-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 7, 1re partie : modération des annonces et signalements (espace Administration, /admin)
--
--   signalements          « Signaler cette annonce » sur la fiche, avec ou sans compte : arnaque, plus disponible,
--                         photos trompeuses, prix faux, doublon, autre ; lus seulement par l'équipe
--   moderations           journal des décisions de l'équipe (qui, quoi, quand, pourquoi)
--   signaler_annonce()    une annonce en ligne, pas la sienne ; un signalement en cours par compte et par annonce
--   moderer_annonce()     publier ou refuser (avec un motif) une annonce en attente ; retirer une annonce en ligne
--                         (avec un motif) ; une annonce revérifiée garde ses dates ; e-mail à l'annonceur
--   traiter_signalements() retirer l'annonce signalée, ou classer les signalements
--   admin_tableau(), admin_a_verifier(), admin_signalements(), admin_journal()   ce que voit l'équipe
--   compteurs()           + « moderation » pour l'équipe : annonces à vérifier et annonces signalées
-- Tout ce qui est réservé à l'équipe vérifie compte_admin() (profil « admin ») : un autre compte est refusé.
-- ════════════════════════════════════════════════════════════════════════════

create table public.signalements (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  auteur_id uuid references public.profils on delete set null,
  motif text not null check (motif in ('arnaque', 'indisponible', 'photos', 'prix', 'doublon', 'autre')),
  message text constraint signalements_message_longueur check (message is null or char_length(message) <= 1000),
  statut text not null default 'a_traiter' check (statut in ('a_traiter', 'retiree', 'classe')),
  traite_par uuid references public.profils on delete set null,
  traite_le timestamptz,
  cree_le timestamptz not null default now()
);
create index signalements_annonce on public.signalements (annonce_id, statut);
comment on table public.signalements is 'Annonces signalées par les visiteurs ; lues et traitées par l''équipe (admin_signalements)';

create table public.moderations (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid references public.annonces on delete set null,
  reference text not null,
  titre text not null,
  admin_id uuid references public.profils on delete set null,
  decision text not null check (decision in ('publiee', 'refusee', 'retiree', 'classee')),
  motif text,
  cree_le timestamptz not null default now()
);
create index moderations_cree_le on public.moderations (cree_le desc);
comment on table public.moderations is 'Journal des décisions de l''équipe sur les annonces';

-- Aucune lecture ni écriture directe : seulement par les fonctions ci-dessous
alter table public.signalements enable row level security;
alter table public.moderations enable row level security;
revoke all on public.signalements, public.moderations from public, anon, authenticated;

-- E-mail à l'annonceur : son annonce est en ligne, refusée ou retirée
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check
    check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce', 'moderation'));

-- Réservé à l'équipe (compte « admin »)
create function public.exiger_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.compte_admin() then
    raise exception 'Réservé à l''équipe 360-Immo.ci.' using errcode = '42501';
  end if;
end $$;


-- ══ Signaler une annonce (avec ou sans compte) ══
create function public.signaler_annonce(annonce uuid, motif text, message text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  texte text := nullif(btrim(coalesce(message, '')), '');
begin
  select * into a from public.annonces x
   where x.id = annonce and x.statut = 'publiee' and (x.expire_le is null or x.expire_le > now());
  if a.id is null then
    raise exception 'Cette annonce n''est plus en ligne.' using errcode = 'P0001';
  end if;
  if a.auteur_id = auth.uid() then
    raise exception 'C''est votre annonce : modifiez-la ou retirez-la dans Mon Espace → Mes annonces.' using errcode = 'P0001';
  end if;
  if motif is null or motif not in ('arnaque', 'indisponible', 'photos', 'prix', 'doublon', 'autre') then
    raise exception 'Choisissez la raison du signalement.' using errcode = 'P0001';
  end if;
  if motif = 'autre' and char_length(coalesce(texte, '')) < 10 then
    raise exception 'Dites en quelques mots ce qui ne va pas.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(texte, '')) > 1000 then
    raise exception 'Message trop long (1 000 caractères au plus).' using errcode = 'P0001';
  end if;
  if auth.uid() is not null and exists (select 1 from public.signalements s
       where s.annonce_id = annonce and s.auteur_id = auth.uid() and s.statut = 'a_traiter') then
    raise exception 'Vous avez déjà signalé cette annonce : l''équipe s''en occupe.' using errcode = 'P0001';
  end if;
  -- Sans compte : au-delà de 20 signalements en attente, l'équipe est déjà prévenue
  if (select count(*) from public.signalements s where s.annonce_id = annonce and s.statut = 'a_traiter') >= 20 then
    return;
  end if;
  insert into public.signalements (annonce_id, auteur_id, motif, message)
  values (annonce, auth.uid(), signaler_annonce.motif, texte);
end $$;


-- ══ Décisions de l'équipe ══
create function public.moderer_annonce(annonce uuid, decision text, motif text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  raison text := nullif(btrim(coalesce(motif, '')), '');
  resultat text;
  reverification boolean;
begin
  perform public.exiger_admin();
  select * into a from public.annonces x where x.id = annonce for update;
  if a.id is null then
    raise exception 'Annonce introuvable.' using errcode = 'P0001';
  end if;
  if decision = 'publier' then
    if a.statut <> 'en_attente' then
      raise exception 'Cette annonce n''est plus en attente de vérification.' using errcode = 'P0001';
    end if;
    -- Une annonce déjà publiée puis modifiée garde ses dates (pas de « nouvelle » annonce, pas de jours offerts)
    reverification := a.publiee_le is not null and a.expire_le > now();
    update public.annonces set statut = 'publiee', motif_refus = null where id = annonce;
    if reverification then
      update public.annonces set publiee_le = a.publiee_le, expire_le = a.expire_le where id = annonce;
    end if;
    resultat := 'publiee';
    raison := null;
  elsif decision in ('refuser', 'retirer') then
    if raison is null or char_length(raison) < 5 then
      raise exception 'Écrivez le motif : l''annonceur le lira pour corriger son annonce.' using errcode = 'P0001';
    end if;
    if char_length(raison) > 500 then
      raise exception 'Motif trop long (500 caractères au plus).' using errcode = 'P0001';
    end if;
    if decision = 'refuser' and a.statut <> 'en_attente' then
      raise exception 'Cette annonce n''est plus en attente de vérification.' using errcode = 'P0001';
    end if;
    if decision = 'retirer' and a.statut <> 'publiee' then
      raise exception 'Cette annonce n''est pas en ligne.' using errcode = 'P0001';
    end if;
    update public.annonces set statut = 'refusee', motif_refus = raison where id = annonce;
    resultat := case decision when 'refuser' then 'refusee' else 'retiree' end;
    reverification := false;
    -- Les signalements en attente sont réglés avec elle
    update public.signalements set statut = 'retiree', traite_par = auth.uid(), traite_le = now()
     where annonce_id = annonce and statut = 'a_traiter';
  else
    raise exception 'Décision inconnue : %', decision using errcode = '22023';
  end if;

  insert into public.moderations (annonce_id, reference, titre, admin_id, decision, motif)
  values (annonce, a.reference, a.titre, auth.uid(), resultat, raison);

  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'moderation', a.auteur_id, 'moderation:' || a.id, jsonb_build_object(
           'decision', resultat, 'motif', raison, 'reverification', reverification,
           'annonce', jsonb_build_object('id', a.id, 'titre', a.titre, 'reference', a.reference))
  from public.profils p where p.id = a.auteur_id and p.emails_annonces;
end $$;

-- Signalements d'une annonce : la retirer (avec un motif), ou les classer (rien à reprocher)
create function public.traiter_signalements(annonce uuid, decision text, motif text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
begin
  perform public.exiger_admin();
  if decision = 'retirer' then
    perform public.moderer_annonce(annonce, 'retirer', motif);
  elsif decision = 'classer' then
    select * into a from public.annonces x where x.id = annonce;
    if a.id is null then
      raise exception 'Annonce introuvable.' using errcode = 'P0001';
    end if;
    update public.signalements set statut = 'classe', traite_par = auth.uid(), traite_le = now()
     where annonce_id = annonce and statut = 'a_traiter';
    if not found then
      raise exception 'Plus de signalement en attente pour cette annonce.' using errcode = 'P0001';
    end if;
    insert into public.moderations (annonce_id, reference, titre, admin_id, decision, motif)
    values (annonce, a.reference, a.titre, auth.uid(), 'classee', nullif(btrim(coalesce(motif, '')), ''));
  else
    raise exception 'Décision inconnue : %', decision using errcode = '22023';
  end if;
end $$;


-- ══ Ce que voit l'équipe ══

-- Tableau de bord : annonces, signalements, comptes, activité des 7 derniers jours
create function public.admin_tableau() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'a_verifier', (select count(*) from public.annonces where statut = 'en_attente'),
    'a_reverifier', (select count(*) from public.annonces where statut = 'en_attente' and publiee_le is not null),
    'signalees', (select count(distinct annonce_id) from public.signalements where statut = 'a_traiter'),
    'en_ligne', (select count(*) from public.annonces where statut = 'publiee' and (expire_le is null or expire_le > now())),
    'expirees', (select count(*) from public.annonces where statut = 'publiee' and expire_le <= now()),
    'refusees', (select count(*) from public.annonces where statut = 'refusee'),
    'brouillons', (select count(*) from public.annonces where statut = 'brouillon'),
    'comptes', (select count(*) from public.profils),
    'agences', (select count(*) from public.profils where role = 'agence' or agence_id is not null),
    'demandes_agence', (select count(*) from public.profils where demande_agence is not null and role = 'particulier'),
    'semaine', jsonb_build_object(
      'inscriptions', (select count(*) from public.profils where cree_le > now() - interval '7 days'),
      'annonces', (select count(*) from public.annonces where statut <> 'brouillon' and cree_le > now() - interval '7 days'),
      'publiees', (select count(*) from public.moderations where decision = 'publiee' and cree_le > now() - interval '7 days'),
      'refusees', (select count(*) from public.moderations where decision in ('refusee', 'retiree') and cree_le > now() - interval '7 days'),
      'signalements', (select count(*) from public.signalements where cree_le > now() - interval '7 days'))
  );
end $$;

-- Les annonces à vérifier, les plus anciennes d'abord, avec tout ce qu'il faut pour décider
create function public.admin_a_verifier() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'reference', a.reference, 'titre', a.titre, 'description', a.description,
      'transaction', a.transaction, 'type_bien', a.type_bien, 'type_nom', t.nom,
      'prix', a.prix, 'loyer_par', a.loyer_par, 'caution_mois', a.caution_mois,
      'ville', v.nom, 'commune', c.nom, 'quartier', coalesce(q.nom, a.quartier_texte), 'quartier_hors_liste', a.quartier_texte is not null,
      'adresse', a.adresse, 'surface', a.surface, 'pieces', a.pieces, 'studio', a.studio, 'chambres', a.chambres,
      'sanitaires', a.sanitaires, 'meuble', a.meuble, 'dans_immeuble', a.dans_immeuble, 'etage', a.etage, 'commodites', a.commodites,
      'type_vendeur', a.type_vendeur, 'contact_nom', a.contact_nom, 'contact_telephone', a.contact_telephone,
      'contact_whatsapp', a.contact_whatsapp, 'contact_telephone2', a.contact_telephone2,
      'contact_telephone2_whatsapp', a.contact_telephone2_whatsapp, 'contact_email', a.contact_email,
      'photos', coalesce((select jsonb_agg(ph.chemin order by ph.ordre, ph.cree_le) from public.photos_annonce ph where ph.annonce_id = a.id), '[]'),
      'cree_le', a.cree_le, 'modifie_le', a.modifie_le, 'publiee_le', a.publiee_le, 'expire_le', a.expire_le,
      'signalements', (select count(*) from public.signalements s where s.annonce_id = a.id and s.statut = 'a_traiter'),
      'derniere_decision', (select jsonb_build_object('decision', m.decision, 'motif', m.motif, 'le', m.cree_le)
                              from public.moderations m where m.annonce_id = a.id order by m.cree_le desc limit 1),
      'auteur', jsonb_build_object(
        'prenom', p.prenom, 'nom', p.nom, 'email', u.email, 'telephone', p.telephone, 'role', p.role,
        'agence', ag.nom, 'inscrit_le', p.cree_le,
        'en_ligne', (select count(*) from public.annonces o where o.auteur_id = a.auteur_id and o.statut = 'publiee'
                       and (o.expire_le is null or o.expire_le > now())),
        'refusees', (select count(*) from public.moderations m join public.annonces o on o.id = m.annonce_id
                      where o.auteur_id = a.auteur_id and m.decision in ('refusee', 'retiree'))))
      order by a.modifie_le, a.cree_le)
    from public.annonces a
    join public.types_bien t on t.cle = a.type_bien
    join public.villes v on v.id = a.ville_id
    join public.communes c on c.id = a.commune_id
    left join public.quartiers q on q.id = a.quartier_id
    join public.profils p on p.id = a.auteur_id
    left join auth.users u on u.id = p.id
    left join public.agences ag on ag.id = p.agence_id
    where a.statut = 'en_attente'
  ), '[]');
end $$;

-- Les annonces signalées (signalements en attente), les plus signalées d'abord
create function public.admin_signalements() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(x.ligne order by x.nombre desc, x.premier)
    from (
      select count(*) as nombre, min(s.cree_le) as premier, jsonb_build_object(
        'annonce', jsonb_build_object(
          'id', a.id, 'reference', a.reference, 'titre', a.titre, 'statut', a.statut,
          'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()),
          'prix', a.prix, 'loyer_par', a.loyer_par, 'commune', c.nom,
          'photo', (select ph.chemin from public.photos_annonce ph where ph.annonce_id = a.id order by ph.ordre, ph.cree_le limit 1),
          'annonceur', public.nom_vitrine(p.prenom, p.nom, ag.nom), 'contact_telephone', a.contact_telephone),
        'nombre', count(*),
        'signalements', jsonb_agg(jsonb_build_object('motif', s.motif, 'message', s.message, 'le', s.cree_le,
                                                     'avec_compte', s.auteur_id is not null) order by s.cree_le)) as ligne
      from public.signalements s
      join public.annonces a on a.id = s.annonce_id
      join public.communes c on c.id = a.commune_id
      join public.profils p on p.id = a.auteur_id
      left join public.agences ag on ag.id = p.agence_id
      where s.statut = 'a_traiter'
      group by a.id, c.nom, p.prenom, p.nom, ag.nom
    ) x
  ), '[]');
end $$;

-- Les dernières décisions de l'équipe
create function public.admin_journal(nombre integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'decision', m.decision, 'motif', m.motif, 'le', m.cree_le, 'reference', m.reference, 'titre', m.titre,
      'annonce_id', m.annonce_id, 'par', nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''))
      order by m.cree_le desc)
    from (select * from public.moderations order by cree_le desc limit greatest(1, least(coalesce(nombre, 50), 200))) m
    left join public.profils p on p.id = m.admin_id
  ), '[]');
end $$;

-- Compteurs du site (complète la version des rappels) : pour l'équipe, annonces à vérifier et annonces signalées
create or replace function public.compteurs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
                  where auth.uid() in (c.client_id, c.annonceur_id) and m.auteur_id <> auth.uid() and m.lu_le is null),
    'visites', (select count(*) from public.visites v join public.annonces a on a.id = v.annonce_id
                 where v.statut = 'demandee' and v.creneau > now()
                   and ((a.auteur_id = auth.uid() and v.creneau_propose is null)
                        or (v.demandeur_id = auth.uid() and v.creneau_propose is not null))),
    'rappels', (select count(*) from public.rappels r join public.annonces a on a.id = r.annonce_id
                 where a.auteur_id = auth.uid() and r.statut = 'a_rappeler' and r.cree_le > now() - interval '30 days'),
    'moderation', case when public.compte_admin() then
                    (select count(*) from public.annonces where statut = 'en_attente')
                    + (select count(distinct annonce_id) from public.signalements where statut = 'a_traiter')
                  else 0 end);
$$;

revoke execute on function public.exiger_admin(), public.signaler_annonce(uuid, text, text),
  public.moderer_annonce(uuid, text, text), public.traiter_signalements(uuid, text, text), public.admin_tableau(),
  public.admin_a_verifier(), public.admin_signalements(), public.admin_journal(integer) from public;
grant execute on function public.signaler_annonce(uuid, text, text) to anon, authenticated;
grant execute on function public.moderer_annonce(uuid, text, text), public.traiter_signalements(uuid, text, text),
  public.admin_tableau(), public.admin_a_verifier(), public.admin_signalements(), public.admin_journal(integer)
  to authenticated;
