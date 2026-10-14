/** Quelques icônes du site (site/components/Icone.tsx), au trait, de la couleur du texte autour */
import type { ReactNode } from "react";

const DESSINS: Record<string, ReactNode> = {
  immeuble: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1M10 22v-4h4v4" /></>,
  maison: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  terrain: <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />,
  bureau: <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>,
  valide: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  fleche: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
};

export function Icone({ nom, taille = 40, epaisseur = 2 }: { nom: string; taille?: number; epaisseur?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur}
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {DESSINS[nom]}
    </svg>
  );
}
