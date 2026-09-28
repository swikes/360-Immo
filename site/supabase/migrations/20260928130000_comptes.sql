-- ══════════════════════════════════════════════════════════════════════════════
--  360-Immo.ci — Comptes (étape 3) : WhatsApp, second numéro, demande d'agence
-- ══════════════════════════════════════════════════════════════════════════════
--  Complète les profils avec ce que demande le formulaire d'inscription :
--    - numéro principal et second numéro, chacun « sur WhatsApp » ou non, type du second numéro ;
--    - demande d'agence : la personne qui s'inscrit comme agence donne le nom de son agence ; l'équipe
--      360-Immo.ci vérifie, puis la rattache à une agence (étape 7). En attendant, le compte est particulier.

alter table public.profils
  add column telephone_whatsapp boolean not null default true,
  add column telephone2_whatsapp boolean not null default false,
  add column telephone2_type text not null default 'mobile'
    constraint telephone2_type_connu check (telephone2_type in ('mobile', 'fixe', 'bureau', 'autre')),
  add column demande_agence text
    constraint demande_agence_nom check (demande_agence is null or char_length(btrim(demande_agence)) between 2 and 120),
  add column demande_agence_le timestamptz,
  -- Numéros enregistrés avec l'indicatif, comme le site les écrit : « +225 07 48 32 11 90 »
  add constraint telephone_format check (telephone is null or telephone ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$'),
  add constraint telephone2_format check (telephone2 is null or telephone2 ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$');

-- Texte « oui / non » des métadonnées d'inscription → booléen (absent : valeur par défaut)
create function public.meta_oui(valeur text, defaut boolean) returns boolean
language sql immutable set search_path = '' as $$
  select case lower(coalesce(valeur, '')) when 'true' then true when 'false' then false else defaut end
$$;

-- À l'inscription : profil rempli avec tout ce que la personne a saisi
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  agence text := nullif(btrim(m ->> 'agence'), '');
begin
  insert into public.profils (id, prenom, nom, telephone, telephone2, telephone_whatsapp, telephone2_whatsapp,
                              telephone2_type, demande_agence, demande_agence_le)
  values (
    new.id,
    coalesce(btrim(m ->> 'prenom'), ''),
    coalesce(btrim(m ->> 'nom'), ''),
    nullif(btrim(m ->> 'telephone'), ''),
    nullif(btrim(m ->> 'telephone2'), ''),
    public.meta_oui(m ->> 'whatsapp', true),
    public.meta_oui(m ->> 'whatsapp2', false),
    coalesce(nullif(m ->> 'telephone2_type', ''), 'mobile'),
    agence,
    case when agence is null then null else now() end
  );
  return new;
end $$;

-- Rôle et agence : jamais choisis soi-même. Date de la demande d'agence : posée par la base.
create or replace function public.profils_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.role := old.role;
    new.agence_id := old.agence_id;
    new.demande_agence_le := old.demande_agence_le;
  end if;
  if new.demande_agence is distinct from old.demande_agence then
    new.demande_agence := nullif(btrim(new.demande_agence), '');
    new.demande_agence_le := case when new.demande_agence is null then null else now() end;
  end if;
  new.id := old.id;
  return new;
end $$;
