/*
 * Page « Prix de l'immobilier à Cocody » (/prix/cocody) : loyers et prix de vente demandés dans la commune, type par type
 * (prix_commune dans la base : supabase/migrations/…_prix_marche.sql). Faite pour Google : « prix loyer Cocody ».
 * Une commune sans aucun prix (moins de 5 annonces semblables partout) n'est pas proposée à Google (noindex) et
 * n'est pas dans le plan du site.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icone from "@/components/Icone";
import { prixCommune } from "@/lib/annonces-serveur";
import {
  annonces, annoncesDe, communeDuSlug, communesDe, fourchette, libelleGroupe, lienCommune, prixMarche, SEUIL, texteUnite,
  type GroupePrix, type PageCommune,
} from "@/lib/prix-marche";
import s from "./page.module.css";

// Chaque page se fait à la première visite, puis se garde une heure (rien à préparer à la construction du site)
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

/** La commune de l'adresse et ses prix (page : undefined si la base ne répond pas) */
async function lire(slug: string): Promise<{ ville: string; commune: string; page: PageCommune | null | undefined } | null> {
  const lieu = communeDuSlug(slug);
  if (!lieu) return null;
  const [ville, commune] = lieu;
  const page = await prixCommune(ville, commune).catch(() => undefined);
  return { ville, commune, page };
}

const avecPrix = (p: PageCommune | null | undefined) => (p?.groupes ?? []).filter((g) => g.mediane != null);
const nomLieu = (ville: string, commune: string) => (ville !== commune ? `${commune} (${ville})` : commune);

export async function generateMetadata({ params }: PageProps<"/prix/[commune]">): Promise<Metadata> {
  const x = await lire((await params).commune);
  if (!x) return { title: "Commune introuvable" };
  const prix = avecPrix(x.page);
  const exemples = prix.slice(0, 2).map((g) => `${libelleGroupe(g)} : ${prixMarche(g.mediane!, g.unite)}`).join(" ; ");
  return {
    title: `Prix de l'immobilier à ${nomLieu(x.ville, x.commune)} : loyers et prix de vente`,
    description: prix.length
      ? `Loyers et prix demandés à ${x.commune}, d'après les annonces des 6 derniers mois. ${exemples}.`
      : `Prix de l'immobilier à ${x.commune} : pas encore assez d'annonces pour donner des prix. Annonces, estimation gratuite.`,
    alternates: { canonical: lienCommune(x.commune) },
    ...(prix.length ? {} : { robots: { index: false, follow: true } }),
  };
}

function Tableau({ titre, groupes, commune }: { titre: string; groupes: GroupePrix[]; commune: string }) {
  if (!groupes.length) return null;
  const id = `prix-${titre.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className={s.bloc} aria-labelledby={id}>
      <h2 id={id} className={s.titreBloc}>{titre}</h2>
      <ul className={s.lignes}>
        {groupes.map((g) => (
          <li key={`${g.type_bien}-${g.unite}-${g.pieces}-${g.meuble}`} className={s.ligne}>
            <div className={s.bien}>
              <span className={s.nomBien}>{libelleGroupe(g)}</span>
              <span className={s.nombre}>{annonces(g.nombre)}</span>
            </div>
            <div className={s.prix}>
              <strong>{prixMarche(g.mediane!, g.unite)}</strong>
              <span>{fourchette(g.bas!, g.haut!)}{texteUnite(g.unite)}</span>
            </div>
            <Link href={annoncesDe(commune, g)} className={s.voir} aria-label={`Voir les annonces : ${libelleGroupe(g)}`}>
              <Icone nom="suivant" taille={16} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PrixCommune({ params }: PageProps<"/prix/[commune]">) {
  const x = await lire((await params).commune);
  if (!x) notFound();
  const { ville, commune, page } = x;
  const prix = avecPrix(page);
  const sansPrix = (page?.groupes ?? []).filter((g) => g.mediane == null);
  const total = (page?.groupes ?? []).reduce((n, g) => n + g.nombre, 0);
  const voisines = communesDe(ville).filter((c) => c !== commune);
  const enLigne = page?.en_ligne ?? 0;

  return (
    <div className={s.page}>
      <header className={s.entete}>
        <div className={s.contenu}>
          <nav className={s.chemin} aria-label="Vous êtes ici">
            <Link href="/carte-des-prix">Carte des prix</Link> <span aria-hidden="true">›</span> {ville !== commune && <>{ville} <span aria-hidden="true">›</span> </>}
            <span aria-current="page">{commune}</span>
          </nav>
          <h1 className={s.titre}>Prix de l&apos;immobilier à {commune}</h1>
          <p className={s.sousTitre}>
            {ville !== commune && <>{ville} · </>}
            {total > 0 ? <>d&apos;après {annonces(total)} des 6 derniers mois</> : "loyers et prix de vente demandés"}
          </p>
        </div>
      </header>

      <div className={`${s.contenu} ${s.corps}`}>
        <div className={s.principal}>
          {page === undefined ? (
            <p className={s.vide}>Les prix ne sont pas disponibles pour le moment. Réessayez dans quelques minutes.</p>
          ) : prix.length === 0 ? (
            <div className={s.vide}>
              <p>
                Pas encore assez d&apos;annonces à {commune} pour donner des prix : il en faut {SEUIL} semblables au moins
                (même type de bien, même taille). Le site est récent : les prix apparaîtront au fil des annonces.
              </p>
            </div>
          ) : (
            <>
              <Tableau titre="À louer" groupes={prix.filter((g) => g.transaction === "location")} commune={commune} />
              <Tableau titre="À vendre" groupes={prix.filter((g) => g.transaction === "vente")} commune={commune} />
            </>
          )}
          {sansPrix.length > 0 && (
            <section className={s.bloc} aria-labelledby="pas-assez">
              <h2 id="pas-assez" className={s.titreBloc}>Pas encore assez d&apos;annonces pour un prix</h2>
              <ul className={s.petits}>
                {sansPrix.slice(0, 12).map((g) => (
                  <li key={`${g.transaction}-${g.type_bien}-${g.unite}-${g.pieces}-${g.meuble}`}>
                    {libelleGroupe(g)} {g.transaction === "location" ? "à louer" : "à vendre"} · {annonces(g.nombre)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className={s.methode}>
            Ce sont les prix <strong>demandés</strong> dans les annonces de 360-Immo.ci (en ligne, ou terminées depuis moins de
            6 mois), pas des prix de vente : le prix final se négocie souvent un peu en dessous. Chaque prix est le prix du
            milieu ; la fourchette va du quart le moins cher au quart le plus cher. Les prix anormaux sont écartés.
          </p>
        </div>

        <aside className={s.cote}>
          <Link href={`/estimation?lieu=${encodeURIComponent(commune)}`} className={s.action}>
            <Icone nom="viabilise" taille={20} />
            <span><strong>Estimer mon bien à {commune}</strong><br />Gratuit, en 1 minute</span>
          </Link>
          <Link href={`/annonces?q=${encodeURIComponent(commune)}`} className={s.action}>
            <Icone nom="recherche" taille={20} />
            <span><strong>{enLigne > 0 ? `Voir les ${annonces(enLigne)} en ligne` : "Voir les annonces"}</strong><br />à {commune}</span>
          </Link>
          <Link href="/carte-des-prix" className={s.action}>
            <Icone nom="carte" taille={20} />
            <span><strong>Carte des prix</strong><br />Comparer avec les autres communes</span>
          </Link>
          {voisines.length > 0 && (
            <nav className={s.voisines} aria-labelledby="voisines">
              <h2 id="voisines" className={s.titreVoisines}>Prix dans les autres communes {ville === "Abidjan" ? "d'Abidjan" : `de ${ville}`}</h2>
              <div className={s.puces}>
                {voisines.map((c) => <Link key={c} href={lienCommune(c)} className={s.puce}>{c}</Link>)}
              </div>
            </nav>
          )}
        </aside>
      </div>
    </div>
  );
}
