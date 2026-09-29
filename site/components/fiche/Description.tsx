"use client";

/* Description du bien : les longues descriptions sont repliées (« Lire la suite ») */
import { useState } from "react";
import s from "./Fiche.module.css";

export default function Description({ texte }: { texte: string }) {
  const longue = texte.length > 420;
  const [ouverte, setOuverte] = useState(false);
  return (
    <div>
      <p className={`${s.description} ${longue && !ouverte ? s.repliee : ""}`}>{texte}</p>
      {longue && (
        <button type="button" className={s.lireSuite} onClick={() => setOuverte(!ouverte)} aria-expanded={ouverte}>
          {ouverte ? "Réduire" : "Lire la suite"}
        </button>
      )}
    </div>
  );
}
