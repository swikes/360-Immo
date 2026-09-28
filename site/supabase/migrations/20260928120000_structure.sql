-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — structure de la base de données (étape 2)
--
-- Lieux, types de bien, comptes, agences, annonces et leurs photos, favoris,
-- messages, demandes de visite, alertes.
-- Les règles des biens du site (lib/regles-biens.ts) sont AUSSI vérifiées ici :
-- une annonce incohérente (terrain meublé, chambre d'hôtel à vendre, loyer « par
-- mois » sur une vente…) est refusée, même si elle n'arrive pas par le site.
-- Les droits d'accès (qui voit et modifie quoi) sont dans la migration suivante.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Valeurs possibles ──
create type public.transaction_bien as enum ('vente', 'location');
create type public.unite_loyer as enum ('nuit', 'jour', 'mois', 'annee');
create type public.statut_annonce as enum ('brouillon', 'en_attente', 'publiee', 'refusee', 'archivee');
create type public.role_profil as enum ('particulier', 'agence', 'admin');
-- « Déjà meublé », « dans un immeuble » : jamais, au choix, ou toujours (selon le type de bien)
create type public.niveau_option as enum ('non', 'option', 'toujours');
create type public.statut_visite as enum ('demandee', 'confirmee', 'annulee', 'effectuee');
create type public.frequence_alerte as enum ('immediate', 'quotidienne', 'hebdomadaire');

-- Date de dernière modification, mise à jour toute seule
create function public.maj_modifie_le() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.modifie_le := now();
  return new;
end $$;


-- ══════════════════════════════ LIEUX ══════════════════════════════
create table public.villes (
  id smallint generated always as identity primary key,
  nom text not null unique
);
comment on table public.villes is 'Villes de Côte d''Ivoire (liste du site : lib/lieux.ts)';

create table public.communes (
  id integer generated always as identity primary key,
  ville_id smallint not null references public.villes on delete cascade,
  nom text not null,
  unique (ville_id, nom)
);
comment on table public.communes is 'Communes de chaque ville ; une ville d''une seule commune a une commune du même nom';

create table public.quartiers (
  id integer generated always as identity primary key,
  commune_id integer not null references public.communes on delete cascade,
  nom text not null,
  unique (commune_id, nom)
);
comment on table public.quartiers is 'Quartiers de chaque commune (pour l''instant : communes d''Abidjan)';


-- ══════════════════════════════ TYPES DE BIEN ══════════════════════════════
-- Une ligne par type, avec ce qui a du sens pour lui (mêmes règles que lib/regles-biens.ts,
-- recopiées par supabase/references.ts : ne pas modifier à la main).
create table public.types_bien (
  cle text primary key,                       -- appartement, maison… (adresses du site)
  nom text not null unique,                   -- Appartement, Maison…
  ordre smallint not null,
  vendable boolean not null,                  -- sinon : location seulement (chambre d'hôtel)
  meuble public.niveau_option not null,       -- « Déjà meublé »
  immeuble public.niveau_option not null,     -- dans un immeuble (et donc un étage)
  pieces text not null check (pieces in ('non', 'oui', 'studio')),
  chambres boolean not null,
  sanitaires text,                            -- « Salles de bain », « Toilettes » ou rien
  loyer_par public.unite_loyer[] not null,    -- unités de loyer possibles en location
  caution boolean not null,                   -- mois de caution en location
  surface text not null,                      -- « Surface » ou « Superficie »
  commodites text[] not null                  -- commodités qui ont un sens pour ce type
);


-- ══════════════════════════════ COMPTES ══════════════════════════════
create table public.agences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),   -- dans les adresses : kamika-immobilier
  telephone text,
  email text,
  logo text,
  commune_id integer references public.communes,
  verifiee boolean not null default false,    -- documents contrôlés par 360-Immo.ci
  cree_le timestamptz not null default now()
);

-- Un profil par compte (créé tout seul à l'inscription, voir plus bas)
create table public.profils (
  id uuid primary key references auth.users on delete cascade,
  prenom text not null default '',
  nom text not null default '',
  telephone text,                             -- avec l'indicatif : +225 07 48 32 11 90
  telephone2 text,
  role public.role_profil not null default 'particulier',
  agence_id uuid references public.agences on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create trigger profils_modifie_le before update on public.profils
  for each row execute function public.maj_modifie_le();

-- À l'inscription : profil rempli avec le prénom, le nom et le téléphone saisis
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id, prenom, nom, telephone, telephone2)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'prenom', ''),
    coalesce(new.raw_user_meta_data ->> 'nom', ''),
    nullif(new.raw_user_meta_data ->> 'telephone', ''),
    nullif(new.raw_user_meta_data ->> 'telephone2', '')
  );
  return new;
end $$;
create trigger inscription_cree_profil after insert on auth.users
  for each row execute function public.creer_profil();


-- ══════════════════════════════ ANNONCES ══════════════════════════════
create sequence public.annonces_numero;

create table public.annonces (
  id uuid primary key default gen_random_uuid(),
  -- Référence lisible, donnée au client et au support : IMM-2026-00001
  reference text not null unique
    default ('IMM-' || extract(year from now())::integer || '-' || lpad(nextval('public.annonces_numero')::text, 5, '0')),
  auteur_id uuid not null default auth.uid() references public.profils on delete cascade,
  agence_id uuid references public.agences on delete set null,
  -- brouillon → en_attente (vérification par 360-Immo.ci) → publiee ou refusee ; archivee quand c'est fini
  statut public.statut_annonce not null default 'brouillon',
  motif_refus text,

  -- Le bien
  transaction public.transaction_bien not null,
  type_bien text not null references public.types_bien,
  titre text not null check (char_length(titre) between 10 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  prix bigint not null check (prix > 0),                 -- en FCFA : prix de vente, ou loyer par loyer_par
  loyer_par public.unite_loyer,                          -- location seulement
  caution_mois smallint,                                 -- location seulement

  -- Où
  ville_id smallint not null references public.villes,
  commune_id integer not null references public.communes,
  quartier_id integer references public.quartiers,
  adresse text,                                          -- repère : « près de la pharmacie… »
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),

  -- Caractéristiques
  surface numeric(10, 2) check (surface is null or surface > 0),   -- m²
  pieces smallint check (pieces is null or pieces between 1 and 50),
  studio boolean not null default false,
  chambres smallint check (chambres is null or chambres between 0 and 49),
  sanitaires smallint check (sanitaires is null or sanitaires between 0 and 50),
  meuble boolean not null default false,
  dans_immeuble boolean not null default false,
  etage smallint check (etage is null or etage between 0 and 100),   -- 0 : rez-de-chaussée
  commodites text[] not null default '{}',

  -- Contact affiché sur l'annonce
  contact_nom text,
  contact_telephone text,
  contact_telephone2 text,

  -- Réservé à 360-Immo.ci
  premium boolean not null default false,
  premium_jusquau timestamptz,
  verifiee boolean not null default false,               -- bien visité et confirmé par un agent
  vues integer not null default 0,
  publiee_le timestamptz,

  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),

  constraint loyer_selon_transaction check ((transaction = 'vente') = (loyer_par is null)),
  constraint caution_en_location check (caution_mois is null or (transaction = 'location' and caution_mois between 0 and 24)),
  -- le séjour compte pour une pièce : 3 pièces → 2 chambres au plus
  constraint chambres_selon_pieces check (chambres is null or pieces is null or chambres <= pieces - 1),
  constraint studio_une_piece check (not studio or pieces = 1),
  constraint etage_dans_immeuble check (etage is null or dans_immeuble)
);
comment on table public.annonces is 'Annonces de vente et de location ; règles des biens vérifiées par annonces_verifier()';

create index annonces_recherche on public.annonces (statut, transaction, type_bien);
create index annonces_commune on public.annonces (commune_id);
create index annonces_quartier on public.annonces (quartier_id);
create index annonces_prix on public.annonces (prix);
create index annonces_publiee_le on public.annonces (publiee_le desc);
create index annonces_auteur on public.annonces (auteur_id);
create index annonces_commodites on public.annonces using gin (commodites);

-- Règles des biens et cohérence du lieu (messages en français, affichables tels quels)
create function public.annonces_verifier() returns trigger
language plpgsql set search_path = '' as $$
declare
  t public.types_bien;
begin
  select * into t from public.types_bien where cle = new.type_bien;
  if new.transaction = 'vente' and not t.vendable then
    raise exception '« % » ne se vend pas : location uniquement.', t.nom using errcode = 'check_violation';
  end if;
  if new.transaction = 'location' and not (new.loyer_par = any (t.loyer_par)) then
    raise exception '« % » ne se loue pas à la %.', t.nom,
      case new.loyer_par when 'nuit' then 'nuit' when 'jour' then 'journée' when 'mois' then 'mois' else 'année' end
      using errcode = 'check_violation';
  end if;
  if new.caution_mois is not null and not t.caution then
    raise exception 'Pas de caution pour « % ».', t.nom using errcode = 'check_violation';
  end if;
  if t.pieces = 'non' and (new.pieces is not null or new.studio) then
    raise exception 'Pas de nombre de pièces pour « % ».', t.nom using errcode = 'check_violation';
  end if;
  if new.studio and t.pieces <> 'studio' then
    raise exception '« Studio » ne concerne que les appartements.' using errcode = 'check_violation';
  end if;
  if not t.chambres and new.chambres is not null then
    raise exception 'Pas de chambres pour « % ».', t.nom using errcode = 'check_violation';
  end if;
  if t.sanitaires is null and new.sanitaires is not null then
    raise exception 'Pas de salles de bain ni de toilettes pour « % ».', t.nom using errcode = 'check_violation';
  end if;
  if t.meuble = 'non' and new.meuble then
    raise exception '« % » ne peut pas être « déjà meublé ».', t.nom using errcode = 'check_violation';
  end if;
  if t.meuble = 'toujours' then new.meuble := true; end if;
  if t.immeuble = 'non' and (new.dans_immeuble or new.etage is not null) then
    raise exception '« % » n''est jamais dans un immeuble : pas d''étage.', t.nom using errcode = 'check_violation';
  end if;
  if t.immeuble = 'toujours' then new.dans_immeuble := true; end if;
  if not (new.commodites <@ t.commodites) then
    raise exception 'Commodités sans objet pour « % » : %.', t.nom,
      array_to_string(array(select c from unnest(new.commodites) c where c <> all (t.commodites)), ', ')
      using errcode = 'check_violation';
  end if;
  -- Le lieu : la commune est dans la ville, le quartier dans la commune
  if not exists (select 1 from public.communes where id = new.commune_id and ville_id = new.ville_id) then
    raise exception 'Cette commune n''est pas dans cette ville.' using errcode = 'check_violation';
  end if;
  if new.quartier_id is not null
     and not exists (select 1 from public.quartiers where id = new.quartier_id and commune_id = new.commune_id) then
    raise exception 'Ce quartier n''est pas dans cette commune.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger annonces_verifier before insert or update on public.annonces
  for each row execute function public.annonces_verifier();

create table public.photos_annonce (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  chemin text not null unique,                -- dans le stockage « photos-annonces » : <id de l'annonce>/<fichier>
  ordre smallint not null default 0,          -- 0 : photo principale
  cree_le timestamptz not null default now()
);
create index photos_annonce_annonce on public.photos_annonce (annonce_id, ordre);


-- ══════════════════════════════ ÉCHANGES ══════════════════════════════
create table public.favoris (
  profil_id uuid not null default auth.uid() references public.profils on delete cascade,
  annonce_id uuid not null references public.annonces on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (profil_id, annonce_id)
);

-- Une conversation par annonce et par personne intéressée
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  client_id uuid not null default auth.uid() references public.profils on delete cascade,
  annonceur_id uuid not null references public.profils on delete cascade,
  cree_le timestamptz not null default now(),
  dernier_message_le timestamptz,
  unique (annonce_id, client_id),
  constraint pas_avec_soi_meme check (client_id <> annonceur_id)
);

-- L'annonceur est l'auteur de l'annonce (jamais choisi par le client)
create function public.conversations_annonceur() returns trigger
language plpgsql set search_path = '' as $$
begin
  select auteur_id into new.annonceur_id from public.annonces where id = new.annonce_id;
  if new.annonceur_id is null then
    raise exception 'Annonce introuvable.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger conversations_annonceur before insert on public.conversations
  for each row execute function public.conversations_annonceur();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  auteur_id uuid not null default auth.uid() references public.profils on delete cascade,
  contenu text not null check (char_length(btrim(contenu)) between 1 and 2000),
  lu_le timestamptz,
  cree_le timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, cree_le);

-- Un message envoyé ne change plus : seule sa lecture (lu_le) peut être notée
create function public.messages_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.contenu := old.contenu;
  new.auteur_id := old.auteur_id;
  new.conversation_id := old.conversation_id;
  new.cree_le := old.cree_le;
  return new;
end $$;
create trigger messages_proteger before update on public.messages
  for each row execute function public.messages_proteger();

-- Date du dernier message sur la conversation (liste des conversations triée)
create function public.messages_dernier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set dernier_message_le = new.cree_le where id = new.conversation_id;
  return new;
end $$;
create trigger messages_dernier after insert on public.messages
  for each row execute function public.messages_dernier();

-- Demandes de visite (possibles sans compte : nom et téléphone suffisent)
create table public.visites (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  demandeur_id uuid default auth.uid() references public.profils on delete set null,
  nom text not null check (char_length(btrim(nom)) between 2 and 80),
  telephone text not null check (char_length(telephone) between 6 and 30),
  message text check (message is null or char_length(message) <= 1000),
  creneau timestamptz not null,
  statut public.statut_visite not null default 'demandee',
  cree_le timestamptz not null default now()
);
create index visites_annonce on public.visites (annonce_id, creneau);

-- Alertes : les critères sont ceux de l'adresse de recherche (tx, type, q, min, max, pieces…)
create table public.alertes (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null default auth.uid() references public.profils on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 80),
  criteres jsonb not null default '{}' check (jsonb_typeof(criteres) = 'object'),
  frequence public.frequence_alerte not null default 'quotidienne',
  active boolean not null default true,
  cree_le timestamptz not null default now()
);
