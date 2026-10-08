-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — une annonce par bien : détection des doublons
--
--   photos_annonce.empreinte  empreinte de chaque photo (16 caractères), calculée dans le navigateur à l'envoi :
--                             deux photos presque identiques (même redimensionnée ou recompressée) ont des
--                             empreintes proches ; empreintes_proches() les compare
--   annonces_effacees         trace, pendant 30 jours, des annonces supprimées par leur auteur (caractéristiques et
--                             empreintes, sans coordonnées) : supprimer puis republier le même bien se voit
--   biens_semblables()        même type, transaction, commune (et quartier s'il est connu des deux côtés), même unité
--                             du loyer, prix à 10 % près, mêmes pièces, surface à 15 % près, même étage
--   annonces_semblables()     à l'envoi d'une annonce : ses autres annonces qui y ressemblent (caractéristiques ou
--                             photos) : en ligne, en vérification, refusées ou retirées depuis moins de 30 jours,
--                             supprimées depuis moins de 30 jours ; jamais celles des autres
--   admin_a_verifier()        + « doublons » : annonces semblables du même auteur ; photos déjà utilisées par un autre
--                             annonceur ; nombre d'annonces en double déjà refusées à l'auteur
--   moderer_annonce(), traiter_signalements()   + refus ou retrait « pour doublon », compté sur le compte : l'e-mail
--                             avertit au 2e ; au 3e, l'équipe suspend le compte (onglet À vérifier)
-- ════════════════════════════════════════════════════════════════════════════

-- ══ Empreintes des photos ══
alter table public.photos_annonce add column empreinte text
  constraint photos_annonce_empreinte check (empreinte is null or empreinte ~ '^[0-9a-f]{16}$');
comment on column public.photos_annonce.empreinte is
  'Empreinte de la photo (64 bits en hexadécimal, calculée à l''envoi) : deux photos presque identiques ont des empreintes proches';

-- Deux empreintes de la même photo : 6 bits différents au plus sur 64. Une image presque unie (mur blanc, photo
-- noire) donne une empreinte peu fiable : jamais comparée.
create function public.empreintes_proches(a text, b text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when a is null or b is null or a !~ '^[0-9a-f]{16}$' or b !~ '^[0-9a-f]{16}$' then false
    when bit_count(('x' || a)::bit(64)) not between 8 and 56 then false
    else bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64)) <= 6
  end
$$;

-- ══ Biens semblables ══
-- a et b : une annonce (to_jsonb) ou ce que le formulaire va envoyer, avec les mêmes noms de champs
create function public.biens_semblables(a jsonb, b jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    a ->> 'type_bien' = b ->> 'type_bien'
    and a ->> 'transaction' = b ->> 'transaction'
    and (a ->> 'commune_id')::integer = (b ->> 'commune_id')::integer
    and (a ->> 'quartier_id' is null or b ->> 'quartier_id' is null
         or (a ->> 'quartier_id')::integer = (b ->> 'quartier_id')::integer)
    and (a ->> 'loyer_par') is not distinct from (b ->> 'loyer_par')
    and abs((a ->> 'prix')::numeric - (b ->> 'prix')::numeric) * 10 <= greatest((a ->> 'prix')::numeric, (b ->> 'prix')::numeric)
    and ((a ->> 'pieces')::integer) is not distinct from ((b ->> 'pieces')::integer)
    and (a ->> 'surface' is null or b ->> 'surface' is null
         or abs((a ->> 'surface')::numeric - (b ->> 'surface')::numeric) * 100
            <= 15 * greatest((a ->> 'surface')::numeric, (b ->> 'surface')::numeric))
    and (a ->> 'etage' is null or b ->> 'etage' is null or (a ->> 'etage')::integer = (b ->> 'etage')::integer),
    false)
$$;

-- Ce qu'on garde d'une annonce pour la comparer (rien de personnel : ni description, ni adresse, ni contact)
create function public.bien_comparable(j jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('type_bien', j -> 'type_bien', 'transaction', j -> 'transaction', 'commune_id', j -> 'commune_id',
    'quartier_id', j -> 'quartier_id', 'quartier_texte', j -> 'quartier_texte', 'prix', j -> 'prix', 'loyer_par', j -> 'loyer_par',
    'pieces', j -> 'pieces', 'surface', j -> 'surface', 'etage', j -> 'etage')
$$;

-- ══ Annonces supprimées : trace de 30 jours ══
create table public.annonces_effacees (
  id uuid primary key,                       -- l'identifiant qu'avait l'annonce
  auteur_id uuid not null,
  reference text not null,
  titre text not null,
  statut text not null,                      -- son statut au moment de la suppression
  bien jsonb not null,                       -- bien_comparable()
  empreintes text[] not null default '{}',   -- empreintes de ses photos
  efface_le timestamptz not null default now()
);
create index annonces_effacees_auteur on public.annonces_effacees (auteur_id, efface_le desc);
comment on table public.annonces_effacees is
  'Annonces supprimées par leur auteur, gardées 30 jours pour repérer un bien republié (lues seulement par les fonctions)';
alter table public.annonces_effacees enable row level security;
revoke all on public.annonces_effacees from public, anon, authenticated;

-- Avant la suppression (les photos sont encore là) ; les traces de plus de 30 jours partent au passage.
-- Un brouillon n'a jamais été vu : pas de trace.
create function public.annonces_garder_trace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.annonces_effacees where efface_le < now() - interval '30 days';
  if old.statut <> 'brouillon' then
    insert into public.annonces_effacees (id, auteur_id, reference, titre, statut, bien, empreintes)
    values (old.id, old.auteur_id, old.reference, old.titre, old.statut::text, public.bien_comparable(to_jsonb(old)),
            coalesce((select array_agg(ph.empreinte order by ph.ordre, ph.cree_le) from public.photos_annonce ph
                       where ph.annonce_id = old.id and ph.empreinte is not null), '{}'))
    on conflict (id) do nothing;
  end if;
  return old;
end $$;
create trigger annonces_garder_trace before delete on public.annonces
  for each row execute function public.annonces_garder_trace();

-- ══ Annonces semblables d'un auteur ══
-- Ses annonces (sauf l'annonce « sauf ») qui ressemblent au bien cherché, par leurs caractéristiques ou leurs photos ;
-- les plus proches d'abord, 5 au plus. Usage interne : annonces_semblables() pour l'auteur, admin_a_verifier() pour l'équipe.
create function public.semblables(auteur_cherche uuid, bien_cherche jsonb, empreintes_cherchees text[], sauf uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with siennes as (
    select a.id, a.reference, a.titre, a.statut::text as statut, a.statut = 'publiee' and a.expire_le <= now() as expiree,
           to_jsonb(a) as b, a.cree_le as le, a.publiee_le, null::timestamptz as efface_le,
           (select ph.chemin from public.photos_annonce ph where ph.annonce_id = a.id order by ph.ordre, ph.cree_le limit 1) as photo,
           coalesce((select array_agg(ph.empreinte) from public.photos_annonce ph
                      where ph.annonce_id = a.id and ph.empreinte is not null), '{}') as e
      from public.annonces a
     where a.auteur_id = auteur_cherche and a.id is distinct from sauf
       and (a.statut in ('en_attente', 'publiee')
            or (a.statut in ('refusee', 'archivee') and a.modifie_le > now() - interval '30 days'))
    union all
    select t.id, t.reference, t.titre, 'effacee', false, t.bien, null, null, t.efface_le, null, t.empreintes
      from public.annonces_effacees t
     where t.auteur_id = auteur_cherche and t.id is distinct from sauf and t.efface_le > now() - interval '30 days'
  ), notees as (
    select s.*, public.biens_semblables(s.b, bien_cherche) as caracteristiques,
           (select count(*) from unnest(coalesce(empreintes_cherchees, '{}')) x
             where exists (select 1 from unnest(s.e) y where public.empreintes_proches(x, y)))::integer as photos
      from siennes s
  )
  select coalesce(jsonb_agg(z.x), '[]') from (
    select jsonb_build_object(
             'id', case when n.statut = 'effacee' then null else n.id end, 'reference', n.reference, 'titre', n.titre,
             'statut', n.statut, 'expiree', n.expiree,
             'prix', (n.b ->> 'prix')::bigint, 'loyer_par', n.b ->> 'loyer_par', 'type_bien', n.b ->> 'type_bien',
             'transaction', n.b ->> 'transaction', 'commune', c.nom, 'quartier', coalesce(q.nom, n.b ->> 'quartier_texte'),
             'pieces', (n.b ->> 'pieces')::integer, 'surface', (n.b ->> 'surface')::numeric, 'etage', (n.b ->> 'etage')::integer,
             'photo', n.photo, 'cree_le', n.le, 'publiee_le', n.publiee_le, 'efface_le', n.efface_le,
             'caracteristiques', n.caracteristiques, 'photos', n.photos) as x
      from notees n
      left join public.communes c on c.id = (n.b ->> 'commune_id')::integer
      left join public.quartiers q on q.id = (n.b ->> 'quartier_id')::integer
     where n.caracteristiques or n.photos > 0
     order by n.photos desc, coalesce(n.le, n.efface_le) desc
     limit 5
  ) z
$$;

-- À l'envoi d'une annonce (bouton « Envoyer pour vérification ») : ses autres annonces qui y ressemblent.
-- bien : les champs du formulaire (type_bien, transaction, commune_id, quartier_id, prix, loyer_par, pieces, surface,
-- etage) ; empreintes : celles de ses photos ; sauf : l'annonce elle-même si elle est déjà enregistrée.
create function public.annonces_semblables(bien jsonb, empreintes text[] default '{}', sauf uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour publier une annonce.' using errcode = '42501';
  end if;
  return public.semblables(auth.uid(), bien, coalesce(empreintes[1:20], '{}'), sauf);
end $$;

-- Photos d'une annonce déjà utilisées dans l'annonce d'un autre annonceur (photos volées, comptes multiples)
create function public.photos_ailleurs(cible uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(z.x), '[]') from (
    select jsonb_build_object('id', o.id, 'reference', o.reference, 'titre', o.titre, 'statut', o.statut,
             'auteur', coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), 'Sans nom'),
             'paires', jsonb_agg(jsonb_build_object('ma_photo', m.chemin, 'sa_photo', ph.chemin) order by m.ordre, ph.ordre)) as x
      from public.annonces a
      join public.photos_annonce m on m.annonce_id = a.id and m.empreinte is not null
      join public.photos_annonce ph on ph.annonce_id <> a.id and public.empreintes_proches(m.empreinte, ph.empreinte)
      join public.annonces o on o.id = ph.annonce_id and o.auteur_id <> a.auteur_id and o.statut <> 'brouillon'
      left join public.profils p on p.id = o.auteur_id
     where a.id = cible
     group by o.id, o.reference, o.titre, o.statut, p.prenom, p.nom
     order by o.reference
     limit 5
  ) z
$$;

-- ══ Refus pour doublon : compté sur le compte ══
alter table public.moderations
  add column auteur_id uuid references public.profils on delete set null,
  add column doublon boolean not null default false;
update public.moderations m set auteur_id = a.auteur_id from public.annonces a where a.id = m.annonce_id;
create index moderations_doublons on public.moderations (auteur_id) where doublon;
comment on column public.moderations.doublon is 'Refus ou retrait pour annonce en double (compté pour les avertissements)';

drop function public.traiter_signalements(uuid, text, text);
drop function public.moderer_annonce(uuid, text, text);

create function public.moderer_annonce(annonce uuid, decision text, motif text default null, doublon boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  raison text := nullif(btrim(coalesce(motif, '')), '');
  pour_doublon boolean := coalesce(doublon, false);
  doublons integer := 0;
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
    pour_doublon := false;
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

  insert into public.moderations (annonce_id, reference, titre, admin_id, decision, motif, auteur_id, doublon)
  values (annonce, a.reference, a.titre, auth.uid(), resultat, raison, a.auteur_id, pour_doublon);
  if pour_doublon then
    select count(*) into doublons from public.moderations m where m.auteur_id = a.auteur_id and m.doublon;
  end if;

  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'moderation', a.auteur_id, 'moderation:' || a.id, jsonb_build_object(
           'decision', resultat, 'motif', raison, 'reverification', reverification,
           'doublon', pour_doublon, 'doublons', doublons,
           'annonce', jsonb_build_object('id', a.id, 'titre', a.titre, 'reference', a.reference))
  from public.profils p where p.id = a.auteur_id and p.emails_annonces;
end $$;

-- Signalements d'une annonce : la retirer (avec un motif, éventuellement pour doublon), ou les classer
create function public.traiter_signalements(annonce uuid, decision text, motif text default null, doublon boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
begin
  perform public.exiger_admin();
  if decision = 'retirer' then
    perform public.moderer_annonce(annonce, 'retirer', motif, doublon);
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
    insert into public.moderations (annonce_id, reference, titre, admin_id, decision, motif, auteur_id)
    values (annonce, a.reference, a.titre, auth.uid(), 'classee', nullif(btrim(coalesce(motif, '')), ''), a.auteur_id);
  else
    raise exception 'Décision inconnue : %', decision using errcode = '22023';
  end if;
end $$;

-- ══ Ce que voit l'équipe : la file « À vérifier », avec les doublons possibles ══
create or replace function public.admin_a_verifier() returns jsonb
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
      'doublons', jsonb_build_object(
        'semblables', public.semblables(a.auteur_id, to_jsonb(a),
          coalesce((select array_agg(ph.empreinte) from public.photos_annonce ph where ph.annonce_id = a.id and ph.empreinte is not null), '{}'),
          a.id),
        'photos_ailleurs', public.photos_ailleurs(a.id)),
      'auteur', jsonb_build_object(
        'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'email', u.email, 'telephone', p.telephone, 'role', p.role,
        'agence', ag.nom, 'inscrit_le', p.cree_le,
        'en_ligne', (select count(*) from public.annonces o where o.auteur_id = a.auteur_id and o.statut = 'publiee'
                       and (o.expire_le is null or o.expire_le > now())),
        'refusees', (select count(*) from public.moderations m join public.annonces o on o.id = m.annonce_id
                      where o.auteur_id = a.auteur_id and m.decision in ('refusee', 'retiree')),
        'doublons_refuses', (select count(*) from public.moderations m where m.auteur_id = a.auteur_id and m.doublon)))
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

-- ══ Droits ══
revoke execute on function public.annonces_garder_trace(), public.semblables(uuid, jsonb, text[], uuid),
  public.photos_ailleurs(uuid) from public, anon, authenticated;
revoke execute on function public.annonces_semblables(jsonb, text[], uuid) from public, anon;
grant execute on function public.annonces_semblables(jsonb, text[], uuid) to authenticated;
revoke execute on function public.moderer_annonce(uuid, text, text, boolean), public.traiter_signalements(uuid, text, text, boolean) from public;
grant execute on function public.moderer_annonce(uuid, text, text, boolean), public.traiter_signalements(uuid, text, text, boolean)
  to authenticated;
