"use client";

/*
 * « Annonces récentes & populaires » : les boutons Tous / Appartements / Villas… trient les cartes.
 */
import Link from "next/link";
import { useState } from "react";
import { ANNONCES_DEMO, type TypeAnnonce } from "@/lib/annonces-demo";
import { TYPES_BIEN } from "@/lib/regles-biens";
import CarteAnnonce from "../CarteAnnonce";
import Icone from "../Icone";
import s from "./AnnoncesRecentes.module.css";

const PLURIEL: Record<string, string> = {
  "Appartement": "Appartements", "Maison": "Maisons", "Villa": "Villas", "Terrain": "Terrains", "Bureau": "Bureaux",
  "Commerce / Magasin": "Commerces / Magasins", "Immeuble": "Immeubles", "Chambre d'hôtel": "Chambres d'hôtel",
  "Autres": "Autres",
};

// Un bouton par type de bien présent parmi les annonces, dans l'ordre de la publication (lib/regles-biens.ts)
const FILTRES: { texte: string; type: TypeAnnonce | null }[] = [
  { texte: "Tous", type: null },
  ...TYPES_BIEN.filter((t) => ANNONCES_DEMO.some((a) => a.type === t)).map((t) => ({
    texte: PLURIEL[t] ?? t,
    type: t as TypeAnnonce,
  })),
];

export default function AnnoncesRecentes() {
  const [filtre, setFiltre] = useState<TypeAnnonce | null>(null);
  const annonces = ANNONCES_DEMO.filter((a) => !filtre || a.type === filtre);
  return (
    <>
      <div className={s.filtres} role="group" aria-label="Type de bien">
        {FILTRES.map((f) => (
          <button
            key={f.texte}
            type="button"
            className={s.filtre}
            aria-pressed={filtre === f.type}
            onClick={() => setFiltre(f.type)}
          >
            {f.texte}
          </button>
        ))}
      </div>
      <div className={s.grille}>
        {annonces.map((a) => (
          <CarteAnnonce key={a.id} annonce={a} />
        ))}
      </div>
      <div className={s.toutes}>
        <Link href="/annonces" className={s.toutesBtn}>
          Voir toutes les annonces
          <Icone nom="fleche" epaisseur={2.5} />
        </Link>
      </div>
    </>
  );
}
