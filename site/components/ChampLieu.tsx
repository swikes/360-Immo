"use client";

/*
 * Champ « ville, commune ou quartier » avec liste de suggestions (reprise de js/choix-lieu.js de la maquette).
 *   - rien de tapé : villes et communes ; en tapant : aussi les quartiers (« rivi » → Riviera 2 · Cocody)
 *   - recherche sans accents ni majuscules ; flèches, Entrée et Échap au clavier ; saisie libre possible
 *   - la liste s'ouvre toujours SOUS le champ ; sur téléphone, s'il manque de place (clavier ouvert, champ bas
 *     dans l'écran), le champ remonte en haut de l'écran pour laisser la place à la liste
 * Le parent du champ doit être en position: relative (la liste se place par rapport à lui).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { chercher, correspondance, normaliser, surligner, texteLieu, type EntreeLieu } from "@/lib/choix-lieu";
import s from "./ChampLieu.module.css";

type Props = {
  id: string;
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  /** proposer aussi les quartiers (dès qu'on tape) */
  quartiers?: boolean;
};

export default function ChampLieu({ id, valeur, onChange, placeholder, quartiers = false }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [tape, setTape] = useState(false); // la liste suit ce qui est tapé (sinon : toute la liste)
  const [active, setActive] = useState(-1);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const derniereValeur = useRef(valeur);
  const fermeture = useRef<number | undefined>(undefined);
  const remonte = useRef(false);

  useEffect(() => {
    derniereValeur.current = valeur;
  }, [valeur]);

  const saisie = tape ? valeur : "";
  const resultats = ouvert ? chercher(saisie, { quartiers }) : [];
  const idListe = `${id}-liste`;

  const ouvrir = (enTapant: boolean) => {
    window.clearTimeout(fermeture.current);
    setTape(enTapant);
    setOuvert(true);
    if (enTapant) setActive(0);
    else {
      // rien de tapé : le lieu déjà choisi est mis en évidence
      const courant = normaliser(valeur);
      setActive(courant ? chercher("", { quartiers }).findIndex((e) => normaliser(texteLieu(e)) === courant) : -1);
    }
  };
  const fermer = () => {
    setOuvert(false);
    setTape(false);
    setActive(-1);
  };
  const choisir = (e: EntreeLieu) => {
    onChange(texteLieu(e));
    fermer();
  };

  // Hauteur de la liste : jusqu'au bas de l'écran, ou jusqu'au clavier ; sur téléphone, le champ remonte si besoin
  useEffect(() => {
    if (!ouvert) {
      remonte.current = false;
      return;
    }
    const ajuster = () => {
      const input = champ.current, ul = liste.current;
      if (!input || !ul) return;
      const vv = window.visualViewport;
      const bas = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const tactile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
      if (tactile && bas - input.getBoundingClientRect().bottom < 190 && !remonte.current) {
        remonte.current = true;
        input.scrollIntoView({ block: "start", behavior: "instant" }); // d'un coup : la place se mesure juste après
      }
      const dessous = bas - input.getBoundingClientRect().bottom - 12;
      ul.style.maxHeight = Math.max(tactile ? 96 : 160, Math.min(300, dessous)) + "px";
    };
    ajuster();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", ajuster);
    vv?.addEventListener("scroll", ajuster);
    window.addEventListener("resize", ajuster);
    return () => {
      vv?.removeEventListener("resize", ajuster);
      vv?.removeEventListener("scroll", ajuster);
      window.removeEventListener("resize", ajuster);
    };
  }, [ouvert]);

  // Garder l'élément actif visible dans la liste
  useEffect(() => {
    const ul = liste.current, li = ul?.children[active] as HTMLElement | undefined;
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop - 6;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) {
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight + 6;
    }
  }, [active, ouvert]);

  const touche = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!ouvert) return ouvrir(false);
      if (!resultats.length) return;
      const n = resultats.length;
      setActive(ev.key === "ArrowDown" ? (active + 1) % n : active <= 0 ? n - 1 : active - 1);
    } else if (ev.key === "Enter") {
      // un lieu en surbrillance : on le choisit ; sinon Entrée lance la recherche du formulaire
      if (ouvert && resultats[active]) {
        ev.preventDefault();
        choisir(resultats[active]);
      } else fermer();
    } else if (ev.key === "Escape" && ouvert) {
      ev.preventDefault();
      fermer();
    } else if (ev.key === "Tab") fermer();
  };

  // En quittant le champ : nom exact du lieu reconnu (« riviera 2 » → Riviera 2, Cocody ; « bouake » → Bouaké)
  const quitter = () => {
    fermeture.current = window.setTimeout(() => {
      fermer();
      const e = correspondance(derniereValeur.current);
      if (e && texteLieu(e) !== derniereValeur.current) onChange(texteLieu(e));
    }, 150);
  };

  const quoi = quartiers ? "Aucune ville, commune ou quartier" : "Aucune ville ou commune";
  return (
    <>
      <input
        ref={champ}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-activedescendant={ouvert && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={s.champ}
        value={valeur}
        onChange={(e) => {
          onChange(e.target.value);
          ouvrir(true);
        }}
        onFocus={() => ouvrir(false)}
        onClick={() => !ouvert && ouvrir(false)}
        onKeyDown={touche}
        onBlur={quitter}
      />
      <ul
        ref={liste}
        id={idListe}
        role="listbox"
        aria-label="Lieux proposés"
        className={s.liste}
        hidden={!ouvert}
        // toucher la liste ne fait pas quitter le champ (sinon elle se fermerait avant le choix)
        onMouseDown={(e) => e.preventDefault()}
      >
        {ouvert && !resultats.length && (
          <li className={s.vide}>
            {quoi} ne correspond. Vous pouvez rechercher « {valeur.trim()} » tel quel.
          </li>
        )}
        {resultats.map((e, i) => (
          <li
            key={`${e.type}-${e.ville}-${e.commune}-${e.libelle}`}
            id={`${id}-option-${i}`}
            role="option"
            aria-selected={i === active}
            className={[s.option, i === active && s.active, e.type === "commune" && !saisie && s.indente]
              .filter(Boolean)
              .join(" ")}
            onClick={() => choisir(e)}
          >
            <span className={s.libelle}>
              {surligner(e.libelle, saisie).map((m, k) => (m.tape ? <mark key={k}>{m.texte}</mark> : m.texte))}
            </span>
            <span className={s.detail}>{e.detail}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
