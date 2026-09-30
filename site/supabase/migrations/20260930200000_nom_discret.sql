-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — nom discret d'un particulier sur les annonces en ligne
--
-- Sur les pages publiques (liste, accueil, fiche, vitrine), un particulier apparaît sous le nom de sa vitrine
-- (« Awa K. ») ; une agence, sous le nom écrit dans l'annonce. Le nom complet du contact n'est plus lisible
-- par un visiteur sans compte : il est donné avec les numéros, sur demande (« Afficher le numéro » →
-- contact_annonce, qui le renvoie déjà).
--
--   nom_agence_annonce()   le nom écrit dans une annonce d'agence en ligne
--   annonces_en_ligne      contact_nom = nom de l'agence, ou nom de la vitrine pour un particulier
--   annonces.contact_nom   plus lisible directement par les visiteurs sans compte
-- ════════════════════════════════════════════════════════════════════════════

-- Nom écrit dans une annonce d'agence en ligne (le nom d'une entreprise est public)
create function public.nom_agence_annonce(annonce uuid) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(btrim(a.contact_nom), '')
  from public.annonces a
  where a.id = annonce and a.type_vendeur = 'agence'
    and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

grant execute on function public.nom_agence_annonce(uuid) to anon, authenticated;

-- Les annonces en ligne : même vue, seul contact_nom change
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
  an.code as annonceur, an.nom as annonceur_nom, an.agence as annonceur_agence, an.verifiee as annonceur_verifie
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

-- Le nom complet du contact : plus lisible directement par un visiteur sans compte (comme les numéros)
revoke select (contact_nom) on public.annonces from anon;
