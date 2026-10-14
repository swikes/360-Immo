/*
 * Photo de couverture d'un article (dossier « blog »), ou à défaut un fond aux couleurs de sa catégorie, avec son nom :
 * jamais de photo prise ailleurs.
 */
import { CATEGORIES, urlCouverture, type Categorie } from "@/lib/blog";
import s from "./Couverture.module.css";

type Props = { chemin: string | null; categorie: Categorie; className?: string; grande?: boolean; adresse?: string | null };

export default function Couverture({ chemin, categorie, className = "", grande = false, adresse }: Props) {
  const src = adresse ?? (chemin ? urlCouverture(chemin) : null);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- photo du stockage, déjà réduite à l'envoi
    return <img src={src} alt="" className={`${s.photo} ${className}`} loading={grande ? "eager" : "lazy"} />;
  }
  return (
    <div className={`${s.fond} ${s[categorie]} ${className}`} aria-hidden="true">
      <span className={s.motif} />
      <span className={s.nom}>{CATEGORIES[categorie].nom}</span>
    </div>
  );
}
