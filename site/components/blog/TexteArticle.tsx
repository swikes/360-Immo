/*
 * Texte d'un article du blog, mis en page (lib/blog.ts : lireTexte) : titres, paragraphes, listes, encadrés
 * « À retenir » et « Attention », gras et liens. Sert à la page de l'article et à l'aperçu de l'éditeur
 * (Administration → Blog). Rien n'est inséré comme du HTML : le texte s'affiche tel quel.
 */
import Link from "next/link";
import { Fragment } from "react";
import Icone from "@/components/Icone";
import type { Bloc, Morceau } from "@/lib/blog";
import s from "./TexteArticle.module.css";

function Morceaux({ morceaux }: { morceaux: Morceau[] }) {
  return morceaux.map((m, i) => {
    if (m.type === "texte") return <Fragment key={i}>{m.texte}</Fragment>;
    if (m.type === "gras") return <strong key={i}><Morceaux morceaux={m.contenu} /></strong>;
    // une page du site : lien du site ; une autre adresse : nouvel onglet
    return m.url.startsWith("/") ? (
      <Link key={i} href={m.url}><Morceaux morceaux={m.contenu} /></Link>
    ) : (
      <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"><Morceaux morceaux={m.contenu} /></a>
    );
  });
}

function Blocs({ blocs }: { blocs: Bloc[] }) {
  return blocs.map((b, i) => {
    switch (b.type) {
      case "titre":
        return b.niveau === 2 ? <h2 key={i} id={b.id}>{b.texte}</h2> : <h3 key={i} id={b.id}>{b.texte}</h3>;
      case "paragraphe":
        return (
          <p key={i}>
            {b.lignes.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Morceaux morceaux={l} /></Fragment>)}
          </p>
        );
      case "liste": {
        const elements = b.elements.map((e, j) => <li key={j}><Morceaux morceaux={e} /></li>);
        return b.numerotee ? <ol key={i} start={b.debut !== 1 ? b.debut : undefined}>{elements}</ol> : <ul key={i}>{elements}</ul>;
      }
      case "encadre":
        return (
          <aside key={i} className={`${s.encadre} ${b.genre === "attention" ? s.attention : s.retenir}`}
            aria-label={b.genre === "attention" ? "Attention" : "À retenir"}>
            <span className={s.encadreTitre}>
              <Icone nom={b.genre === "attention" ? "bouclier" : "valide"} taille={16} /> {b.genre === "attention" ? "Attention" : "À retenir"}
            </span>
            <Blocs blocs={b.blocs} />
          </aside>
        );
    }
  });
}

export default function TexteArticle({ blocs }: { blocs: Bloc[] }) {
  return <div className={s.texte}><Blocs blocs={blocs} /></div>;
}
