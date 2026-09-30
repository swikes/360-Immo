/*
 * Résultats d'une recherche (liste des annonces ou vitrine d'un annonceur), préparés par le serveur :
 * cartes, pages, ou message (aucun résultat, base injoignable).
 */
import Link from "next/link";
import CarteAnnonce from "@/components/CarteAnnonce";
import Icone from "@/components/Icone";
import type { Resultats as Trouvees } from "@/lib/annonces-en-ligne";
import { adresseListe, RECHERCHE_VIDE, rechercheVide, type EtatRecherche } from "@/lib/recherche";
import s from "./Resultats.module.css";

type Props = {
  etat: EtatRecherche;
  /** null : la base n'a pas répondu */
  resultats: Trouvees | null;
  /** adresse de la liste (/annonces) ou de la vitrine (/annonceur/…) */
  base?: string;
  /** vitrine sans aucune annonce en ligne */
  messageVide?: string;
};

export default function Resultats({ etat, resultats, base = "/annonces", messageVide }: Props) {
  if (!resultats) {
    return (
      <div className={s.message} role="alert">
        <Icone nom="horloge" taille={28} />
        <p>Les annonces ne peuvent pas être affichées pour l&apos;instant. Réessayez dans quelques minutes.</p>
      </div>
    );
  }
  const pages = Math.max(1, Math.ceil(resultats.total / resultats.par_page));
  if (!resultats.annonces.length) {
    const sansCritere = rechercheVide(etat);
    return (
      <div className={s.message}>
        <Icone nom="recherche" taille={28} />
        <p className={s.messageTitre}>
          {resultats.total
            ? "Cette page n'existe plus."
            : sansCritere && messageVide
              ? messageVide
              : "Aucune annonce ne correspond à cette recherche pour l'instant."}
        </p>
        {!(sansCritere && messageVide) && <p>Essayez un autre lieu ou moins de critères. Les nouvelles annonces arrivent chaque jour.</p>}
        <div className={s.messageLiens}>
          {resultats.total > 0 ? (
            <Link href={adresseListe({ ...etat, page: 1 }, base)} className={s.boutonPlein}>Revenir à la première page</Link>
          ) : sansCritere ? (
            <Link href="/annonces" className={s.boutonPlein}>Voir toutes les annonces</Link>
          ) : (
            <Link href={adresseListe({ ...RECHERCHE_VIDE, tx: etat.tx, duree: etat.duree }, base)} className={s.boutonPlein}>
              Voir toutes les annonces{etat.tx === "location" ? " à louer" : etat.tx === "achat" ? " à vendre" : ""}
            </Link>
          )}
          <Link href="/publier" className={s.boutonContour}>Publier une annonce</Link>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className={s.grille}>
        {resultats.annonces.map((a) => <CarteAnnonce key={a.id} annonce={a} titreNiveau={2} />)}
      </div>
      {pages > 1 && <Pages etat={etat} pages={pages} base={base} />}
    </>
  );
}

/** Pages : ‹ Précédente · 1 … 4 5 6 … 12 · Suivante › */
function Pages({ etat, pages, base }: { etat: EtatRecherche; pages: number; base: string }) {
  const p = Math.min(etat.page, pages);
  const numeros = [...new Set([1, p - 1, p, p + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const lien = (n: number) => adresseListe({ ...etat, page: n }, base);
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
