/*
 * Une page du pied de page (/a-propos, /aide, /devenir-partenaire, /mentions-legales, /cgu, /confidentialite, /cookies),
 * écrite dans l'Administration → Pages du site (lib/pages-site.ts). Tant qu'elle n'est pas publiée : « Page bientôt
 * disponible » (404). Pages légales : date de mise à jour ; page Aide : questions qui s'ouvrent au toucher, et données
 * « FAQ » pour Google. À côté : les autres pages et le lien vers le formulaire Contact.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icone from "@/components/Icone";
import TexteArticle from "@/components/blog/TexteArticle";
import { lirePage } from "@/lib/annonces-serveur";
import { dateArticle, enQuestions, lireTexte, sommaire, texteDeBlocs, type Question } from "@/lib/blog";
import { LISTE_PAGES, PAGES_SITE, lienPage, type AdressePage, type PagePublique } from "@/lib/pages-site";
import s from "./PageSite.module.css";

export async function metadonneesPage(slug: AdressePage): Promise<Metadata> {
  // (base injoignable : un titre simple ; la page, elle, s'arrête sur l'erreur)
  const p: PagePublique | null | undefined = await lirePage(slug).catch(() => undefined);
  if (!p) return { title: PAGES_SITE[slug].nom };
  return {
    title: p.titre,
    description: p.resume,
    alternates: { canonical: lienPage(slug) },
    openGraph: { type: "website", siteName: "360-Immo.ci", locale: "fr_CI", title: p.titre, description: p.resume, url: lienPage(slug) },
  };
}

/** Questions fréquentes pour Google (schema.org FAQPage) ; « < » échappé pour ne jamais fermer la balise */
function DonneesFaq({ questions }: { questions: Question[] }) {
  const donnees = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({ "@type": "Question", name: q.titre, acceptedAnswer: { "@type": "Answer", text: texteDeBlocs(q.blocs) } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }} />;
}

export default async function PageSite({ slug }: { slug: AdressePage }) {
  // Base injoignable : l'erreur remonte. Le site garde la dernière version de la page au lieu d'enregistrer pour
  // 10 minutes un message « pas disponible » (et une construction du site faite pendant une panne échoue au lieu de
  // mettre en ligne des pages vides : la version d'avant reste en ligne)
  const p = await lirePage(slug);
  if (!p) notFound();
  const { legale } = PAGES_SITE[slug];
  const faq = slug === "aide";
  const blocs = lireTexte(p.contenu);
  const plan = faq ? [] : sommaire(blocs);
  const questions = faq ? enQuestions(blocs).filter((b): b is Question => b.type === "question") : [];
  const autres = (filtre: boolean) => LISTE_PAGES.filter((x) => PAGES_SITE[x].legale === filtre);

  return (
    <article className={s.page}>
      {faq && questions.length > 0 && <DonneesFaq questions={questions} />}
      <header className={s.entete}>
        <div className={s.etroit}>
          <span className={s.surtitre}>{legale ? "Informations légales" : "360-Immo.ci"}</span>
          <h1 className={s.titre}>{p.titre}</h1>
          {p.resume && <p className={s.chapo}>{p.resume}</p>}
          {legale && <p className={s.date}>Mise à jour le <time dateTime={p.modifie_le}>{dateArticle(p.modifie_le)}</time></p>}
        </div>
      </header>

      <div className={`${s.large} ${s.corps}`}>
        <div className={s.principal}>
          {plan.length >= 3 && (
            <nav className={s.sommaire} aria-labelledby="sommaire">
              <h2 id="sommaire" className={s.sommaireTitre}>Sommaire</h2>
              <ol>{plan.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.texte}</a></li>)}</ol>
            </nav>
          )}
          <TexteArticle blocs={blocs} questions={faq} />
        </div>

        <aside className={s.cote} aria-label="Autres pages">
          <Link href="/contact" className={s.contact}>
            <Icone nom="message" taille={20} />
            <span><strong>Une question ?</strong> Écrivez à notre équipe</span>
          </Link>
          <nav className={s.liens} aria-label="360-Immo.ci">
            <h2 className={s.liensTitre}>360-Immo.ci</h2>
            <ul>
              {autres(false).map((x) => (
                <li key={x}><Link href={lienPage(x)} aria-current={x === slug ? "page" : undefined} prefetch={false}>{PAGES_SITE[x].nom}</Link></li>
              ))}
              <li><Link href="/contact" prefetch={false}>Contact</Link></li>
            </ul>
            <h2 className={s.liensTitre}>Informations légales</h2>
            <ul>
              {autres(true).map((x) => (
                <li key={x}><Link href={lienPage(x)} aria-current={x === slug ? "page" : undefined} prefetch={false}>{PAGES_SITE[x].nom}</Link></li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </article>
  );
}
