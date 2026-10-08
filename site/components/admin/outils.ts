/* Petits outils de l'espace Administration : dates, caractéristiques d'une annonce en clair */
import type { AnnonceAVerifier } from "@/lib/admin";
import { disponiblesTexte } from "@/lib/regles-biens";

export const dateHeure = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) + " à " +
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const dateJour = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const n = (v: number, mot: string, mots = `${mot}s`) => `${v} ${v > 1 ? mots : mot}`;

/** « 3 pièces · 2 chambres · 1 salle de bain · 85 m² · Meublé · 2e étage » */
export function caracteristiques(a: AnnonceAVerifier): string[] {
  const c: string[] = [];
  if (a.studio) c.push("Studio");
  else if (a.pieces) c.push(n(a.pieces, "pièce"));
  if (a.chambres) c.push(n(a.chambres, "chambre"));
  if (a.sanitaires) c.push(n(a.sanitaires, "salle de bain", "salles de bain"));
  if (a.surface) c.push(`${new Intl.NumberFormat("fr-FR").format(a.surface)} m²`);
  if (a.meuble) c.push("Meublé");
  if (a.dans_immeuble || a.etage !== null) c.push(a.etage === null ? "Dans un immeuble" : a.etage === 0 ? "Rez-de-chaussée" : a.etage === 1 ? "1er étage" : `${a.etage}e étage`);
  if (a.caution_mois) c.push(`Caution : ${n(a.caution_mois, "mois", "mois")}`);
  const disponibles = disponiblesTexte(a.type_bien, a.disponibles);
  if (disponibles) c.push(disponibles);
  return c;
}
