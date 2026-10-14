/*
 * Un article dans les listes du blog (page /blog, « À lire aussi ») : couverture, catégorie, titre, résumé, date et
 * durée de lecture. En grand pour l'article à la une.
 */
import Link from "next/link";
import { CATEGORIES, dateArticle, dureeLecture, lienArticle, type ResumeArticle } from "@/lib/blog";
import Couverture from "./Couverture";
import s from "./CarteArticle.module.css";

type Props = { article: ResumeArticle; grande?: boolean; niveau?: "h2" | "h3" };

export default function CarteArticle({ article: a, grande = false, niveau: Titre = "h3" }: Props) {
  return (
    <article className={`${s.carte} ${grande ? s.grande : ""}`}>
      <Link href={lienArticle(a.slug)} className={s.lienImage} tabIndex={-1} aria-hidden="true">
        <Couverture chemin={a.couverture} categorie={a.categorie} className={s.image} grande={grande} />
      </Link>
      <div className={s.corps}>
        <span className={s.categorie}>{grande ? "À la une · " : ""}{CATEGORIES[a.categorie].nom}</span>
        <Titre className={s.titre}><Link href={lienArticle(a.slug)} className={s.lien}>{a.titre}</Link></Titre>
        <p className={s.resume}>{a.resume}</p>
        <p className={s.infos}>
          <time dateTime={a.publie_le}>{dateArticle(a.publie_le)}</time> · {dureeLecture(a.minutes)}
        </p>
      </div>
    </article>
  );
}
