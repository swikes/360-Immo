/*
 * La maquette (première version du site en HTML) reste en ligne pendant la construction du nouveau site :
 * les pages pas encore reconstruites y renvoient.
 */
export const MAQUETTE = "https://swikes.github.io/360-Immo/";

/** Adresse d'une page de la maquette, avec les mêmes paramètres de recherche éventuels */
export function pageMaquette(fichier: string, parametres?: URLSearchParams): string {
  const suite = parametres?.toString();
  return MAQUETTE + fichier + (suite ? "?" + suite : "");
}
