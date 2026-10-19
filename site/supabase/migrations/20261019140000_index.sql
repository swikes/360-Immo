-- Index des colonnes lues souvent (audit M1) : rien ne change pour le site, les mêmes recherches restent rapides quand
-- les tables grossissent. Seulement des ajouts.
--   conversations (client, annonceur)     Mon Espace → Messages, compteur des non-lus à chaque page d'un compte
--   visites, rappels (demandeur)          Mon Espace → Visites, Rappels
--   visites (numéro, date)                limite de 5 demandes par jour et par numéro
--   favoris (annonce)                     statistiques de l'annonceur
--   messages (auteur), signalements (auteur), moderations (annonce), verifications (annonce)
--                                         suppression d'un compte ou d'une annonce, journal de l'équipe
--   profils (agence), annonces (ville)    comptes d'une agence, recherche par ville
create index if not exists conversations_client on public.conversations (client_id);
create index if not exists conversations_annonceur on public.conversations (annonceur_id);
create index if not exists visites_demandeur on public.visites (demandeur_id);
create index if not exists visites_telephone on public.visites (telephone, cree_le);
create index if not exists rappels_demandeur on public.rappels (demandeur_id);
create index if not exists favoris_annonce on public.favoris (annonce_id);
create index if not exists messages_auteur on public.messages (auteur_id);
create index if not exists signalements_auteur on public.signalements (auteur_id);
create index if not exists moderations_annonce on public.moderations (annonce_id);
create index if not exists verifications_annonce on public.verifications (annonce_id);
create index if not exists profils_agence on public.profils (agence_id);
create index if not exists annonces_ville on public.annonces (ville_id);
