-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 7, 2e partie : équipe, comptes et agences (espace Administration)
--
--   Équipe     admin_equipe(), changer_acces_admin() : donner ou retirer l'accès administrateur depuis le site
--              (jamais le sien : l'équipe n'est jamais sans administrateur) ; e-mail au nouvel administrateur
--   Comptes    admin_chercher_comptes() : par e-mail, nom ou téléphone ; suspendre_compte() (avec un motif : ses
--              annonces sont retirées, il ne peut plus publier, écrire, demander une visite ou un rappel, créer une
--              alerte), reactiver_compte() ; e-mail à la personne
--   Agences    admin_demandes_agence(), valider_agence() (nouvelle agence ou rattachement à une agence existante :
--              le compte devient « agence »), refuser_agence() (avec un motif), admin_agences(), modifier_agence()
--              (nom, téléphone, e-mail, badge « vérifiée »)
--   Accueil    agences_partenaires() : agences vérifiées avec des annonces en ligne
--   Journal    actions_equipe (qui a fait quoi, sur quel compte ou quelle agence) ; admin_journal() réunit annonces
--              et comptes
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profils
  add column suspendu_le timestamptz,
  add column suspension_motif text constraint suspension_motif_longueur check (suspension_motif is null or char_length(suspension_motif) <= 500);

create table public.actions_equipe (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profils on delete set null,
  compte_id uuid references public.profils on delete set null,
  agence_id uuid references public.agences on delete set null,
  action text not null check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
                                         'agence_validee', 'agence_refusee', 'agence_modifiee')),
  cible text not null,     -- la personne ou l'agence, gardée même si elle disparaît
  detail text,             -- motif, agence, changements
  cree_le timestamptz not null default now()
);
create index actions_equipe_cree_le on public.actions_equipe (cree_le desc);
comment on table public.actions_equipe is 'Journal des actions de l''équipe sur les comptes et les agences';
alter table public.actions_equipe enable row level security;
revoke all on public.actions_equipe from public, anon, authenticated;

-- E-mails liés au compte : agence validée ou refusée, compte suspendu ou réactivé, accès administrateur
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check
    check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce', 'moderation', 'compte'));

-- La suspension ne se change pas soi-même (complète la version des vitrines)
create or replace function public.profils_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.role := old.role;
    new.agence_id := old.agence_id;
    new.demande_agence_le := old.demande_agence_le;
    new.code_vitrine := old.code_vitrine;
    new.suspendu_le := old.suspendu_le;
    new.suspension_motif := old.suspension_motif;
  end if;
  if new.demande_agence is distinct from old.demande_agence then
    new.demande_agence := nullif(btrim(new.demande_agence), '');
    new.demande_agence_le := case when new.demande_agence is null then null else now() end;
  end if;
  new.id := old.id;
  return new;
end $$;

-- ══ Compte suspendu : rien de nouveau ══
create function public.compte_suspendu() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = auth.uid() and suspendu_le is not null);
$$;

create function public.bloquer_compte_suspendu() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.compte_suspendu() then
    -- annonces : seulement les siennes (une vue comptée sur l'annonce d'un autre ne gêne pas)
    if tg_table_name = 'annonces' then
      if new.auteur_id = auth.uid() then
        raise exception 'Votre compte est suspendu par l''équipe 360-Immo.ci : cette action n''est pas possible.' using errcode = 'P0001';
      end if;
    else
      raise exception 'Votre compte est suspendu par l''équipe 360-Immo.ci : cette action n''est pas possible.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger annonces_compte_suspendu before insert or update on public.annonces
  for each row execute function public.bloquer_compte_suspendu();
create trigger conversations_compte_suspendu before insert on public.conversations
  for each row execute function public.bloquer_compte_suspendu();
create trigger messages_compte_suspendu before insert on public.messages
  for each row execute function public.bloquer_compte_suspendu();
create trigger visites_compte_suspendu before insert on public.visites
  for each row execute function public.bloquer_compte_suspendu();
create trigger rappels_compte_suspendu before insert on public.rappels
  for each row execute function public.bloquer_compte_suspendu();
create trigger alertes_compte_suspendu before insert on public.alertes
  for each row execute function public.bloquer_compte_suspendu();


-- ══ Outils ══
create function public.nom_complet(p public.profils) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), 'Sans nom');
$$;

create function public.noter_action_equipe(action text, compte uuid, agence uuid, cible text, detail text) returns void
language sql security definer set search_path = '' as $$
  insert into public.actions_equipe (admin_id, compte_id, agence_id, action, cible, detail)
  values (auth.uid(), compte, agence, action, cible, detail);
$$;

create function public.prevenir_compte(compte uuid, evenement text, donnees jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (modele, profil_id, cle, donnees)
  values ('compte', compte, 'compte:' || evenement || ':' || compte, donnees || jsonb_build_object('evenement', evenement));
$$;

-- Un compte, tel que l'équipe le voit
create function public.fiche_compte(p public.profils) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'email', (select u.email from auth.users u where u.id = p.id),
    'telephone', p.telephone, 'role', p.role, 'agence', (select ag.nom from public.agences ag where ag.id = p.agence_id),
    'demande_agence', p.demande_agence, 'suspendu_le', p.suspendu_le, 'suspension_motif', p.suspension_motif,
    'inscrit_le', p.cree_le, 'moi', p.id = auth.uid(),
    'annonces_en_ligne', (select count(*) from public.annonces a where a.auteur_id = p.id and a.statut = 'publiee'
                            and (a.expire_le is null or a.expire_le > now())),
    'annonces', (select count(*) from public.annonces a where a.auteur_id = p.id and a.statut <> 'brouillon'),
    'refus', (select count(*) from public.moderations m join public.annonces a on a.id = m.annonce_id
               where a.auteur_id = p.id and m.decision in ('refusee', 'retiree')),
    'signalements', (select count(*) from public.signalements s join public.annonces a on a.id = s.annonce_id where a.auteur_id = p.id));
$$;


-- ══ Équipe ══
create function public.admin_equipe() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(public.fiche_compte(p) || jsonb_build_object(
             'depuis', (select max(x.cree_le) from public.actions_equipe x where x.compte_id = p.id and x.action = 'admin_donne'))
           order by p.id <> auth.uid(), p.prenom, p.nom)
    from public.profils p where p.role = 'admin'
  ), '[]');
end $$;

create function public.changer_acces_admin(compte uuid, donner boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
begin
  perform public.exiger_admin();
  if compte = auth.uid() then
    raise exception 'Vous ne pouvez pas changer votre propre accès : demandez à un autre membre de l''équipe.' using errcode = 'P0001';
  end if;
  select * into p from public.profils where id = compte for update;
  if p.id is null then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  if donner then
    if p.role = 'admin' then
      raise exception 'Ce compte est déjà administrateur.' using errcode = 'P0001';
    end if;
    if p.suspendu_le is not null then
      raise exception 'Ce compte est suspendu : réactivez-le d''abord.' using errcode = 'P0001';
    end if;
    update public.profils set role = 'admin' where id = compte;
    perform public.noter_action_equipe('admin_donne', compte, null, public.nom_complet(p), null);
    perform public.prevenir_compte(compte, 'admin_donne');
  else
    if p.role <> 'admin' then
      raise exception 'Ce compte n''est pas administrateur.' using errcode = 'P0001';
    end if;
    update public.profils set role = case when agence_id is not null then 'agence'::public.role_profil else 'particulier' end
     where id = compte;
    perform public.noter_action_equipe('admin_retire', compte, null, public.nom_complet(p), null);
  end if;
end $$;


-- ══ Comptes ══
-- Par e-mail, prénom, nom ou téléphone (sans accents) ; rien : les derniers inscrits ; 20 au plus
create function public.admin_chercher_comptes(texte text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t text := public.sans_accents(coalesce(texte, ''));
  chiffres text := regexp_replace(coalesce(texte, ''), '\D', '', 'g');
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(public.fiche_compte(x) order by x.cree_le desc)
    from (
      select p.* from public.profils p
      left join auth.users u on u.id = p.id
      where t = ''
         or position(t in public.sans_accents(coalesce(u.email, ''))) > 0
         or position(t in public.sans_accents(p.prenom || ' ' || p.nom)) > 0
         or position(t in public.sans_accents(p.nom || ' ' || p.prenom)) > 0
         or (char_length(chiffres) >= 4
             and position(chiffres in regexp_replace(coalesce(p.telephone, '') || ' ' || coalesce(p.telephone2, ''), '\D', '', 'g')) > 0)
      order by p.cree_le desc
      limit 20
    ) x
  ), '[]');
end $$;

create function public.suspendre_compte(compte uuid, motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
  raison text := nullif(btrim(coalesce(motif, '')), '');
  a public.annonces;
begin
  perform public.exiger_admin();
  if compte = auth.uid() then
    raise exception 'Vous ne pouvez pas suspendre votre propre compte.' using errcode = 'P0001';
  end if;
  select * into p from public.profils where id = compte for update;
  if p.id is null then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  if p.role = 'admin' then
    raise exception 'Retirez d''abord son accès administrateur (onglet Équipe).' using errcode = 'P0001';
  end if;
  if p.suspendu_le is not null then
    raise exception 'Ce compte est déjà suspendu.' using errcode = 'P0001';
  end if;
  if raison is null or char_length(raison) < 5 then
    raise exception 'Écrivez le motif : la personne le recevra par e-mail.' using errcode = 'P0001';
  end if;
  if char_length(raison) > 500 then
    raise exception 'Motif trop long (500 caractères au plus).' using errcode = 'P0001';
  end if;
  update public.profils set suspendu_le = now(), suspension_motif = raison where id = compte;
  -- Ses annonces en ligne ou en attente sont retirées (avec le motif), au journal
  for a in select * from public.annonces where auteur_id = compte and statut in ('publiee', 'en_attente') loop
    update public.annonces set statut = 'refusee', motif_refus = 'Compte suspendu : ' || raison where id = a.id;
    insert into public.moderations (annonce_id, reference, titre, admin_id, decision, motif)
    values (a.id, a.reference, a.titre, auth.uid(), case when a.statut = 'publiee' then 'retiree' else 'refusee' end,
            'Compte suspendu : ' || raison);
  end loop;
  update public.signalements s set statut = 'retiree', traite_par = auth.uid(), traite_le = now()
    from public.annonces x where x.id = s.annonce_id and x.auteur_id = compte and s.statut = 'a_traiter';
  perform public.noter_action_equipe('compte_suspendu', compte, null, public.nom_complet(p), raison);
  perform public.prevenir_compte(compte, 'suspendu', jsonb_build_object('motif', raison));
end $$;

create function public.reactiver_compte(compte uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
begin
  perform public.exiger_admin();
  select * into p from public.profils where id = compte for update;
  if p.id is null or p.suspendu_le is null then
    raise exception 'Ce compte n''est pas suspendu.' using errcode = 'P0001';
  end if;
  update public.profils set suspendu_le = null, suspension_motif = null where id = compte;
  perform public.noter_action_equipe('compte_reactive', compte, null, public.nom_complet(p), null);
  perform public.prevenir_compte(compte, 'reactive');
end $$;


-- ══ Agences ══
-- Adresse d'une agence (kamika-immobilier), unique
create function public.slug_agence(nom text) returns text
language plpgsql stable set search_path = '' as $$
declare
  base text := coalesce(nullif(btrim(regexp_replace(public.sans_accents(nom), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'agence');
  essai text := base;
  n integer := 1;
begin
  while exists (select 1 from public.agences where slug = essai) loop
    n := n + 1;
    essai := base || '-' || n;
  end loop;
  return essai;
end $$;

create function public.admin_demandes_agence() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(public.fiche_compte(p) || jsonb_build_object(
             'demande_le', p.demande_agence_le,
             -- agences existantes au nom proche : pour rattacher plutôt que créer un doublon
             'semblables', coalesce((select jsonb_agg(jsonb_build_object('id', ag.id, 'nom', ag.nom) order by ag.nom)
                                       from public.agences ag
                                      where position(public.sans_accents(ag.nom) in public.sans_accents(p.demande_agence)) > 0
                                         or position(public.sans_accents(p.demande_agence) in public.sans_accents(ag.nom)) > 0), '[]'))
           order by p.demande_agence_le)
    from public.profils p
    where p.demande_agence is not null and p.role = 'particulier'
  ), '[]');
end $$;

-- Valider : nouvelle agence (nom choisi, ou celui de la demande), ou rattachement à une agence existante
create function public.valider_agence(compte uuid, nom text default null, agence uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
  ag public.agences;
  n text;
begin
  perform public.exiger_admin();
  select * into p from public.profils where id = compte for update;
  if p.id is null then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  if p.suspendu_le is not null then
    raise exception 'Ce compte est suspendu : réactivez-le d''abord.' using errcode = 'P0001';
  end if;
  if agence is not null then
    select * into ag from public.agences where id = agence;
    if ag.id is null then
      raise exception 'Agence introuvable.' using errcode = 'P0001';
    end if;
  else
    n := btrim(coalesce(nullif(btrim(coalesce(nom, '')), ''), p.demande_agence, ''));
    if char_length(n) < 2 or char_length(n) > 120 then
      raise exception 'Indiquez le nom de l''agence (2 à 120 caractères).' using errcode = 'P0001';
    end if;
    insert into public.agences (nom, slug, telephone, email)
    values (n, public.slug_agence(n), p.telephone, (select u.email from auth.users u where u.id = compte))
    returning * into ag;
  end if;
  update public.profils set role = case when role = 'admin' then 'admin'::public.role_profil else 'agence' end,
                            agence_id = ag.id, demande_agence = null
   where id = compte;
  perform public.noter_action_equipe('agence_validee', compte, ag.id, public.nom_complet(p), ag.nom);
  perform public.prevenir_compte(compte, 'agence_validee', jsonb_build_object('agence', ag.nom));
  return ag.id;
end $$;

create function public.refuser_agence(compte uuid, motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
  raison text := nullif(btrim(coalesce(motif, '')), '');
begin
  perform public.exiger_admin();
  select * into p from public.profils where id = compte for update;
  if p.id is null or p.demande_agence is null then
    raise exception 'Plus de demande d''agence pour ce compte.' using errcode = 'P0001';
  end if;
  if raison is null or char_length(raison) < 5 then
    raise exception 'Écrivez le motif : la personne le recevra par e-mail.' using errcode = 'P0001';
  end if;
  update public.profils set demande_agence = null where id = compte;
  perform public.noter_action_equipe('agence_refusee', compte, null, public.nom_complet(p), p.demande_agence || ' : ' || left(raison, 500));
  perform public.prevenir_compte(compte, 'agence_refusee', jsonb_build_object('agence', p.demande_agence, 'motif', left(raison, 500)));
end $$;

create function public.admin_agences() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ag.id, 'nom', ag.nom, 'slug', ag.slug, 'telephone', ag.telephone, 'email', ag.email, 'verifiee', ag.verifiee,
      'cree_le', ag.cree_le,
      'comptes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nom', public.nom_complet(p),
                                                               'email', (select u.email from auth.users u where u.id = p.id))
                                            order by p.cree_le)
                             from public.profils p where p.agence_id = ag.id), '[]'),
      'annonces_en_ligne', (select count(*) from public.annonces a join public.profils p on p.id = a.auteur_id
                             where p.agence_id = ag.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())),
      'vitrine', (select jsonb_build_object('code', p.code_vitrine, 'nom', public.nom_vitrine(p.prenom, p.nom, ag.nom))
                    from public.profils p where p.agence_id = ag.id order by p.cree_le limit 1))
      order by ag.verifiee, ag.nom)
    from public.agences ag
  ), '[]');
end $$;

create function public.modifier_agence(agence uuid, nom text, telephone text, email text, verifiee boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ag public.agences;
  n text := btrim(coalesce(nom, ''));
  tel text := nullif(btrim(coalesce(telephone, '')), '');
  mel text := nullif(lower(btrim(coalesce(email, ''))), '');
  changements text[] := '{}';
begin
  perform public.exiger_admin();
  select * into ag from public.agences where id = agence for update;
  if ag.id is null then
    raise exception 'Agence introuvable.' using errcode = 'P0001';
  end if;
  if char_length(n) < 2 or char_length(n) > 120 then
    raise exception 'Indiquez le nom de l''agence (2 à 120 caractères).' using errcode = 'P0001';
  end if;
  if tel is not null and tel !~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$' then
    raise exception 'Téléphone avec l''indicatif, par exemple : +225 07 48 32 11 90.' using errcode = 'P0001';
  end if;
  if mel is not null and mel !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide.' using errcode = 'P0001';
  end if;
  if n <> ag.nom then changements := changements || ('nom : ' || ag.nom || ' → ' || n); end if;
  if tel is distinct from ag.telephone then changements := changements || ('téléphone : ' || coalesce(tel, 'aucun')); end if;
  if mel is distinct from ag.email then changements := changements || ('e-mail : ' || coalesce(mel, 'aucun')); end if;
  if coalesce(verifiee, false) <> ag.verifiee then
    changements := changements || case when verifiee then 'badge « vérifiée » donné' else 'badge « vérifiée » retiré' end;
  end if;
  if array_length(changements, 1) is null then
    return;
  end if;
  update public.agences set nom = n, telephone = tel, email = mel, verifiee = coalesce(modifier_agence.verifiee, false)
   where id = agence;
  perform public.noter_action_equipe('agence_modifiee', null, agence, n, array_to_string(changements, ' ; '));
end $$;

-- Accueil : les agences vérifiées qui ont des annonces en ligne, avec leur vitrine
create function public.agences_partenaires(nombre integer default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.ligne order by x.annonces desc, x.nom), '[]')
  from (
    select ag.nom, count(a.id) as annonces, jsonb_build_object(
             'nom', ag.nom, 'annonces', count(a.id),
             'vitrine', (select jsonb_build_object('code', p2.code_vitrine, 'nom', ag.nom)
                           from public.profils p2 where p2.agence_id = ag.id and p2.suspendu_le is null
                          order by (select count(*) from public.annonces o where o.auteur_id = p2.id and o.statut = 'publiee') desc
                          limit 1)) as ligne
    from public.agences ag
    join public.profils p on p.agence_id = ag.id and p.suspendu_le is null
    join public.annonces a on a.auteur_id = p.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())
    where ag.verifiee
    group by ag.id, ag.nom
    order by count(a.id) desc, ag.nom
    limit greatest(1, least(coalesce(nombre, 10), 30))
  ) x;
$$;


-- ══ Tableau de bord, journal, compteurs (complètent la version de la modération) ══
create or replace function public.admin_tableau() returns jsonb
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
    'agences', (select count(*) from public.agences),
    'agences_verifiees', (select count(*) from public.agences where verifiee),
    'demandes_agence', (select count(*) from public.profils where demande_agence is not null and role = 'particulier'),
    'suspendus', (select count(*) from public.profils where suspendu_le is not null),
    'administrateurs', (select count(*) from public.profils where role = 'admin'),
    'semaine', jsonb_build_object(
      'inscriptions', (select count(*) from public.profils where cree_le > now() - interval '7 days'),
      'annonces', (select count(*) from public.annonces where statut <> 'brouillon' and cree_le > now() - interval '7 days'),
      'publiees', (select count(*) from public.moderations where decision = 'publiee' and cree_le > now() - interval '7 days'),
      'refusees', (select count(*) from public.moderations where decision in ('refusee', 'retiree') and cree_le > now() - interval '7 days'),
      'signalements', (select count(*) from public.signalements where cree_le > now() - interval '7 days'))
  );
end $$;

-- Journal : décisions sur les annonces et actions sur les comptes et les agences, les plus récentes d'abord
create or replace function public.admin_journal(nombre integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'decision', j.decision, 'motif', j.motif, 'le', j.le, 'reference', j.reference, 'titre', j.titre,
      'annonce_id', j.annonce_id, 'par', nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''))
      order by j.le desc)
    from (
      select * from (
        select m.decision, m.motif, m.cree_le as le, m.reference, m.titre, m.annonce_id, m.admin_id from public.moderations m
        union all
        select x.action, x.detail, x.cree_le, null, x.cible, null, x.admin_id from public.actions_equipe x
      ) t order by t.le desc limit greatest(1, least(coalesce(nombre, 50), 200))
    ) j
    left join public.profils p on p.id = j.admin_id
  ), '[]');
end $$;

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
                    + (select count(*) from public.profils where demande_agence is not null and role = 'particulier')
                  else 0 end);
$$;

revoke execute on function public.compte_suspendu(), public.noter_action_equipe(text, uuid, uuid, text, text),
  public.prevenir_compte(uuid, text, jsonb), public.fiche_compte(public.profils), public.nom_complet(public.profils),
  public.admin_equipe(), public.changer_acces_admin(uuid, boolean), public.admin_chercher_comptes(text),
  public.suspendre_compte(uuid, text), public.reactiver_compte(uuid), public.slug_agence(text),
  public.admin_demandes_agence(), public.valider_agence(uuid, text, uuid), public.refuser_agence(uuid, text),
  public.admin_agences(), public.modifier_agence(uuid, text, text, text, boolean), public.agences_partenaires(integer)
  from public;
grant execute on function public.compte_suspendu() to anon, authenticated;
grant execute on function public.admin_equipe(), public.changer_acces_admin(uuid, boolean), public.admin_chercher_comptes(text),
  public.suspendre_compte(uuid, text), public.reactiver_compte(uuid), public.admin_demandes_agence(),
  public.valider_agence(uuid, text, uuid), public.refuser_agence(uuid, text), public.admin_agences(),
  public.modifier_agence(uuid, text, text, text, boolean)
  to authenticated;
grant execute on function public.agences_partenaires(integer) to anon, authenticated;
