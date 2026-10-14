"use client";

/*
 * Zone de texte avec boutons de mise en forme (Administration → Blog et → Pages du site) : titres, gras, listes, liens,
 * encadrés « À retenir » et « Attention » (Markdown simple de lib/blog.ts). Le bouton agit sur la ligne en cours ou sur
 * le texte sélectionné ; un lien est demandé, et refusé s'il ne mène pas à une page du site ou à une adresse web.
 */
import { useLayoutEffect, useRef } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { lienSur } from "@/lib/blog";
import s from "./Admin.module.css";
import b from "./Blog.module.css";

type Outil = { texte: string; icone?: NomIcone; aide: string; faire: "ligne" | "autour" | "lien"; avant: string; apres?: string; exemple: string };

const OUTILS: Outil[] = [
  { texte: "Titre de partie", aide: "## Titre de partie", faire: "ligne", avant: "## ", exemple: "Titre de partie" },
  { texte: "Sous-titre", aide: "### Sous-titre", faire: "ligne", avant: "### ", exemple: "Sous-titre" },
  { texte: "Gras", aide: "**mot important**", faire: "autour", avant: "**", apres: "**", exemple: "mot important" },
  { texte: "Liste", aide: "- élément", faire: "ligne", avant: "- ", exemple: "élément de la liste" },
  { texte: "Liste numérotée", aide: "1. étape", faire: "ligne", avant: "1. ", exemple: "première étape" },
  { texte: "Lien", icone: "lien", aide: "[texte](adresse)", faire: "lien", avant: "", exemple: "texte du lien" },
  { texte: "À retenir", aide: "> encadré vert", faire: "ligne", avant: "> ", exemple: "Le point essentiel à retenir." },
  { texte: "Attention", aide: "!> encadré orange", faire: "ligne", avant: "!> ", exemple: "Le piège à éviter." },
];

// préfixe de ligne déjà présent (remplacé quand on en choisit un autre)
const PREFIXE = /^(#{1,3}\s+|[-*•]\s+|\d{1,3}[.)]\s+|!?>\s?)/;

type Props = {
  id: string; etiquette: string; valeur: string; onChange: (texte: string) => void;
  /** message d'erreur (lien refusé), vide pour l'effacer */
  onErreur: (message: string) => void;
  /** aide sous la zone (en plus du rappel des raccourcis) */
  aide?: string;
};

export default function ZoneTexte({ id, etiquette, valeur, onChange, onErreur, aide }: Props) {
  const zone = useRef<HTMLTextAreaElement>(null);
  // sélection à remettre une fois le nouveau texte affiché (aussitôt, avant toute autre frappe)
  const aSelectionner = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const z = zone.current, sel = aSelectionner.current;
    if (!z || !sel) return;
    aSelectionner.current = null;
    z.focus();
    z.setSelectionRange(sel[0], sel[1]);
  }, [valeur]);

  /** Bouton de mise en forme : préfixe de ligne, texte entouré, ou lien */
  const outil = (o: Outil) => {
    const z = zone.current;
    if (!z) return;
    const v = valeur;
    const d = z.selectionStart, f = z.selectionEnd;
    let texte: string, debutSelection: number, finSelection: number;
    if (o.faire === "ligne") {
      const debut = v.lastIndexOf("\n", d - 1) + 1;
      let fin = v.indexOf("\n", Math.max(f, d) - (f > d && v[f - 1] === "\n" ? 1 : 0));
      if (fin < 0) fin = v.length;
      const bloc = v.slice(debut, fin);
      const lignes = bloc.trim() ? bloc.split("\n") : [o.exemple];
      const nouveau = lignes.map((l, i) => (l.trim() ? (o.avant === "1. " ? `${i + 1}. ` : o.avant) + l.replace(PREFIXE, "") : l)).join("\n");
      texte = v.slice(0, debut) + nouveau + v.slice(fin);
      debutSelection = debut;
      finSelection = debut + nouveau.length;
    } else {
      const choisi = v.slice(d, f) || o.exemple;
      let avant = o.avant, apres = o.apres ?? "";
      if (o.faire === "lien") {
        const url = window.prompt("Adresse du lien : une page du site (ex. /estimation) ou une adresse complète (https://…)", "/");
        if (!url) return;
        if (!lienSur(url.trim())) {
          onErreur("Ce lien n'est pas accepté : une page du site commence par « / », une autre adresse par « https:// ».");
          return;
        }
        avant = "[";
        apres = `](${url.trim()})`;
      }
      texte = v.slice(0, d) + avant + choisi + apres + v.slice(f);
      debutSelection = d + avant.length;
      finSelection = debutSelection + choisi.length;
    }
    onErreur("");
    if (texte === v) {
      // rien ne change (préfixe déjà là) : la sélection seulement
      z.focus();
      z.setSelectionRange(debutSelection, finSelection);
      return;
    }
    aSelectionner.current = [debutSelection, finSelection];
    onChange(texte);
  };

  return (
    <div className={b.champ}>
      <label htmlFor={id} className={s.etiquette}>{etiquette}</label>
      <div className={b.outils} role="toolbar" aria-label="Mise en forme du texte">
        {OUTILS.map((o) => (
          <button key={o.texte} type="button" className={b.outil} title={o.aide} onClick={() => outil(o)}>
            {o.icone && <Icone nom={o.icone} taille={14} />}{o.texte}
          </button>
        ))}
      </div>
      <textarea id={id} ref={zone} className={`${s.zone} ${b.texte}`} rows={22} value={valeur}
        placeholder={"## Titre de partie\n\nUn paragraphe. Laissez une ligne vide entre deux paragraphes.\n\n- Un élément de liste\n- Un autre"}
        onChange={(e) => onChange(e.target.value)} />
      <p className={s.aide}>
        {aide ? `${aide} ` : ""}Sélectionnez du texte puis touchez un bouton, ou écrivez directement : « ## » titre de partie,
        « - » liste, « **mot** » gras, « &gt; » encadré À retenir, « !&gt; » encadré Attention. Vérifiez le résultat avec l&apos;Aperçu.
      </p>
    </div>
  );
}
