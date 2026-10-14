/*
 * Carte des prix : pour un type de bien, le prix demandé habituel commune par commune (prix_communes dans la base :
 * supabase/migrations/…_prix_marche.sql). Liste d'abord (lisible sur téléphone), carte ensuite (components/prix/CartePrix).
 * Les choix sont dans l'adresse (/carte-des-prix?tx=achat&type=terrain) : de simples liens, la page arrive déjà remplie.
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Icone from "@/components/Icone";
import CartePrix, { type Point } from "@/components/prix/CartePrix";
import { prixCommunes } from "@/lib/annonces-serveur";
import { positionCommune } from "@/lib/positions-communes";
import {
  adresseCarte, annonces, annoncesDe, choixBase, fourchette, lienCommune, lireChoixCarte, prixMarche, SEUIL, TEINTES, texteUnite, uniteCarte,
  type ChoixCarte, type PrixCommune, type Unite,
} from "@/lib/prix-marche";
import { cleType, pluriel, regles, typeDeCle, typesProposes } from "@/lib/regles-biens";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Carte des prix de l'immobilier",
  description:
    "Loyers et prix de vente demandés en Côte d'Ivoire, commune par commune : appartements, maisons, villas, terrains, " +
    "bureaux. D'après les annonces des 6 derniers mois sur 360-Immo.ci.",
  alternates: { canonical: "/carte-des-prix" },
};

const PIECES = [1, 2, 3, 4, 5];

function Puce({ href, actif, children }: { href: string; actif: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={`${s.puce} ${actif ? s.puceActive : ""}`} aria-current={actif ? "true" : undefined} scroll={false}>
      {children}
    </Link>
  );
}

/** Rang de prix de chaque commune (0 : le moins cher, 4 : le plus cher), pour la couleur de sa pastille */
function classes(lignes: PrixCommune[]): Map<string, number> {
  const avec = lignes.filter((l) => l.mediane != null).sort((a, b) => a.mediane! - b.mediane!);
  return new Map(avec.map((l, i) => [`${l.ville}|${l.commune}`, avec.length === 1 ? 2 : Math.round((i / (avec.length - 1)) * 4)]));
}

const parPrix = (a: PrixCommune, b: PrixCommune) =>
  (b.mediane ?? -1) - (a.mediane ?? -1) || b.nombre - a.nombre || a.commune.localeCompare(b.commune, "fr");

type PropsListe = {
  id: string; titre: string; lignes: PrixCommune[]; rangs: Map<string, number>; unite: Unite;
  annoncesDeLaCommune: (commune: string) => string;
};

function Liste({ id, titre, lignes, rangs, unite, annoncesDeLaCommune }: PropsListe) {
  if (!lignes.length) return null;
  return (
    <section className={s.groupe} aria-labelledby={id}>
      <h2 id={id} className={s.titreGroupe}>{titre}</h2>
      <ol className={s.liste}>
        {lignes.map((x) => {
          const rang = rangs.get(`${x.ville}|${x.commune}`);
          return (
            <li key={`${x.ville}|${x.commune}`} className={s.ligne}>
              <span className={s.pastille} style={{ background: rang != null ? TEINTES[rang] : "var(--gray-light)" }} aria-hidden="true" />
              <div className={s.nom}>
                <Link href={lienCommune(x.commune)} className={s.lienCommune}>{x.commune}</Link>
                {x.ville !== x.commune && x.ville !== "Abidjan" && <span className={s.ville}>{x.ville}</span>}
                <span className={s.nombre}>{annonces(x.nombre)}</span>
              </div>
              {x.mediane != null && x.bas != null && x.haut != null ? (
                <div className={s.prix}>
                  <strong>{prixMarche(x.mediane, unite)}</strong>
                  <span>{fourchette(x.bas, x.haut)}{texteUnite(unite)}</span>
                </div>
              ) : (
                <div className={`${s.prix} ${s.sansPrix}`}>Pas encore assez d&apos;annonces</div>
              )}
              <Link href={annoncesDeLaCommune(x.commune)} className={s.voir} aria-label={`Voir les annonces à ${x.commune}`}>
                <Icone nom="suivant" taille={16} />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function CarteDesPrix({ searchParams }: PageProps<"/carte-des-prix">) {
  const c: ChoixCarte = lireChoixCarte(await searchParams);
  const unite = uniteCarte(c);
  const base = choixBase(c);
  const nomType = typeDeCle(c.type) ?? "Autres";
  const r = regles(nomType);
  let lignes: PrixCommune[] = [];
  let indisponible = false;
  try {
    lignes = await prixCommunes(base);
  } catch {
    indisponible = true;
  }
  const rangs = classes(lignes);
  const total = lignes.reduce((n, l) => n + l.nombre, 0);
  const abidjan = lignes.filter((l) => l.ville === "Abidjan").sort(parPrix);
  const ailleurs = lignes.filter((l) => l.ville !== "Abidjan").sort(parPrix);
  const points: Point[] = lignes.flatMap((l) => {
    const position = positionCommune(l.ville, l.commune);
    return position ? [{
      commune: l.commune, ville: l.ville, lien: lienCommune(l.commune), position, nombre: l.nombre,
      prix: l.mediane != null ? prixMarche(l.mediane, unite) : null, classe: rangs.get(`${l.ville}|${l.commune}`) ?? null,
    }] : [];
  });
  const taille = c.pieces ? ` ${c.pieces >= 5 ? "5 pièces et plus" : c.pieces === 1 ? "1 pièce" : `${c.pieces} pièces`}` : "";
  const meuble = c.tx === "location" && r.meuble === true ? (c.meuble ? " meublés" : " non meublés") : "";
  const quoi = `${pluriel(nomType)}${taille}${meuble}${c.tx === "location" ? " à louer" : " à vendre"}${unite === "jour" ? " à la journée" : ""}`;
  const annoncesDeLaCommune = (commune: string) => annoncesDe(commune, base);

  return (
    <div className={s.page}>
      <header className={s.entete}>
        <div className={s.enteteContenu}>
          <h1 className={s.titre}>Carte des prix</h1>
          <p className={s.sousTitre}>
            Prix demandés dans les annonces des 6 derniers mois, commune par commune. Un prix s&apos;affiche à partir
            de {SEUIL} annonces semblables.
          </p>
          <nav className={s.filtres} aria-label="Choix des biens">
            <div className={s.onglets}>
              <Puce href={adresseCarte(c, { tx: "location" })} actif={c.tx === "location"}>Louer</Puce>
              <Puce href={adresseCarte(c, { tx: "achat" })} actif={c.tx === "achat"}>Acheter</Puce>
            </div>
            <div className={s.rangee}>
              {typesProposes(c.tx === "achat" ? "vente" : "location").map((t) => (
                <Puce key={t} href={adresseCarte(c, { type: cleType(t)! })} actif={c.type === cleType(t)}>{t}</Puce>
              ))}
            </div>
            {r.pieces && (
              <div className={s.rangee}>
                <Puce href={adresseCarte(c, { pieces: null })} actif={!c.pieces}>Toutes tailles</Puce>
                {PIECES.map((n) => (
                  <Puce key={n} href={adresseCarte(c, { pieces: n })} actif={c.pieces === n}>
                    {n === 1 ? (r.pieces === "studio" ? "Studio / 1 pièce" : "1 pièce") : n === 5 ? "5 pièces et +" : `${n} pièces`}
                  </Puce>
                ))}
              </div>
            )}
            {c.tx === "location" && (r.meuble === true || r.loyerPar.includes("Jour")) && (
              <div className={s.rangee}>
                {r.meuble === true && (
                  <>
                    <Puce href={adresseCarte(c, { meuble: false })} actif={!c.meuble}>Non meublé</Puce>
                    <Puce href={adresseCarte(c, { meuble: true })} actif={c.meuble}>Meublé</Puce>
                  </>
                )}
                {r.loyerPar.includes("Jour") && (
                  <>
                    <Puce href={adresseCarte(c, { duree: "mois" })} actif={c.duree === "mois"}>Au mois</Puce>
                    <Puce href={adresseCarte(c, { duree: "jour" })} actif={c.duree === "jour"}>À la journée</Puce>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      <div className={s.corps}>
        <div className={s.colonneListe}>
          <p className={s.resume}>
            <strong>{quoi}</strong>
            {total > 0 && <> · d&apos;après {annonces(total)}</>}
          </p>
          {indisponible ? (
            <p className={s.vide}>Les prix ne sont pas disponibles pour le moment. Réessayez dans quelques minutes.</p>
          ) : lignes.length === 0 ? (
            <div className={s.vide}>
              <p>Pas encore d&apos;annonces pour ce choix. Le site est récent : les prix apparaîtront au fil des annonces.</p>
              <Link href="/publier" className={s.bouton}><Icone nom="plus" taille={15} epaisseur={2.5} /> Publier une annonce</Link>
            </div>
          ) : (
            <>
              <Liste id="liste-abidjan" titre="Abidjan" lignes={abidjan} rangs={rangs} unite={unite} annoncesDeLaCommune={annoncesDeLaCommune} />
              <Liste id="liste-villes" titre={abidjan.length ? "Autres villes" : "Villes"} lignes={ailleurs} rangs={rangs} unite={unite}
                annoncesDeLaCommune={annoncesDeLaCommune} />
            </>
          )}
        </div>

        <div className={s.colonneCarte}>
          {points.length > 0 && (
            <>
              <CartePrix points={points} titre={`Carte des prix : ${quoi}`} />
              <div className={s.legende} aria-hidden="true">
                <span>Moins cher</span>
                {TEINTES.map((t) => <span key={t} className={s.teinte} style={{ background: t }} />)}
                <span>Plus cher</span>
                <span className={s.teinteVide} />
                <span>Pas assez d&apos;annonces</span>
              </div>
            </>
          )}
          <div className={s.encadre}>
            <h2 className={s.encadreTitre}><Icone nom="statistiques" taille={16} /> D&apos;où viennent ces prix ?</h2>
            <p>
              Ce sont les prix <strong>demandés</strong> dans les annonces de 360-Immo.ci (en ligne, ou terminées depuis
              moins de 6 mois), pas des prix de vente : le prix final se négocie souvent un peu en dessous. Chaque prix est
              le prix du milieu ; la fourchette va du quart le moins cher au quart le plus cher. Les prix anormaux sont écartés.
            </p>
            <Link href="/estimation" className={s.lienEstimer}>Estimer mon bien <Icone nom="suivant" taille={15} /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
