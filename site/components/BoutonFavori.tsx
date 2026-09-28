"use client";

/*
 * Cœur « Ajouter aux favoris » d'une annonce.
 * Pour l'instant le choix n'est pas enregistré : il le sera avec les comptes (étape « favoris, messages… »).
 */
import { useState } from "react";
import Icone from "./Icone";

export default function BoutonFavori({ titre, className }: { titre: string; className?: string }) {
  const [favori, setFavori] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={favori}
      aria-label={`${favori ? "Retirer des" : "Ajouter aux"} favoris : ${titre}`}
      onClick={() => setFavori(!favori)}
    >
      <Icone nom="coeur" fill={favori ? "currentColor" : "none"} />
    </button>
  );
}
