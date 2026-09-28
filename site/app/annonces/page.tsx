/*
 * Liste des annonces (Acheter, Louer, recherche de l'accueil).
 * Pour l'instant : résumé de la recherche et lien vers les résultats de la maquette.
 */
import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";
import { formaterPrix } from "@/lib/format";
import { typeDeCle } from "@/lib/regles-biens";

export const metadata: Metadata = { title: "Annonces immobilières" };

/** Critères de l'adresse, en clair : « Louer · au mois », « Appartement », « Cocody », « Loyer max : 200 000 FCFA / mois » */
function resumer(p: URLSearchParams): string[] {
  const resume: string[] = [];
  const location = p.get("tx") === "location";
  const duree = p.get("duree") === "jour" ? "jour" : "mois";
  if (p.get("tx") === "achat") resume.push("Acheter");
  if (location) resume.push(`Louer · ${duree === "jour" ? "à la journée" : "au mois"}`);
  const types = (p.get("type") ?? "").split(",").map(typeDeCle).filter(Boolean);
  if (types.length) resume.push(types.join(", "));
  const lieu = p.get("q")?.trim();
  if (lieu) resume.push(lieu);
  const unite = location ? ` FCFA / ${duree}` : " FCFA";
  const prix = location ? "Loyer" : "Prix";
  const min = Number(p.get("min")), max = Number(p.get("max"));
  if (min > 0) resume.push(`${prix} min : ${formaterPrix(min)}${unite}`);
  if (max > 0) resume.push(`${prix} max : ${formaterPrix(max)}${unite}`);
  // Critères avancés (« Plus de critères »)
  const pieces = p.get("pieces");
  if (pieces) resume.push(pieces === "studio" ? "Studio" : pieces === "1" ? "1 pièce" : `${pieces} pièces`);
  const chambres = p.get("chambres");
  if (chambres) resume.push(chambres === "1" ? "1 chambre" : `${chambres} chambres`);
  const smin = Number(p.get("smin")), smax = Number(p.get("smax"));
  if (smin > 0 || smax > 0) {
    resume.push(smin > 0 && smax > 0 ? `${smin} – ${smax} m²` : smin > 0 ? `${smin} m² min` : `${smax} m² max`);
  }
  if (p.get("sdb")) resume.push(`Salles de bain / toilettes : ${p.get("sdb")}`);
  if (p.get("caution")) resume.push(`Caution max : ${p.get("caution")} mois`);
  if (p.get("meuble") === "1") resume.push("Déjà meublé");
  if (p.get("immeuble") === "1") resume.push("Dans un immeuble");
  const etage = p.get("etage");
  if (etage) resume.push(`Étage : ${etage === "rdc" ? "rez-de-chaussée" : etage.replace("+", " et plus")}`);
  if (p.get("photos") === "1") resume.push("Avec photos");
  if (p.get("recentes") === "1") resume.push("Annonces récentes");
  const commodites = (p.get("com") ?? "").split("|").filter(Boolean);
  if (commodites.length) resume.push(commodites.join(", "));
  if (p.get("sort") === "recent") resume.push("Les plus récentes");
  return resume;
}

export default async function Annonces({ searchParams }: PageProps<"/annonces">) {
  const parametres = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(await searchParams)) {
    for (const v of [valeur ?? []].flat()) parametres.append(cle, v);
  }
  const tx = parametres.get("tx");
  const titre = tx === "achat" ? "Biens à vendre" : tx === "location" ? "Biens à louer" : "Annonces immobilières";
  return (
    <BientotDisponible
      titre={titre}
      etape="Recherche et filtres"
      maquette="360-immo-resultats.html"
      parametres={parametres}
      resume={resumer(parametres)}
    />
  );
}
