/*
 * Liste des annonces (Acheter, Louer, recherche de l'accueil, liens du pied de page).
 * L'adresse décrit la recherche (/annonces?tx=location&type=appartement&q=Cocody…, voir lib/recherche.ts) :
 * le serveur lit les annonces en ligne correspondantes dans la base, puis la page permet d'affiner.
 */
import type { Metadata } from "next";
import Link from "next/link";
import ListeAnnonces from "@/components/annonces/ListeAnnonces";
import CarteAnnonce from "@/components/CarteAnnonce";
import Icone from "@/components/Icone";
import type { Resultats } from "@/lib/annonces-en-ligne";
import { rechercher } from "@/lib/annonces-serveur";
import { adresseListe, criteresBase, lireAdresse, RECHERCHE_VIDE, titreRecherche, type EtatRecherche } from "@/lib/recherche";
import s from "./page.module.css";

async function etatDe(searchParams: PageProps<"/annonces">["searchParams"]): Promise<EtatRecherche> {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(await searchParams)) {
    for (const v of [valeur ?? []].flat()) p.append(cle, v);
  }
  return lireAdresse(p);
}

export async function generateMetadata({ searchParams }: PageProps<"/annonces">): Promise<Metadata> {
  const etat = await etatDe(searchParams);
  const titre = titreRecherche(etat);
  return {
    title: etat.page > 1 ? `${titre} (page ${etat.page})` : titre,
    description: `${titre} en Côte d'Ivoire sur 360-Immo.ci : photos, prix, quartier, contact direct de l'annonceur.`,
  };
}

export default async function Annonces({ searchParams }: PageProps<"/annonces">) {
  const etat = await etatDe(searchParams);
  let resultats: Resultats | null = null;
  try {
    resultats = await rechercher(criteresBase(etat));
  } catch {
    resultats = null; // base injoignable : message plus bas
  }
  const pages = resultats ? Math.max(1, Math.ceil(resultats.total / resultats.par_page)) : 1;

  return (
    <ListeAnnonces
      etat={etat}
      titre={titreRecherche(etat)}
      total={resultats?.total ?? 0}
      parTransaction={resultats?.par_transaction ?? {}}
      parType={resultats?.par_type ?? {}}
    >
      {!resultats ? (
        <div className={s.message} role="alert">
          <Icone nom="horloge" taille={28} />
          <p>Les annonces ne peuvent pas être affichées pour l&apos;instant. Réessayez dans quelques minutes.</p>
        </div>
      ) : resultats.annonces.length === 0 ? (
        <div className={s.message}>
          <Icone nom="recherche" taille={28} />
          <p className={s.messageTitre}>
            {resultats.total ? "Cette page n'existe plus." : "Aucune annonce ne correspond à cette recherche pour l'instant."}
          </p>
          <p>Essayez un autre lieu ou moins de critères. Les nouvelles annonces arrivent chaque jour.</p>
          <div className={s.messageLiens}>
            {resultats.total > 0 ? (
              <Link href={adresseListe({ ...etat, page: 1 })} className={s.boutonPlein}>Revenir à la première page</Link>
            ) : (
              <Link href={adresseListe({ ...RECHERCHE_VIDE, tx: etat.tx, duree: etat.duree })} className={s.boutonPlein}>
                Voir toutes les annonces{etat.tx === "location" ? " à louer" : etat.tx === "achat" ? " à vendre" : ""}
              </Link>
            )}
            <Link href="/publier" className={s.boutonContour}>Publier une annonce</Link>
          </div>
        </div>
      ) : (
        <>
          <div className={s.grille}>
            {resultats.annonces.map((a) => <CarteAnnonce key={a.id} annonce={a} titreNiveau={2} />)}
          </div>
          {pages > 1 && <Pages etat={etat} pages={pages} />}
        </>
      )}
    </ListeAnnonces>
  );
}

/** Pages : ‹ Précédente · 1 … 4 5 6 … 12 · Suivante › */
function Pages({ etat, pages }: { etat: EtatRecherche; pages: number }) {
  const p = Math.min(etat.page, pages);
  const numeros = [...new Set([1, p - 1, p, p + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const lien = (n: number) => adresseListe({ ...etat, page: n });
  return (
    <nav className={s.pages} aria-label="Pages">
      {p > 1 ? <Link href={lien(p - 1)} className={s.page} rel="prev"><Icone nom="retour" taille={14} /> Précédente</Link> : <span />}
      <ol className={s.numeros}>
        {numeros.map((n, i) => (
          <li key={n}>
            {i > 0 && n - numeros[i - 1] > 1 && <span className={s.points} aria-hidden="true">…</span>}
            {n === p ? (
              <span className={`${s.numero} ${s.numeroActif}`} aria-current="page">{n}</span>
            ) : (
              <Link href={lien(n)} className={s.numero} aria-label={`Page ${n}`}>{n}</Link>
            )}
          </li>
        ))}
      </ol>
      {p < pages ? <Link href={lien(p + 1)} className={s.page} rel="next">Suivante <Icone nom="suivant" taille={14} /></Link> : <span />}
    </nav>
  );
}
