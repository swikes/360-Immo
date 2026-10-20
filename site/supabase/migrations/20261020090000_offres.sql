-- ══════════════════════════════════════════════════════════════════════════════
--  360-Immo.ci — Offres payantes des annonceurs (étape 8a)
-- ══════════════════════════════════════════════════════════════════════════════
--  Règles : document « Offre commerciale » (8 octobre 2026). Chercher, contacter et publier restent gratuits.
--   - Remonter mon annonce : 1 000 FCFA ; pack de 3 remontées : 2 000 FCFA, à utiliser dans les 30 jours (à la main,
--     ou automatiquement tous les 3 jours). Une remontée replace l'annonce en tête des annonces ordinaires de
--     « Plus récentes », comme publiée à l'instant ; une par annonce toutes les 24 heures au plus ; annonce en ligne
--     seulement. La vraie date de publication reste affichée, aucune alerte n'est envoyée, le filtre « nouvelles
--     annonces (7 jours) » et le tri par prix ne changent pas, les 90 jours de validité ne sont pas prolongés.
--   - Premium 30 jours : 5 000 FCFA. Au-dessus des annonces ordinaires de « Plus récentes » (entre annonces Premium :
--     la plus récemment publiée ou remontée d'abord), badge, 30 photos au lieu de 20, « À la une » des e-mails
--     d'alerte (seulement si l'annonce a tout l'essentiel de l'alerte), rappel 3 jours avant la fin. Bien vendu,
--     loué ou retiré par son auteur avant la fin (ou annonce arrivée à sa fin) : les jours restants sont gardés et
--     se reportent sur une autre de ses annonces.
--   - Paiement par Mobile Money, par un agrégateur choisi plus tard. Le navigateur commence un paiement
--     (commencer_paiement) ; seul le serveur du site (clé secrète) le confirme, après la réponse de l'agrégateur
--     (confirmer_paiement), et l'offre s'applique aussitôt. Une offre qui ne peut plus s'appliquer est créditée.
--   - Reçu par e-mail ; historique dans Mon Espace ; onglet Paiements de l'Administration (remboursements notés).
--  Les prix sont dans la table « offres » : modifiables sans toucher au site (Supabase → Table Editor → offres).

-- ══ Les offres et leurs prix ══
create table public.offres (
  cle text primary key check (cle in ('remontee', 'remontees_3', 'premium_30')),
  nom text not null,
  prix integer not null check (prix > 0),
  remontees smallint not null default 0 check (remontees >= 0),
  jours_premium smallint not null default 0 check (jours_premium >= 0),
  ordre smallint not null default 0
);
comment on table public.offres is 'Offres payantes des annonceurs et leurs prix en FCFA (étape 8a)';
alter table public.offres enable row level security;
create policy "Offres : lisibles par tous" on public.offres for select to anon, authenticated using (true);
revoke insert, update, delete on public.offres from anon, authenticated;
insert into public.offres (cle, nom, prix, remontees, jours_premium, ordre) values
  ('remontee', 'Remonter mon annonce', 1000, 1, 0, 1),
  ('remontees_3', 'Pack de 3 remontées', 2000, 3, 0, 2),
  ('premium_30', 'Premium 30 jours', 5000, 0, 30, 3);

-- ══ Remontée d'une annonce : date posée par la base seule ══
alter table public.annonces add column remontee_le timestamptz;
-- (lisible comme les autres colonnes publiques : la liste des annonces en dépend, même sans compte)
grant select (remontee_le) on public.annonces to anon, authenticated;

create function public.annonces_remontee_serveur() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.remontee_le := case when tg_op = 'INSERT' then null else old.remontee_le end;
  end if;
  return new;
end $$;
create trigger annonces_remontee before insert or update on public.annonces
  for each row execute function public.annonces_remontee_serveur();

-- Une remontée ou le Premium ne changent pas la date « Modifiée le » de l'annonce (Mes annonces)
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
     and (to_jsonb(new) - 'vues' - 'modifie_le' - 'remontee_le' - 'premium' - 'premium_jusquau')
         is distinct from (to_jsonb(old) - 'vues' - 'modifie_le' - 'remontee_le' - 'premium' - 'premium_jusquau') then
    new.modifie_le := now();
  end if;
  return new;
end $$;

-- ══ Les annonces en ligne : place dans « Plus récentes » (publication ou dernière remontée) ══
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
  greatest(a.publiee_le, a.remontee_le) as classee_le
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

-- Cartes : sans la place dans la liste (la date affichée reste celle de la publication)
create or replace function public.carte_annonce(v public.annonces_en_ligne) returns jsonb
language sql stable set search_path = '' as $$
  select (to_jsonb(v) - 'description' - 'photos' - 'expire_le' - 'vues' - 'classee_le')
         || jsonb_build_object('photo', v.photos[1], 'nb_photos', coalesce(cardinality(v.photos), 0));
$$;

-- « Plus récentes » : Premium d'abord, puis la plus récemment publiée ou remontée ; tri par prix inchangé
create or replace function public.rechercher_annonces(criteres jsonb default '{}') returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  c jsonb := coalesce(criteres, '{}');
  par_page integer := least(48, greatest(1, coalesce((c ->> 'par_page')::integer, 24)));
  page integer := greatest(1, coalesce((c ->> 'page')::integer, 1));
  tri text := coalesce(c ->> 'tri', 'recent');
  total integer;
  cartes jsonb;
begin
  select count(*) into total from public.annonces_en_ligne v where public.annonce_correspond(v, c);
  select coalesce(jsonb_agg(public.carte_annonce(s.ligne) order by s.n), '[]') into cartes
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
    order by n
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

-- ══ Premium : 30 photos au lieu de 20 ══
create or replace function public.photos_annonce_limite() returns trigger
language plpgsql set search_path = '' as $$
declare
  limite integer := case when exists (select 1 from public.annonces a where a.id = new.annonce_id and a.premium
                                        and (a.premium_jusquau is null or a.premium_jusquau > now())) then 30 else 20 end;
begin
  if (select count(*) from public.photos_annonce where annonce_id = new.annonce_id) >= limite then
    raise exception '% photos au plus par annonce%.', limite,
      case when limite = 20 then ' (30 avec le Premium)' else '' end using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ══ Paiements ══
create sequence public.paiements_numero;
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  -- Référence lisible, donnée sur le reçu et au support : PAY-2026-00001
  reference text not null unique
    default ('PAY-' || extract(year from now())::integer || '-' || lpad(nextval('public.paiements_numero')::text, 5, '0')),
  profil_id uuid references public.profils on delete set null,
  offre text not null references public.offres,
  annonce_id uuid references public.annonces on delete set null,
  annonce jsonb not null default '{}',            -- { reference, titre } au moment de l'achat (reçu, historique)
  montant integer not null check (montant > 0),   -- FCFA
  automatique boolean not null default false,     -- pack : les remontées suivantes tous les 3 jours sur cette annonce
  statut text not null default 'en_attente' check (statut in ('en_attente', 'payee', 'echouee', 'remboursee')),
  fournisseur text,                               -- 'simulation' (essais), puis l'agrégateur choisi
  moyen text,                                     -- Orange Money, MTN MoMo, Moov Money, Wave (donné par l'agrégateur)
  transaction text,                               -- identifiant du paiement chez l'agrégateur
  resultat text,                                  -- ce qui a été appliqué, pour l'annonceur
  erreur text,                                    -- paiement échoué : la raison donnée par l'agrégateur
  cree_le timestamptz not null default now(),
  payee_le timestamptz,
  echouee_le timestamptz,
  remboursee_le timestamptz,
  rembourse_par uuid references public.profils on delete set null,
  motif_remboursement text
);
create index paiements_profil on public.paiements (profil_id, cree_le desc);
create index paiements_statut on public.paiements (statut, cree_le desc);
create index paiements_annonce on public.paiements (annonce_id);
comment on table public.paiements is 'Paiements des offres (lus seulement par les fonctions : mes_offres, admin_paiements)';
alter table public.paiements enable row level security;
revoke all on public.paiements from public, anon, authenticated;

-- Remontées payées d'avance (pack, ou remontée qui n'a pas pu s'appliquer) : à utiliser dans les 30 jours
create table public.credits_remontee (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils on delete cascade,
  paiement_id uuid references public.paiements on delete set null,
  restantes smallint not null check (restantes >= 0),
  expire_le timestamptz not null,
  cree_le timestamptz not null default now()
);
create index credits_remontee_profil on public.credits_remontee (profil_id, expire_le);
alter table public.credits_remontee enable row level security;
revoke all on public.credits_remontee from public, anon, authenticated;

-- Jours Premium gardés (bien vendu, loué ou retiré, annonce arrivée à sa fin, annonce plus en ligne au paiement)
create table public.credits_premium (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils on delete cascade,
  paiement_id uuid references public.paiements on delete set null,
  jours smallint not null check (jours > 0),
  origine text not null check (origine in ('report', 'fin_annonce', 'paiement')),
  annonce_reference text,                         -- l'annonce d'où viennent les jours
  utilise_le timestamptz,
  utilise_sur uuid references public.annonces on delete set null,
  cree_le timestamptz not null default now()
);
create index credits_premium_profil on public.credits_premium (profil_id) where utilise_le is null;
alter table public.credits_premium enable row level security;
revoke all on public.credits_premium from public, anon, authenticated;

-- Remontées automatiques : une annonce, tous les 3 jours, tant qu'il reste des remontées
create table public.remontees_programmees (
  annonce_id uuid primary key references public.annonces on delete cascade,
  profil_id uuid not null references public.profils on delete cascade,
  tous_les smallint not null default 3 check (tous_les between 1 and 30),
  prochaine timestamptz not null,
  cree_le timestamptz not null default now()
);
alter table public.remontees_programmees enable row level security;
revoke all on public.remontees_programmees from public, anon, authenticated;

-- Journal des remontées (statistiques, réclamations)
create table public.remontees (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  profil_id uuid references public.profils on delete set null,
  origine text not null check (origine in ('paiement', 'credit', 'automatique')),
  paiement_id uuid references public.paiements on delete set null,
  le timestamptz not null default now()
);
create index remontees_annonce on public.remontees (annonce_id, le desc);
alter table public.remontees enable row level security;
revoke all on public.remontees from public, anon, authenticated;

-- E-mails : reçu de paiement, Premium qui se termine bientôt
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check
    check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce', 'moderation', 'compte', 'contact', 'offre'));

-- Journal de l'équipe : remboursements
alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee', 'piece_consultee',
    'numero_libere', 'article_publie', 'article_retire', 'article_supprime', 'page_publiee', 'page_retiree',
    'paiement_rembourse'));

-- ══ Règles communes ══

-- « 20/10 à 10 h 05 » (heure d'Abidjan)
create function public.date_heure_courte(t timestamptz) returns text
language sql stable set search_path = '' as $$
  select to_char(t at time zone 'Africa/Abidjan', 'DD/MM "à" HH24 "h" MI');
$$;

-- Pourquoi cette annonce ne peut pas recevoir cette offre maintenant (null : elle peut)
create function public.offre_impossible(a public.annonces, offre text) returns text
language sql stable set search_path = '' as $$
  select case
    when a.id is null then 'Annonce introuvable.'
    when a.statut <> 'publiee' or (a.expire_le is not null and a.expire_le <= now())
      then 'Cette annonce n''est pas en ligne : seules les annonces en ligne peuvent être remontées ou passer en Premium.'
    when offre in ('remontee', 'remontees_3') and a.remontee_le > now() - interval '24 hours'
      then 'Cette annonce a déjà été remontée il y a moins de 24 heures : prochaine remontée possible le '
           || public.date_heure_courte(a.remontee_le + interval '24 hours') || '.'
  end;
$$;

-- Remonter (sans contrôle : déjà fait par l'appelant)
create function public.faire_remontee(annonce uuid, origine text, paiement uuid) returns void
language sql security definer set search_path = '' as $$
  update public.annonces set remontee_le = now() where id = annonce;
  insert into public.remontees (annonce_id, profil_id, origine, paiement_id)
  select a.id, a.auteur_id, origine, paiement from public.annonces a where a.id = annonce;
$$;

-- Ajouter des jours Premium à une annonce (à la suite du Premium en cours)
create function public.ajouter_premium(annonce uuid, jours integer) returns timestamptz
language sql security definer set search_path = '' as $$
  update public.annonces set premium = true,
         premium_jusquau = greatest(now(), case when premium then coalesce(premium_jusquau, now()) else now() end)
                           + make_interval(days => jours)
   where id = annonce
  returning premium_jusquau;
$$;

-- Une remontée payée d'avance (la plus proche de sa fin d'abord) ; false s'il n'y en a plus
create function public.prendre_credit_remontee(profil uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  credit uuid;
begin
  select id into credit from public.credits_remontee
   where profil_id = profil and restantes > 0 and expire_le > now()
   order by expire_le limit 1 for update;
  if credit is null then return false; end if;
  update public.credits_remontee set restantes = restantes - 1 where id = credit;
  return true;
end $$;

-- ══ Le parcours d'un paiement ══

-- 1. L'annonceur choisit une offre (navigateur) : paiement « en attente ». annonce : obligatoire, sauf pour le pack.
create function public.commencer_paiement(offre text, annonce uuid default null, automatique boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.offres;
  a public.annonces;
  pourquoi text;
  p public.paiements;
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
  if annonce is null and o.cle <> 'remontees_3' then
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
  end if;
  -- Contre les clics en rafale : 10 paiements commencés par heure au plus
  if (select count(*) from public.paiements x where x.profil_id = auth.uid() and x.cree_le > now() - interval '1 hour') >= 10 then
    raise exception 'Vous avez commencé beaucoup de paiements en peu de temps : réessayez dans une heure.' using errcode = 'P0001';
  end if;
  insert into public.paiements (profil_id, offre, annonce_id, annonce, montant, automatique)
  values (auth.uid(), o.cle, a.id,
          case when a.id is null then '{}'::jsonb else jsonb_build_object('reference', a.reference, 'titre', a.titre) end,
          o.prix, coalesce(automatique, false) and o.cle = 'remontees_3' and a.id is not null)
  returning * into p;
  return jsonb_build_object('id', p.id, 'reference', p.reference, 'offre', p.offre, 'nom', o.nom, 'montant', p.montant);
end $$;

-- 2. Le serveur du site le présente à l'agrégateur (clé secrète) : ce qu'il faut pour la page de paiement
create function public.paiement_a_payer(paiement uuid, fournisseur text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.paiements;
begin
  update public.paiements x set fournisseur = paiement_a_payer.fournisseur
   where x.id = paiement and x.statut = 'en_attente'
  returning * into p;
  if p.id is null then
    select * into p from public.paiements x where x.id = paiement;
  end if;
  if p.id is null then return null; end if;
  return jsonb_build_object(
    'id', p.id, 'reference', p.reference, 'statut', p.statut, 'montant', p.montant, 'offre', p.offre,
    'nom', (select o.nom from public.offres o where o.cle = p.offre), 'annonce', p.annonce,
    'email', (select u.email from auth.users u where u.id = p.profil_id),
    'prenom', (select pr.prenom from public.profils pr where pr.id = p.profil_id));
end $$;

-- L'offre payée s'applique ; ce qui ne peut plus s'appliquer est crédité (texte pour l'annonceur)
create function public.appliquer_offre(p public.paiements) returns text
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  fin timestamptz;
begin
  select * into a from public.annonces x where x.id = p.annonce_id;
  if p.offre = 'remontee' then
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
  else
    if a.id is not null and public.offre_impossible(a, 'premium_30') is null then
      fin := public.ajouter_premium(a.id, 30);
      return 'Annonce Premium jusqu''au ' || to_char(fin at time zone 'Africa/Abidjan', 'DD/MM/YYYY') || '.';
    end if;
    insert into public.credits_premium (profil_id, paiement_id, jours, origine, annonce_reference)
    values (p.profil_id, p.id, 30, 'paiement', p.annonce ->> 'reference');
    return 'L''annonce n''est plus en ligne : vos 30 jours Premium sont gardés, à utiliser sur une autre de vos annonces.';
  end if;
end $$;

-- 3. L'agrégateur confirme le paiement (serveur du site, clé secrète) : l'offre s'applique, le reçu part.
--    Une confirmation reçue deux fois ne s'applique qu'une fois.
create function public.confirmer_paiement(paiement uuid, transaction text default null, moyen text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.paiements;
  texte text;
begin
  select * into p from public.paiements x where x.id = paiement for update;
  if p.id is null then
    raise exception 'Paiement introuvable.' using errcode = 'P0001';
  end if;
  if p.statut in ('payee', 'remboursee') then
    return jsonb_build_object('statut', p.statut, 'resultat', p.resultat, 'deja', true);
  end if;
  -- un paiement d'abord signalé échoué peut encore réussir (l'agrégateur fait foi)
  update public.paiements x set statut = 'payee', payee_le = now(), erreur = null,
         transaction = coalesce(confirmer_paiement.transaction, x.transaction), moyen = coalesce(confirmer_paiement.moyen, x.moyen)
   where x.id = p.id
  returning * into p;
  texte := public.appliquer_offre(p);
  update public.paiements set resultat = texte where id = p.id;
  if p.profil_id is not null then
    insert into public.notifications (modele, profil_id, cle, donnees)
    values ('offre', p.profil_id, 'recu:' || p.id, jsonb_build_object(
      'evenement', 'recu', 'paiement', p.reference, 'offre', (select o.nom from public.offres o where o.cle = p.offre),
      'montant', p.montant, 'moyen', p.moyen, 'annonce', p.annonce, 'resultat', texte, 'payee_le', p.payee_le));
  end if;
  return jsonb_build_object('statut', 'payee', 'resultat', texte, 'deja', false);
end $$;

-- Paiement refusé ou annulé (solde insuffisant, annulation) : rien n'est appliqué
create function public.echec_paiement(paiement uuid, erreur text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.paiements;
begin
  update public.paiements x set statut = 'echouee', echouee_le = now(), erreur = left(echec_paiement.erreur, 300)
   where x.id = paiement and x.statut = 'en_attente'
  returning * into p;
  if p.id is null then
    select * into p from public.paiements x where x.id = paiement;
  end if;
  return jsonb_build_object('statut', p.statut);
end $$;

-- Où en est un de ses paiements (page de retour après le paiement)
create function public.mon_paiement(paiement uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'reference', p.reference, 'statut', p.statut, 'offre', p.offre, 'nom', o.nom,
                            'montant', p.montant, 'annonce', p.annonce, 'resultat', p.resultat, 'erreur', p.erreur,
                            'cree_le', p.cree_le, 'payee_le', p.payee_le)
  from public.paiements p join public.offres o on o.cle = p.offre
  where p.id = paiement and p.profil_id = auth.uid();
$$;

-- ══ Utiliser ce qui est payé d'avance ══

-- Une remontée payée d'avance sur une de ses annonces ; automatique : les suivantes tous les 3 jours
create function public.utiliser_remontee(annonce uuid, automatique boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  pourquoi text;
begin
  select * into a from public.annonces x where x.id = utiliser_remontee.annonce and x.auteur_id = auth.uid();
  pourquoi := public.offre_impossible(a, 'remontee');
  if pourquoi is not null then
    raise exception '%', pourquoi using errcode = 'P0001';
  end if;
  if not public.prendre_credit_remontee(auth.uid()) then
    raise exception 'Vous n''avez plus de remontée d''avance : achetez une remontée ou un pack.' using errcode = 'P0001';
  end if;
  perform public.faire_remontee(a.id, 'credit', null);
  if automatique then
    insert into public.remontees_programmees (annonce_id, profil_id, prochaine)
    values (a.id, auth.uid(), now() + interval '3 days')
    on conflict (annonce_id) do update set prochaine = excluded.prochaine;
  end if;
  return jsonb_build_object('restantes', (select coalesce(sum(restantes), 0) from public.credits_remontee
                                           where profil_id = auth.uid() and expire_le > now()));
end $$;

-- Remontées automatiques d'une de ses annonces : les arrêter, ou les (re)lancer (prochaine dans 3 jours)
create function public.programmer_remontees(annonce uuid, actif boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.annonces a where a.id = annonce and a.auteur_id = auth.uid()) then
    raise exception 'Annonce introuvable.' using errcode = 'P0001';
  end if;
  if actif then
    if not exists (select 1 from public.credits_remontee c where c.profil_id = auth.uid() and c.restantes > 0 and c.expire_le > now()) then
      raise exception 'Vous n''avez plus de remontée d''avance : achetez un pack pour les remontées automatiques.' using errcode = 'P0001';
    end if;
    insert into public.remontees_programmees (annonce_id, profil_id, prochaine)
    values (annonce, auth.uid(), now() + interval '3 days')
    on conflict (annonce_id) do nothing;
  else
    delete from public.remontees_programmees r where r.annonce_id = annonce and r.profil_id = auth.uid();
  end if;
end $$;

-- Ses jours Premium gardés, tous sur une de ses annonces en ligne
create function public.utiliser_jours_premium(annonce uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  pourquoi text;
  jours integer;
  fin timestamptz;
begin
  select * into a from public.annonces x where x.id = utiliser_jours_premium.annonce and x.auteur_id = auth.uid();
  pourquoi := public.offre_impossible(a, 'premium_30');
  if pourquoi is not null then
    raise exception '%', pourquoi using errcode = 'P0001';
  end if;
  select coalesce(sum(c.jours), 0) into jours from public.credits_premium c where c.profil_id = auth.uid() and c.utilise_le is null;
  if jours = 0 then
    raise exception 'Vous n''avez pas de jours Premium gardés.' using errcode = 'P0001';
  end if;
  update public.credits_premium c set utilise_le = now(), utilise_sur = a.id where c.profil_id = auth.uid() and c.utilise_le is null;
  fin := public.ajouter_premium(a.id, jours);
  return fin;
end $$;

-- Jours Premium restants d'une annonce qui quitte le site par la volonté de son auteur (vendue, louée, retirée,
-- supprimée) : gardés pour une autre de ses annonces. Pas pour une annonce retirée par l'équipe (règles non respectées).
create function public.annonces_report_premium() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  jours integer;
begin
  -- (compte supprimé : ses annonces partent avec lui, rien à garder)
  if old.premium and old.premium_jusquau > now() and auth.uid() = old.auteur_id
     and (tg_op = 'DELETE' or (new.statut = 'archivee' and old.statut <> 'archivee'))
     and exists (select 1 from public.profils p where p.id = old.auteur_id) then
    jours := ceil(extract(epoch from old.premium_jusquau - now()) / 86400)::integer;
    if jours > 0 then
      insert into public.credits_premium (profil_id, jours, origine, annonce_reference)
      values (old.auteur_id, jours, 'report', old.reference);
    end if;
    if tg_op = 'UPDATE' then
      new.premium := false;
      new.premium_jusquau := null;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
-- (après annonces_controler : les déclencheurs « before » passent par ordre alphabétique)
create trigger annonces_report_premium before update or delete on public.annonces
  for each row execute function public.annonces_report_premium();

-- ══ Mon Espace : ce qui est payé d'avance, programmé, et l'historique des paiements ══
create function public.mes_offres() returns jsonb
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
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', x.id, 'reference', x.reference, 'offre', x.offre, 'nom', o.nom, 'montant', x.montant,
                     'statut', x.statut, 'annonce', x.annonce, 'resultat', x.resultat, 'erreur', x.erreur, 'moyen', x.moyen,
                     'cree_le', x.cree_le, 'payee_le', x.payee_le, 'remboursee_le', x.remboursee_le) order by x.cree_le desc), '[]')
                  from (select * from public.paiements p where p.profil_id = auth.uid()
                        and (p.statut <> 'en_attente' or p.cree_le > now() - interval '1 day')
                        order by p.cree_le desc limit 50) x
                  join public.offres o on o.cle = x.offre));
$$;

-- ══ Chaque matin (clé secrète) : remontées automatiques, fin du Premium, rappels ══
create function public.taches_offres() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  remontees integer := 0;
  rappels integer := 0;
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
    elsif public.prendre_credit_remontee(r.profil_id) then
      perform public.faire_remontee(r.annonce_id, 'automatique', null);
      update public.remontees_programmees set prochaine = now() + make_interval(days => r.tous_les) where annonce_id = r.annonce_id;
      remontees := remontees + 1;
    else
      delete from public.remontees_programmees where annonce_id = r.annonce_id;   -- plus de remontée d'avance
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
  return jsonb_build_object('remontees', remontees, 'rappels', rappels, 'reports', reports);
end $$;

-- ══ Administration → Paiements ══
create function public.admin_paiements(jours integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  depuis timestamptz := now() - make_interval(days => least(greatest(coalesce(jours, 30), 1), 366));
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'jours', least(greatest(coalesce(jours, 30), 1), 366),
    'encaisse', (select coalesce(sum(montant), 0) from public.paiements where statut = 'payee' and payee_le >= depuis),
    'nombre', (select count(*) from public.paiements where statut = 'payee' and payee_le >= depuis),
    'rembourse', (select coalesce(sum(montant), 0) from public.paiements where statut = 'remboursee' and remboursee_le >= depuis),
    'echoues', (select count(*) from public.paiements where statut = 'echouee' and echouee_le >= depuis),
    'en_attente', (select count(*) from public.paiements where statut = 'en_attente' and cree_le > now() - interval '1 day'),
    'par_offre', (select coalesce(jsonb_object_agg(x.offre, jsonb_build_object('nombre', x.n, 'montant', x.m)), '{}')
                  from (select offre, count(*) as n, sum(montant) as m from public.paiements
                        where statut = 'payee' and payee_le >= depuis group by offre) x),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'reference', p.reference, 'offre', p.offre, 'nom', o.nom, 'montant', p.montant,
                    'statut', p.statut, 'annonce', p.annonce, 'annonce_id', p.annonce_id, 'resultat', p.resultat,
                    'erreur', p.erreur, 'fournisseur', p.fournisseur, 'moyen', p.moyen, 'transaction', p.transaction,
                    'cree_le', p.cree_le, 'payee_le', p.payee_le, 'remboursee_le', p.remboursee_le,
                    'motif_remboursement', p.motif_remboursement,
                    'compte', case when pr.id is null then null else jsonb_build_object(
                      'id', pr.id, 'nom', nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), ''), 'telephone', pr.telephone,
                      'email', (select u.email from auth.users u where u.id = pr.id)) end)
                  order by p.cree_le desc), '[]')
                  from (select * from public.paiements x where x.cree_le >= depuis and x.statut <> 'en_attente'
                        order by x.cree_le desc limit 200) p
                  join public.offres o on o.cle = p.offre
                  left join public.profils pr on pr.id = p.profil_id)
  );
end $$;

-- Remboursement (fait chez l'agrégateur ; noté ici) : ce qui reste de l'offre est retiré
create function public.rembourser_paiement(paiement uuid, motif text) returns void
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
  perform public.noter_action_equipe('paiement_rembourse', p.profil_id, null,
    coalesce((select nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), '') from public.profils pr where pr.id = p.profil_id), 'Compte supprimé'),
    p.reference || ' · ' || p.montant || ' FCFA · ' || raison);
end $$;

-- ══ Alertes : jusqu'à 2 annonces Premium « À la une » qui ont tout l'essentiel de l'alerte ══
create or replace function public.preparer_alertes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  al public.alertes;
  maintenant timestamptz := now();
  v2 boolean;
  total integer;
  cartes jsonb;
  une jsonb;
  n integer := 0;
begin
  for al in
    select * from public.alertes x
    where x.active
      and x.verifiee_le < maintenant - case when x.frequence = 'hebdomadaire' then interval '6 days 20 hours'
                                            else interval '20 hours' end
    order by x.verifiee_le
    for update skip locked
  loop
    begin
      v2 := (al.criteres ->> 'v') = '2';
      select count(*)::integer,
             coalesce(jsonb_agg(public.carte_annonce(s.v)
                                || case when v2 then jsonb_build_object('souhaits', s.souhaits) else '{}'::jsonb end
                                order by s.rang) filter (where s.rang <= 6), '[]')
        into total, cartes
      from (
        select t.v, t.souhaits,
               row_number() over (order by jsonb_array_length(t.souhaits -> 'ok') desc, (t.v).publiee_le desc, (t.v).reference) as rang
        from (
          select v, case when v2 then public.alerte_souhaits(v, al.criteres) else '{"ok": []}'::jsonb end as souhaits
          from public.annonces_en_ligne v
          where v.publiee_le > al.verifiee_le and v.publiee_le <= maintenant
            and case when v2 then public.alerte_correspond(v, al.criteres) else public.annonce_correspond(v, al.criteres) end
        ) t
      ) s;
      if total > 0 then
        -- « À la une » : annonces Premium qui ont tout l'essentiel, pas déjà dans la liste
        select coalesce(jsonb_agg(public.carte_annonce(u.v) order by u.classee desc), '[]') into une
        from (
          select v, v.classee_le as classee from public.annonces_en_ligne v
          where v.premium
            and not (cartes @> jsonb_build_array(jsonb_build_object('id', v.id)))
            and case when v2 then public.alerte_correspond(v, al.criteres) else public.annonce_correspond(v, al.criteres) end
          order by v.classee_le desc limit 2
        ) u;
        insert into public.notifications (modele, profil_id, cle, donnees)
        values ('alerte', al.profil_id, 'alerte:' || al.id, jsonb_build_object(
          'alerte', jsonb_build_object('id', al.id, 'nom', al.nom, 'adresse', al.adresse, 'jeton', al.jeton,
                                       'frequence', al.frequence),
          'total', total, 'annonces', cartes)
          || case when jsonb_array_length(une) > 0 then jsonb_build_object('a_la_une', une) else '{}'::jsonb end);
        n := n + 1;
      end if;
      update public.alertes set verifiee_le = maintenant,
             dernier_envoi = case when total > 0 then maintenant else dernier_envoi end
       where id = al.id;
    exception when others then
      update public.alertes set verifiee_le = maintenant where id = al.id;
    end;
  end loop;
  return n;
end $$;

-- ══ Droits ══
revoke execute on function
  public.date_heure_courte(timestamptz), public.offre_impossible(public.annonces, text),
  public.faire_remontee(uuid, text, uuid), public.ajouter_premium(uuid, integer), public.prendre_credit_remontee(uuid),
  public.commencer_paiement(text, uuid, boolean), public.paiement_a_payer(uuid, text), public.appliquer_offre(public.paiements),
  public.confirmer_paiement(uuid, text, text), public.echec_paiement(uuid, text), public.mon_paiement(uuid),
  public.utiliser_remontee(uuid, boolean), public.programmer_remontees(uuid, boolean), public.utiliser_jours_premium(uuid),
  public.mes_offres(), public.taches_offres(), public.admin_paiements(integer), public.rembourser_paiement(uuid, text)
from public, anon, authenticated;
-- Comptes connectés : acheter, suivre, utiliser ce qui est payé d'avance ; l'équipe : onglet Paiements
grant execute on function
  public.commencer_paiement(text, uuid, boolean), public.mon_paiement(uuid), public.utiliser_remontee(uuid, boolean),
  public.programmer_remontees(uuid, boolean), public.utiliser_jours_premium(uuid), public.mes_offres(),
  public.admin_paiements(integer), public.rembourser_paiement(uuid, text)
to authenticated;
-- Serveur du site seulement (clé secrète) : présenter, confirmer, refuser un paiement ; tâche du matin
grant execute on function
  public.paiement_a_payer(uuid, text), public.confirmer_paiement(uuid, text, text), public.echec_paiement(uuid, text),
  public.taches_offres()
to service_role;
