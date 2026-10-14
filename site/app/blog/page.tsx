/*
 * Guide & Blog (/blog) : les articles publiés par l'équipe (Administration → Blog ; supabase/migrations/…_blog.sql).
 * L'article à la une en grand, puis les plus récents ; une catégorie se choisit par un simple lien (/blog?categorie=…).
 * À côté : les outils gratuits du site et le glossaire des mots de l'immobilier (lib/glossaire.ts).
 */
import type { Metadata } from "next";
import Link from "next/link";
import Icone, { type NomIcone } from "@/components/Icone";
import CarteArticle from "@/components/blog/CarteArticle";
import { articlesBlog } from "@/lib/annonces-serveur";
import { CATEGORIES, estCategorie, LISTE_CATEGORIES, lienCategorie, type ResumeArticle } from "@/lib/blog";
import { GLOSSAIRE } from "@/lib/glossaire";
import s from "./page.module.css";

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const { categorie } = await searchParams;
  if (estCategorie(categorie)) {
    return {
      title: `${CATEGORIES[categorie].nom} : conseils immobiliers`,
      description: `${CATEGORIES[categorie].description} Les articles du guide 360-Immo.ci pour la Côte d'Ivoire.`,
      alternates: { canonical: lienCategorie(categorie) },
    };
  }
  return {
    title: "Guide & Blog : conseils pour louer, acheter et vendre",
    description: "Guides pratiques pour louer, acheter, vendre et faire estimer un bien en Côte d'Ivoire : documents, bail, "
      + "caution, terrain, prix. Par l'équipe 360-Immo.ci.",
    alternates: { canonical: "/blog" },
  };
}

const OUTILS: { lien: string; icone: NomIcone; titre: string; texte: string }[] = [
  { lien: "/estimation", icone: "statistiques", titre: "Estimer un bien", texte: "Gratuit, d'après les annonces semblables du quartier" },
  { lien: "/carte-des-prix", icone: "carte", titre: "Carte des prix", texte: "Loyers et prix de vente, commune par commune" },
  { lien: "/annonces", icone: "recherche", titre: "Voir les annonces", texte: "Appartements, maisons, terrains, bureaux" },
  { lien: "/publier", icone: "plus", titre: "Publier une annonce", texte: "Vendre ou louer votre bien" },
];

export default async function Blog({ searchParams }: PageProps<"/blog">) {
  const { categorie: demandee } = await searchParams;
  const categorie = estCategorie(demandee) ? demandee : null;
  let articles: ResumeArticle[] = [];
  let indisponible = false;
  try {
    articles = await articlesBlog();
  } catch {
    indisponible = true;
  }
  const nombre = (c: string) => articles.filter((a) => a.categorie === c).length;
  const choisis = categorie ? articles.filter((a) => a.categorie === categorie) : articles;
  const une = categorie ? null : (articles.find((a) => a.a_la_une) ?? articles[0] ?? null);
  const autres = choisis.filter((a) => a !== une);
  const mots = [...GLOSSAIRE].sort((a, b) => a.mot.localeCompare(b.mot, "fr"));

  return (
    <div className={s.page}>
      <header className={s.entete}>
        <div className={s.contenu}>
          <span className={s.surtitre}>Guide & Blog</span>
          <h1 className={s.titre}>{categorie ? CATEGORIES[categorie].nom : "Louer, acheter, vendre : nos guides"}</h1>
          <p className={s.sousTitre}>
            {categorie ? CATEGORIES[categorie].description
              : "Des conseils pratiques pour l'immobilier en Côte d'Ivoire : documents à vérifier, bail, caution, terrain, prix."}
          </p>
          <nav className={s.categories} aria-label="Catégories du blog">
            <Link href="/blog" className={`${s.puce} ${!categorie ? s.puceActive : ""}`} aria-current={!categorie ? "page" : undefined}>
              Tous les articles
            </Link>
            {LISTE_CATEGORIES.filter((c) => nombre(c) > 0 || c === categorie).map((c) => (
              <Link key={c} href={lienCategorie(c)} className={`${s.puce} ${categorie === c ? s.puceActive : ""}`}
                aria-current={categorie === c ? "page" : undefined}>
                {CATEGORIES[c].nom} <span className={s.nombre}>{nombre(c)}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className={`${s.contenu} ${s.corps}`}>
        <div className={s.principal}>
          {indisponible ? (
            <p className={s.vide}>Les articles ne sont pas disponibles pour le moment. Réessayez dans quelques minutes.</p>
          ) : !articles.length ? (
            <div className={s.vide}>
              <p><strong>Les premiers articles arrivent bientôt.</strong></p>
              <p>En attendant, nos outils gratuits vous aident déjà à trouver le juste prix.</p>
            </div>
          ) : (
            <>
              {une && (
                <section aria-label="À la une" className={s.une}>
                  <CarteArticle article={une} grande niveau="h2" />
                </section>
              )}
              {autres.length > 0 && (
                <section aria-labelledby="derniers">
                  <h2 id="derniers" className={s.titreSection}>{categorie ? `${autres.length} article${autres.length > 1 ? "s" : ""}` : "Derniers articles"}</h2>
                  <div className={s.grille}>
                    {autres.map((a) => <CarteArticle key={a.id} article={a} />)}
                  </div>
                </section>
              )}
              {categorie && !autres.length && (
                <p className={s.vide}>
                  Pas encore d&apos;article dans cette catégorie. <Link href="/blog">Voir tous les articles</Link>
                </p>
              )}
            </>
          )}
        </div>

        <aside className={s.cote} aria-label="Outils et glossaire">
          <section className={s.encart} aria-labelledby="outils">
            <h2 id="outils" className={s.encartTitre}>Outils gratuits</h2>
            <ul className={s.outils}>
              {OUTILS.map((o) => (
                <li key={o.lien}>
                  <Link href={o.lien} className={s.outil}>
                    <Icone nom={o.icone} taille={18} />
                    <span><strong>{o.titre}</strong>{o.texte}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className={s.encart} aria-labelledby="glossaire">
            <h2 id="glossaire" className={s.encartTitre}>Glossaire</h2>
            <p className={s.aide}>Les mots de l&apos;immobilier, expliqués simplement.</p>
            <ul className={s.glossaire}>
              {mots.map((m) => (
                <li key={m.mot}>
                  <details className={s.mot}>
                    <summary>{m.mot}</summary>
                    <p>{m.definition}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
