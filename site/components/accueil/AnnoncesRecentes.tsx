"use client";

/*
 * « Annonces récentes & populaires » : les boutons Tous / Appartements / Villas… trient les cartes.
 */
import Link from "next/link";
import { useState } from "react";
import { ANNONCES_DEMO, type TypeAnnonce } from "@/lib/annonces-demo";
import CarteAnnonce from "../CarteAnnonce";
import Icone from "../Icone";
import s from "./AnnoncesRecentes.module.css";

const FILTRES: { texte: string; type: TypeAnnonce | null }[] = [
  { texte: "Tous", type: null },
  { texte: "Appartements", type: "Appartement" },
  { texte: "Villas", type: "Villa" },
  { texte: "Maisons", type: "Maison" },
  { texte: "Terrains", type: "Terrain" },
  { texte: "Bureaux", type: "Bureau" },
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
