"use client";

/*
 * Cœur « Ajouter aux favoris » d'une annonce (cartes, fiche). Compte connecté : enregistré dans ses favoris
 * (lib/favoris.ts). Sans compte : fenêtre « Connectez-vous », puis l'annonce est ajoutée après la connexion.
 */
import Icone from "./Icone";
import { demanderConnexion } from "./DemandeConnexion";
import { retenirFavori, useFavoris } from "@/lib/favoris";

type Props = {
  annonce: string;
  titre: string;
  className?: string;
  /** texte à côté du cœur (« Sauvegarder » / « Sauvegardé ») */
  texte?: boolean;
};

export default function BoutonFavori({ annonce, titre, className, texte }: Props) {
  const { compte, est, basculer } = useFavoris();
  const favori = est(annonce);
  const toucher = () => {
    if (compte === "chargement") return;
    if (compte !== "connecte") {
      retenirFavori(annonce);
      demanderConnexion("favori");
      return;
    }
    void basculer(annonce);
  };
  return (
    <button
      type="button"
      className={className}
      aria-pressed={favori}
      aria-label={`${favori ? "Retirer des" : "Ajouter aux"} favoris : ${titre}`}
      title={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={toucher}
    >
      <Icone nom="coeur" fill={favori ? "currentColor" : "none"} />
      {texte && <span>{favori ? "Sauvegardé" : "Sauvegarder"}</span>}
    </button>
  );
}
