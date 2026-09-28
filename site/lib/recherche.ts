/*
 * Adresse de la liste des annonces pour une recherche (mêmes paramètres que la maquette) :
 *   tx=achat|location · duree=mois|jour · type=appartement,villa… (clés : lib/regles-biens.ts) · q=lieu · min · max
 */
import { cleType } from "./regles-biens";

export type Criteres = {
  location: boolean;
  journaliere?: boolean;
  types?: string[];
  lieu?: string;
  min?: string;
  max?: string;
};

/** Montant saisi (« 500 000 », « 500000 FCFA ») → chiffres seuls */
export const chiffres = (texte = "") => texte.replace(/\D/g, "");

export function adresseAnnonces(c: Criteres): string {
  const p = new URLSearchParams();
  if (c.location) {
    p.set("tx", "location");
    p.set("duree", c.journaliere ? "jour" : "mois");
  } else {
    p.set("tx", "achat");
  }
  const types = (c.types ?? []).map(cleType).filter(Boolean);
  if (types.length) p.set("type", types.join(","));
  const lieu = c.lieu?.trim();
  if (lieu) p.set("q", lieu);
  const min = chiffres(c.min), max = chiffres(c.max);
  if (min) p.set("min", min);
  if (max) p.set("max", max);
  return "/annonces?" + p.toString();
}
