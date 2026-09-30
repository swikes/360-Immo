/*
 * Vitrine d'un annonceur (particulier ou agence) : /annonceur/kamika-immobilier-k7p2qx
 * Toutes ses annonces en ligne, avec la recherche, les filtres et le tri de la liste des annonces ; les critères
 * s'écrivent dans l'adresse, qui se partage (« Partager ») : un client reçoit exactement la sélection.
 * Le code (6 caractères) désigne la vitrine ; le nom devant n'est là que pour la lecture (un ancien nom mène au bon).
 */
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ListeAnnonces from "@/components/annonces/ListeAnnonces";
import Resultats from "@/components/annonces/Resultats";
import EnteteVitrine from "@/components/vitrine/EnteteVitrine";
import { codeVitrineDe, lienVitrine, type Resultats as Trouvees, type Vitrine } from "@/lib/annonces-en-ligne";
import { lireVitrine, rechercher } from "@/lib/annonces-serveur";
import { adresseListe, criteresBase, lireParametres, rechercheVide, titreRecherche } from "@/lib/recherche";

async function vitrineDe(params: PageProps<"/annonceur/[vitrine]">["params"]): Promise<Vitrine | null> {
  const code = codeVitrineDe(decodeURIComponent((await params).vitrine));
  return code ? lireVitrine(code) : null;
}

export async function generateMetadata({ params }: PageProps<"/annonceur/[vitrine]">): Promise<Metadata> {
  const v = await vitrineDe(params).catch(() => null);
  if (!v) return { title: "Vitrine introuvable" };
  return {
    title: `${v.nom} — annonces immobilières`,
    description: `Les ${v.total} annonce${v.total > 1 ? "s" : ""} en ligne de ${v.nom} sur 360-Immo.ci : photos, prix, quartier, contact direct.`,
    alternates: { canonical: lienVitrine(v) },
  };
}

export default async function PageVitrine({ params, searchParams }: PageProps<"/annonceur/[vitrine]">) {
  const v = await vitrineDe(params);
  if (!v) notFound();
  const base = lienVitrine(v);
  const etat = lireParametres(await searchParams);
  // Adresse ancienne ou incomplète (nom changé, code seul…) : la bonne, en gardant les critères
  if (decodeURIComponent((await params).vitrine) !== base.split("/").pop()) permanentRedirect(adresseListe(etat, base));

  const resultats: Trouvees | null = await rechercher({ ...criteresBase(etat), annonceur: v.code }).catch(() => null);
  return (
    <ListeAnnonces
      etat={etat}
      titre={v.nom}
      titrePartage={rechercheVide(etat) ? `Les annonces de ${v.nom}` : `${titreRecherche(etat)} — ${v.nom}`}
      base={base}
      presentation={<EnteteVitrine vitrine={v} adresse={base} />}
      total={resultats?.total ?? 0}
      parTransaction={resultats?.par_transaction ?? {}}
      parType={resultats?.par_type ?? {}}
    >
      <Resultats etat={etat} resultats={resultats} base={base} messageVide={`${v.nom} n'a pas d'annonce en ligne pour l'instant.`} />
    </ListeAnnonces>
  );
}
