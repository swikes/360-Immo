/*
 * Présentation de l'annonceur, en haut de sa vitrine : initiales (logo de l'agence à l'étape 7), particulier ou
 * agence (vérifiée), nombre d'annonces en ligne, membre depuis.
 */
import Icone from "@/components/Icone";
import type { Vitrine } from "@/lib/annonces-en-ligne";
import BandeauProprietaire from "./BandeauProprietaire";
import s from "./EnteteVitrine.module.css";

const initiales = (nom: string) =>
  nom.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "?";

export default function EnteteVitrine({ vitrine: v, adresse }: { vitrine: Vitrine; adresse: string }) {
  const depuis = new Date(v.membre_depuis).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return (
    <div className={s.entete}>
      <div className={s.identite}>
        <span className={`${s.avatar} ${v.agence ? s.agence : ""}`} aria-hidden="true">{initiales(v.nom)}</span>
        <div className={s.infos}>
          <span className={s.type}>
            <span>{v.agence ? "Agence immobilière" : "Particulier"}</span>
            {v.verifiee && <span className={s.verifiee}><Icone nom="bouclier" taille={12} /> Vérifiée par 360-Immo.ci</span>}
          </span>
          <span className={s.chiffres}>
            {v.total} annonce{v.total > 1 ? "s" : ""} en ligne · Membre depuis {depuis}
          </span>
        </div>
      </div>
      <BandeauProprietaire code={v.code} nom={v.nom} adresse={adresse} />
    </div>
  );
}
