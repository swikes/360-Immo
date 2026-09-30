-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — coordonnées des annonces réservées à leur auteur, même pour les comptes connectés
--
-- Les visiteurs sans compte ne lisaient déjà ni le nom complet du contact, ni les numéros, ni l'e-mail, ni la
-- position exacte (voir …_recherche.sql et …_nom_discret.sql). Un compte connecté, lui, pouvait encore les lire
-- directement dans la table des annonces publiées. Désormais :
--   · tout compte lit des annonces ce que la page publique montre, plus leur auteur et leurs dates ;
--   · les coordonnées (contact_nom, contact_telephone, contact_telephone2, contact_email) et la position exacte
--     (latitude, longitude) ne se lisent que par mes_annonces(), pour ses propres annonces ;
--   · les visiteurs obtiennent le nom complet et les numéros d'une annonce en ligne par contact_annonce()
--     (« Afficher le numéro »), comme avant.
-- Écrire ses annonces ne change pas (création, modification, suppression par leur auteur).
-- Une colonne ajoutée plus tard aux annonces n'est lisible par les comptes que si elle est ajoutée ci-dessous.
-- ════════════════════════════════════════════════════════════════════════════

revoke select on public.annonces from authenticated;
grant select (
  id, reference, auteur_id, agence_id, statut, motif_refus, transaction, type_bien, titre, description, prix,
  loyer_par, caution_mois, ville_id, commune_id, quartier_id, quartier_texte, adresse, surface, pieces, studio,
  chambres, sanitaires, meuble, dans_immeuble, etage, commodites, type_vendeur, contact_whatsapp,
  contact_telephone2_whatsapp, premium, premium_jusquau, verifiee, vues, publiee_le, expire_le, cree_le, modifie_le
) on public.annonces to authenticated;

-- Ses propres annonces, complètes (Mon Espace → Mes annonces, modification d'une annonce)
create function public.mes_annonces() returns setof public.annonces
language sql stable security definer set search_path = '' as $$
  select * from public.annonces where auteur_id = auth.uid();
$$;

revoke execute on function public.mes_annonces() from public, anon;
grant execute on function public.mes_annonces() to authenticated;
