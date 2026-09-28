/*
 * Liste des annonces (Acheter, Louer, recherche de l'accueil).
 * Pour l'instant : résumé de la recherche et lien vers les résultats de la maquette.
 */
import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";
import { formaterPrix } from "@/lib/format";

export const metadata: Metadata = { title: "Annonces immobilières" };

const NOM_TYPE: Record<string, string> = {
  appartement: "Appartement", maison: "Maison", villa: "Villa", terrain: "Terrain",
  bureau: "Bureau", commerce: "Commerce / Magasin", immeuble: "Immeuble",
};

/** Critères de l'adresse, en clair : « Louer · au mois », « Appartement », « Cocody », « Loyer max : 200 000 FCFA / mois » */
function resumer(p: URLSearchParams): string[] {
  const resume: string[] = [];
  const location = p.get("tx") === "location";
  const duree = p.get("duree") === "jour" ? "jour" : "mois";
  if (p.get("tx") === "achat") resume.push("Acheter");
  if (location) resume.push(`Louer · ${duree === "jour" ? "à la journée" : "au mois"}`);
  const types = (p.get("type") ?? "").split(",").map((t) => NOM_TYPE[t]).filter(Boolean);
  if (types.length) resume.push(types.join(", "));
  const lieu = p.get("q")?.trim();
  if (lieu) resume.push(lieu);
  const unite = location ? ` FCFA / ${duree}` : " FCFA";
  const prix = location ? "Loyer" : "Prix";
  const min = Number(p.get("min")), max = Number(p.get("max"));
  if (min > 0) resume.push(`${prix} min : ${formaterPrix(min)}${unite}`);
  if (max > 0) resume.push(`${prix} max : ${formaterPrix(max)}${unite}`);
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
