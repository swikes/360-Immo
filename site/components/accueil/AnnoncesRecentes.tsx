"use client";

/*
 * « Annonces récentes & populaires » : les dernières annonces en ligne (lues par la page d'accueil) ;
 * les boutons Tous / Appartements / Villas… trient les cartes.
 */
import Link from "next/link";
import { useState } from "react";
import type { CarteAnnonce as Annonce } from "@/lib/annonces-en-ligne";
import { pluriel, TYPES_BIEN } from "@/lib/regles-biens";
import CarteAnnonce from "../CarteAnnonce";
import Icone from "../Icone";
import s from "./AnnoncesRecentes.module.css";

/** Cartes affichées (les plus récentes du type choisi) */
const NOMBRE = 6;

export default function AnnoncesRecentes({ annonces: toutes }: { annonces: Annonce[] }) {
  const [filtre, setFiltre] = useState<string | null>(null);
  // Un bouton par type de bien présent parmi les annonces, dans l'ordre de la publication (lib/regles-biens.ts)
  const filtres = [
    { texte: "Tous", type: null as string | null },
    ...TYPES_BIEN.filter((t) => toutes.some((a) => a.type_nom === t)).map((t) => ({ texte: t === "Autres" ? "Autres" : pluriel(t), type: t as string | null })),
  ];
  const annonces = toutes.filter((a) => !filtre || a.type_nom === filtre).slice(0, NOMBRE);
  if (!toutes.length) {
    return (
      <div className={s.vide}>
        <p>Les premières annonces arrivent : elles s&apos;afficheront ici dès leur publication.</p>
        <Link href="/publier" className={s.toutesBtn}>
          Publier une annonce
          <Icone nom="fleche" epaisseur={2.5} />
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className={s.filtres} role="group" aria-label="Type de bien">
        {filtres.map((f) => (
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
