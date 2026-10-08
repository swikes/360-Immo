/*
 * Présentation de l'annonceur, en haut de sa vitrine : logo de l'agence vérifiée (sinon les initiales), particulier ou
 * agence, badge « Agence vérifiée » ou « Identité vérifiée », nombre d'annonces en ligne, membre depuis.
 */
import Icone from "@/components/Icone";
import { urlLogo, type Vitrine } from "@/lib/annonces-en-ligne";
import BandeauProprietaire from "./BandeauProprietaire";
import s from "./EnteteVitrine.module.css";

const initiales = (nom: string) =>
  nom.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "?";

export default function EnteteVitrine({ vitrine: v, adresse }: { vitrine: Vitrine; adresse: string }) {
  const depuis = new Date(v.membre_depuis).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return (
    <div className={s.entete}>
      <div className={s.identite}>
        {v.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlLogo(v.logo)} alt={`Logo de ${v.nom}`} className={`${s.avatar} ${s.agence} ${s.logo}`} width={56} height={56} />
        ) : (
          <span className={`${s.avatar} ${v.agence ? s.agence : ""}`} aria-hidden="true">{initiales(v.nom)}</span>
        )}
        <div className={s.infos}>
          <span className={s.type}>
            <span>{v.agence ? "Agence immobilière" : "Particulier"}</span>
            {v.verifiee ? (
              <span className={s.verifiee}><Icone nom="bouclier" taille={12} /> {v.agence ? "Agence vérifiée" : "Identité vérifiée"} par 360-Immo.ci</span>
            ) : (
              <span className={s.nonVerifie}>Annonceur non vérifié</span>
            )}
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
