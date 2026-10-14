/*
 * Page d'un article du blog (/blog/<adresse>) : catégorie, titre, résumé, auteur, dates, durée de lecture, couverture,
 * texte mis en page (components/blog/TexteArticle), sommaire, partage, « À lire aussi ».
 * Seuls les articles publiés existent ici (blog_article dans la base) : un brouillon donne « page introuvable ».
 * Les données structurées (schema.org Article) aident Google à présenter l'article.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BoutonPartage from "@/components/BoutonPartage";
import Icone from "@/components/Icone";
import CarteArticle from "@/components/blog/CarteArticle";
import Couverture from "@/components/blog/Couverture";
import TexteArticle from "@/components/blog/TexteArticle";
import { lireArticle } from "@/lib/annonces-serveur";
import {
  AUTEUR_PAR_DEFAUT, CATEGORIES, dateArticle, dureeLecture, lienArticle, lienCategorie, lireTexte, sommaire, urlCouverture,
  type Article,
} from "@/lib/blog";
import { ADRESSE_SITE } from "@/lib/site";
import s from "./page.module.css";

// Chaque article se fait à la première visite, puis se garde 10 minutes ; l'Administration le rafraîchit aussitôt
// après une modification (app/api/blog/route.ts)
export const revalidate = 600;
export async function generateStaticParams() {
  return [];
}

/** L'article (null : n'existe pas ou pas publié ; undefined : la base ne répond pas) */
const lire = async (slug: string): Promise<Article | null | undefined> => lireArticle(slug).catch(() => undefined);

export async function generateMetadata({ params }: PageProps<"/blog/[article]">): Promise<Metadata> {
  const a = await lire((await params).article);
  if (a === undefined) return { title: "Guide & Blog" };
  if (!a) return { title: "Article introuvable" };
  const image = a.couverture ? urlCouverture(a.couverture) : undefined;
  return {
    title: a.titre,
    description: a.resume,
    alternates: { canonical: lienArticle(a.slug) },
    openGraph: {
      type: "article", siteName: "360-Immo.ci", locale: "fr_CI", title: a.titre, description: a.resume, url: lienArticle(a.slug),
      publishedTime: a.publie_le, modifiedTime: a.modifie_le, authors: [a.auteur_nom],
      images: image ? [{ url: image, alt: a.titre }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: a.titre, description: a.resume, images: image ? [image] : undefined },
  };
}

/** Données pour Google (schema.org) ; « < » échappé pour ne jamais fermer la balise */
function DonneesGoogle({ a }: { a: Article }) {
  const donnees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titre,
    description: a.resume,
    datePublished: a.publie_le,
    dateModified: a.modifie_le,
    inLanguage: "fr-CI",
    articleSection: CATEGORIES[a.categorie].nom,
    author: a.auteur_nom === AUTEUR_PAR_DEFAUT
      ? { "@type": "Organization", name: "360-Immo.ci", url: ADRESSE_SITE }
      : { "@type": "Person", name: a.auteur_nom, ...(a.auteur_fonction ? { jobTitle: a.auteur_fonction } : {}) },
    publisher: { "@type": "Organization", name: "360-Immo.ci", url: ADRESSE_SITE, logo: { "@type": "ImageObject", url: `${ADRESSE_SITE}/apple-icon.png` } },
    image: [a.couverture ? urlCouverture(a.couverture) : `${ADRESSE_SITE}/opengraph-image.png`],
    mainEntityOfPage: `${ADRESSE_SITE}${lienArticle(a.slug)}`,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }} />;
}

export default async function PageArticle({ params }: PageProps<"/blog/[article]">) {
  const a = await lire((await params).article);
  if (a === undefined) {
    return (
      <div className={s.page}>
        <div className={s.etroit}>
          <p className={s.indisponible}>Cet article n&apos;est pas disponible pour le moment. Réessayez dans quelques minutes.</p>
          <Link href="/blog" className={s.retour}><Icone nom="retour" taille={15} /> Guide & Blog</Link>
        </div>
      </div>
    );
  }
  if (!a) notFound();
  const blocs = lireTexte(a.contenu);
  const plan = sommaire(blocs);
  const misAJour = new Date(a.modifie_le).getTime() - new Date(a.publie_le).getTime() > 24 * 3600 * 1000;
  const categorie = CATEGORIES[a.categorie];

  return (
    <article className={s.page}>
      <DonneesGoogle a={a} />
      <header className={s.entete}>
        <div className={s.etroit}>
          <nav className={s.chemin} aria-label="Fil d'Ariane">
            <Link href="/">Accueil</Link> <span aria-hidden="true">›</span> <Link href="/blog">Guide & Blog</Link>{" "}
            <span aria-hidden="true">›</span> <Link href={lienCategorie(a.categorie)}>{categorie.nom}</Link>
          </nav>
          <h1 className={s.titre}>{a.titre}</h1>
          <p className={s.chapo}>{a.resume}</p>
          <p className={s.infos}>
            <span>Par <strong>{a.auteur_nom}</strong>{a.auteur_fonction ? `, ${a.auteur_fonction}` : ""}</span>
            <span>Publié le <time dateTime={a.publie_le}>{dateArticle(a.publie_le)}</time></span>
            {misAJour && <span>Mis à jour le <time dateTime={a.modifie_le}>{dateArticle(a.modifie_le)}</time></span>}
            <span>{dureeLecture(a.minutes)}</span>
          </p>
        </div>
      </header>

      {a.couverture && (
        <div className={s.large}>
          <Couverture chemin={a.couverture} categorie={a.categorie} className={s.couverture} grande />
        </div>
      )}

      <div className={`${s.large} ${s.corps}`}>
        <div className={s.principal}>
          {plan.length >= 3 && (
            <nav className={s.sommaire} aria-labelledby="sommaire">
              <h2 id="sommaire" className={s.sommaireTitre}>Dans cet article</h2>
              <ol>
                {plan.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.texte}</a></li>)}
              </ol>
            </nav>
          )}
          <TexteArticle blocs={blocs} />
          <p className={s.avertissement}>
            Cet article donne des informations générales, qui peuvent évoluer. Pour une situation précise, demandez
            conseil à un professionnel (notaire, avocat, géomètre expert, agent immobilier).
          </p>
          <div className={s.partage}>
            <span>Cet article peut aider un proche ?</span>
            <BoutonPartage adresse={lienArticle(a.slug)} texte={`${a.titre} — à lire sur 360-Immo.ci :`} aide="Partagez cet article"
              nom="Partager cet article" />
          </div>
        </div>

        <aside className={s.cote} aria-label="Outils gratuits">
          <Link href="/estimation" className={s.action}>
            <Icone nom="statistiques" taille={20} />
            <span><strong>Estimer un bien</strong> d&apos;après les annonces semblables du quartier</span>
          </Link>
          <Link href="/carte-des-prix" className={s.action}>
            <Icone nom="carte" taille={20} />
            <span><strong>Carte des prix</strong> loyers et prix de vente, commune par commune</span>
          </Link>
          <Link href="/annonces" className={s.action}>
            <Icone nom="recherche" taille={20} />
            <span><strong>Voir les annonces</strong> vérifiées par notre équipe</span>
          </Link>
        </aside>
      </div>

      {a.a_lire_aussi.length > 0 && (
        <section className={s.aussi} aria-labelledby="a-lire-aussi">
          <div className={s.large}>
            <h2 id="a-lire-aussi" className={s.aussiTitre}>À lire aussi</h2>
            <div className={s.grille}>
              {a.a_lire_aussi.map((x) => <CarteArticle key={x.id} article={x} />)}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
