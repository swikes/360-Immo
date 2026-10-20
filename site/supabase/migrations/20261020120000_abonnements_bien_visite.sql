-- ══════════════════════════════════════════════════════════════════════════════
--  360-Immo.ci — Abonnements des agences et « Bien visité » (étape 8b)
-- ══════════════════════════════════════════════════════════════════════════════
--  Règles : document « Offre commerciale » (8 octobre 2026), à la suite de …_offres.sql (étape 8a).
--   - Abonnement agence : 15 000, 35 000 ou 75 000 FCFA par mois, pour une agence qui a jusqu'à 20, 60 ou 200 annonces
--     en ligne (tous les comptes de l'agence). 20, 60 ou 200 remontées incluses par mois : un crédit commun de l'agence,
--     utilisé à la main ou programmé (une annonce tous les 1 à 30 jours) ; une remontée par annonce toutes les 24 heures,
--     toujours ; pas de report d'un mois sur l'autre ; au-delà, 500 FCFA la remontée supplémentaire. Pas de prélèvement
--     automatique : l'agence paie chaque mois (le mois suivant peut se payer d'avance) ; rappel par e-mail 3 jours
--     avant la fin. La formule se choisit selon le nombre d'annonces en ligne ; rien n'est bloqué pendant le mois payé.
--     L'abonnement apporte aussi les statistiques détaillées (d'où viennent les visiteurs de chaque annonce, export)
--     et le suivi des contacts (messages, demandes de visite et de rappel, pour quelle annonce).
--   - Équité : dans « Plus récentes », une même agence (ou un même particulier) n'a jamais plus de 3 annonces dans les
--     10 premières ; ses autres annonces passent juste après.
--   - Bien visité : un agent de 360-Immo.ci visite le bien, prend de vraies photos (ajoutées à l'annonce) et contrôle
--     l'original des papiers ; badge « Bien visité » avec la date. Prix choisi par la base : 10 000 FCFA (appartement,
--     maison, bureau, commerce… à Abidjan) ou 25 000 FCFA (terrain, villa, immeuble, ou bien hors d'Abidjan). Payé en
--     ligne ; l'équipe fixe le rendez-vous puis note la visite (Administration → Biens visités). Le badge est retiré si
--     le bien change (type, lieu, adresse, surface) ou si une photo de l'agent est supprimée. Visite impossible :
--     l'équipe rembourse (onglet Paiements).
--  Prix : table « offres », modifiables sans toucher au site (Supabase → Table Editor → offres).

-- ══ Les nouvelles offres ══
alter table public.offres drop constraint offres_cle_check,
  add constraint offres_cle_check check (cle in ('remontee', 'remontees_3', 'premium_30', 'remontee_sup',
    'agence_20', 'agence_60', 'agence_200', 'bien_visite', 'bien_visite_plus'));
alter table public.offres add column annonces_max smallint check (annonces_max > 0);
comment on column public.offres.remontees is 'Remontées données (abonnement agence : incluses chaque mois)';
comment on column public.offres.annonces_max is 'Abonnement agence : annonces en ligne au plus pour cette formule';
insert into public.offres (cle, nom, prix, remontees, jours_premium, ordre, annonces_max) values
  ('remontee_sup', 'Remontée supplémentaire (abonnés)', 500, 1, 0, 4, null),
  ('agence_20', 'Abonnement agence (20 annonces)', 15000, 20, 0, 5, 20),
  ('agence_60', 'Abonnement agence (60 annonces)', 35000, 60, 0, 6, 60),
  ('agence_200', 'Abonnement agence (200 annonces)', 75000, 200, 0, 7, 200),
  ('bien_visite', 'Bien visité', 10000, 0, 0, 8, null),
  ('bien_visite_plus', 'Bien visité (terrain, villa, immeuble ou hors d''Abidjan)', 25000, 0, 0, 9, null);

-- Montant lisible : « 15 000 FCFA »
create function public.fcfa(n integer) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(n::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') || ' FCFA';
$$;

-- ══ Abonnements des agences : un mois par paiement ══
alter table public.paiements add column agence_id uuid references public.agences on delete set null;

create table public.abonnements (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences on delete cascade,
  offre text not null references public.offres,
  paiement_id uuid references public.paiements on delete set null,
  profil_id uuid references public.profils on delete set null,       -- le compte qui a payé
  debut timestamptz not null,
  fin timestamptz not null,
  annonces_max smallint not null,
  remontees_incluses smallint not null check (remontees_incluses >= 0),
  remontees_utilisees smallint not null default 0,
  cree_le timestamptz not null default now(),
  constraint abonnements_remontees check (remontees_utilisees between 0 and remontees_incluses),
  constraint abonnements_periode check (fin >= debut)   -- (égales : mois remboursé aussitôt payé)
);
create index abonnements_agence on public.abonnements (agence_id, fin desc);
comment on table public.abonnements is 'Mois d''abonnement payés par les agences (lus seulement par les fonctions : mes_offres, admin)';
alter table public.abonnements enable row level security;
revoke all on public.abonnements from public, anon, authenticated;

-- Journal des remontées : celles prises sur l'abonnement
alter table public.remontees drop constraint remontees_origine_check,
  add constraint remontees_origine_check check (origine in ('paiement', 'credit', 'automatique', 'abonnement'));

-- Le compte est-il dans une agence abonnée en ce moment ?
create function public.compte_abonne(profil uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils p join public.abonnements x on x.agence_id = p.agence_id
                 where p.id = profil and x.debut <= now() and x.fin > now());
$$;

-- Annonces en ligne d'une agence (tous ses comptes)
create function public.annonces_en_ligne_agence(agence uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.annonces a join public.profils p on p.id = a.auteur_id
  where p.agence_id = agence and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

-- L'abonnement de l'agence d'un compte, pour Mon Espace (null : compte qui n'est pas une agence)
create function public.abonnement_agence(profil uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when ag.id is not null then jsonb_build_object(
    'agence', ag.nom,
    'annonces_en_ligne', public.annonces_en_ligne_agence(ag.id),
    'en_cours', (select jsonb_build_object('offre', x.offre, 'nom', o.nom, 'debut', x.debut, 'fin', x.fin,
                                           'annonces_max', x.annonces_max, 'incluses', x.remontees_incluses,
                                           'utilisees', x.remontees_utilisees)
                 from public.abonnements x join public.offres o on o.cle = x.offre
                 where x.agence_id = ag.id and x.debut <= now() and x.fin > now() order by x.debut desc limit 1),
    'suivant', (select jsonb_build_object('offre', x.offre, 'nom', o.nom, 'debut', x.debut, 'fin', x.fin)
                from public.abonnements x join public.offres o on o.cle = x.offre
                where x.agence_id = ag.id and x.debut > now() order by x.debut limit 1),
    'termine_le', (select max(x.fin) from public.abonnements x where x.agence_id = ag.id and x.fin <= now()))
  end
  from public.profils p left join public.agences ag on ag.id = p.agence_id
  where p.id = profil;
$$;

-- Une remontée pour un compte : d'abord celles de l'abonnement de son agence (perdues à la fin du mois), puis celles
-- payées d'avance (pack, remontée créditée) ; null s'il n'en reste plus
create function public.prendre_remontee(profil uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ab uuid;
begin
  select x.id into ab from public.abonnements x join public.profils p on p.agence_id = x.agence_id
   where p.id = profil and x.debut <= now() and x.fin > now() and x.remontees_utilisees < x.remontees_incluses
   order by x.debut limit 1
   for update of x;
  if ab is not null then
    update public.abonnements set remontees_utilisees = remontees_utilisees + 1 where id = ab;
    return 'abonnement';
  end if;
  if public.prendre_credit_remontee(profil) then
    return 'credit';
  end if;
  return null;
end $$;

-- ══ Équité dans « Plus récentes » : l'annonceur de chaque annonce (agence, sinon compte), sans rien révéler ══
create function public.groupe_annonceur(annonce uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce('agence:' || ag.slug, 'compte:' || p.code_vitrine, 'annonce:' || a.id)
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  left join public.agences ag on ag.id = p.agence_id
  where a.id = annonce;
$$;

-- ══ Bien visité ══
alter table public.annonces add column bien_visite_le timestamptz;
-- (lisible comme les autres colonnes publiques : badge des cartes et de la fiche)
grant select (bien_visite_le) on public.annonces to anon, authenticated;
comment on column public.annonces.bien_visite_le is 'Badge « Bien visité » : date de la visite de l''agent (posée par l''équipe)';

alter table public.photos_annonce add column par_agent boolean not null default false;
comment on column public.photos_annonce.par_agent is 'Photo prise par l''agent de 360-Immo.ci pendant la visite (ajoutée par l''équipe)';

create table public.visites_agent (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid references public.annonces on delete set null,
  annonce jsonb not null default '{}',            -- { reference, titre } à la demande
  profil_id uuid references public.profils on delete set null,
  paiement_id uuid references public.paiements on delete set null,
  offre text not null references public.offres,
  montant integer not null,
  statut text not null default 'a_planifier' check (statut in ('a_planifier', 'planifiee', 'visitee', 'impossible', 'annulee')),
  rendez_vous timestamptz,
  agent text check (agent is null or char_length(agent) <= 80),
  papiers text[] not null default '{}',           -- originaux contrôlés : ACD, lettre d'attribution, mandat…
  compte_rendu text check (compte_rendu is null or char_length(compte_rendu) <= 1000),
  visitee_le timestamptz,
  traitee_par uuid references public.profils on delete set null,
  badge_retire_le timestamptz,
  badge_retire_raison text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
-- Une seule visite en cours par bien
create unique index visites_agent_en_cours on public.visites_agent (annonce_id) where statut in ('a_planifier', 'planifiee');
create index visites_agent_statut on public.visites_agent (statut, cree_le);
comment on table public.visites_agent is 'Visites « Bien visité » d''un agent de 360-Immo.ci (lues seulement par les fonctions)';
alter table public.visites_agent enable row level security;
revoke all on public.visites_agent from public, anon, authenticated;

-- Le prix de la visite pour ce bien : 25 000 FCFA (terrain, villa, immeuble, ou hors d'Abidjan), sinon 10 000 FCFA
create function public.offre_bien_visite(a public.annonces) returns text
language sql stable set search_path = '' as $$
  select case when a.type_bien in ('terrain', 'villa', 'immeuble')
                or not exists (select 1 from public.villes v where v.id = a.ville_id and v.nom = 'Abidjan')
              then 'bien_visite_plus' else 'bien_visite' end;
$$;

-- Écrit par l'équipe (compte administrateur) ou par la base elle-même (sans compte : tâches, clé secrète) ?
-- (dans une fonction à pleins droits, est_admin() répond toujours oui : elle regarde l'utilisateur de la base)
create function public.par_l_equipe() returns boolean
language sql stable set search_path = '' as $$
  select (select auth.uid()) is null or public.compte_admin();
$$;

-- Le badge se pose par l'équipe seulement ; il tombe si le bien change (ce n'est plus celui que l'agent a vu)
create function public.annonces_bien_visite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.par_l_equipe() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.bien_visite_le := null;
    return new;
  end if;
  if new.bien_visite_le is not null and new.bien_visite_le is distinct from old.bien_visite_le then
    new.bien_visite_le := old.bien_visite_le;
  end if;
  if old.bien_visite_le is not null and (
       new.type_bien is distinct from old.type_bien
    or new.ville_id is distinct from old.ville_id
    or new.commune_id is distinct from old.commune_id
    or new.quartier_id is distinct from old.quartier_id
    or new.quartier_texte is distinct from old.quartier_texte
    or new.adresse is distinct from old.adresse
    or new.surface is distinct from old.surface) then
    new.bien_visite_le := null;
    update public.visites_agent set badge_retire_le = now(),
           badge_retire_raison = 'Le bien a changé (type, lieu, adresse ou surface).'
     where annonce_id = new.id and statut = 'visitee' and badge_retire_le is null;
  end if;
  return new;
end $$;
-- (avant annonces_controler : les déclencheurs « before » passent par ordre alphabétique)
create trigger annonces_bien_visite before insert or update on public.annonces
  for each row execute function public.annonces_bien_visite();

-- Photos de l'agent : marquées par l'équipe seulement ; en supprimer une retire le badge
create function public.photos_agent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.par_agent and not public.par_l_equipe() then
      update public.annonces set bien_visite_le = null where id = old.annonce_id and bien_visite_le is not null;
      if found then
        update public.visites_agent set badge_retire_le = now(),
               badge_retire_raison = 'Une photo prise par l''agent a été supprimée.'
         where annonce_id = old.annonce_id and statut = 'visitee' and badge_retire_le is null;
      end if;
    end if;
    return old;
  end if;
  if not public.par_l_equipe() then
    new.par_agent := case when tg_op = 'INSERT' then false else old.par_agent end;
  end if;
  return new;
end $$;
-- (« agent » avant « limite » : la photo est marquée avant le compte des photos)
create trigger photos_annonce_agent before insert or update on public.photos_annonce
  for each row execute function public.photos_agent();
create trigger photos_annonce_agent_supprimee after delete on public.photos_annonce
  for each row execute function public.photos_agent();

-- 20 photos (30 avec le Premium) ; celles de l'agent en plus
create or replace function public.photos_annonce_limite() returns trigger
language plpgsql set search_path = '' as $$
declare
  limite integer := case when exists (select 1 from public.annonces a where a.id = new.annonce_id and a.premium
                                        and (a.premium_jusquau is null or a.premium_jusquau > now())) then 30 else 20 end;
begin
  if new.par_agent then
    return new;
  end if;
  if (select count(*) from public.photos_annonce where annonce_id = new.annonce_id and not par_agent) >= limite then
    raise exception '% photos au plus par annonce%.', limite,
      case when limite = 20 then ' (30 avec le Premium)' else '' end using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Le badge (comme la remontée et le Premium) ne change pas la date « Modifiée le » de l'annonce
create or replace function public.annonces_controler() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    if tg_op = 'INSERT' then
      if new.statut not in ('brouillon', 'en_attente') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.premium := false;
      new.premium_jusquau := null;
      new.verifiee := false;
      new.vues := 0;
      new.publiee_le := null;
      new.expire_le := null;
      new.motif_refus := null;
    else
      if new.statut is distinct from old.statut and new.statut not in ('brouillon', 'en_attente', 'archivee') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.reference := old.reference;
      new.auteur_id := old.auteur_id;
      new.premium := old.premium;
      new.premium_jusquau := old.premium_jusquau;
      new.verifiee := old.verifiee;
      new.vues := old.vues;
      new.publiee_le := old.publiee_le;
      new.expire_le := old.expire_le;
      new.motif_refus := old.motif_refus;
      -- Une annonce publiée qui change beaucoup repasse par la vérification de l'équipe
      if old.statut = 'publiee' and new.statut = 'publiee' and (
           new.transaction is distinct from old.transaction
        or new.type_bien is distinct from old.type_bien
        or new.commune_id is distinct from old.commune_id
        or new.quartier_id is distinct from old.quartier_id
        or new.quartier_texte is distinct from old.quartier_texte
        or abs(new.prix - old.prix) * 5 > old.prix            -- plus de 20 % d'écart
      ) then
        new.statut := 'en_attente';
      end if;
    end if;
  end if;
  if new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut <> 'publiee') then
    new.publiee_le := now();
    new.expire_le := now() + public.duree_validite();
    new.motif_refus := null;
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'vues' - 'modifie_le' - 'remontee_le' - 'premium' - 'premium_jusquau' - 'bien_visite_le')
         is distinct from (to_jsonb(old) - 'vues' - 'modifie_le' - 'remontee_le' - 'premium' - 'premium_jusquau' - 'bien_visite_le') then
    new.modifie_le := now();
  end if;
  return new;
end $$;

-- ══ Les annonces en ligne : badge « Bien visité », annonceur pour l'équité (colonnes ajoutées à la fin) ══
create or replace view public.annonces_en_ligne with (security_invoker = true) as
select
  a.id, a.reference, a.transaction, a.type_bien, t.nom as type_nom, a.titre, a.description,
  a.prix, a.loyer_par, a.caution_mois,
  v.nom as ville, c.nom as commune, coalesce(q.nom, a.quartier_texte) as quartier, a.adresse,
  a.ville_id, a.commune_id, a.quartier_id,
  a.surface, t.surface as surface_nom, a.pieces, a.studio, a.chambres, a.sanitaires, t.sanitaires as sanitaires_nom,
  a.meuble, a.dans_immeuble, a.etage, a.commodites,
  a.type_vendeur,
  case when a.type_vendeur = 'agence' then public.nom_agence_annonce(a.id) else an.nom end as contact_nom,
  a.contact_whatsapp,
  (a.premium and (a.premium_jusquau is null or a.premium_jusquau > now())) as premium,
  a.verifiee, a.vues, a.publiee_le, a.expire_le,
  coalesce(p.photos, '{}') as photos,
  an.code as annonceur, an.nom as annonceur_nom, an.agence as annonceur_agence,
  case when a.type_vendeur = 'agence' then an.agence and an.verifiee else an.verifiee end as annonceur_verifie,
  a.disponibles,
  greatest(a.publiee_le, a.remontee_le) as classee_le,
  a.bien_visite_le,
  public.groupe_annonceur(a.id) as groupe
from public.annonces a
join public.types_bien t on t.cle = a.type_bien
join public.villes v on v.id = a.ville_id
join public.communes c on c.id = a.commune_id
left join public.quartiers q on q.id = a.quartier_id
left join lateral (
  select array_agg(ph.chemin order by ph.ordre, ph.cree_le) as photos
  from public.photos_annonce ph where ph.annonce_id = a.id
) p on true
left join lateral public.annonceur_public(a.id) an on true
where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());

-- Cartes : sans la place dans la liste ni l'annonceur de l'équité
create or replace function public.carte_annonce(v public.annonces_en_ligne) returns jsonb
language sql stable set search_path = '' as $$
  select (to_jsonb(v) - 'description' - 'photos' - 'expire_le' - 'vues' - 'classee_le' - 'groupe')
         || jsonb_build_object('photo', v.photos[1], 'nb_photos', coalesce(cardinality(v.photos), 0));
$$;

-- « Plus récentes » : Premium d'abord, puis la plus récemment publiée ou remontée, et 3 annonces au plus d'un même
-- annonceur dans les 10 premières (ses autres annonces juste après) ; tri par prix et vitrines inchangés
create or replace function public.rechercher_annonces(criteres jsonb default '{}') returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  c jsonb := coalesce(criteres, '{}');
  par_page integer := least(48, greatest(1, coalesce((c ->> 'par_page')::integer, 24)));
  page integer := greatest(1, coalesce((c ->> 'page')::integer, 1));
  tri text := coalesce(c ->> 'tri', 'recent');
  -- (une vitrine ne montre qu'un annonceur : pas d'équité à faire)
  equite boolean := coalesce(c ->> 'tri', 'recent') = 'recent' and c ->> 'annonceur' is null;
  total integer;
  cartes jsonb;
begin
  select count(*) into total from public.annonces_en_ligne v where public.annonce_correspond(v, c);
  select coalesce(jsonb_agg(public.carte_annonce(s.ligne) order by s.n), '[]') into cartes
  from (
    select e.v, row_number() over (order by e.bloc, e.n) as n
    from (
      select r.v, r.n,
             -- les 10 premières : les 3 premières annonces de chaque annonceur, dans l'ordre ; les autres après
             case when not equite then 0
                  when r.rang <= 3 and sum((r.rang <= 3)::integer) over (order by r.n) <= 10 then 0
                  else 1 end as bloc
      from (
        select b.v, b.n, row_number() over (partition by (b.v).groupe order by b.n) as rang
        from (
          select v, row_number() over (
            order by
              -- Premium en tête, sauf quand on trie par prix
              case when tri = 'recent' then v.premium end desc,
              case when tri = 'recent' then v.classee_le end desc,
              case when tri = 'prix_asc' then public.loyer_mensuel(v.prix, v.loyer_par) end asc,
              case when tri = 'prix_desc' then public.loyer_mensuel(v.prix, v.loyer_par) end desc,
              v.publiee_le desc, v.reference) as n
          from public.annonces_en_ligne v
          where public.annonce_correspond(v, c)
        ) b
      ) r
    ) e
    order by e.bloc, e.n
    offset (page - 1) * par_page limit par_page
  ) s (ligne, n);
  return jsonb_build_object(
    'total', total, 'page', page, 'par_page', par_page, 'annonces', cartes,
    'par_transaction', (select coalesce(jsonb_object_agg(transaction, n), '{}') from (
        select v.transaction, count(*) as n from public.annonces_en_ligne v
        where public.annonce_correspond(v, c, 'transaction') group by v.transaction) x),
    'par_type', (select coalesce(jsonb_object_agg(type_bien, n), '{}') from (
        select v.type_bien, count(*) as n from public.annonces_en_ligne v
        where public.annonce_correspond(v, c, 'type') group by v.type_bien) x)
  );
end $$;

-- ══ E-mails et journal de l'équipe ══
alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee', 'piece_consultee',
    'numero_libere', 'article_publie', 'article_retire', 'article_supprime', 'page_publiee', 'page_retiree',
    'paiement_rembourse', 'visite_agent_planifiee', 'visite_agent_notee'));

-- ══ Règles des offres ══

-- Pourquoi cette annonce ne peut pas recevoir cette offre maintenant (null : elle peut)
create or replace function public.offre_impossible(a public.annonces, offre text) returns text
language sql stable set search_path = '' as $$
  select case
    when a.id is null then 'Annonce introuvable.'
    when a.statut <> 'publiee' or (a.expire_le is not null and a.expire_le <= now())
      then 'Cette annonce n''est pas en ligne : seules les annonces en ligne peuvent être remontées, passer en Premium ou être visitées.'
    when offre in ('remontee', 'remontees_3', 'remontee_sup') and a.remontee_le > now() - interval '24 hours'
      then 'Cette annonce a déjà été remontée il y a moins de 24 heures : prochaine remontée possible le '
           || public.date_heure_courte(a.remontee_le + interval '24 hours') || '.'
    when offre in ('bien_visite', 'bien_visite_plus') and a.bien_visite_le is not null
      then 'Ce bien a déjà le badge « Bien visité » (visite du '
           || to_char(a.bien_visite_le at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || ').'
    when offre in ('bien_visite', 'bien_visite_plus')
         and exists (select 1 from public.visites_agent v where v.annonce_id = a.id and v.statut in ('a_planifier', 'planifiee'))
      then 'Une visite est déjà demandée pour ce bien : l''équipe 360-Immo.ci vous appelle pour fixer le rendez-vous.'
  end;
$$;

-- 1. L'annonceur choisit une offre (navigateur) : paiement « en attente ».
--    annonce : obligatoire, sauf pour le pack et l'abonnement. Chaque offre a ses conditions (voir en tête).
create or replace function public.commencer_paiement(offre text, annonce uuid default null, automatique boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.offres;
  a public.annonces;
  pourquoi text;
  p public.paiements;
  abonne boolean := public.compte_abonne(auth.uid());
  agence uuid;
  n integer;
  suivant public.abonnements;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour acheter une offre.' using errcode = 'P0001';
  end if;
  if public.compte_suspendu() then
    raise exception 'Votre compte est suspendu : vous ne pouvez pas acheter d''offre. Contactez l''équipe 360-Immo.ci.' using errcode = 'P0001';
  end if;
  select * into o from public.offres where cle = commencer_paiement.offre;
  if o.cle is null then
    raise exception 'Offre inconnue.' using errcode = 'P0001';
  end if;

  -- Remontées : à l'unité sans abonnement ; à 500 FCFA pour les agences abonnées
  if o.cle in ('remontee', 'remontees_3') and abonne then
    raise exception 'Votre abonnement agence inclut des remontées : utilisez-les d''abord ; au-delà, la remontée supplémentaire coûte %.',
      public.fcfa((select x.prix from public.offres x where x.cle = 'remontee_sup')) using errcode = 'P0001';
  end if;
  if o.cle = 'remontee_sup' and not abonne then
    raise exception 'La remontée à % est réservée aux agences abonnées.', public.fcfa(o.prix) using errcode = 'P0001';
  end if;

  -- Abonnement : comptes agence ; formule selon le nombre d'annonces en ligne ; un mois d'avance au plus
  if o.cle like 'agence\_%' then
    select pr.agence_id into agence from public.profils pr where pr.id = auth.uid();
    if agence is null then
      raise exception 'L''abonnement est réservé aux agences (compte rattaché à une agence par l''équipe 360-Immo.ci).' using errcode = 'P0001';
    end if;
    n := public.annonces_en_ligne_agence(agence);
    if n > o.annonces_max and exists (select 1 from public.offres x where x.cle like 'agence\_%' and x.annonces_max > o.annonces_max) then
      raise exception 'Votre agence a % annonces en ligne : choisissez la formule pour % annonces ou plus.', n,
        (select min(x.annonces_max) from public.offres x where x.cle like 'agence\_%' and x.annonces_max >= n) using errcode = 'P0001';
    end if;
    select * into suivant from public.abonnements x where x.agence_id = agence and x.debut > now() order by x.debut limit 1;
    if suivant.id is not null then
      raise exception 'Le mois suivant est déjà payé (du % au %).',
        to_char(suivant.debut at time zone 'Africa/Abidjan', 'DD/MM/YYYY'), to_char(suivant.fin at time zone 'Africa/Abidjan', 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    annonce := null;
  elsif annonce is null and o.cle <> 'remontees_3' then
    raise exception 'Choisissez l''annonce.' using errcode = 'P0001';
  end if;

  if annonce is not null then
    select * into a from public.annonces x where x.id = commencer_paiement.annonce and x.auteur_id = auth.uid();
    pourquoi := public.offre_impossible(a, o.cle);
    -- pack : seule la première remontée attendrait les 24 heures ; l'achat reste possible
    if pourquoi is not null and not (o.cle = 'remontees_3' and a.id is not null and a.statut = 'publiee'
                                     and (a.expire_le is null or a.expire_le > now())) then
      raise exception '%', pourquoi using errcode = 'P0001';
    end if;
    -- Bien visité : le prix qui correspond au bien
    if o.cle in ('bien_visite', 'bien_visite_plus') and public.offre_bien_visite(a) <> o.cle then
      raise exception 'Pour ce bien, la visite coûte % : rechargez la page.',
        public.fcfa((select x.prix from public.offres x where x.cle = public.offre_bien_visite(a))) using errcode = 'P0001';
    end if;
  end if;
  -- Contre les clics en rafale : 10 paiements commencés par heure au plus
  if (select count(*) from public.paiements x where x.profil_id = auth.uid() and x.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Vous avez commencé beaucoup de paiements en peu de temps : réessayez dans une heure.' using errcode = 'P0001';
  end if;
  insert into public.paiements (profil_id, offre, annonce_id, annonce, montant, automatique, agence_id)
  values (auth.uid(), o.cle, a.id,
          case when a.id is null then '{}'::jsonb else jsonb_build_object('reference', a.reference, 'titre', a.titre) end,
          o.prix, coalesce(automatique, false) and o.cle = 'remontees_3' and a.id is not null, agence)
  returning * into p;
  return jsonb_build_object('id', p.id, 'reference', p.reference, 'offre', p.offre, 'nom', o.nom, 'montant', p.montant);
end $$;

-- L'offre payée s'applique ; ce qui ne peut plus s'appliquer est crédité (texte pour l'annonceur)
create or replace function public.appliquer_offre(p public.paiements) returns text
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  o public.offres;
  fin timestamptz;
  agence uuid;
  debut timestamptz;
  v public.visites_agent;
begin
  select * into a from public.annonces x where x.id = p.annonce_id;
  select * into o from public.offres x where x.cle = p.offre;
  if p.offre in ('remontee', 'remontee_sup') then
    if public.offre_impossible(a, 'remontee') is null then
      perform public.faire_remontee(a.id, 'paiement', p.id);
      return 'Annonce remontée en tête de la liste.';
    end if;
    insert into public.credits_remontee (profil_id, paiement_id, restantes, expire_le)
    values (p.profil_id, p.id, 1, now() + interval '30 days');
    return 'La remontée n''a pas pu s''appliquer (annonce plus en ligne, ou déjà remontée il y a moins de 24 heures) : '
           || 'elle vous est créditée, à utiliser dans les 30 jours sur l''annonce de votre choix.';
  elsif p.offre = 'remontees_3' then
    insert into public.credits_remontee (profil_id, paiement_id, restantes, expire_le)
    values (p.profil_id, p.id, 3, now() + interval '30 days');
    if a.id is not null and public.offre_impossible(a, 'remontee') is null and public.prendre_credit_remontee(p.profil_id) then
      perform public.faire_remontee(a.id, 'paiement', p.id);
      if p.automatique then
        insert into public.remontees_programmees (annonce_id, profil_id, prochaine)
        values (a.id, p.profil_id, now() + interval '3 days')
        on conflict (annonce_id) do update set prochaine = excluded.prochaine, tous_les = 3;
        return 'Annonce remontée ; les 2 remontées suivantes se feront automatiquement tous les 3 jours.';
      end if;
      return 'Annonce remontée ; il vous reste 2 remontées, à utiliser dans les 30 jours.';
    end if;
    return '3 remontées créditées, à utiliser dans les 30 jours sur l''annonce de votre choix.';
  elsif p.offre = 'premium_30' then
    if a.id is not null and public.offre_impossible(a, 'premium_30') is null then
      fin := public.ajouter_premium(a.id, 30);
      return 'Annonce Premium jusqu''au ' || to_char(fin at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || '.';
    end if;
    insert into public.credits_premium (profil_id, paiement_id, jours, origine, annonce_reference)
    values (p.profil_id, p.id, 30, 'paiement', p.annonce ->> 'reference');
    return 'L''annonce n''est plus en ligne : vos 30 jours Premium sont gardés, à utiliser sur une autre de vos annonces.';
  elsif p.offre like 'agence\_%' then
    -- Un mois, à la suite du mois en cours (ou payé d'avance) s'il y en a un
    agence := coalesce(p.agence_id, (select pr.agence_id from public.profils pr where pr.id = p.profil_id));
    if agence is null or not exists (select 1 from public.agences ag where ag.id = agence) then
      return 'Ce compte n''est plus rattaché à une agence : l''équipe 360-Immo.ci vous contacte pour le remboursement.';
    end if;
    debut := greatest(now(), coalesce((select max(x.fin) from public.abonnements x where x.agence_id = agence), now()));
    insert into public.abonnements (agence_id, offre, paiement_id, profil_id, debut, fin, annonces_max, remontees_incluses)
    values (agence, o.cle, p.id, p.profil_id, debut, debut + interval '1 month', o.annonces_max, o.remontees);
    if debut > now() + interval '1 minute' then
      return 'Mois suivant payé : du ' || to_char(debut at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || ' au '
             || to_char((debut + interval '1 month') at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || ', '
             || o.remontees || ' remontées incluses.';
    end if;
    return 'Abonnement actif jusqu''au ' || to_char((debut + interval '1 month') at time zone 'Africa/Abidjan', 'DD/MM/YYYY')
           || ' : ' || o.remontees || ' remontées incluses ce mois-ci.';
  else
    -- Bien visité : la demande va à l'équipe, qui appelle l'annonceur pour le rendez-vous
    if a.id is null then
      insert into public.visites_agent (annonce_id, annonce, profil_id, paiement_id, offre, montant, statut, compte_rendu)
      values (null, p.annonce, p.profil_id, p.id, p.offre, p.montant, 'annulee', 'Annonce supprimée avant le paiement : à rembourser.');
      return 'L''annonce n''existe plus : l''équipe 360-Immo.ci vous contacte pour le remboursement.';
    end if;
    insert into public.visites_agent (annonce_id, annonce, profil_id, paiement_id, offre, montant)
    values (a.id, p.annonce, p.profil_id, p.id, p.offre, p.montant)
    on conflict (annonce_id) where statut in ('a_planifier', 'planifiee') do nothing
    returning * into v;
    if v.id is null then
      return 'Une visite était déjà demandée pour ce bien : l''équipe 360-Immo.ci vous contacte pour le remboursement de ce paiement.';
    end if;
    -- l'équipe est prévenue
    insert into public.notifications (modele, profil_id, cle, donnees)
    select 'offre', pr.id, 'visite_demandee:' || v.id || ':' || pr.id,
           jsonb_build_object('evenement', 'visite_demandee', 'annonce', p.annonce, 'offre', o.nom, 'montant', p.montant,
                              'commune', (select c.nom from public.communes c where c.id = a.commune_id),
                              'annonceur', (select nullif(btrim(concat_ws(' ', x.prenom, x.nom)), '') from public.profils x where x.id = p.profil_id),
                              'telephone', (select x.telephone from public.profils x where x.id = p.profil_id))
    from public.profils pr where pr.role = 'admin' and pr.suspendu_le is null;
    return 'Demande de visite reçue : l''équipe 360-Immo.ci vous appelle pour fixer le rendez-vous avec l''agent.';
  end if;
end $$;

-- Remboursement (fait chez l'agrégateur ; noté ici) : ce qui reste de l'offre est retiré
create or replace function public.rembourser_paiement(paiement uuid, motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.paiements;
  raison text := nullif(btrim(coalesce(motif, '')), '');
begin
  perform public.exiger_admin();
  if raison is null or char_length(raison) < 5 then
    raise exception 'Indiquez le motif du remboursement.' using errcode = 'P0001';
  end if;
  select * into p from public.paiements x where x.id = paiement for update;
  if p.id is null or p.statut <> 'payee' then
    raise exception 'Seul un paiement reçu peut être remboursé.' using errcode = 'P0001';
  end if;
  update public.paiements set statut = 'remboursee', remboursee_le = now(), rembourse_par = auth.uid(),
         motif_remboursement = left(raison, 500)
   where id = p.id;
  -- Ce qui n'a pas encore servi : remontées d'avance, jours Premium gardés ; Premium en cours : 30 jours de moins
  update public.credits_remontee set restantes = 0 where paiement_id = p.id;
  delete from public.credits_premium where paiement_id = p.id and utilise_le is null;
  if p.offre = 'premium_30' and p.annonce_id is not null then
    update public.annonces set premium_jusquau = premium_jusquau - interval '30 days'
     where id = p.annonce_id and premium and premium_jusquau > now();
    update public.annonces set premium = false where id = p.annonce_id and premium_jusquau <= now();
  end if;
  -- Abonnement : mois pas commencé, annulé ; mois en cours, arrêté maintenant (les remontées restantes avec lui)
  if p.offre like 'agence\_%' then
    delete from public.abonnements where paiement_id = p.id and debut > now();
    update public.abonnements set fin = now(), remontees_incluses = remontees_utilisees
     where paiement_id = p.id and debut <= now() and fin > now();
  end if;
  -- Bien visité : la visite qui n'a pas eu lieu est annulée
  update public.visites_agent set statut = 'annulee', modifie_le = now()
   where paiement_id = p.id and statut in ('a_planifier', 'planifiee');
  perform public.noter_action_equipe('paiement_rembourse', p.profil_id, null,
    coalesce((select nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), '') from public.profils pr where pr.id = p.profil_id), 'Compte supprimé'),
    p.reference || ' · ' || p.montant || ' FCFA · ' || raison);
end $$;

-- ══ Utiliser ses remontées : celles de l'abonnement d'abord, puis celles payées d'avance ══
drop function public.utiliser_remontee(uuid, boolean);
create function public.utiliser_remontee(annonce uuid, automatique boolean default false, tous_les integer default 3) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  pourquoi text;
  origine text;
  abonne boolean := public.compte_abonne(auth.uid());
  -- (programmation : tous les 1 à 30 jours pour une agence abonnée ; tous les 3 jours avec un pack)
  jours integer := case when public.compte_abonne(auth.uid()) then least(greatest(coalesce(tous_les, 3), 1), 30) else 3 end;
begin
  select * into a from public.annonces x where x.id = utiliser_remontee.annonce and x.auteur_id = auth.uid();
  pourquoi := public.offre_impossible(a, 'remontee');
  if pourquoi is not null then
    raise exception '%', pourquoi using errcode = 'P0001';
  end if;
  origine := public.prendre_remontee(auth.uid());
  if origine is null then
    if abonne then
      raise exception 'Les remontées incluses dans votre abonnement sont toutes utilisées ce mois-ci : la remontée supplémentaire coûte %.',
        public.fcfa((select x.prix from public.offres x where x.cle = 'remontee_sup')) using errcode = 'P0001';
    end if;
    raise exception 'Vous n''avez plus de remontée d''avance : achetez une remontée ou un pack.' using errcode = 'P0001';
  end if;
  perform public.faire_remontee(a.id, origine, null);
  if automatique then
    insert into public.remontees_programmees (annonce_id, profil_id, tous_les, prochaine)
    values (a.id, auth.uid(), jours, now() + make_interval(days => jours))
    on conflict (annonce_id) do update set tous_les = excluded.tous_les, prochaine = excluded.prochaine;
  end if;
  return jsonb_build_object(
    'restantes', (select coalesce(sum(restantes), 0) from public.credits_remontee
                   where profil_id = auth.uid() and expire_le > now()),
    'incluses', (select x.remontees_incluses - x.remontees_utilisees from public.abonnements x
                  join public.profils pr on pr.agence_id = x.agence_id
                  where pr.id = auth.uid() and x.debut <= now() and x.fin > now() order by x.debut desc limit 1));
end $$;

-- Remontées automatiques d'une de ses annonces : les arrêter, ou les (re)lancer (la prochaine dans « tous_les » jours)
drop function public.programmer_remontees(uuid, boolean);
create function public.programmer_remontees(annonce uuid, actif boolean, tous_les integer default 3) returns void
language plpgsql security definer set search_path = '' as $$
declare
  abonne boolean := public.compte_abonne(auth.uid());
  jours integer := case when public.compte_abonne(auth.uid()) then least(greatest(coalesce(tous_les, 3), 1), 30) else 3 end;
begin
  if not exists (select 1 from public.annonces a where a.id = annonce and a.auteur_id = auth.uid()) then
    raise exception 'Annonce introuvable.' using errcode = 'P0001';
  end if;
  if actif then
    if not abonne and not exists (select 1 from public.credits_remontee c where c.profil_id = auth.uid() and c.restantes > 0 and c.expire_le > now()) then
      raise exception 'Vous n''avez plus de remontée d''avance : achetez un pack pour les remontées automatiques.' using errcode = 'P0001';
    end if;
    insert into public.remontees_programmees (annonce_id, profil_id, tous_les, prochaine)
    values (annonce, auth.uid(), jours, now() + make_interval(days => jours))
    on conflict (annonce_id) do update set tous_les = excluded.tous_les, prochaine = excluded.prochaine;
  else
    delete from public.remontees_programmees r where r.annonce_id = annonce and r.profil_id = auth.uid();
  end if;
end $$;

-- ══ Mon Espace : abonnement, visites « Bien visité », en plus de ce que donnait l'étape 8a ══
create or replace function public.mes_offres() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tarifs', (select coalesce(jsonb_agg(to_jsonb(o) order by o.ordre), '[]') from public.offres o),
    'remontees', (select coalesce(sum(c.restantes), 0) from public.credits_remontee c
                   where c.profil_id = auth.uid() and c.restantes > 0 and c.expire_le > now()),
    'remontees_fin', (select min(c.expire_le) from public.credits_remontee c
                       where c.profil_id = auth.uid() and c.restantes > 0 and c.expire_le > now()),
    'jours_premium', (select coalesce(sum(c.jours), 0) from public.credits_premium c
                       where c.profil_id = auth.uid() and c.utilise_le is null),
    'programmees', (select coalesce(jsonb_agg(jsonb_build_object('annonce', r.annonce_id, 'prochaine', r.prochaine,
                                                                  'tous_les', r.tous_les)), '[]')
                    from public.remontees_programmees r where r.profil_id = auth.uid()),
    'abonnement', public.abonnement_agence(auth.uid()),
    'visites', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', v.id, 'annonce_id', v.annonce_id, 'annonce', v.annonce, 'offre', v.offre, 'montant', v.montant,
                  'statut', v.statut, 'rendez_vous', v.rendez_vous, 'agent', v.agent, 'papiers', v.papiers,
                  'compte_rendu', case when v.statut in ('visitee', 'impossible') then v.compte_rendu end,
                  'visitee_le', v.visitee_le, 'badge_retire_le', v.badge_retire_le, 'badge_retire_raison', v.badge_retire_raison,
                  'cree_le', v.cree_le) order by v.cree_le desc), '[]')
                from (select * from public.visites_agent x where x.profil_id = auth.uid() order by x.cree_le desc limit 50) v),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', x.id, 'reference', x.reference, 'offre', x.offre, 'nom', o.nom, 'montant', x.montant,
                     'statut', x.statut, 'annonce', x.annonce, 'resultat', x.resultat, 'erreur', x.erreur, 'moyen', x.moyen,
                     'cree_le', x.cree_le, 'payee_le', x.payee_le, 'remboursee_le', x.remboursee_le) order by x.cree_le desc), '[]')
                  from (select * from public.paiements p where p.profil_id = auth.uid()
                        and (p.statut <> 'en_attente' or p.cree_le > now() - interval '1 day')
                        order by p.cree_le desc limit 50) x
                  join public.offres o on o.cle = x.offre));
$$;

-- ══ Chaque matin (clé secrète) : remontées automatiques, fin du Premium et de l'abonnement, rappels ══
create or replace function public.taches_offres() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  origine text;
  remontees integer := 0;
  rappels integer := 0;
  rappels_abonnement integer := 0;
  reports integer := 0;
begin
  -- Remontées automatiques dues (à 2 heures près : la tâche du matin ne passe pas chaque jour à la même minute)
  for r in
    select rp.*, a.statut, a.expire_le, a.remontee_le, a.auteur_id
    from public.remontees_programmees rp join public.annonces a on a.id = rp.annonce_id
    where rp.prochaine <= now() + interval '2 hours'
    for update of rp skip locked
  loop
    if r.statut <> 'publiee' or (r.expire_le is not null and r.expire_le <= now()) or r.auteur_id <> r.profil_id then
      delete from public.remontees_programmees where annonce_id = r.annonce_id;
    elsif r.remontee_le > now() - interval '24 hours' then
      update public.remontees_programmees set prochaine = r.remontee_le + interval '24 hours' where annonce_id = r.annonce_id;
    else
      origine := public.prendre_remontee(r.profil_id);
      if origine is not null then
        perform public.faire_remontee(r.annonce_id, 'automatique', null);
        update public.remontees_programmees set prochaine = now() + make_interval(days => r.tous_les) where annonce_id = r.annonce_id;
        remontees := remontees + 1;
      elsif public.compte_abonne(r.profil_id)
            or exists (select 1 from public.abonnements x join public.profils p on p.agence_id = x.agence_id
                       where p.id = r.profil_id and x.debut > now()) then
        -- agence abonnée sans remontée restante ce mois-ci : on réessaie demain (le mois suivant en apporte)
        update public.remontees_programmees set prochaine = now() + interval '1 day' where annonce_id = r.annonce_id;
      else
        delete from public.remontees_programmees where annonce_id = r.annonce_id;   -- plus de remontée d'avance
      end if;
    end if;
  end loop;

  -- Annonce arrivée à sa fin pendant son Premium : les jours restants sont gardés
  for r in
    select a.id, a.auteur_id, a.reference, a.premium_jusquau from public.annonces a
    where a.premium and a.premium_jusquau > now() and a.statut = 'publiee' and a.expire_le <= now()
    for update skip locked
  loop
    insert into public.credits_premium (profil_id, jours, origine, annonce_reference)
    values (r.auteur_id, ceil(extract(epoch from r.premium_jusquau - now()) / 86400)::integer, 'fin_annonce', r.reference);
    update public.annonces set premium = false, premium_jusquau = null where id = r.id;
    reports := reports + 1;
  end loop;
  -- Premium terminé
  update public.annonces set premium = false where premium and premium_jusquau <= now();

  -- Rappel 3 jours avant la fin du Premium (une fois par Premium)
  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'offre', a.auteur_id, 'premium_fin:' || a.id || ':' || to_char(a.premium_jusquau at time zone 'UTC', 'YYYY-MM-DD'),
         jsonb_build_object('evenement', 'premium_fin', 'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre),
                            'fin', a.premium_jusquau)
  from public.annonces a
  where a.premium and a.statut = 'publiee' and a.premium_jusquau > now() and a.premium_jusquau <= now() + interval '3 days'
    and not exists (select 1 from public.notifications n
                    where n.profil_id = a.auteur_id
                      and n.cle = 'premium_fin:' || a.id || ':' || to_char(a.premium_jusquau at time zone 'UTC', 'YYYY-MM-DD'));
  get diagnostics rappels = row_count;

  -- Rappel 3 jours avant la fin de l'abonnement, si le mois suivant n'est pas payé (aux comptes de l'agence)
  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'offre', p.id, 'abonnement_fin:' || x.id || ':' || p.id,
         jsonb_build_object('evenement', 'abonnement_fin', 'agence', ag.nom, 'offre', o.nom, 'prix', o.prix, 'fin', x.fin,
                            'restantes', x.remontees_incluses - x.remontees_utilisees,
                            'annonces_en_ligne', public.annonces_en_ligne_agence(x.agence_id))
  from public.abonnements x
  join public.agences ag on ag.id = x.agence_id
  join public.offres o on o.cle = x.offre
  join public.profils p on p.agence_id = x.agence_id and p.suspendu_le is null
  where x.debut <= now() and x.fin > now() and x.fin <= now() + interval '3 days'
    and not exists (select 1 from public.abonnements y where y.agence_id = x.agence_id and y.debut >= x.fin)
    and not exists (select 1 from public.notifications n where n.profil_id = p.id and n.cle = 'abonnement_fin:' || x.id || ':' || p.id);
  get diagnostics rappels_abonnement = row_count;
  return jsonb_build_object('remontees', remontees, 'rappels', rappels, 'reports', reports, 'rappels_abonnement', rappels_abonnement);
end $$;

-- ══ Statistiques détaillées : d'où viennent les visiteurs de chaque annonce ══
-- (compteurs anonymes par jour : la page d'où l'on arrive sur la fiche, ou le site d'où vient la visite)
create table public.statistiques_sources (
  annonce_id uuid not null references public.annonces on delete cascade,
  jour date not null,
  source text not null check (source in ('liste', 'accueil', 'vitrine', 'fiche', 'mon_espace', 'site',
    'direct', 'google', 'autres_moteurs', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'youtube', 'x', 'linkedin',
    'email', 'sms', 'autre_site')),
  vues integer not null default 0,
  primary key (annonce_id, jour, source)
);
comment on table public.statistiques_sources is 'Vues de la fiche par source, par annonce et par jour ; lues par statistiques_detaillees()';
alter table public.statistiques_sources enable row level security;
revoke all on public.statistiques_sources from public, anon, authenticated;

-- Une vue de plus (comme avant), avec sa source quand le navigateur la donne
drop function public.compter_vue(uuid);
create function public.compter_vue(annonce uuid, source text default null) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  update public.annonces set vues = vues + 1
   where id = annonce and statut = 'publiee' and (expire_le is null or expire_le > now())
     and auteur_id is distinct from auth.uid();
  if found then
    insert into public.statistiques as s (annonce_id, jour, vues) values (annonce, public.jour_abidjan(now()), 1)
    on conflict (annonce_id, jour) do update set vues = s.vues + 1;
    if compter_vue.source in ('liste', 'accueil', 'vitrine', 'fiche', 'mon_espace', 'site', 'direct', 'google', 'autres_moteurs',
                  'facebook', 'instagram', 'whatsapp', 'tiktok', 'youtube', 'x', 'linkedin', 'email', 'sms', 'autre_site') then
      insert into public.statistiques_sources as s (annonce_id, jour, source, vues)
      values (annonce, public.jour_abidjan(now()), compter_vue.source, 1)
      on conflict (annonce_id, jour, source) do update set vues = s.vues + 1;
    end if;
  end if;
end $$;

create function public.statistiques_detaillees(jours integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  n integer := least(greatest(coalesce(jours, 30), 1), 365);
  fin date := public.jour_abidjan(now());
  debut date := fin - (n - 1);
begin
  if moi is null then
    raise exception 'Connectez-vous pour voir vos statistiques.' using errcode = '42501';
  end if;
  if not public.compte_abonne(moi) then
    raise exception 'Les statistiques détaillées viennent avec l''abonnement agence.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'jours', n, 'du', debut, 'au', fin,
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'vues', x.vues) order by x.vues desc, x.source), '[]')
                from (select s.source, sum(s.vues)::integer as vues
                      from public.statistiques_sources s join public.annonces a on a.id = s.annonce_id
                      where a.auteur_id = moi and s.jour between debut and fin group by s.source) x),
    'annonces', (select coalesce(jsonb_object_agg(y.annonce_id, y.sources), '{}')
                 from (select x.annonce_id, jsonb_object_agg(x.source, x.vues) as sources
                       from (select s.annonce_id, s.source, sum(s.vues)::integer as vues
                             from public.statistiques_sources s join public.annonces a on a.id = s.annonce_id
                             where a.auteur_id = moi and s.jour between debut and fin group by 1, 2) x
                       group by x.annonce_id) y));
end $$;

-- ══ Suivi des contacts : qui a écrit, demandé une visite ou un rappel, pour quelle annonce ══
create function public.suivi_contacts(jours integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  n integer := least(greatest(coalesce(jours, 30), 1), 365);
  depuis timestamptz := now() - make_interval(days => least(greatest(coalesce(jours, 30), 1), 365));
begin
  if moi is null then
    raise exception 'Connectez-vous pour voir vos contacts.' using errcode = '42501';
  end if;
  if not public.compte_abonne(moi) then
    raise exception 'Le suivi des contacts vient avec l''abonnement agence.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'jours', n,
    'contacts', (select coalesce(jsonb_agg(x.j order by x.le desc), '[]') from (
      select c.cree_le as le, jsonb_build_object(
        'genre', 'message', 'id', c.id, 'le', c.cree_le,
        'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre),
        'nom', public.nom_vitrine(p.prenom, p.nom, ag.nom), 'telephone', null,
        'statut', case when exists (select 1 from public.messages m where m.conversation_id = c.id and m.auteur_id = moi)
                       then 'repondu' else 'sans_reponse' end,
        'dernier', c.dernier_message_le) as j
      from public.conversations c
      join public.annonces a on a.id = c.annonce_id
      join public.profils p on p.id = c.client_id
      left join public.agences ag on ag.id = p.agence_id
      where c.annonceur_id = moi and c.cree_le >= depuis
      union all
      select v.cree_le, jsonb_build_object(
        'genre', 'visite', 'id', v.id, 'le', v.cree_le,
        'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre),
        'nom', v.nom, 'telephone', v.telephone, 'statut', v.statut, 'creneau', v.creneau)
      from public.visites v join public.annonces a on a.id = v.annonce_id
      where a.auteur_id = moi and v.cree_le >= depuis
      union all
      select r.cree_le, jsonb_build_object(
        'genre', 'rappel', 'id', r.id, 'le', r.cree_le,
        'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre),
        'nom', r.nom, 'telephone', r.telephone, 'statut', r.statut, 'moment', r.moment)
      from public.rappels r join public.annonces a on a.id = r.annonce_id
      where a.auteur_id = moi and r.cree_le >= depuis
      order by 1 desc limit 500) x),
    -- Numéros affichés, appels, WhatsApp, e-mails : comptés sans savoir qui (ils passent par le téléphone du visiteur)
    'gestes', (select coalesce(jsonb_agg(jsonb_build_object(
                 'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre),
                 'numeros', g.numeros, 'appels', g.appels, 'whatsapp', g.whatsapp, 'emails', g.emails)
                 order by g.numeros + g.appels + g.whatsapp + g.emails desc), '[]')
               from (select s.annonce_id, sum(s.numeros)::integer as numeros, sum(s.appels)::integer as appels,
                            sum(s.whatsapp)::integer as whatsapp, sum(s.emails)::integer as emails
                     from public.statistiques s
                     where s.jour >= public.jour_abidjan(depuis)
                     group by s.annonce_id) g
               join public.annonces a on a.id = g.annonce_id
               where a.auteur_id = moi and g.numeros + g.appels + g.whatsapp + g.emails > 0));
end $$;

-- ══ Administration → Biens visités ══
create function public.admin_biens_visites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'a_planifier', (select count(*) from public.visites_agent where statut = 'a_planifier'),
    'planifiees', (select count(*) from public.visites_agent where statut = 'planifiee'),
    'badges', (select count(*) from public.annonces where bien_visite_le is not null and statut = 'publiee'),
    'visites', (select coalesce(jsonb_agg(x.j order by x.ordre, x.cle), '[]') from (
      select case v.statut when 'a_planifier' then 0 when 'planifiee' then 1 else 2 end as ordre,
             case v.statut when 'a_planifier' then extract(epoch from v.cree_le)
                           when 'planifiee' then extract(epoch from v.rendez_vous)
                           else -extract(epoch from v.modifie_le) end as cle,
             jsonb_build_object(
               'id', v.id, 'statut', v.statut, 'offre', v.offre, 'nom', o.nom, 'montant', v.montant,
               'rendez_vous', v.rendez_vous, 'agent', v.agent, 'papiers', v.papiers, 'compte_rendu', v.compte_rendu,
               'visitee_le', v.visitee_le, 'badge_retire_le', v.badge_retire_le, 'badge_retire_raison', v.badge_retire_raison,
               'cree_le', v.cree_le, 'modifie_le', v.modifie_le,
               'paiement', (select jsonb_build_object('id', pa.id, 'reference', pa.reference, 'statut', pa.statut)
                            from public.paiements pa where pa.id = v.paiement_id),
               'annonce', case when a.id is null then v.annonce else jsonb_build_object(
                 'id', a.id, 'reference', a.reference, 'titre', a.titre, 'type_nom', t.nom, 'transaction', a.transaction,
                 'ville', vi.nom, 'commune', co.nom, 'quartier', coalesce(q.nom, a.quartier_texte), 'adresse', a.adresse,
                 'surface', a.surface, 'statut', a.statut,
                 'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()),
                 'bien_visite_le', a.bien_visite_le,
                 'photo', (select ph.chemin from public.photos_annonce ph where ph.annonce_id = a.id order by ph.ordre, ph.cree_le limit 1),
                 'photos', (select count(*) from public.photos_annonce ph where ph.annonce_id = a.id and not ph.par_agent),
                 'photos_agent', (select count(*) from public.photos_annonce ph where ph.annonce_id = a.id and ph.par_agent)) end,
               'compte', case when pr.id is null then null else jsonb_build_object(
                 'id', pr.id, 'nom', nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), ''), 'telephone', pr.telephone,
                 'email', (select u.email from auth.users u where u.id = pr.id)) end) as j
      from public.visites_agent v
      join public.offres o on o.cle = v.offre
      left join public.annonces a on a.id = v.annonce_id
      left join public.types_bien t on t.cle = a.type_bien
      left join public.villes vi on vi.id = a.ville_id
      left join public.communes co on co.id = a.commune_id
      left join public.quartiers q on q.id = a.quartier_id
      left join public.profils pr on pr.id = v.profil_id
      where v.statut in ('a_planifier', 'planifiee') or v.modifie_le > now() - interval '90 days') x));
end $$;

-- Tableau de bord de l'équipe : + les biens à visiter (pastille de l'onglet Biens visités)
create or replace function public.admin_tableau() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'a_verifier', (select count(*) from public.annonces where statut = 'en_attente'),
    'a_reverifier', (select count(*) from public.annonces where statut = 'en_attente' and publiee_le is not null),
    'signalees', (select count(distinct annonce_id) from public.signalements where statut = 'a_traiter'),
    'documents', (select count(*) from public.verifications where statut = 'soumise'),
    'contacts', (select count(*) from public.demandes_contact where statut = 'nouvelle'),
    'biens_a_visiter', (select count(*) from public.visites_agent where statut = 'a_planifier'),
    'en_ligne', (select count(*) from public.annonces where statut = 'publiee' and (expire_le is null or expire_le > now())),
    'expirees', (select count(*) from public.annonces where statut = 'publiee' and expire_le <= now()),
    'refusees', (select count(*) from public.annonces where statut = 'refusee'),
    'brouillons', (select count(*) from public.annonces where statut = 'brouillon'),
    'biens_verifies', (select count(*) from public.annonces where verifiee and statut = 'publiee'),
    'comptes', (select count(*) from public.profils),
    'identites_verifiees', (select count(*) from public.profils where identite_verifiee_le is not null),
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

-- Rendez-vous fixé avec l'annonceur (par téléphone) : il le reçoit aussi par e-mail
create function public.planifier_visite_agent(visite uuid, rendez_vous timestamptz, agent text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.visites_agent;
  nom_agent text := nullif(btrim(coalesce(agent, '')), '');
begin
  perform public.exiger_admin();
  if rendez_vous is null or rendez_vous < now() - interval '1 day' then
    raise exception 'Choisissez la date et l''heure du rendez-vous.' using errcode = 'P0001';
  end if;
  if nom_agent is null then
    raise exception 'Indiquez le nom de l''agent qui fera la visite.' using errcode = 'P0001';
  end if;
  update public.visites_agent x set statut = 'planifiee', rendez_vous = planifier_visite_agent.rendez_vous,
         agent = left(nom_agent, 80), traitee_par = auth.uid(), modifie_le = now()
   where x.id = visite and x.statut in ('a_planifier', 'planifiee')
  returning * into v;
  if v.id is null then
    raise exception 'Cette visite n''est plus à planifier.' using errcode = 'P0001';
  end if;
  if v.profil_id is not null then
    insert into public.notifications (modele, profil_id, cle, donnees)
    values ('offre', v.profil_id, 'visite_planifiee:' || v.id || ':' || extract(epoch from v.rendez_vous)::bigint,
            jsonb_build_object('evenement', 'visite_planifiee', 'annonce', v.annonce, 'rendez_vous', v.rendez_vous, 'agent', v.agent));
  end if;
  perform public.noter_action_equipe('visite_agent_planifiee', v.profil_id, null, coalesce(v.annonce ->> 'reference', ''),
    to_char(v.rendez_vous at time zone 'Africa/Abidjan', 'DD/MM/YYYY HH24:MI') || ' · ' || v.agent);
end $$;

-- Résultat de la visite : « visitee » (badge, avec les photos de l'agent et les papiers contrôlés) ou « impossible »
create function public.noter_visite_agent(visite uuid, resultat text, papiers text[] default '{}', compte_rendu text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.visites_agent;
  texte text := nullif(btrim(coalesce(compte_rendu, '')), '');
  controles text[] := array(select left(btrim(x), 80) from unnest(coalesce(papiers, '{}')) x where btrim(x) <> '');
begin
  perform public.exiger_admin();
  select * into v from public.visites_agent x where x.id = visite for update;
  if v.id is null or v.statut not in ('a_planifier', 'planifiee') then
    raise exception 'Cette visite est déjà notée (ou annulée).' using errcode = 'P0001';
  end if;
  if resultat = 'visitee' then
    if v.annonce_id is null then
      raise exception 'L''annonce n''existe plus : notez plutôt « visite impossible ».' using errcode = 'P0001';
    end if;
    if cardinality(controles) = 0 then
      raise exception 'Cochez les papiers dont l''agent a vu l''original.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.photos_annonce ph where ph.annonce_id = v.annonce_id and ph.par_agent) then
      raise exception 'Ajoutez d''abord les photos prises par l''agent.' using errcode = 'P0001';
    end if;
    update public.visites_agent set statut = 'visitee', visitee_le = now(), papiers = controles, compte_rendu = left(texte, 1000),
           traitee_par = auth.uid(), modifie_le = now(), badge_retire_le = null, badge_retire_raison = null
     where id = v.id;
    update public.annonces set bien_visite_le = now() where id = v.annonce_id;
    if v.profil_id is not null then
      insert into public.notifications (modele, profil_id, cle, donnees)
      values ('offre', v.profil_id, 'visite_faite:' || v.id,
              jsonb_build_object('evenement', 'visite_faite', 'annonce', v.annonce, 'papiers', controles, 'compte_rendu', texte));
    end if;
  elsif resultat = 'impossible' then
    if texte is null or char_length(texte) < 5 then
      raise exception 'Écrivez pourquoi la visite n''a pas pu se faire.' using errcode = 'P0001';
    end if;
    update public.visites_agent set statut = 'impossible', compte_rendu = left(texte, 1000), traitee_par = auth.uid(), modifie_le = now()
     where id = v.id;
    if v.profil_id is not null then
      insert into public.notifications (modele, profil_id, cle, donnees)
      values ('offre', v.profil_id, 'visite_impossible:' || v.id,
              jsonb_build_object('evenement', 'visite_impossible', 'annonce', v.annonce, 'compte_rendu', texte));
    end if;
  else
    raise exception 'Résultat inconnu : « visitee » ou « impossible ».' using errcode = 'P0001';
  end if;
  perform public.noter_action_equipe('visite_agent_notee', v.profil_id, null, coalesce(v.annonce ->> 'reference', ''),
    case when resultat = 'visitee' then 'Bien visité · ' || array_to_string(controles, ', ') else 'Visite impossible · ' || texte end);
end $$;

-- ══ Droits ══
revoke execute on function
  public.fcfa(integer), public.compte_abonne(uuid), public.annonces_en_ligne_agence(uuid), public.abonnement_agence(uuid),
  public.prendre_remontee(uuid), public.offre_bien_visite(public.annonces), public.par_l_equipe(),
  public.utiliser_remontee(uuid, boolean, integer), public.programmer_remontees(uuid, boolean, integer),
  public.compter_vue(uuid, text), public.statistiques_detaillees(integer), public.suivi_contacts(integer),
  public.admin_biens_visites(), public.planifier_visite_agent(uuid, timestamptz, text),
  public.noter_visite_agent(uuid, text, text[], text), public.groupe_annonceur(uuid)
from public, anon, authenticated;
-- Visiteurs : une vue de plus (avec sa source) ; l'annonceur de chaque annonce en ligne (équité de la liste)
grant execute on function public.compter_vue(uuid, text), public.groupe_annonceur(uuid) to anon, authenticated;
-- Comptes connectés : utiliser et programmer ses remontées, statistiques détaillées et contacts (abonnés) ;
-- l'équipe : Biens visités
grant execute on function
  public.utiliser_remontee(uuid, boolean, integer), public.programmer_remontees(uuid, boolean, integer),
  public.statistiques_detaillees(integer), public.suivi_contacts(integer),
  public.admin_biens_visites(), public.planifier_visite_agent(uuid, timestamptz, text),
  public.noter_visite_agent(uuid, text, text[], text)
to authenticated;
