"use client";

/*
 * Champ téléphone avec l'indicatif de tous les pays (reprise de js/telephone.js de la maquette) :
 *   - bouton du pays (drapeau, +225…) devant le numéro ; Côte d'Ivoire par défaut ;
 *   - liste des pays : les fréquents en tête, recherche par nom ou indicatif, flèches / Entrée / Échap ;
 *   - un numéro tapé ou collé avec son indicatif (« +33 6 12… ») choisit le pays tout seul en quittant le champ.
 * La vérification et l'écriture complète du numéro sont dans lib/telephone.ts.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { drapeau, exemple, normaliser, paysIso, rechercherPays, type Pays } from "@/lib/telephone";
import Icone from "./Icone";
import s from "./ChampTelephone.module.css";

type Props = {
  id: string;
  /** code du pays choisi (« CI ») */
  iso: string;
  /** numéro saisi, sans l'indicatif */
  valeur: string;
  onChange: (iso: string, valeur: string) => void;
  /** ajouté à l'exemple de numéro (« (optionnel) ») */
  suffixe?: string;
  invalide?: boolean;
  /** id du message d'erreur ou d'aide */
  decrit?: string;
  /** texte lu par les lecteurs d'écran quand le champ n'a pas d'étiquette visible */
  libelle?: string;
  /** à droite du numéro (bouton WhatsApp…) */
  apres?: ReactNode;
};

export default function ChampTelephone({ id, iso, valeur, onChange, suffixe, invalide, decrit, libelle, apres }: Props) {
  const pays = paysIso(iso);
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [active, setActive] = useState(-1);
  const bloc = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const recherche = useRef<HTMLInputElement>(null);
  const fenetre = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const idListe = `${useId()}-pays`;

  const { frequents, tous } = rechercherPays(filtre);
  const visibles: Pays[] = [...frequents, ...tous];

  const ouvrir = () => {
    const tout = rechercherPays("");
    setFiltre("");
    setActive([...tout.frequents, ...tout.tous].findIndex((p) => p.iso === pays.iso)); // le pays choisi, dans les fréquents s'il y est
    setOuvert(true);
  };
  const fermer = (rendreFocus: boolean) => {
    setOuvert(false);
    if (rendreFocus) bouton.current?.focus({ preventScroll: true });
  };
  const choisir = (p: Pays) => {
    setOuvert(false);
    onChange(p.iso, valeur);
    champ.current?.focus({ preventScroll: true });
  };

  // Liste ouverte : curseur dans la recherche ; un clic ailleurs la ferme ; hauteur jusqu'au bas de l'écran
  // (ou jusqu'au clavier) ; sur téléphone, le champ remonte en haut de l'écran s'il manque de place.
  useEffect(() => {
    if (!ouvert) return;
    let remonte = false;
    const ajuster = () => {
      const b = bouton.current, f = fenetre.current;
      if (!b || !f) return;
      const vv = window.visualViewport;
      const bas = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const tactile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
      if (tactile && bas - b.getBoundingClientRect().bottom < 260 && !remonte) {
        remonte = true;
        bloc.current?.scrollIntoView({ block: "start", behavior: "instant" });
      }
      const dessous = bas - b.getBoundingClientRect().bottom - 18;
      f.style.maxHeight = Math.max(170, Math.min(340, dessous)) + "px";
    };
    ajuster();
    recherche.current?.focus({ preventScroll: true });
    const clic = (e: MouseEvent | TouchEvent) => {
      if (!bloc.current?.contains(e.target as Node)) setOuvert(false);
    };
    const vv = window.visualViewport;
    document.addEventListener("mousedown", clic);
    document.addEventListener("touchstart", clic, { passive: true });
    vv?.addEventListener("resize", ajuster);
    window.addEventListener("resize", ajuster);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("touchstart", clic);
      vv?.removeEventListener("resize", ajuster);
      window.removeEventListener("resize", ajuster);
    };
  }, [ouvert]);

  // Garder le pays actif visible dans la liste
  useEffect(() => {
    const ul = liste.current;
    const li = ul?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop - 6;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) {
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight + 6;
    }
  }, [active, ouvert, filtre]);

  const touche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(active + 1, visibles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, active - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibles[active]) choisir(visibles[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      fermer(true);
    } else if (e.key === "Tab") fermer(false);
  };

  let index = 0;
  const ligne = (p: Pays) => {
    const i = index++;
    return (
      <li
        key={`${i}-${p.iso}`}
        id={`${idListe}-${i}`}
        data-index={i}
        role="option"
        aria-selected={i === active}
        className={[s.option, i === active && s.active, p.iso === pays.iso && s.courant].filter(Boolean).join(" ")}
        onClick={() => choisir(p)}
      >
        <span className={s.drapeau} aria-hidden="true">{drapeau(p.iso)}</span>
        <span className={s.nom}>{p.nom}</span>
        <span className={s.code}>+{p.indicatif}</span>
      </li>
    );
  };

  return (
    <div ref={bloc} className={s.ligne}>
      <button
        ref={bouton}
        type="button"
        className={s.pays}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={`Indicatif : ${pays.nom} +${pays.indicatif}. Changer de pays`}
        title={`${pays.nom} (+${pays.indicatif})`}
        onClick={() => (ouvert ? fermer(true) : ouvrir())}
      >
        <span className={s.drapeau} aria-hidden="true">{drapeau(pays.iso)}</span>
        <span>+{pays.indicatif}</span>
        <Icone nom="chevron" taille={10} epaisseur={2.5} className={s.chevron} />
      </button>
      <input
        ref={champ}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className={s.saisie}
        placeholder={[exemple(pays.iso), suffixe].filter(Boolean).join(" ")}
        value={valeur}
        aria-invalid={invalide || undefined}
        aria-describedby={decrit}
        aria-label={libelle}
        onChange={(e) => onChange(pays.iso, e.target.value)}
        onBlur={() => {
          const n = normaliser(valeur, pays.iso);
          if (n && (n.iso !== pays.iso || n.valeur !== valeur)) onChange(n.iso, n.valeur);
        }}
      />
      {apres}
      {ouvert && (
        <div ref={fenetre} className={s.fenetre} role="dialog" aria-label="Choisir l'indicatif du pays">
          <input
            ref={recherche}
            type="text"
            className={s.recherche}
            placeholder="Pays ou indicatif (ex. France, +33)"
            aria-label="Rechercher un pays ou un indicatif"
            role="combobox"
            aria-expanded="true"
            aria-controls={idListe}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${idListe}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={filtre}
            onChange={(e) => {
              setFiltre(e.target.value);
              setActive(0);
            }}
            onKeyDown={touche}
          />
          <ul ref={liste} id={idListe} role="listbox" aria-label="Pays" className={s.options} onMouseDown={(e) => e.preventDefault()}>
            {frequents.length > 0 && <li className={s.titre} role="presentation">Pays fréquents</li>}
            {frequents.map(ligne)}
            {frequents.length > 0 && <li className={s.titre} role="presentation">Tous les pays</li>}
            {tous.map(ligne)}
            {!visibles.length && <li className={s.vide} role="presentation">Aucun pays trouvé</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
