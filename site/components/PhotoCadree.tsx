/*
 * Photo d'un bien dans un cadre de taille fixe (aperçu, vignette, carte d'annonce, plus tard fiche du bien).
 * La plupart des photos viennent d'un téléphone, souvent prises en hauteur : la photo est montrée en entier,
 * sans être rognée ni agrandie, et les bords libres du cadre sont remplis par la même photo, floutée.
 * Le cadre (proportions, coins arrondis) est celui de l'élément parent, en position relative.
 */
import s from "./PhotoCadree.module.css";

export default function PhotoCadree({ src, alt = "", paresseuse = true }: { src: string; alt?: string; paresseuse?: boolean }) {
  const chargement = paresseuse ? "lazy" : "eager";
  return (
    <span className={s.cadre}>
      {/* eslint-disable-next-line @next/next/no-img-element -- photo du stockage Supabase ou aperçu local (blob:) */}
      <img src={src} alt="" aria-hidden="true" className={s.fond} loading={chargement} />
      {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
      <img src={src} alt={alt} className={s.photo} loading={chargement} />
    </span>
  );
}
