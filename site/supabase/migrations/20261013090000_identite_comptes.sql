-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 7, 4e partie : identité vérifiée (utile en cas de plainte), un numéro et un e-mail par compte
--
--   Pièce d'identité      CNI (recto et verso) ou passeport (page photo), et la photo de soi tenant la pièce
--   Validation            l'équipe note le numéro et la date de fin de la pièce : une pièce ne vérifie qu'un compte
--                         (sauf compte suspendu) ; le badge s'arrête à la date de fin ; changer de nom retire le badge
--   Conservation          pièce d'identité validée : gardée tant que le compte existe, puis 1 an (en cas de plainte) ;
--                         les autres documents : supprimés après la décision. La tâche du matin supprime ce qui a fait
--                         son temps (documents_a_supprimer, documents_supprimes : clé secrète seulement)
--   Plainte               l'équipe retrouve une pièce conservée (même d'un compte supprimé : admin_pieces_conservees) et
--                         l'ouvre avec un motif noté au journal (consulter_pieces) ; sans ce motif, le dossier privé
--                         reste fermé à l'équipe pour ces pièces
--   Un compte par contact numéro principal et e-mail (Gmail sans ses points, sans « +… ») déjà utilisés : refusés ;
--                         adresses jetables refusées ; inscription_possible() prévient avant l'envoi du formulaire ;
--                         numéros partagés par des comptes d'avant cette règle : listés pour l'équipe, qui peut libérer
--                         un numéro (liberer_numero)
-- Pas de code par SMS pour l'instant : un numéro peut être pris par quelqu'un d'autre ; l'équipe le libère sur réclamation.
-- ════════════════════════════════════════════════════════════════════════════

-- ══ Identité : pièce, numéro, date de fin, conservation ══
alter table public.profils add column identite_expire_le date;   -- fin de validité de la pièce vérifiée (fin du badge)

alter table public.verifications
  add column type_piece text check (type_piece in ('cni', 'passeport')),
  add column numero_piece text,                  -- noté par l'équipe : lettres et chiffres, sans espace
  add column piece_expire_le date,
  add column titulaire jsonb,                    -- prénom, nom, e-mail, téléphone au jour de la validation
  add column conserver_jusqu_au timestamptz,     -- ensuite, documents supprimés par la tâche du matin
  add column fichiers_supprimes_le timestamptz;
comment on column public.verifications.conserver_jusqu_au is
  'null : documents gardés (pièce d''identité validée d''un compte qui existe) ; sinon, supprimés à cette date';

-- Le compte supprimé : la demande reste (pièce gardée 1 an), sans lien vers lui
alter table public.verifications alter column profil_id drop not null,
  drop constraint verifications_profil_id_fkey,
  add constraint verifications_profil_id_fkey foreign key (profil_id) references public.profils on delete set null;
create index verifications_fichiers on public.verifications using gin (fichiers jsonb_path_ops);
create index verifications_a_supprimer on public.verifications (conserver_jusqu_au) where fichiers_supprimes_le is null;
create index verifications_piece on public.verifications (type_piece, numero_piece) where statut = 'validee';

-- Demandes déjà traitées : leurs documents ont été supprimés à la décision (version précédente)
update public.verifications set fichiers_supprimes_le = coalesce(traitee_le, now()) where statut <> 'soumise';
update public.verifications set type_piece = case when fichiers @> '[{"piece": "passeport"}]' then 'passeport' else 'cni' end
 where type = 'identite';
update public.verifications v set titulaire = jsonb_build_object('prenom', p.prenom, 'nom', p.nom,
    'email', (select u.email from auth.users u where u.id = p.id), 'telephone', p.telephone)
  from public.profils p where p.id = v.profil_id and v.type = 'identite' and v.statut = 'validee';

-- Consultations d'une pièce conservée (plainte) : qui, quand, pourquoi
create table public.consultations_pieces (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.verifications on delete cascade,
  admin_id uuid references public.profils on delete set null,
  motif text not null check (char_length(motif) between 5 and 500),
  cree_le timestamptz not null default now()
);
create index consultations_pieces_recentes on public.consultations_pieces (verification_id, admin_id, cree_le desc);
comment on table public.consultations_pieces is 'Pièces d''identité conservées ouvertes par l''équipe, avec le motif (plainte)';
alter table public.consultations_pieces enable row level security;
revoke all on public.consultations_pieces from public, anon, authenticated;

alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee', 'piece_consultee',
    'numero_libere'));

-- ── Dossier privé : l'équipe ouvre les demandes en cours ; une pièce d'identité conservée, seulement après un motif ──
-- Le fichier fait-il partie d'une demande ?
create function public.document_dans_une_demande(chemin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verifications v where v.fichiers @> jsonb_build_array(jsonb_build_object('chemin', chemin)));
$$;
-- Pièce d'identité validée, gardée pour une éventuelle plainte ?
create function public.piece_a_conserver(chemin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verifications v
                 where v.fichiers @> jsonb_build_array(jsonb_build_object('chemin', chemin))
                   and v.type = 'identite' and v.statut = 'validee' and v.fichiers_supprimes_le is null);
$$;
-- L'équipe peut-elle ouvrir ce document ? Oui pour une demande (en cours, ou en attente de suppression) ; pour une pièce
-- d'identité conservée, seulement dans l'heure qui suit une consultation avec motif (consulter_pieces)
create function public.document_ouvert_a_l_equipe(chemin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.compte_admin() and exists (
    select 1 from public.verifications v
    where v.fichiers @> jsonb_build_array(jsonb_build_object('chemin', chemin))
      and (not (v.type = 'identite' and v.statut = 'validee')
           or exists (select 1 from public.consultations_pieces c
                      where c.verification_id = v.id and c.admin_id = auth.uid() and c.cree_le > now() - interval '1 hour')));
$$;

drop policy "Documents : lus par leur propriétaire et l'équipe" on storage.objects;
drop policy "Documents : supprimés par leur propriétaire et l'équipe" on storage.objects;
create policy "Documents : lus par leur propriétaire, et par l'équipe pour une demande ou une plainte" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and (public.fichier_a_moi(name) or public.document_ouvert_a_l_equipe(name)));
-- Le propriétaire : seulement un fichier resté hors d'une demande (envoi raté) ; l'équipe : jamais une pièce conservée
create policy "Documents : supprimés par l'équipe, ou par leur propriétaire hors d'une demande" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and (
    (public.fichier_a_moi(name) and not public.document_dans_une_demande(name))
    or (public.compte_admin() and not public.piece_a_conserver(name))));

-- ── Le compte supprimé : pièce d'identité validée gardée 1 an ; le reste supprimé le lendemain matin ──
create function public.profils_avant_suppression() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.verifications
     set conserver_jusqu_au = case when type = 'identite' and statut = 'validee' then now() + interval '1 year' else now() end
   where profil_id = old.id and fichiers_supprimes_le is null and conserver_jusqu_au is null;
  update public.verifications set statut = 'refusee', motif = 'Compte supprimé', traitee_le = now()
   where profil_id = old.id and statut = 'soumise';
  return old;
end $$;
create trigger profils_suppression before delete on public.profils
  for each row execute function public.profils_avant_suppression();

-- ── Nom changé : l'identité vérifiée ne correspond plus (il faut renvoyer sa pièce) ; dates jamais choisies soi-même ──
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
    new.identite_expire_le := old.identite_expire_le;
  end if;
  if old.identite_verifiee_le is not null
     and (lower(btrim(new.prenom)) is distinct from lower(btrim(old.prenom))
          or lower(btrim(new.nom)) is distinct from lower(btrim(old.nom))) then
    new.identite_verifiee_le := null;
    new.identite_expire_le := null;
  end if;
  if new.demande_agence is distinct from old.demande_agence then
    new.demande_agence := nullif(btrim(new.demande_agence), '');
    new.demande_agence_le := case when new.demande_agence is null then null else now() end;
  end if;
  new.id := old.id;
  return new;
end $$;

-- Identité vérifiée et pièce encore valable ?
create function public.identite_valide(verifiee timestamptz, expire date) returns boolean
language sql stable set search_path = '' as $$
  select verifiee is not null and (expire is null or expire >= current_date);
$$;

-- Pièces demandées : obligatoires, au choix (un des ensembles, complet), facultatives
create or replace function public.pieces_verification(type text) returns jsonb
language sql immutable set search_path = '' as $$
  select case type
    when 'identite' then '{"obligatoires": ["selfie"], "au_choix": [["piece_recto", "piece_verso"], ["passeport"]], "facultatives": []}'::jsonb
    when 'agence' then '{"obligatoires": ["rccm"], "au_choix": [], "facultatives": ["logo"]}'::jsonb
    when 'bien' then '{"obligatoires": ["titre"], "au_choix": [], "facultatives": ["autre"]}'::jsonb
  end;
$$;

create or replace function public.demander_verification(type text, annonce uuid default null, fichiers jsonb default '[]', note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  p public.profils;
  a public.annonces;
  pieces jsonb := public.pieces_verification(type);
  f jsonb;
  ensemble jsonb;
  piece text;
  presentes integer;
  choix_complets integer := 0;
  choix_entames integer := 0;
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
  -- Le sujet ; une pièce qui expire dans moins de 30 jours peut déjà être remplacée
  if type = 'identite' and public.identite_valide(p.identite_verifiee_le, p.identite_expire_le)
     and (p.identite_expire_le is null or p.identite_expire_le > current_date + 30) then
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
  -- Les fichiers : 6 au plus, un par document, dans son dossier, déjà envoyés, aux bons formats
  if jsonb_typeof(fichiers) <> 'array' or jsonb_array_length(fichiers) = 0 or jsonb_array_length(fichiers) > 6 then
    raise exception 'Ajoutez les documents demandés (6 fichiers au plus).' using errcode = 'P0001';
  end if;
  for f in select * from jsonb_array_elements(fichiers) loop
    if not ((pieces -> 'obligatoires') ? (f ->> 'piece') or (pieces -> 'facultatives') ? (f ->> 'piece')
            or exists (select 1 from jsonb_array_elements(pieces -> 'au_choix') o where o ? (f ->> 'piece'))) then
      raise exception 'Document inattendu : %', f ->> 'piece' using errcode = 'P0001';
    end if;
    if (select count(*) from jsonb_array_elements(fichiers) x where x ->> 'piece' = f ->> 'piece') > 1 then
      raise exception 'Un seul fichier par document.' using errcode = 'P0001';
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
  -- Au choix : un seul ensemble, et complet (CNI recto et verso, ou passeport)
  for ensemble in select value from jsonb_array_elements(pieces -> 'au_choix') loop
    select count(*) into presentes from jsonb_array_elements_text(ensemble) o
     where exists (select 1 from jsonb_array_elements(fichiers) x where x ->> 'piece' = o);
    if presentes = jsonb_array_length(ensemble) then choix_complets := choix_complets + 1; end if;
    if presentes > 0 then choix_entames := choix_entames + 1; end if;
  end loop;
  if jsonb_array_length(pieces -> 'au_choix') > 0 then
    if choix_entames > 1 then
      raise exception 'Choisissez soit la CNI (recto et verso), soit le passeport : pas les deux.' using errcode = 'P0001';
    end if;
    if choix_complets = 0 then
      raise exception 'Document manquant : %', case
        when fichiers @> '[{"piece": "piece_recto"}]' then 'le verso de la CNI'
        when fichiers @> '[{"piece": "piece_verso"}]' then 'le recto de la CNI'
        else 'la CNI (recto et verso) ou la page photo du passeport' end using errcode = 'P0001';
    end if;
  end if;
  for piece in select jsonb_array_elements_text(pieces -> 'obligatoires') loop
    if not exists (select 1 from jsonb_array_elements(fichiers) x where x ->> 'piece' = piece) then
      raise exception 'Document manquant : %', case piece
        when 'selfie' then 'la photo de vous tenant la pièce'
        when 'rccm' then 'le RCCM de l''agence' else 'le titre de propriété ou le mandat' end using errcode = 'P0001';
    end if;
  end loop;
  if char_length(coalesce(texte, '')) > 1000 then
    raise exception 'Message trop long (1 000 caractères au plus).' using errcode = 'P0001';
  end if;
  insert into public.verifications (profil_id, type, annonce_id, agence_id, fichiers, note, type_piece)
  values (moi, type, annonce, case when type = 'agence' then p.agence_id end, fichiers, texte,
          case when type <> 'identite' then null when fichiers @> '[{"piece": "passeport"}]' then 'passeport' else 'cni' end)
  returning id into nouvelle;
  return nouvelle;
end $$;

-- Mon Espace → Vérification : + date de fin de la pièce, badge encore valable
create or replace function public.mes_verifications() returns jsonb
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
      'expire_le', p.identite_expire_le,
      'valide', public.identite_valide(p.identite_verifiee_le, p.identite_expire_le),
      'demande', (select jsonb_build_object('statut', v.statut, 'motif', v.motif, 'le', coalesce(v.traitee_le, v.cree_le), 'type_piece', v.type_piece)
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

-- L'équipe : + type de pièce
create or replace function public.admin_verifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'type', v.type, 'type_piece', v.type_piece, 'fichiers', v.fichiers, 'note', v.note, 'cree_le', v.cree_le,
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

-- Valider (badge) ou refuser (motif). Identité validée : numéro et date de fin de la pièce, documents gardés.
-- Renvoie les documents du dossier privé à supprimer tout de suite (rien pour une identité validée).
drop function public.traiter_verification(uuid, text, text);
create function public.traiter_verification(verification uuid, decision text, motif text default null,
                                             numero text default null, expire_le date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.verifications;
  p public.profils;
  autre public.profils;
  raison text := nullif(btrim(coalesce(motif, '')), '');
  num text := upper(regexp_replace(coalesce(numero, ''), '[^A-Za-z0-9]', '', 'g'));
  fin date := expire_le;
  piece text;
  garder boolean := false;
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
      piece := coalesce(v.type_piece, case when v.fichiers @> '[{"piece": "passeport"}]' then 'passeport' else 'cni' end);
      if char_length(num) not between 5 and 20 then
        raise exception 'Notez le numéro de la pièce (5 à 20 lettres ou chiffres) : il sert en cas de plainte.' using errcode = 'P0001';
      end if;
      if fin is null or fin <= current_date then
        raise exception 'Notez la date de fin de validité de la pièce : une pièce expirée se refuse.' using errcode = 'P0001';
      end if;
      -- Une pièce ne vérifie qu'un compte (sauf un compte suspendu)
      select q.* into autre from public.verifications x join public.profils q on q.id = x.profil_id
       where x.type = 'identite' and x.statut = 'validee' and x.type_piece = piece and x.numero_piece = num
         and x.profil_id <> v.profil_id and q.suspendu_le is null
       limit 1;
      if autre.id is not null then
        raise exception 'Cette pièce a déjà servi à vérifier le compte de % (%) : refusez la demande, ou suspendez d''abord l''autre compte.',
          public.nom_complet(autre), coalesce((select u.email from auth.users u where u.id = autre.id), 'sans e-mail') using errcode = 'P0001';
      end if;
      -- L'ancienne pièce (renouvellement) : gardée encore 1 an
      update public.verifications set conserver_jusqu_au = now() + interval '1 year'
       where profil_id = v.profil_id and type = 'identite' and statut = 'validee' and conserver_jusqu_au is null;
      update public.profils set identite_verifiee_le = now(), identite_expire_le = fin where id = v.profil_id;
      garder := true;
    elsif v.type = 'agence' then
      select x ->> 'chemin' into chemin_logo from jsonb_array_elements(v.fichiers) x where x ->> 'piece' = 'logo' limit 1;
      update public.agences set verifiee = true, logo = coalesce(chemin_logo, logo) where id = v.agence_id;
    else
      update public.annonces set verifiee = true where id = v.annonce_id;
    end if;
    update public.verifications
       set statut = 'validee', traitee_le = now(), traitee_par = auth.uid(), motif = null,
           type_piece = case when v.type = 'identite' then piece end,
           numero_piece = case when garder then num end,
           piece_expire_le = case when garder then fin end,
           titulaire = case when garder then jsonb_build_object('prenom', p.prenom, 'nom', p.nom,
             'email', (select u.email from auth.users u where u.id = p.id), 'telephone', p.telephone) end,
           conserver_jusqu_au = case when garder then null else now() end
     where id = v.id;
    perform public.noter_action_equipe('verification_validee', v.profil_id, v.agence_id, public.nom_complet(p),
                                       initcap(left(quoi, 1)) || substr(quoi, 2)
                                       || case when garder then ' : ' || upper(piece) || ' n° ' || num || ', jusqu''au ' || to_char(fin, 'DD/MM/YYYY') else '' end);
    perform public.prevenir_compte(v.profil_id, 'verification_validee',
      jsonb_build_object('type', v.type, 'quoi', quoi) || case when garder then jsonb_build_object('expire_le', fin) else '{}'::jsonb end);
  elsif decision = 'refuser' then
    if raison is null or char_length(raison) < 5 then
      raise exception 'Écrivez le motif : la personne le recevra par e-mail.' using errcode = 'P0001';
    end if;
    update public.verifications set statut = 'refusee', traitee_le = now(), traitee_par = auth.uid(), motif = left(raison, 500),
                                    conserver_jusqu_au = now()
     where id = v.id;
    perform public.noter_action_equipe('verification_refusee', v.profil_id, v.agence_id, public.nom_complet(p),
                                       initcap(left(quoi, 1)) || substr(quoi, 2) || ' : ' || left(raison, 500));
    perform public.prevenir_compte(v.profil_id, 'verification_refusee', jsonb_build_object('type', v.type, 'quoi', quoi, 'motif', left(raison, 500)));
  else
    raise exception 'Décision inconnue : %', decision using errcode = '22023';
  end if;
  if garder then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(x ->> 'chemin') from jsonb_array_elements(v.fichiers) x where x ->> 'dossier' = 'documents'), '[]');
end $$;

-- ── Plainte : retrouver une pièce conservée (compte existant ou supprimé), l'ouvrir avec un motif ──
create function public.admin_pieces_conservees(texte text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t text := public.sans_accents(coalesce(texte, ''));
  chiffres text := regexp_replace(coalesce(texte, ''), '\D', '', 'g');
  num text := upper(regexp_replace(coalesce(texte, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'compte', r.profil_id, 'compte_supprime', r.profil_id is null, 'titulaire', r.titulaire,
      'nom_actuel', r.nom_actuel, 'type_piece', r.type_piece, 'numero_piece', r.numero_piece, 'piece_expire_le', r.piece_expire_le,
      'validee_le', r.traitee_le, 'conserver_jusqu_au', r.conserver_jusqu_au, 'badge', r.badge,
      'consultations', (select count(*) from public.consultations_pieces c where c.verification_id = r.id))
      order by r.traitee_le desc)
    from (
      select v.*, case when p.id is null then null else public.nom_complet(p) end as nom_actuel,
             public.identite_valide(p.identite_verifiee_le, p.identite_expire_le) and v.conserver_jusqu_au is null as badge
      from public.verifications v
      left join public.profils p on p.id = v.profil_id
      where v.type = 'identite' and v.statut = 'validee' and v.fichiers_supprimes_le is null
        and (t = ''
             or position(t in public.sans_accents(coalesce(v.titulaire ->> 'prenom', '') || ' ' || coalesce(v.titulaire ->> 'nom', ''))) > 0
             or position(t in public.sans_accents(coalesce(v.titulaire ->> 'nom', '') || ' ' || coalesce(v.titulaire ->> 'prenom', ''))) > 0
             or position(t in public.sans_accents(coalesce(v.titulaire ->> 'email', ''))) > 0
             or (p.id is not null and position(t in public.sans_accents(public.nom_complet(p))) > 0)
             or (char_length(chiffres) >= 4
                 and position(chiffres in regexp_replace(coalesce(v.titulaire ->> 'telephone', ''), '\D', '', 'g')) > 0)
             or (char_length(num) >= 4 and position(num in coalesce(v.numero_piece, '')) > 0))
      order by v.traitee_le desc
      limit 20
    ) r
  ), '[]');
end $$;

create function public.consulter_pieces(verification uuid, motif text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.verifications;
  raison text := nullif(btrim(coalesce(motif, '')), '');
begin
  perform public.exiger_admin();
  select * into v from public.verifications x
   where x.id = verification and x.type = 'identite' and x.statut = 'validee' and x.fichiers_supprimes_le is null;
  if v.id is null then
    raise exception 'Pièce introuvable, ou déjà supprimée.' using errcode = 'P0001';
  end if;
  if raison is null or char_length(raison) < 5 then
    raise exception 'Écrivez le motif (la plainte reçue) : il est noté au journal.' using errcode = 'P0001';
  end if;
  insert into public.consultations_pieces (verification_id, admin_id, motif) values (v.id, auth.uid(), left(raison, 500));
  perform public.noter_action_equipe('piece_consultee', v.profil_id, null,
    coalesce(nullif(btrim(coalesce(v.titulaire ->> 'prenom', '') || ' ' || coalesce(v.titulaire ->> 'nom', '')), ''), 'Compte supprimé'),
    left(raison, 500));
  return coalesce((select jsonb_agg(x) from jsonb_array_elements(v.fichiers) x where x ->> 'dossier' = 'documents'), '[]');
end $$;

-- ── La tâche du matin (clé secrète) : documents qui ont fait leur temps ; logo seulement d'une demande non validée ──
create function public.documents_a_supprimer(nombre integer default 200) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'fichiers',
    (select coalesce(jsonb_agg(jsonb_build_object('dossier', x ->> 'dossier', 'chemin', x ->> 'chemin')), '[]')
       from jsonb_array_elements(v.fichiers) x
      where x ->> 'dossier' = 'documents' or (x ->> 'dossier' = 'logos' and v.statut <> 'validee')))), '[]')
  from (select * from public.verifications
         where fichiers_supprimes_le is null and conserver_jusqu_au <= now()
         order by conserver_jusqu_au limit greatest(1, least(coalesce(nombre, 200), 500))) v;
$$;

create function public.documents_supprimes(ids uuid[]) returns integer
language sql security definer set search_path = '' as $$
  with faites as (
    update public.verifications set fichiers_supprimes_le = now()
     where id = any(ids) and fichiers_supprimes_le is null and conserver_jusqu_au <= now()
    returning 1)
  select count(*)::integer from faites;
$$;


-- ══ Un numéro et un e-mail par compte ══
-- « +225 07 48 32 11 90 » → « 2250748321190 »
create function public.numero_normalise(t text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '');
$$;
-- E-mail comparé : minuscules, sans « +… » avant l'@, Gmail sans ses points (a.kone+2@gmail.com = akone@gmail.com)
create function public.email_normalise(e text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  adresse text := lower(btrim(coalesce(e, '')));
  local text := split_part(split_part(adresse, '@', 1), '+', 1);
  domaine text := split_part(adresse, '@', 2);
begin
  if adresse = '' then
    return null;
  end if;
  if domaine in ('gmail.com', 'googlemail.com') then
    local := replace(local, '.', '');
    domaine := 'gmail.com';
  end if;
  return local || '@' || domaine;
end $$;
-- Adresses jetables les plus courantes (boîtes temporaires sans inscription)
create function public.email_jetable(e text) returns boolean
language sql immutable set search_path = '' as $$
  select split_part(lower(btrim(coalesce(e, ''))), '@', 2) = any (array[
    'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'courriel.fr.nf', 'moncourrier.fr.nf',
    'monemail.fr.nf', 'monmail.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dyndns.org', 'speed.1s.fr',
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', 'grr.la',
    '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net', 'tempail.com', 'tempr.email',
    'trashmail.com', 'trashmail.fr', 'jetable.org', 'getnada.com', 'maildrop.cc', 'dispostable.com', 'throwawaymail.com',
    'fakeinbox.com', 'mailnesia.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com', 'mailcatch.com',
    'tmail.ws', 'tmpmail.org', 'tmpmail.net', 'burnermail.io', 'mail.tm', 'luxusmail.org', 'emailfake.com', 'crazymailing.com']);
$$;

create index profils_numero on public.profils (public.numero_normalise(telephone));

-- Numéro principal déjà pris par un autre compte : refusé (les comptes d'avant cette règle ne sont pas bloqués)
create function public.profils_numero_unique() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n text := public.numero_normalise(new.telephone);
begin
  if n is not null and (tg_op = 'INSERT' or n is distinct from public.numero_normalise(old.telephone))
     and exists (select 1 from public.profils x where x.id <> new.id and public.numero_normalise(x.telephone) = n) then
    raise exception 'Ce numéro est déjà utilisé par un autre compte. S''il est à vous, écrivez à l''équipe 360-Immo.ci : elle peut le libérer.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger profils_numero_unique before insert or update of telephone on public.profils
  for each row execute function public.profils_numero_unique();

-- À l'inscription : + e-mail jetable ou déjà utilisé sous une autre forme : refusé (complète la version des comptes)
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  agence text := nullif(btrim(m ->> 'agence'), '');
begin
  if public.email_jetable(new.email) then
    raise exception 'Adresse e-mail jetable : utilisez votre adresse habituelle.' using errcode = 'P0001';
  end if;
  if new.email is not null and exists (select 1 from auth.users u
                                       where u.id <> new.id and public.email_normalise(u.email) = public.email_normalise(new.email)) then
    raise exception 'Cet e-mail est déjà utilisé par un autre compte.' using errcode = 'P0001';
  end if;
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

-- Formulaire d'inscription : prévenir avant l'envoi (e-mail jetable ou déjà utilisé, numéro déjà utilisé)
create function public.inscription_possible(adresse text, numero text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', case
      when public.email_jetable(adresse) then 'jetable'
      when exists (select 1 from auth.users u where public.email_normalise(u.email) = public.email_normalise(adresse)) then 'deja'
    end,
    'telephone', case
      when public.numero_normalise(numero) is not null
           and exists (select 1 from public.profils p where public.numero_normalise(p.telephone) = public.numero_normalise(numero)) then 'deja'
    end);
$$;

-- Un compte, tel que l'équipe le voit : + identité vérifiée, comptes qui ont le même numéro (complète la version des comptes)
create or replace function public.fiche_compte(p public.profils) returns jsonb
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
    'signalements', (select count(*) from public.signalements s join public.annonces a on a.id = s.annonce_id where a.auteur_id = p.id),
    'identite_verifiee', public.identite_valide(p.identite_verifiee_le, p.identite_expire_le),
    'identite_expire_le', p.identite_expire_le,
    'meme_numero', (select count(*) from public.profils x
                     where x.id <> p.id and public.numero_normalise(x.telephone) = public.numero_normalise(p.telephone)));
$$;

-- Numéros partagés par plusieurs comptes (inscrits avant la règle, ou numéro pris par erreur)
create function public.admin_numeros_partages() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('numero', g.numero, 'comptes', g.comptes) order by g.n desc, g.numero)
    from (
      select min(p.telephone) as numero, count(*) as n, jsonb_agg(public.fiche_compte(p) order by p.cree_le) as comptes
      from public.profils p
      where public.numero_normalise(p.telephone) is not null
      group by public.numero_normalise(p.telephone)
      having count(*) > 1
    ) g
  ), '[]');
end $$;

-- Libérer un numéro (réclamé par son vrai propriétaire) : retiré du compte, avec un motif ; e-mail au compte
create function public.liberer_numero(compte uuid, motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.profils;
  raison text := nullif(btrim(coalesce(motif, '')), '');
begin
  perform public.exiger_admin();
  select * into p from public.profils where id = compte;
  if p.id is null then
    raise exception 'Compte introuvable.' using errcode = 'P0001';
  end if;
  if p.telephone is null then
    raise exception 'Ce compte n''a pas de numéro.' using errcode = 'P0001';
  end if;
  if raison is null or char_length(raison) < 5 then
    raise exception 'Écrivez le motif : la personne le recevra par e-mail.' using errcode = 'P0001';
  end if;
  update public.profils set telephone = null where id = compte;
  perform public.noter_action_equipe('numero_libere', compte, null, public.nom_complet(p), p.telephone || ' : ' || left(raison, 500));
  perform public.prevenir_compte(compte, 'numero_libere', jsonb_build_object('telephone', p.telephone, 'motif', left(raison, 500)));
end $$;


-- ══ Badges : la pièce doit être encore valable (complète la version des documents) ══
create or replace function public.annonceur_public(annonce uuid)
returns table (code text, nom text, agence boolean, verifiee boolean)
language sql stable security definer set search_path = '' as $$
  select p.code_vitrine, public.nom_vitrine(p.prenom, p.nom, ag.nom),
         p.agence_id is not null or p.role = 'agence',
         coalesce(ag.verifiee, false) or (ag.id is null and public.identite_valide(p.identite_verifiee_le, p.identite_expire_le))
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  left join public.agences ag on ag.id = p.agence_id
  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

create or replace function public.vitrine(code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', p.code_vitrine,
    'nom', public.nom_vitrine(p.prenom, p.nom, ag.nom),
    'agence', p.agence_id is not null or p.role = 'agence',
    'verifiee', coalesce(ag.verifiee, false) or (ag.id is null and public.identite_valide(p.identite_verifiee_le, p.identite_expire_le)),
    'logo', case when ag.verifiee then ag.logo end,
    'membre_depuis', p.cree_le,
    'total', (select count(*) from public.annonces a
              where a.auteur_id = p.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())))
  from public.profils p
  left join public.agences ag on ag.id = p.agence_id
  where p.code_vitrine = lower(btrim(code));
$$;


-- ══ Droits ══
-- Supabase donne d'office le droit d'appeler chaque nouvelle fonction aux visiteurs (anon) et aux comptes (authenticated) :
-- le retirer à « public » ne suffit pas. Fonctions internes de l'étape 7 restées appelables depuis le site : fermées ici
-- (prévenir un compte par e-mail, écrire au journal de l'équipe, fiche d'un compte avec son e-mail).
revoke execute on function public.prevenir_compte(uuid, text, jsonb), public.noter_action_equipe(text, uuid, uuid, text, text),
  public.fiche_compte(public.profils) from public, anon, authenticated;

revoke execute on function public.document_dans_une_demande(text), public.piece_a_conserver(text),
  public.document_ouvert_a_l_equipe(text), public.traiter_verification(uuid, text, text, text, date),
  public.admin_pieces_conservees(text), public.consulter_pieces(uuid, text), public.documents_a_supprimer(integer),
  public.documents_supprimes(uuid[]), public.inscription_possible(text, text), public.admin_numeros_partages(),
  public.liberer_numero(uuid, text) from public, anon, authenticated;
-- (les règles du dossier privé s'évaluent avec les droits de la personne connectée)
grant execute on function public.document_dans_une_demande(text), public.piece_a_conserver(text),
  public.document_ouvert_a_l_equipe(text) to authenticated;
grant execute on function public.traiter_verification(uuid, text, text, text, date), public.admin_pieces_conservees(text),
  public.consulter_pieces(uuid, text), public.admin_numeros_partages(), public.liberer_numero(uuid, text) to authenticated;
grant execute on function public.inscription_possible(text, text) to anon, authenticated;
grant execute on function public.documents_a_supprimer(integer), public.documents_supprimes(uuid[]) to service_role;
