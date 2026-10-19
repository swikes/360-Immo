-- Formulaire Contact protégé par le contrôle anti-robot (CAPTCHA Cloudflare Turnstile, étape 9e).
-- Jusqu'ici, le navigateur appelait envoyer_contact lui-même : un robot pouvait donc l'appeler sans passer par le
-- formulaire. Désormais seul le serveur du site l'appelle (app/api/contact, clé secrète), après avoir vérifié le
-- jeton anti-robot quand il est réglé (TURNSTILE_SECRET_KEY dans Vercel) ; il donne le compte de la personne
-- connectée (« auteur »), qu'il a lui-même vérifié. Les règles de la demande ne changent pas.

drop function public.envoyer_contact(jsonb);

-- Nouvelle demande : { nom, email, telephone, sujet, reference, message } ; auteur : le compte connecté, ou null
create function public.envoyer_contact(demande jsonb, auteur uuid) returns uuid
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
  values (auteur, left(v_nom, 80), v_email, left(v_telephone, 30), v_sujet, left(v_reference, 30), v_message)
  returning * into d;

  insert into public.notifications (modele, profil_id, cle, donnees)
  select 'contact', p.id, 'contact:' || d.id,
    jsonb_build_object('demande', d.id, 'nom', d.nom, 'email', d.email, 'telephone', d.telephone, 'sujet', d.sujet,
      'reference', d.reference, 'message', d.message)
  from public.profils p where p.role = 'admin' and p.suspendu_le is null;
  return d.id;
end $$;

revoke execute on function public.envoyer_contact(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.envoyer_contact(jsonb, uuid) to service_role;
