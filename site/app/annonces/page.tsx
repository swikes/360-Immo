/*
 * Liste des annonces (Acheter, Louer, recherche de l'accueil, liens du pied de page).
 * L'adresse décrit la recherche (/annonces?tx=location&type=appartement&q=Cocody…, voir lib/recherche.ts) :
 * le serveur lit les annonces en ligne correspondantes dans la base, puis la page permet d'affiner et de partager.
 */
import type { Metadata } from "next";
import ListeAnnonces from "@/components/annonces/ListeAnnonces";
import Resultats from "@/components/annonces/Resultats";
import type { Resultats as Trouvees } from "@/lib/annonces-en-ligne";
import { rechercher } from "@/lib/annonces-serveur";
import { criteresBase, lireParametres, titreRecherche } from "@/lib/recherche";

export async function generateMetadata({ searchParams }: PageProps<"/annonces">): Promise<Metadata> {
  const etat = lireParametres(await searchParams);
  const titre = titreRecherche(etat);
  return {
    title: etat.page > 1 ? `${titre} (page ${etat.page})` : titre,
    description: `${titre} en Côte d'Ivoire sur 360-Immo.ci : photos, prix, quartier, contact direct de l'annonceur.`,
  };
}

export default async function Annonces({ searchParams }: PageProps<"/annonces">) {
  const etat = lireParametres(await searchParams);
  const resultats: Trouvees | null = await rechercher(criteresBase(etat)).catch(() => null); // null : base injoignable
  const titre = titreRecherche(etat);
  return (
    <ListeAnnonces
      etat={etat}
      titre={titre}
      titrePartage={titre}
      total={resultats?.total ?? 0}
      parTransaction={resultats?.par_transaction ?? {}}
      parType={resultats?.par_type ?? {}}
    >
      <Resultats etat={etat} resultats={resultats} />
    </ListeAnnonces>
  );
}
