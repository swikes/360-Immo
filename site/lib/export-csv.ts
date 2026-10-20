/*
 * Export d'un tableau en fichier CSV (statistiques détaillées et suivi des contacts des agences abonnées) :
 * point-virgule et marque UTF-8, pour qu'Excel l'ouvre directement, accents compris.
 */
type Cellule = string | number | null | undefined;

const cellule = (v: Cellule) => {
  const t = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Le texte du fichier : une ligne par rang, cellules séparées par des points-virgules */
export const texteCsv = (lignes: Cellule[][]) => lignes.map((l) => l.map(cellule).join(";")).join("\r\n");

/** Fait télécharger le fichier par le navigateur */
export function telechargerCsv(fichier: string, lignes: Cellule[][]) {
  const url = URL.createObjectURL(new Blob(["﻿" + texteCsv(lignes)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
