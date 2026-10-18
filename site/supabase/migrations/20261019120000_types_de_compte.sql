-- Deux types de compte bien séparés : une agence reste une agence, un particulier reste un particulier.
--   - compte agence (rattaché à une agence par l'équipe) : toutes ses annonces sont « Agence immobilière », au nom de
--     l'agence enregistré par l'équipe ; badge « Agence vérifiée » une fois le RCCM contrôlé ;
--   - particulier (y compris pendant une demande d'agence : chaque annonce passe de toute façon par l'équipe, qui
--     valide l'agence en même temps) : toutes ses annonces sont « Particulier », au nom de son compte. Ce nom est
--     celui que l'équipe compare à la pièce d'identité (CNI ou passeport) ; le changer retire le badge
--     « Identité vérifiée » (…_identite_comptes.sql). Plus de nom écrit à la main sur une annonce.
-- Remplace la règle de …_vendeur_agence.sql (où une demande en cours suffisait pour publier comme agence).

-- Agence d'un compte : seulement celle à laquelle l'équipe l'a rattaché
create or replace function public.nom_agence_compte(p public.profils) returns text
language sql stable set search_path = '' as $$
  select ag.nom from public.agences ag where ag.id = p.agence_id;
$$;

-- À l'enregistrement (compte ordinaire) : type et nom de l'annonce = ceux du compte
create or replace function public.annonces_vendeur() returns trigger
language plpgsql set search_path = '' as $$
declare
  p public.profils;
  agence text;
begin
  if public.est_admin() then
    return new;
  end if;
  select * into p from public.profils where id = new.auteur_id;
  agence := public.nom_agence_compte(p);
  -- (une valeur inconnue reste telle quelle : la contrainte type_vendeur_connu la refuse)
  if new.type_vendeur in ('particulier', 'agence') then
    new.type_vendeur := case when agence is null then 'particulier' else 'agence' end;
  end if;
  new.contact_nom := coalesce(agence, public.nom_complet(p));
  return new;
end $$;

-- Agence validée ou retirée, nom du compte changé : ses annonces suivent
create or replace function public.profils_annonces_vendeur() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  agence text := public.nom_agence_compte(new);
  type_compte text := case when agence is null then 'particulier' else 'agence' end;
  nom text := coalesce(agence, public.nom_complet(new));
begin
  update public.annonces set type_vendeur = type_compte, contact_nom = nom
   where auteur_id = new.id and (type_vendeur <> type_compte or contact_nom is distinct from nom);
  return null;
end $$;
drop trigger profils_annonces_vendeur on public.profils;
create trigger profils_annonces_vendeur after update of agence_id, prenom, nom on public.profils
  for each row when (old.agence_id is distinct from new.agence_id or old.prenom is distinct from new.prenom
                     or old.nom is distinct from new.nom)
  execute function public.profils_annonces_vendeur();

-- Annonces déjà enregistrées : mêmes règles
update public.annonces a
   set type_vendeur = case when public.nom_agence_compte(p) is null then 'particulier' else 'agence' end,
       contact_nom = coalesce(public.nom_agence_compte(p), public.nom_complet(p))
  from public.profils p
 where p.id = a.auteur_id
   and (a.type_vendeur <> case when public.nom_agence_compte(p) is null then 'particulier' else 'agence' end
        or a.contact_nom is distinct from coalesce(public.nom_agence_compte(p), public.nom_complet(p)));
