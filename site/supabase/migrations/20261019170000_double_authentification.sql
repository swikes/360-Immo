-- Double authentification de l'équipe (étape 9e, audit E5) : un compte « admin » n'a les droits de l'équipe que si sa
-- connexion a été confirmée par le code à 6 chiffres de son application (Google Authenticator, Microsoft
-- Authenticator…), c'est-à-dire si son jeton de connexion est de niveau « aal2 ». Sans ce code, c'est un compte
-- ordinaire : un mot de passe volé ne suffit plus pour ouvrir les pièces d'identité, les comptes ou la publication.
-- L'espace Administration demande d'activer le code la première fois, puis le code à chaque nouvelle connexion
-- (components/admin/DoubleAuthentification.tsx).
-- compte_admin() est la seule porte des droits de l'équipe : est_admin(), exiger_admin() et les règles du stockage
-- (images du blog, documents, logos) passent par elle.
-- Téléphone perdu : DEPANNAGE.md (« Code de l'Administration perdu »).

create or replace function public.compte_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from public.profils where id = (select auth.uid()) and role = 'admin');
$$;
