-- Ce que Supabase fournit déjà dans chaque projet, simulé pour tester les migrations sans Supabase :
-- rôles (anon, authenticated, service_role), comptes (auth.users, auth.uid()), stockage des fichiers.
-- Utilisé seulement par les tests (tests/base.spec.ts), jamais envoyé à Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- ── Comptes ──
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
-- Identifiant du compte connecté, comme Supabase : lu dans le jeton de connexion
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;
-- Contenu du jeton de connexion, comme Supabase ; « aal » : aal2 quand le code de l'application a été donné
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb,
                  jsonb_strip_nulls(jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
                                                       'aal', nullif(current_setting('request.jwt.claim.aal', true), ''))))
$$;

-- ── Stockage des fichiers ──
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets,
  name text not null,
  owner uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

-- ── Droits de base de Supabase : tout est ouvert… puis fermé table par table par les règles (RLS) ──
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
