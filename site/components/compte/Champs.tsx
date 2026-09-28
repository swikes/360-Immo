"use client";

/*
 * Champs des formulaires de compte : texte avec icône, mot de passe avec « œil » et force, message d'erreur.
 */
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import f from "./Formulaire.module.css";

type PropsChamp = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  etiquette: string;
  icone: NomIcone;
  valeur: string;
  onChange: (valeur: string) => void;
  erreur?: string;
  aide?: string;
  obligatoire?: boolean;
  /** dans le champ, à droite (bouton « œil »…) */
  apres?: ReactNode;
  /** sous le champ, avant l'erreur (force du mot de passe…) */
  dessous?: ReactNode;
};

export function ChampTexte({ etiquette, icone, valeur, onChange, erreur, aide, obligatoire, apres, dessous, ...reste }: PropsChamp) {
  const id = useId();
  const decrit = [erreur && `${id}-erreur`, aide && `${id}-aide`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={f.groupe}>
      <label htmlFor={id} className={f.etiquette}>
        {etiquette}
        {obligatoire && <span className={f.obligatoire} aria-hidden="true">*</span>}
      </label>
      <div className={f.saisie}>
        <Icone nom={icone} className={f.icone} />
        <input
          id={id}
          className={f.champ}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          aria-required={obligatoire || undefined}
          {...reste}
        />
        {apres}
      </div>
      {dessous}
      {aide && (
        <p id={`${id}-aide`} className={f.aide}>
          {aide}
        </p>
      )}
      {erreur && (
        <p id={`${id}-erreur`} className={f.erreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}

/** Force d'un mot de passe, comme sur la maquette : longueur, majuscule, chiffre, caractère spécial */
export function forceMotDePasse(mdp: string): { note: number; texte: string } {
  if (mdp.length < 8) return { note: mdp ? 1 : 0, texte: "Trop court" };
  const note = 1 + [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(mdp)).length;
  return { note, texte: ["", "Faible", "Moyen", "Fort", "Très fort"][note] };
}

type PropsMdp = Omit<PropsChamp, "icone" | "type"> & { avecForce?: boolean };

export function ChampMotDePasse({ avecForce, valeur, ...reste }: PropsMdp) {
  const [visible, setVisible] = useState(false);
  const force = forceMotDePasse(valeur);
  const classe = force.note <= 1 ? f.faible : force.note === 2 ? f.moyen : f.fort;
  return (
    <ChampTexte
      {...reste}
      valeur={valeur}
      icone="cadenas"
      type={visible ? "text" : "password"}
      apres={
        <button
          type="button"
          className={f.oeil}
          aria-label={visible ? "Cacher le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icone nom={visible ? "cacher" : "voir"} taille={17} />
        </button>
      }
      dessous={
        avecForce &&
        valeur && (
          <div className={f.force} aria-live="polite">
            <div className={f.barres} aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`${f.barre} ${i <= force.note ? classe : ""}`} />
              ))}
            </div>
            <span className={f.forceTexte}>{force.texte}</span>
          </div>
        )
      }
    />
  );
}

/** Adresse e-mail plausible (nom@domaine.ext) */
export const emailValide = (e: string) => /^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]{2,}$/.test(e.trim());
