-- Colonnes verrouillées : ce qu'un compte ne peut pas écrire lui-même, même en appelant la base directement avec la
-- clé publique (contrôle « attaque de l'extérieur » d'octobre 2026, refait à chaque test de la base).
--   1. Dates de création : l'heure du serveur à l'ajout, puis plus jamais changée (sauf par l'équipe ou la base)
--   2. Date d'envoi d'une annonce en vérification : posée par la base seule
--   3. Agence d'une annonce : celle du compte de son auteur, jamais une autre
--   4. Deux envois en même temps (double clic, deux onglets) d'une demande de visite ou de rappel : l'un après l'autre

-- 1. Dates de création
create function public.date_creation_serveur() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    if tg_op = 'INSERT' then
      new.cree_le := now();
    else
      new.cree_le := old.cree_le;
    end if;
  end if;
  return new;
end $$;

create trigger profils_date_creation before insert or update on public.profils
  for each row execute function public.date_creation_serveur();
create trigger annonces_date_creation before insert or update on public.annonces
  for each row execute function public.date_creation_serveur();
create trigger photos_annonce_date_creation before insert or update on public.photos_annonce
  for each row execute function public.date_creation_serveur();
create trigger alertes_date_creation before insert or update on public.alertes
  for each row execute function public.date_creation_serveur();
create trigger favoris_date_creation before insert or update on public.favoris
  for each row execute function public.date_creation_serveur();
create trigger conversations_date_creation before insert or update on public.conversations
  for each row execute function public.date_creation_serveur();
create trigger messages_date_creation before insert or update on public.messages
  for each row execute function public.date_creation_serveur();
create trigger visites_date_creation before insert or update on public.visites
  for each row execute function public.date_creation_serveur();
create trigger rappels_date_creation before insert or update on public.rappels
  for each row execute function public.date_creation_serveur();

-- 2. Date d'envoi en vérification (onglet Audience : délai de vérification de l'équipe)
create or replace function public.annonces_date_envoi() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.envoyee_le := case when tg_op = 'INSERT' then null else old.envoyee_le end;
  end if;
  if new.statut = 'en_attente' and (tg_op = 'INSERT' or old.statut is distinct from 'en_attente') then
    new.envoyee_le := now();
  end if;
  return new;
end $$;

-- 3. Agence d'une annonce : un particulier ne peut pas rattacher son annonce à une agence (vérifiée ou non)
create function public.annonces_agence_du_compte() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    if tg_op = 'INSERT' then
      select p.agence_id into new.agence_id from public.profils p where p.id = new.auteur_id;
    else
      new.agence_id := old.agence_id;
    end if;
  end if;
  return new;
end $$;
create trigger annonces_agence before insert or update on public.annonces
  for each row execute function public.annonces_agence_du_compte();

-- 4. Une seule demande en cours par bien et par numéro : deux envois simultanés passaient tous les deux le contrôle
-- (chacun ne voyait pas encore l'autre). Le second attend maintenant la fin du premier, le voit, et il est refusé.
-- « a_la_file » : avant « …_controler » (les déclencheurs « before » passent par ordre alphabétique).
create function public.demandes_a_la_file() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.annonce_id::text || ':' || coalesce(new.telephone, ''), 0));
  return new;
end $$;
create trigger visites_a_la_file before insert on public.visites
  for each row execute function public.demandes_a_la_file();
create trigger rappels_a_la_file before insert on public.rappels
  for each row execute function public.demandes_a_la_file();
