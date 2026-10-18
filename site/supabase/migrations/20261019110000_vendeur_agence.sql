-- « Agence immobilière » sur une annonce : réservé aux comptes agence. Les pièces demandées ne sont pas les mêmes
-- (identité : CNI ou passeport et selfie ; agence : RCCM) : une identité vérifiée ne fait pas une agence vérifiée.
--   - compte rattaché à une agence par l'équipe : l'annonce porte le nom de l'agence enregistré par l'équipe, et le
--     badge « Agence vérifiée » seulement si l'agence l'est (RCCM contrôlé) ;
--   - demande d'agence en cours : l'annonce porte le nom demandé, toujours « Annonceur non vérifié » ;
--   - particulier : toujours « Particulier » (même s'il a coché « Agence » en appelant la base directement).
-- Avant, n'importe qui pouvait cocher « Agence » et écrire le nom de son choix ; avec une identité vérifiée, la fiche
-- affichait alors « Agence vérifiée ».

-- Nom de l'agence d'un compte : celui enregistré par l'équipe, sinon celui de sa demande en cours (null : particulier)
create function public.nom_agence_compte(p public.profils) returns text
language sql stable set search_path = '' as $$
  select coalesce((select ag.nom from public.agences ag where ag.id = p.agence_id), nullif(btrim(p.demande_agence), ''));
$$;

-- À l'enregistrement (compte ordinaire) : « Agence » seulement pour un compte agence, avec le nom de l'agence
-- (sans « security definer » : est_admin() doit voir le compte qui écrit ; il lit son propre profil)
create function public.annonces_vendeur() returns trigger
language plpgsql set search_path = '' as $$
declare
  agence text;
begin
  if public.est_admin() then
    return new;
  end if;
  select public.nom_agence_compte(p) into agence from public.profils p where p.id = new.auteur_id;
  if new.type_vendeur = 'agence' then
    if agence is null then
      new.type_vendeur := 'particulier';
    else
      new.contact_nom := agence;
    end if;
  end if;
  return new;
end $$;
-- (après « annonces_controler », qui remet l'auteur d'origine)
create trigger annonces_vendeur before insert or update on public.annonces
  for each row execute function public.annonces_vendeur();

-- Demande retirée ou refusée, agence détachée : ses annonces « Agence » repassent « Particulier », à son nom ;
-- agence validée ou renommée : ses annonces « Agence » prennent le nom enregistré
create function public.profils_annonces_vendeur() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  agence text := public.nom_agence_compte(new);
begin
  if agence is null then
    update public.annonces set type_vendeur = 'particulier', contact_nom = public.nom_complet(new)
     where auteur_id = new.id and type_vendeur = 'agence';
  else
    update public.annonces set contact_nom = agence
     where auteur_id = new.id and type_vendeur = 'agence' and contact_nom is distinct from agence;
  end if;
  return null;
end $$;
create trigger profils_annonces_vendeur after update of agence_id, demande_agence on public.profils
  for each row when (old.agence_id is distinct from new.agence_id or old.demande_agence is distinct from new.demande_agence)
  execute function public.profils_annonces_vendeur();

create function public.agences_nom_annonces() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.annonces a set contact_nom = new.nom
    from public.profils p
   where p.agence_id = new.id and a.auteur_id = p.id and a.type_vendeur = 'agence' and a.contact_nom is distinct from new.nom;
  return null;
end $$;
create trigger agences_nom_annonces after update of nom on public.agences
  for each row when (old.nom is distinct from new.nom) execute function public.agences_nom_annonces();

-- Annonces déjà enregistrées : mêmes règles
update public.annonces a set type_vendeur = 'particulier', contact_nom = public.nom_complet(p)
  from public.profils p
 where p.id = a.auteur_id and a.type_vendeur = 'agence' and public.nom_agence_compte(p) is null;
update public.annonces a set contact_nom = public.nom_agence_compte(p)
  from public.profils p
 where p.id = a.auteur_id and a.type_vendeur = 'agence' and a.contact_nom is distinct from public.nom_agence_compte(p);

-- Sur les pages publiques : nom de l'agence du compte (jamais un nom écrit à la main)
create or replace function public.nom_agence_annonce(annonce uuid) returns text
language sql stable security definer set search_path = '' as $$
  select public.nom_agence_compte(p)
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  where a.id = annonce and a.type_vendeur = 'agence'
    and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

-- Le badge d'une annonce « Agence » : celui de l'agence (RCCM), jamais celui de l'identité de la personne
create or replace view public.annonces_en_ligne with (security_invoker = true) as
select
  a.id, a.reference, a.transaction, a.type_bien, t.nom as type_nom, a.titre, a.description,
  a.prix, a.loyer_par, a.caution_mois,
  v.nom as ville, c.nom as commune, coalesce(q.nom, a.quartier_texte) as quartier, a.adresse,
  a.ville_id, a.commune_id, a.quartier_id,
  a.surface, t.surface as surface_nom, a.pieces, a.studio, a.chambres, a.sanitaires, t.sanitaires as sanitaires_nom,
  a.meuble, a.dans_immeuble, a.etage, a.commodites,
  a.type_vendeur,
  case when a.type_vendeur = 'agence' then public.nom_agence_annonce(a.id) else an.nom end as contact_nom,
  a.contact_whatsapp,
  (a.premium and (a.premium_jusquau is null or a.premium_jusquau > now())) as premium,
  a.verifiee, a.vues, a.publiee_le, a.expire_le,
  coalesce(p.photos, '{}') as photos,
  an.code as annonceur, an.nom as annonceur_nom, an.agence as annonceur_agence,
  case when a.type_vendeur = 'agence' then an.agence and an.verifiee else an.verifiee end as annonceur_verifie,
  a.disponibles
from public.annonces a
join public.types_bien t on t.cle = a.type_bien
join public.villes v on v.id = a.ville_id
join public.communes c on c.id = a.commune_id
left join public.quartiers q on q.id = a.quartier_id
left join lateral (
  select array_agg(ph.chemin order by ph.ordre, ph.cree_le) as photos
  from public.photos_annonce ph where ph.annonce_id = a.id
) p on true
left join lateral public.annonceur_public(a.id) an on true
where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
