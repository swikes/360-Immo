"use client";

/*
 * Numéros de contact d'un compte (inscription et Mon Espace), comme sur la maquette :
 *   - numéro principal obligatoire, avec l'indicatif du pays, « sur WhatsApp » ou non (oui par défaut) ;
 *   - second numéro facultatif : mobile, fixe, bureau ou autre, sur WhatsApp ou non ;
 *   - aperçu des numéros tels que les visiteurs les verront.
 */
import { useId } from "react";
import ChampTelephone from "@/components/ChampTelephone";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import type { ChampsProfil, Profil } from "@/lib/compte";
import { complet, decomposer, message, valide } from "@/lib/telephone";
import f from "./Formulaire.module.css";
import s from "./BlocTelephones.module.css";

export type TypeNumero = Profil["telephone2_type"];
const TYPES: { cle: TypeNumero; texte: string }[] = [
  { cle: "mobile", texte: "Mobile" },
  { cle: "fixe", texte: "Fixe" },
  { cle: "bureau", texte: "Bureau" },
  { cle: "autre", texte: "Autre" },
];

export type Telephones = {
  iso1: string; tel1: string; wa1: boolean;
  second: boolean; type2: TypeNumero; iso2: string; tel2: string; wa2: boolean;
};

export const TELEPHONES_VIDES: Telephones = {
  iso1: "CI", tel1: "", wa1: true, second: false, type2: "mobile", iso2: "CI", tel2: "", wa2: false,
};

/** Numéros enregistrés dans le profil → champs du formulaire */
export function telephonesDuProfil(p: Profil): Telephones {
  const t1 = decomposer(p.telephone), t2 = decomposer(p.telephone2);
  return {
    iso1: t1.iso, tel1: t1.valeur, wa1: p.telephone_whatsapp,
    second: !!p.telephone2, type2: p.telephone2_type, iso2: t2.iso, tel2: t2.valeur, wa2: p.telephone2_whatsapp,
  };
}

/** Message d'erreur des numéros (vide si tout va bien) */
export function erreurTelephones(t: Telephones): string {
  if (!valide(t.tel1, t.iso1)) return message(t.tel1, t.iso1);
  if (t.second && t.tel2.trim() && !valide(t.tel2, t.iso2)) return "Second numéro — " + message(t.tel2, t.iso2);
  return "";
}

/** Champs du profil, numéros écrits en entier (« +225 07 48 32 11 90 ») */
export function champsTelephones(t: Telephones): Pick<
  ChampsProfil, "telephone" | "telephone2" | "telephone_whatsapp" | "telephone2_whatsapp" | "telephone2_type"
> {
  const deux = t.second ? complet(t.tel2, t.iso2) : "";
  return {
    telephone: complet(t.tel1, t.iso1),
    telephone2: deux || null,
    telephone_whatsapp: t.wa1,
    telephone2_whatsapp: !!deux && t.wa2,
    telephone2_type: t.type2,
  };
}

function BoutonWhatsApp({ actif, onChange, libelle }: { actif: boolean; onChange: (actif: boolean) => void; libelle: string }) {
  return (
    <button
      type="button"
      className={`${s.whatsapp} ${actif ? s.whatsappActif : ""}`}
      aria-pressed={actif}
      aria-label={libelle}
      title="Ce numéro est-il sur WhatsApp ?"
      onClick={() => onChange(!actif)}
    >
      <span className={s.whatsappRond}>
        <IconeWhatsApp taille={11} />
      </span>
      <span>{actif ? "WhatsApp" : "WhatsApp ?"}</span>
    </button>
  );
}

type Props = {
  valeur: Telephones;
  onChange: (t: Telephones) => void;
  /** message d'erreur à afficher sous le bloc */
  erreur?: string;
  /** « Numéros de contact » (inscription) ou autre titre */
  titre?: string;
};

export default function BlocTelephones({ valeur: t, onChange, erreur, titre = "Numéros de contact" }: Props) {
  const id = useId();
  const changer = (c: Partial<Telephones>) => onChange({ ...t, ...c });
  const p1 = complet(t.tel1, t.iso1), p2 = t.second ? complet(t.tel2, t.iso2) : "";
  const idErreur = `${id}-erreur`;

  return (
    <fieldset className={f.groupe}>
      <legend className={f.etiquette}>
        {titre} <span className={f.obligatoire} aria-hidden="true">*</span>
      </legend>
      <div className={`${s.bloc} ${erreur ? s.enErreur : ""}`}>
        <ChampTelephone
          id={`${id}-tel1`}
          iso={t.iso1}
          valeur={t.tel1}
          onChange={(iso1, tel1) => changer({ iso1, tel1 })}
          invalide={!!erreur}
          decrit={erreur ? idErreur : undefined}
          libelle="Numéro principal"
          apres={<BoutonWhatsApp actif={t.wa1} onChange={(wa1) => changer({ wa1 })} libelle="Numéro principal sur WhatsApp" />}
        />
        {!t.second ? (
          <button type="button" className={s.ajouter} onClick={() => changer({ second: true })}>
            <Icone nom="plus" taille={13} epaisseur={2.5} />
            Ajouter un second numéro (fixe, WhatsApp…)
          </button>
        ) : (
          <div className={s.second}>
            <div className={s.types} role="radiogroup" aria-label="Type du second numéro">
              <span className={s.typesTitre} aria-hidden="true">Type :</span>
              {TYPES.map((ty) => (
                <button
                  key={ty.cle}
                  type="button"
                  role="radio"
                  aria-checked={t.type2 === ty.cle}
                  className={`${s.type} ${t.type2 === ty.cle ? s.typeChoisi : ""}`}
                  onClick={() => changer({ type2: ty.cle })}
                >
                  {ty.texte}
                </button>
              ))}
            </div>
            <div className={s.secondLigne}>
              <ChampTelephone
                id={`${id}-tel2`}
                iso={t.iso2}
                valeur={t.tel2}
                onChange={(iso2, tel2) => changer({ iso2, tel2 })}
                suffixe="(optionnel)"
                libelle="Second numéro"
                apres={<BoutonWhatsApp actif={t.wa2} onChange={(wa2) => changer({ wa2 })} libelle="Second numéro sur WhatsApp" />}
              />
              <button
                type="button"
                className={s.retirer}
                aria-label="Retirer le second numéro"
                title="Retirer ce numéro"
                onClick={() => changer({ second: false, tel2: "", wa2: false, type2: "mobile" })}
              >
                <Icone nom="fermer" taille={14} epaisseur={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
      {erreur && (
        <p id={idErreur} className={f.erreur} role="alert">
          {erreur}
        </p>
      )}
      {(p1 || p2) && (
        <div className={s.apercu} aria-label="Aperçu pour les visiteurs">
          <span className={s.apercuTitre}>Aperçu pour les visiteurs</span>
          {[
            { n: p1, wa: t.wa1, type: "Principal" },
            { n: p2, wa: t.wa2, type: TYPES.find((ty) => ty.cle === t.type2)!.texte },
          ]
            .filter((l) => l.n)
            .map((l) => (
              <div key={l.type} className={s.apercuLigne}>
                <Icone nom="telephone" taille={13} />
                <span className={s.apercuNumero}>{l.n}</span>
                <span className={s.apercuType}>{l.type}</span>
                {l.wa && (
                  <span className={s.apercuWa}>
                    <IconeWhatsApp taille={11} /> WhatsApp
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </fieldset>
  );
}
