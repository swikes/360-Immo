-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 9 : pages du site (à propos, aide, partenaires, pages légales) et formulaire Contact
--
--   pages_site                        les pages du pied de page, écrites dans l'Administration (comme les articles du
--                                     blog) : brouillon ou publiée ; une page qui contient encore « [à compléter] »
--                                     ne peut pas être publiée ; notes de l'équipe jamais publiées
--   page_site(), pages_publiees()     pages publiques (/a-propos, /aide, /cgu…) et plan du site
--   admin_pages(), enregistrer_page(), publier_page()     onglet « Pages du site » de l'Administration
--   demandes_contact                  messages du formulaire /contact (avec ou sans compte) ; 5 par jour au plus pour
--                                     une même adresse ou un même numéro ; supprimés un an après avoir été traités
--   envoyer_contact()                 enregistre la demande et prévient l'équipe par e-mail (modèle « contact »)
--   admin_contacts(), traiter_contact()                   onglet « Contact » de l'Administration
--   Journal de l'équipe               page publiée, page retirée
-- ════════════════════════════════════════════════════════════════════════════

-- ══ Pages du site ══
create table public.pages_site (
  slug text primary key check (slug in ('a-propos', 'aide', 'devenir-partenaire', 'mentions-legales', 'cgu', 'confidentialite', 'cookies')),
  titre text not null constraint pages_titre_longueur check (char_length(btrim(titre)) between 3 and 120),
  resume text not null default '' constraint pages_resume_longueur check (char_length(resume) <= 300),
  -- texte en Markdown simple, comme les articles du blog (lib/blog.ts)
  contenu text not null default '' constraint pages_contenu_longueur check (char_length(contenu) <= 100000),
  notes text constraint pages_notes_longueur check (notes is null or char_length(notes) <= 10000),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  publie_le timestamptz,
  modifie_le timestamptz not null default now(),
  modifie_par uuid references public.profils on delete set null,
  constraint page_publiee_complete check (statut = 'brouillon'
    or (publie_le is not null and char_length(btrim(resume)) > 0 and char_length(btrim(contenu)) > 0))
);
comment on table public.pages_site is 'Pages du pied de page (à propos, aide, partenaires, pages légales), écrites dans l''Administration';
alter table public.pages_site enable row level security;
revoke all on public.pages_site from public, anon, authenticated;

-- Un passage encore à remplir (« [à compléter : numéro RCCM] ») : la page ne peut pas être publiée
create function public.reste_a_completer(t text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(t, '') ~* '\[\s*(à|a) compl[éeè]ter';
$$;

create function public.page_admin(p public.pages_site) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(p) || jsonb_build_object(
    'a_completer', public.reste_a_completer(p.titre) or public.reste_a_completer(p.resume) or public.reste_a_completer(p.contenu),
    'modifie_par', (select nullif(btrim(coalesce(x.prenom, '') || ' ' || coalesce(x.nom, '')), '') from public.profils x where x.id = p.modifie_par));
$$;

-- Une page publiée (null si elle n'existe pas ou n'est pas publiée)
create function public.page_site(adresse text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('slug', p.slug, 'titre', p.titre, 'resume', p.resume, 'contenu', p.contenu,
    'publie_le', p.publie_le, 'modifie_le', p.modifie_le)
  from public.pages_site p where p.slug = adresse and p.statut = 'publie';
$$;

-- Pages publiées (plan du site)
create function public.pages_publiees() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', p.slug, 'modifie_le', p.modifie_le) order by p.slug), '[]')
  from public.pages_site p where p.statut = 'publie';
$$;

-- Toutes les pages, pour l'équipe
create function public.admin_pages() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((select jsonb_agg(public.page_admin(p) order by array_position(
    array['a-propos', 'aide', 'devenir-partenaire', 'mentions-legales', 'cgu', 'confidentialite', 'cookies'], p.slug))
    from public.pages_site p), '[]');
end $$;

-- Page modifiée : { slug, titre, resume, contenu, notes }. Ne change pas son état : publier_page.
create function public.enregistrer_page(page jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.pages_site;
  v_titre text := btrim(coalesce(page ->> 'titre', ''));
  v_resume text := btrim(coalesce(page ->> 'resume', ''));
  v_contenu text := btrim(coalesce(page ->> 'contenu', ''));
begin
  perform public.exiger_admin();
  select * into p from public.pages_site x where x.slug = page ->> 'slug' for update;
  if p.slug is null then
    raise exception 'Page introuvable.' using errcode = 'P0001';
  end if;
  if char_length(v_titre) < 3 then
    raise exception 'Donnez un titre à la page.' using errcode = 'P0001';
  end if;
  if p.statut = 'publie' then
    if v_resume = '' or v_contenu = '' then
      raise exception 'Une page publiée garde un résumé et un texte. Retirez-la d''abord du site pour la vider.' using errcode = 'P0001';
    end if;
    if public.reste_a_completer(v_titre) or public.reste_a_completer(v_resume) or public.reste_a_completer(v_contenu) then
      raise exception 'Cette page est en ligne : elle ne peut pas contenir « [à compléter] ». Remplacez ce passage, ou retirez d''abord la page du site.' using errcode = 'P0001';
    end if;
  end if;
  update public.pages_site x set titre = v_titre, resume = v_resume, contenu = v_contenu, notes = nullif(btrim(page ->> 'notes'), ''),
    modifie_le = now(), modifie_par = auth.uid()
  where x.slug = p.slug returning * into p;
  return public.page_admin(p);
end $$;

-- Publier (visible de tous) ou retirer du site (redevient un brouillon : le lien affiche « Page bientôt disponible »)
create function public.publier_page(adresse text, publier boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.pages_site;
begin
  perform public.exiger_admin();
  select * into p from public.pages_site x where x.slug = adresse for update;
  if p.slug is null then
    raise exception 'Page introuvable.' using errcode = 'P0001';
  end if;
  if publier then
    if char_length(btrim(p.resume)) = 0 or char_length(btrim(p.contenu)) = 0 then
      raise exception 'Ajoutez un résumé et le texte de la page avant de la publier.' using errcode = 'P0001';
    end if;
    if public.reste_a_completer(p.titre) or public.reste_a_completer(p.resume) or public.reste_a_completer(p.contenu) then
      raise exception 'Remplacez d''abord chaque « [à compléter] » de la page (nom de la société, adresse…).' using errcode = 'P0001';
    end if;
    if p.statut <> 'publie' then
      perform public.noter_action_equipe('page_publiee', null, null, p.titre, null);
    end if;
    update public.pages_site x set statut = 'publie', publie_le = coalesce(x.publie_le, now()), modifie_par = auth.uid()
    where x.slug = p.slug returning * into p;
  else
    if p.statut = 'publie' then
      perform public.noter_action_equipe('page_retiree', null, null, p.titre, null);
    end if;
    update public.pages_site x set statut = 'brouillon', modifie_par = auth.uid() where x.slug = p.slug returning * into p;
  end if;
  return public.page_admin(p);
end $$;

-- Journal de l'équipe : pages publiées ou retirées
alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee', 'piece_consultee',
    'numero_libere', 'article_publie', 'article_retire', 'article_supprime', 'page_publiee', 'page_retiree'));

-- Les pages, vides ; leurs premières versions : …_pages_premieres_versions.sql
insert into public.pages_site (slug, titre) values
  ('a-propos', 'À propos de 360-Immo.ci'), ('aide', 'Aide & questions fréquentes'), ('devenir-partenaire', 'Devenir partenaire'),
  ('mentions-legales', 'Mentions légales'), ('cgu', 'Conditions générales d''utilisation'),
  ('confidentialite', 'Politique de confidentialité'), ('cookies', 'Cookies et stockage sur votre appareil');


-- ══ Formulaire Contact ══
create table public.demandes_contact (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid references public.profils on delete set null,
  nom text not null constraint contact_nom_longueur check (char_length(btrim(nom)) between 2 and 80),
  email text constraint contact_email_forme check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200)),
  telephone text constraint contact_telephone_longueur check (telephone is null or char_length(telephone) <= 30),
  sujet text not null check (sujet in ('question', 'annonce', 'arnaque', 'compte', 'partenariat', 'donnees', 'presse', 'autre')),
  reference text constraint contact_reference_longueur check (reference is null or char_length(reference) <= 30),
  message text not null constraint contact_message_longueur check (char_length(btrim(message)) between 10 and 3000),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'traitee')),
  cree_le timestamptz not null default now(),
  traitee_le timestamptz,
  traitee_par uuid references public.profils on delete set null,
  constraint contact_joignable check (email is not null or telephone is not null)
);
create index demandes_contact_statut on public.demandes_contact (statut, cree_le desc);
create index demandes_contact_email on public.demandes_contact (lower(email), cree_le);
create index demandes_contact_telephone on public.demandes_contact (telephone, cree_le);
comment on table public.demandes_contact is 'Messages du formulaire Contact ; supprimés un an après avoir été traités';
alter table public.demandes_contact enable row level security;
revoke all on public.demandes_contact from public, anon, authenticated;

-- E-mail à l'équipe pour chaque nouvelle demande
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check
    check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce', 'moderation', 'compte', 'contact'));

-- Nouvelle demande : { nom, email, telephone, sujet, reference, message } ; avec ou sans compte
create function public.envoyer_contact(demande jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_nom text := btrim(coalesce(demande ->> 'nom', ''));
  v_email text := lower(nullif(btrim(demande ->> 'email'), ''));
  v_telephone text := nullif(btrim(demande ->> 'telephone'), '');
  v_sujet text := coalesce(nullif(demande ->> 'sujet', ''), 'question');
  v_reference text := upper(nullif(btrim(demande ->> 'reference'), ''));
  v_message text := btrim(coalesce(demande ->> 'message', ''));
  d public.demandes_contact;
begin
  if char_length(v_nom) < 2 then
    raise exception 'Indiquez votre nom.' using errcode = 'P0001';
  end if;
  if v_email is null and v_telephone is null then
    raise exception 'Indiquez une adresse e-mail ou un numéro de téléphone pour que nous puissions vous répondre.' using errcode = 'P0001';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'L''adresse e-mail n''est pas valide.' using errcode = 'P0001';
  end if;
  if v_telephone is not null and char_length(regexp_replace(v_telephone, '\D', '', 'g')) < 8 then
    raise exception 'Le numéro de téléphone n''est pas complet.' using errcode = 'P0001';
  end if;
  if v_sujet not in ('question', 'annonce', 'arnaque', 'compte', 'partenariat', 'donnees', 'presse', 'autre') then
    raise exception 'Choisissez le sujet de votre message.' using errcode = 'P0001';
  end if;
  if char_length(v_message) < 10 then
    raise exception 'Écrivez votre message (10 caractères au moins).' using errcode = 'P0001';
  end if;
  if char_length(v_message) > 3000 then
    raise exception 'Votre message est trop long (3 000 caractères au plus).' using errcode = 'P0001';
  end if;
  -- Contre les envois en masse : 5 demandes par jour au plus pour une même adresse ou un même numéro
  if (select count(*) from public.demandes_contact c
       where c.cree_le > now() - interval '1 day'
         and ((v_email is not null and lower(c.email) = v_email) or (v_telephone is not null and c.telephone = v_telephone))) >= 5 then
    raise exception 'Vous nous avez déjà écrit plusieurs fois aujourd''hui : notre équipe vous répond au plus vite.' using errcode = 'P0001';
  end if;

  -- Ménage : les demandes traitées depuis plus d'un an
  delete from public.demandes_contact c where c.statut = 'traitee' and c.traitee_le < now() - interval '1 year';

  insert into public.demandes_contact (profil_id, nom, email, telephone, sujet, reference, message)
  values (auth.uid(), left(v_nom, 80), v_email, left(v_telephone, 30), v_sujet, left(v_reference, 30), v_message)
  returning * into d;

  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'contact', p.id, 'contact:' || d.id,
    jsonb_build_object('demande', d.id, 'nom', d.nom, 'email', d.email, 'telephone', d.telephone, 'sujet', d.sujet,
      'reference', d.reference, 'message', d.message)
  from public.profils p where p.role = 'admin' and p.suspendu_le is null;
  return d.id;
end $$;

-- Demandes, pour l'équipe : nouvelles d'abord, puis les 100 dernières traitées
create function public.admin_contacts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(c) - 'traitee_par' || jsonb_build_object(
      'traitee_par', (select nullif(btrim(coalesce(x.prenom, '') || ' ' || coalesce(x.nom, '')), '') from public.profils x where x.id = c.traitee_par),
      'avec_compte', c.profil_id is not null)
      order by c.statut = 'traitee', c.cree_le desc)
    from (
      select * from public.demandes_contact where statut = 'nouvelle'
      union all
      select * from (select * from public.demandes_contact where statut = 'traitee' order by traitee_le desc limit 100) t
    ) c
  ), '[]');
end $$;

-- Marquer une demande comme traitée (ou la remettre parmi les nouvelles)
create function public.traiter_contact(demande uuid, traitee boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  update public.demandes_contact c set statut = case when traitee then 'traitee' else 'nouvelle' end,
    traitee_le = case when traitee then now() end, traitee_par = case when traitee then auth.uid() end
  where c.id = demande;
  if not found then
    raise exception 'Demande introuvable.' using errcode = 'P0001';
  end if;
end $$;

-- Tableau de bord : nouvelles demandes de contact (complète la version des documents)
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

revoke execute on function public.reste_a_completer(text), public.page_admin(public.pages_site), public.page_site(text),
  public.pages_publiees(), public.admin_pages(), public.enregistrer_page(jsonb), public.publier_page(text, boolean),
  public.envoyer_contact(jsonb), public.admin_contacts(), public.traiter_contact(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.page_site(text), public.pages_publiees(), public.envoyer_contact(jsonb) to anon, authenticated;
grant execute on function public.admin_pages(), public.enregistrer_page(jsonb), public.publier_page(text, boolean),
  public.admin_contacts(), public.traiter_contact(uuid, boolean) to authenticated;
