-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 7, 3e partie : documents de vérification et badges « vérifié »
--
--   Dossier « documents » (privé)   pièces d'identité, selfies, RCCM, titres de propriété : rangés sous l'identifiant
--                                   de la personne (<compte>/<fichier>), lus seulement par elle et par l'équipe ;
--                                   10 Mo au plus, JPEG, PNG, WebP ou PDF ; supprimés après la décision de l'équipe
--   Dossier « logos » (public)      logo d'une agence (<compte>/<fichier>), 2 Mo au plus, image
--   verifications                   les demandes : identité (pièce recto, verso facultatif, selfie avec la pièce),
--                                   agence (RCCM, logo facultatif), bien (titre de propriété ou mandat d'une annonce)
--   demander_verification()         une demande en cours à la fois par sujet ; pièces obligatoires vérifiées
--   mes_verifications()             Mon Espace → Vérification : où en est chaque demande
--   admin_verifications(), traiter_verification()   l'équipe valide (badge) ou refuse (motif, e-mail)
--   Badges                          identité vérifiée (profils.identite_verifiee_le) ; agence vérifiée et son logo ;
--                                   bien vérifié (annonces.verifiee) ; annonceur_public, vitrine et agences_partenaires
--                                   les montrent
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profils add column identite_verifiee_le timestamptz;

-- ══ Dossiers de fichiers ══
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le fichier est-il rangé dans le dossier de la personne connectée (<compte>/…) ?
create function public.fichier_a_moi(chemin text) returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and split_part(chemin, '/', 1) = auth.uid()::text;
$$;

create policy "Documents : ajoutés par leur propriétaire" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.fichier_a_moi(name));
create policy "Documents : lus par leur propriétaire et l'équipe" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and (public.fichier_a_moi(name) or public.compte_admin()));
create policy "Documents : supprimés par leur propriétaire et l'équipe" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and (public.fichier_a_moi(name) or public.compte_admin()));
create policy "Logos : ajoutés par leur propriétaire" on storage.objects
  for insert to authenticated with check (bucket_id = 'logos' and public.fichier_a_moi(name));
create policy "Logos : vus par leur propriétaire" on storage.objects
  for select to authenticated using (bucket_id = 'logos' and (public.fichier_a_moi(name) or public.compte_admin()));
create policy "Logos : supprimés par leur propriétaire et l'équipe" on storage.objects
  for delete to authenticated using (bucket_id = 'logos' and (public.fichier_a_moi(name) or public.compte_admin()));


-- ══ Les demandes ══
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils on delete cascade,
  type text not null check (type in ('identite', 'agence', 'bien')),
  annonce_id uuid references public.annonces on delete cascade,
  agence_id uuid references public.agences on delete set null,
  -- [{ piece, dossier, chemin, nom, type, taille }]
  fichiers jsonb not null default '[]' check (jsonb_typeof(fichiers) = 'array'),
  note text constraint verifications_note_longueur check (note is null or char_length(note) <= 1000),
  statut text not null default 'soumise' check (statut in ('soumise', 'validee', 'refusee')),
  motif text,
  cree_le timestamptz not null default now(),
  traitee_le timestamptz,
  traitee_par uuid references public.profils on delete set null,
  constraint verification_de_bien check ((type = 'bien') = (annonce_id is not null))
);
create index verifications_profil on public.verifications (profil_id, type, statut);
-- Une seule demande en cours par sujet (son identité, son agence, chacun de ses biens)
create unique index verifications_une_en_cours on public.verifications
  (profil_id, type, coalesce(annonce_id, '00000000-0000-0000-0000-000000000000'::uuid)) where statut = 'soumise';
comment on table public.verifications is 'Demandes de vérification (identité, agence, bien) ; documents dans le dossier privé « documents »';
alter table public.verifications enable row level security;
revoke all on public.verifications from public, anon, authenticated;
create trigger verifications_compte_suspendu before insert on public.verifications
  for each row execute function public.bloquer_compte_suspendu();

-- Journal de l'équipe : décisions sur les vérifications
alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee'));

-- La date de vérification de l'identité ne se choisit pas soi-même (complète la version des comptes)
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
    new.identite_verifiee_le := old.identite_verifiee_le;
  end if;
  if new.demande_agence is distinct from old.demande_agence then
    new.demande_agence := nullif(btrim(new.demande_agence), '');
    new.demande_agence_le := case when new.demande_agence is null then null else now() end;
  end if;
  new.id := old.id;
  return new;
end $$;

-- Pièces demandées pour chaque sujet : obligatoires et facultatives
create function public.pieces_verification(type text) returns jsonb
language sql immutable set search_path = '' as $$
  select case type
    when 'identite' then '{"obligatoires": ["piece_recto", "selfie"], "facultatives": ["piece_verso"]}'::jsonb
    when 'agence' then '{"obligatoires": ["rccm"], "facultatives": ["logo"]}'::jsonb
    when 'bien' then '{"obligatoires": ["titre"], "facultatives": ["autre"]}'::jsonb
  end;
$$;

create function public.demander_verification(type text, annonce uuid default null, fichiers jsonb default '[]', note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  p public.profils;
  a public.annonces;
  pieces jsonb := public.pieces_verification(type);
  f jsonb;
  piece text;
  texte text := nullif(btrim(coalesce(note, '')), '');
  nouvelle uuid;
begin
  if moi is null then
    raise exception 'Connectez-vous pour demander une vérification.' using errcode = '42501';
  end if;
  select * into p from public.profils where id = moi;
  if pieces is null then
    raise exception 'Vérification inconnue : %', type using errcode = '22023';
  end if;
  -- Le sujet
  if type = 'identite' and p.identite_verifiee_le is not null then
    raise exception 'Votre identité est déjà vérifiée.' using errcode = 'P0001';
  end if;
  if type = 'agence' then
    if p.agence_id is null then
      raise exception 'Réservé aux comptes agence : demandez d''abord un compte agence (Mon Espace → Mon profil).' using errcode = 'P0001';
    end if;
    if (select verifiee from public.agences where id = p.agence_id) then
      raise exception 'Votre agence est déjà vérifiée.' using errcode = 'P0001';
    end if;
  end if;
  if type = 'bien' then
    select * into a from public.annonces x where x.id = annonce and x.auteur_id = moi and x.statut in ('publiee', 'en_attente');
    if a.id is null then
      raise exception 'Choisissez une de vos annonces en ligne ou en vérification.' using errcode = 'P0001';
    end if;
    if a.verifiee then
      raise exception 'Ce bien est déjà vérifié.' using errcode = 'P0001';
    end if;
  elsif annonce is not null then
    raise exception 'Seule la vérification d''un bien concerne une annonce.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.verifications v where v.profil_id = moi and v.type = demander_verification.type
               and v.annonce_id is not distinct from annonce and v.statut = 'soumise') then
    raise exception 'Une demande est déjà en cours de vérification : l''équipe vous répond bientôt.' using errcode = 'P0001';
  end if;
  -- Les fichiers : 6 au plus, dans son dossier, déjà envoyés, aux bons formats
  if jsonb_typeof(fichiers) <> 'array' or jsonb_array_length(fichiers) = 0 or jsonb_array_length(fichiers) > 6 then
    raise exception 'Ajoutez les documents demandés (6 fichiers au plus).' using errcode = 'P0001';
  end if;
  for f in select * from jsonb_array_elements(fichiers) loop
    if not ((pieces -> 'obligatoires') ? (f ->> 'piece') or (pieces -> 'facultatives') ? (f ->> 'piece')) then
      raise exception 'Document inattendu : %', f ->> 'piece' using errcode = 'P0001';
    end if;
    if (f ->> 'dossier') <> (case when f ->> 'piece' = 'logo' then 'logos' else 'documents' end)
       or split_part(coalesce(f ->> 'chemin', ''), '/', 1) <> moi::text
       or not exists (select 1 from storage.objects o where o.bucket_id = f ->> 'dossier' and o.name = f ->> 'chemin') then
      raise exception 'Un document n''a pas été envoyé correctement : ajoutez-le de nouveau.' using errcode = 'P0001';
    end if;
    if coalesce(f ->> 'type', '') not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
       or (f ->> 'piece' = 'logo' and f ->> 'type' = 'application/pdf') then
      raise exception 'Format non accepté : photo (JPG, PNG, WebP) ou PDF.' using errcode = 'P0001';
    end if;
  end loop;
  for piece in select jsonb_array_elements_text(pieces -> 'obligatoires') loop
    if not exists (select 1 from jsonb_array_elements(fichiers) x where x ->> 'piece' = piece) then
      raise exception 'Document manquant : %', case piece
        when 'piece_recto' then 'la pièce d''identité (recto)' when 'selfie' then 'la photo de vous tenant la pièce'
        when 'rccm' then 'le RCCM de l''agence' else 'le titre de propriété ou le mandat' end using errcode = 'P0001';
    end if;
  end loop;
  if char_length(coalesce(texte, '')) > 1000 then
    raise exception 'Message trop long (1 000 caractères au plus).' using errcode = 'P0001';
  end if;
  insert into public.verifications (profil_id, type, annonce_id, agence_id, fichiers, note)
  values (moi, type, annonce, case when type = 'agence' then p.agence_id end, fichiers, texte)
  returning id into nouvelle;
  return nouvelle;
end $$;

-- Mon Espace → Vérification : identité, agence, et chacun de ses biens
create function public.mes_verifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  p public.profils;
begin
  if moi is null then
    raise exception 'Connectez-vous pour voir vos vérifications.' using errcode = '42501';
  end if;
  select * into p from public.profils where id = moi;
  return jsonb_build_object(
    'identite', jsonb_build_object(
      'verifiee_le', p.identite_verifiee_le,
      'demande', (select jsonb_build_object('statut', v.statut, 'motif', v.motif, 'le', coalesce(v.traitee_le, v.cree_le))
                    from public.verifications v where v.profil_id = moi and v.type = 'identite' order by v.cree_le desc limit 1)),
    'agence', case when p.agence_id is null then null else (
      select jsonb_build_object('nom', ag.nom, 'verifiee', ag.verifiee, 'logo', ag.logo,
        'demande', (select jsonb_build_object('statut', v.statut, 'motif', v.motif, 'le', coalesce(v.traitee_le, v.cree_le))
                      from public.verifications v where v.profil_id = moi and v.type = 'agence' order by v.cree_le desc limit 1))
      from public.agences ag where ag.id = p.agence_id) end,
    'biens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'titre', a.titre, 'reference', a.reference, 'statut', a.statut, 'verifiee', a.verifiee,
        'demande', (select jsonb_build_object('statut', v.statut, 'motif', v.motif, 'le', coalesce(v.traitee_le, v.cree_le))
                      from public.verifications v where v.annonce_id = a.id and v.profil_id = moi order by v.cree_le desc limit 1))
        order by a.verifiee, a.publiee_le desc nulls last)
      from public.annonces a where a.auteur_id = moi and a.statut in ('publiee', 'en_attente')
    ), '[]'));
end $$;


-- ══ L'équipe ══
create function public.admin_verifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'type', v.type, 'fichiers', v.fichiers, 'note', v.note, 'cree_le', v.cree_le,
      'compte', public.fiche_compte(p),
      'annonce', case when a.id is null then null else jsonb_build_object(
        'id', a.id, 'titre', a.titre, 'reference', a.reference, 'statut', a.statut,
        'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()),
        'commune', (select c.nom from public.communes c where c.id = a.commune_id),
        'type_bien', a.type_bien) end,
      'agence', (select ag.nom from public.agences ag where ag.id = v.agence_id))
      order by v.cree_le)
    from public.verifications v
    join public.profils p on p.id = v.profil_id
    left join public.annonces a on a.id = v.annonce_id
    where v.statut = 'soumise'
  ), '[]');
end $$;

-- Valider (badge) ou refuser (motif) ; renvoie les documents du dossier privé à supprimer
create function public.traiter_verification(verification uuid, decision text, motif text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.verifications;
  p public.profils;
  raison text := nullif(btrim(coalesce(motif, '')), '');
  quoi text;
  chemin_logo text;
begin
  perform public.exiger_admin();
  select * into v from public.verifications x where x.id = verification for update;
  if v.id is null or v.statut <> 'soumise' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = 'P0001';
  end if;
  select * into p from public.profils where id = v.profil_id;
  quoi := case v.type
    when 'identite' then 'votre identité'
    when 'agence' then 'votre agence « ' || coalesce((select nom from public.agences where id = v.agence_id), '') || ' »'
    else 'votre bien « ' || coalesce((select titre from public.annonces where id = v.annonce_id), '') || ' »' end;
  if decision = 'valider' then
    if v.type = 'identite' then
      update public.profils set identite_verifiee_le = now() where id = v.profil_id;
    elsif v.type = 'agence' then
      select x ->> 'chemin' into chemin_logo from jsonb_array_elements(v.fichiers) x where x ->> 'piece' = 'logo' limit 1;
      update public.agences set verifiee = true, logo = coalesce(chemin_logo, logo) where id = v.agence_id;
    else
      update public.annonces set verifiee = true where id = v.annonce_id;
    end if;
    update public.verifications set statut = 'validee', traitee_le = now(), traitee_par = auth.uid(), motif = null where id = v.id;
    perform public.noter_action_equipe('verification_validee', v.profil_id, v.agence_id, public.nom_complet(p), initcap(left(quoi, 1)) || substr(quoi, 2));
    perform public.prevenir_compte(v.profil_id, 'verification_validee', jsonb_build_object('type', v.type, 'quoi', quoi));
  elsif decision = 'refuser' then
    if raison is null or char_length(raison) < 5 then
      raise exception 'Écrivez le motif : la personne le recevra par e-mail.' using errcode = 'P0001';
    end if;
    update public.verifications set statut = 'refusee', traitee_le = now(), traitee_par = auth.uid(), motif = left(raison, 500)
     where id = v.id;
    perform public.noter_action_equipe('verification_refusee', v.profil_id, v.agence_id, public.nom_complet(p),
                                       initcap(left(quoi, 1)) || substr(quoi, 2) || ' : ' || left(raison, 500));
    perform public.prevenir_compte(v.profil_id, 'verification_refusee', jsonb_build_object('type', v.type, 'quoi', quoi, 'motif', left(raison, 500)));
  else
    raise exception 'Décision inconnue : %', decision using errcode = '22023';
  end if;
  -- Les documents (pas le logo) ne sont plus utiles : l'équipe les supprime du dossier privé
  return coalesce((select jsonb_agg(x ->> 'chemin') from jsonb_array_elements(v.fichiers) x where x ->> 'dossier' = 'documents'), '[]');
end $$;


-- ══ Badges ══
-- L'annonceur d'une annonce en ligne : « vérifié » = agence vérifiée, ou identité vérifiée (complète les vitrines)
create or replace function public.annonceur_public(annonce uuid)
returns table (code text, nom text, agence boolean, verifiee boolean)
language sql stable security definer set search_path = '' as $$
  select p.code_vitrine, public.nom_vitrine(p.prenom, p.nom, ag.nom),
         p.agence_id is not null or p.role = 'agence',
         coalesce(ag.verifiee, false) or (ag.id is null and p.identite_verifiee_le is not null)
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  left join public.agences ag on ag.id = p.agence_id
  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

-- Vitrine : + logo de l'agence vérifiée, et identité vérifiée d'un particulier
create or replace function public.vitrine(code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', p.code_vitrine,
    'nom', public.nom_vitrine(p.prenom, p.nom, ag.nom),
    'agence', p.agence_id is not null or p.role = 'agence',
    'verifiee', coalesce(ag.verifiee, false) or (ag.id is null and p.identite_verifiee_le is not null),
    'logo', case when ag.verifiee then ag.logo end,
    'membre_depuis', p.cree_le,
    'total', (select count(*) from public.annonces a
              where a.auteur_id = p.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())))
  from public.profils p
  left join public.agences ag on ag.id = p.agence_id
  where p.code_vitrine = lower(btrim(code));
$$;

-- Logo de l'annonceur d'une annonce en ligne (agence vérifiée) : pour la fiche
create function public.logo_annonceur(annonce uuid) returns text
language sql stable security definer set search_path = '' as $$
  select ag.logo
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  join public.agences ag on ag.id = p.agence_id and ag.verifiee
  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

-- Accueil : + logo (complète la version des comptes et agences)
create or replace function public.agences_partenaires(nombre integer default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.ligne order by x.annonces desc, x.nom), '[]')
  from (
    select ag.nom, count(a.id) as annonces, jsonb_build_object(
             'nom', ag.nom, 'annonces', count(a.id), 'logo', ag.logo,
             'vitrine', (select jsonb_build_object('code', p2.code_vitrine, 'nom', ag.nom)
                           from public.profils p2 where p2.agence_id = ag.id and p2.suspendu_le is null
                          order by (select count(*) from public.annonces o where o.auteur_id = p2.id and o.statut = 'publiee') desc
                          limit 1)) as ligne
    from public.agences ag
    join public.profils p on p.agence_id = ag.id and p.suspendu_le is null
    join public.annonces a on a.auteur_id = p.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())
    where ag.verifiee
    group by ag.id, ag.nom, ag.logo
    order by count(a.id) desc, ag.nom
    limit greatest(1, least(coalesce(nombre, 10), 30))
  ) x;
$$;


-- ══ Tableau de bord et compteurs (complètent les versions des comptes et agences) ══
create or replace function public.admin_tableau() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return jsonb_build_object(
    'a_verifier', (select count(*) from public.annonces where statut = 'en_attente'),
    'a_reverifier', (select count(*) from public.annonces where statut = 'en_attente' and publiee_le is not null),
    'signalees', (select count(distinct annonce_id) from public.signalements where statut = 'a_traiter'),
    'documents', (select count(*) from public.verifications where statut = 'soumise'),
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
                    + (select count(*) from public.verifications where statut = 'soumise')
                  else 0 end);
$$;

revoke execute on function public.fichier_a_moi(text), public.pieces_verification(text),
  public.demander_verification(text, uuid, jsonb, text), public.mes_verifications(), public.admin_verifications(),
  public.traiter_verification(uuid, text, text), public.logo_annonceur(uuid) from public;
grant execute on function public.fichier_a_moi(text), public.demander_verification(text, uuid, jsonb, text),
  public.mes_verifications(), public.admin_verifications(), public.traiter_verification(uuid, text, text) to authenticated;
grant execute on function public.pieces_verification(text) to anon, authenticated;
grant execute on function public.logo_annonceur(uuid) to anon, authenticated;
