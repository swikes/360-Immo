/*
 * Fiche d'un bien : /annonces/appartement-3-pieces-meuble-a-louer-riviera-2-imm-2026-00001
 * (le titre pour Google, puis la référence, qui seule compte : un ancien titre mène à la bonne adresse).
 * Photos, prix, caractéristiques, description, commodités, quartier (lien Google Maps : la position exacte n'est
 * jamais publiée), contact de l'annonceur (numéro après un clic), partage, biens similaires.
 * Page préparée par le serveur (rapide, lisible par Google, aperçu du lien sur WhatsApp et Facebook), refaite au plus
 * une fois par minute. Annonce plus en ligne : page « introuvable » (not-found.tsx).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import CarteAnnonce from "@/components/CarteAnnonce";
import CompteurVues from "@/components/fiche/CompteurVues";
import Contact from "@/components/fiche/Contact";
import Description from "@/components/fiche/Description";
import Galerie from "@/components/fiche/Galerie";
import Partager from "@/components/fiche/Partager";
import BoutonFavori from "@/components/BoutonFavori";
import BoutonAlerte from "@/components/BoutonAlerte";
import Icone, { type NomIcone } from "@/components/Icone";
import {
  lienAnnonce, lienVitrine, lieuAnnonce, referenceDe, uniteLoyer, urlPhotoPublique, type CarteAnnonce as Carte, type FicheAnnonce,
} from "@/lib/annonces-en-ligne";
import { lireFiche, similaires } from "@/lib/annonces-serveur";
import { formaterPrix } from "@/lib/format";
import { adresseListe, RECHERCHE_VIDE } from "@/lib/recherche";
import { pluriel } from "@/lib/regles-biens";
import { ADRESSE_SITE } from "@/lib/site";
import s from "@/components/fiche/Fiche.module.css";

export const revalidate = 60;
// Aucune fiche préparée à l'avance : chacune l'est à sa première visite, puis gardée une minute
export async function generateStaticParams() {
  return [];
}

async function ficheDe(params: PageProps<"/annonces/[annonce]">["params"]): Promise<FicheAnnonce | null> {
  const reference = referenceDe((await params).annonce);
  if (!reference) return null;
  try {
    return await lireFiche(reference);
  } catch {
    return null;
  }
}

/** Caution en FCFA : mois de caution × loyer mensuel (un loyer à l'année compte pour 12 mois) */
const caution = (a: Pick<FicheAnnonce, "prix" | "loyer_par" | "caution_mois">) =>
  formaterPrix(Math.round((a.loyer_par === "annee" ? a.prix / 12 : a.prix) * (a.caution_mois ?? 0)));

const prixTexte = (a: Pick<FicheAnnonce, "prix" | "loyer_par">) =>
  `${formaterPrix(a.prix)} FCFA${a.loyer_par ? ` / ${uniteLoyer(a.loyer_par)}` : ""}`;

export async function generateMetadata({ params }: PageProps<"/annonces/[annonce]">): Promise<Metadata> {
  const a = await ficheDe(params);
  if (!a) return { title: "Annonce introuvable" };
  const titre = `${a.titre} — ${prixTexte(a)}`;
  const resume = `${prixTexte(a)} · ${lieuAnnonce(a)}${a.ville !== a.commune ? `, ${a.ville}` : ""}. ${a.description}`.slice(0, 200);
  const photo = a.photos[0] ? urlPhotoPublique(a.photos[0]) : undefined;
  return {
    title: titre,
    description: resume,
    alternates: { canonical: lienAnnonce(a) },
    openGraph: {
      type: "website", siteName: "360-Immo.ci", locale: "fr_CI", title: titre, description: resume, url: lienAnnonce(a),
      images: photo ? [{ url: photo, alt: a.titre }] : undefined,
    },
    twitter: { card: photo ? "summary_large_image" : "summary", title: titre, description: resume, images: photo ? [photo] : undefined },
  };
}

export default async function FicheBien({ params }: PageProps<"/annonces/[annonce]">) {
  const a = await ficheDe(params);
  if (!a) notFound();
  // Adresse ancienne ou incomplète (titre modifié…) : la bonne adresse, pour Google et le partage
  const segment = decodeURIComponent((await params).annonce);
  const bonne = lienAnnonce(a);
  if (segment !== bonne.split("/").pop()) permanentRedirect(bonne);

  const autres: Carte[] = await similaires(a.id).catch(() => []);
  const vente = a.transaction === "vente";
  const adresse = `${ADRESSE_SITE}${bonne}`;
  const lieu = [a.quartier, a.commune, a.ville !== a.commune ? a.ville : null].filter(Boolean).join(", ");
  const listeType = adresseListe({ ...RECHERCHE_VIDE, tx: vente ? "achat" : "location", types: [a.type_nom] });
  const listeLieu = adresseListe({ ...RECHERCHE_VIDE, tx: vente ? "achat" : "location", types: [a.type_nom], lieu: a.commune });
  const cartes: { icone: NomIcone; valeur: string; texte: string }[] = [
    ...(a.studio ? [{ icone: "pieces" as const, valeur: "Studio", texte: "Type" }] : a.pieces ? [{ icone: "pieces" as const, valeur: String(a.pieces), texte: a.pieces > 1 ? "Pièces" : "Pièce" }] : []),
    ...(a.chambres ? [{ icone: "chambres" as const, valeur: String(a.chambres), texte: a.chambres > 1 ? "Chambres" : "Chambre" }] : []),
    ...(a.sanitaires ? [{ icone: "bain" as const, valeur: String(a.sanitaires), texte: a.sanitaires_nom ?? "Salles de bain" }] : []),
    ...(a.surface ? [{ icone: "surface" as const, valeur: `${formaterPrix(Number(a.surface))} m²`, texte: a.surface_nom }] : []),
  ];
  const oui = <span className={s.oui}><Icone nom="valide" taille={13} epaisseur={2.5} /> Oui</span>;
  const lignes: [string, ReactNode][] = [
    ["Type de bien", a.type_nom],
    ["Transaction", vente ? "Vente" : "Location"],
    ["Prix", <strong key="prix" className={s.vert}>{prixTexte(a)}</strong>],
    ...(a.caution_mois ? [["Caution", `${a.caution_mois} mois (${caution(a)} FCFA)`] as [string, string]] : []),
    ...(a.surface ? [[a.surface_nom, `${formaterPrix(Number(a.surface))} m²`] as [string, string]] : []),
    ...(a.studio ? [["Pièces", "Studio"] as [string, string]] : a.pieces ? [["Pièces", String(a.pieces)] as [string, string]] : []),
    ...(a.chambres !== null && !a.studio ? [["Chambres", String(a.chambres)] as [string, string]] : []),
    ...(a.sanitaires ? [[a.sanitaires_nom ?? "Salles de bain", String(a.sanitaires)] as [string, string]] : []),
    ...(a.etage !== null ? [["Étage", a.etage === 0 ? "Rez-de-chaussée" : `${a.etage}${a.etage === 1 ? "er" : "e"} étage`] as [string, string]] : []),
    ...(a.meuble ? [["Déjà meublé", oui] as [string, ReactNode]] : []),
    ...(a.dans_immeuble ? [["Dans un immeuble", oui] as [string, ReactNode]] : []),
  ];
  const carte = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lieu}, Côte d'Ivoire`)}`;

  return (
    <div className={s.page}>
      <CompteurVues id={a.id} />
      <div className={s.contenu}>
        <nav className={s.ariane} aria-label="Fil d'Ariane">
          <ol>
            <li><Link href="/">Accueil</Link></li>
            <li><Link href={listeType}>{pluriel(a.type_nom)} {vente ? "à vendre" : "à louer"}</Link></li>
            <li><Link href={listeLieu}>{a.commune}</Link></li>
            <li aria-current="page">{a.titre}</li>
          </ol>
        </nav>

        <Galerie photos={a.photos.map(urlPhotoPublique)} titre={a.titre} badge={vente ? "À vendre" : "À louer"} vente={vente} />

        <div className={s.grille}>
          <div className={s.principal}>
            <header className={s.entete}>
              <div className={s.haut}>
                <div className={s.badges}>
                  {a.premium && <span className={`${s.badge} ${s.badgePremium}`}>Premium</span>}
                  {a.verifiee && <span className={`${s.badge} ${s.badgeVerifie}`}><Icone nom="bouclier" taille={13} /> Bien vérifié par 360-Immo.ci</span>}
                </div>
                <BoutonFavori annonce={a.id} titre={a.titre} className={s.sauvegarder} texte />
              </div>
              <h1 className={s.titre}>{a.titre}</h1>
              <ul className={s.infos}>
                <li><Icone nom="lieu" taille={14} /> {lieu}</li>
                <li><Icone nom="calendrier" taille={14} /> Publiée le {new Date(a.publiee_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</li>
                <li><Icone nom="voir" taille={14} /> {formaterPrix(a.vues)} vue{a.vues > 1 ? "s" : ""}</li>
                <li>Réf. {a.reference}</li>
              </ul>
              <p className={s.prix}>
                {formaterPrix(a.prix)} <span>FCFA{a.loyer_par ? ` / ${uniteLoyer(a.loyer_par)}` : ""}</span>
              </p>
              {a.caution_mois ? <p className={s.caution}>+ {a.caution_mois} mois de caution ({caution(a)} FCFA)</p> : null}
            </header>

            {cartes.length > 0 && (
              <ul className={s.chiffres}>
                {cartes.map((c) => (
                  <li key={c.texte}>
                    <Icone nom={c.icone} taille={20} />
                    <strong>{c.valeur}</strong>
                    <span>{c.texte}</span>
                  </li>
                ))}
              </ul>
            )}

            {a.description && (
              <section className={s.section} aria-labelledby="description">
                <h2 id="description" className={s.sectionTitre}>Description du bien</h2>
                <Description texte={a.description} />
              </section>
            )}

            <section className={s.section} aria-labelledby="descriptif">
              <h2 id="descriptif" className={s.sectionTitre}>Caractéristiques</h2>
              <dl className={s.tableau}>
                {lignes.map(([cle, valeur]) => (
                  <div key={cle} className={s.ligne}>
                    <dt>{cle}</dt>
                    <dd>{valeur}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {a.commodites.length > 0 && (
              <section className={s.section} aria-labelledby="commodites">
                <h2 id="commodites" className={s.sectionTitre}>Commodités et équipements</h2>
                <ul className={s.commodites}>
                  {a.commodites.map((c) => (
                    <li key={c}><Icone nom="valide" taille={16} /> {c}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className={s.section} aria-labelledby="localisation">
              <h2 id="localisation" className={s.sectionTitre}>Localisation</h2>
              <div className={s.localisation}>
                <div className={s.localisationTexte}>
                  <span className={s.localisationLieu}><Icone nom="lieu" taille={18} /> {lieu}</span>
                  {a.adresse && <span className={s.repere}>Repère : {a.adresse}</span>}
                  <span className={s.note}>L&apos;adresse exacte vous est donnée par l&apos;annonceur, pour la visite.</span>
                </div>
                <a href={carte} target="_blank" rel="noopener" className={s.boutonCarte}>
                  <Icone nom="carte" taille={17} /> Voir le quartier sur la carte
                </a>
              </div>
            </section>
          </div>

          <aside className={s.cote}>
            <Contact
              id={a.id} reference={a.reference} titre={a.titre} adresse={adresse}
              nom={a.contact_nom ?? (a.type_vendeur === "agence" ? "Agence immobilière" : "Particulier")}
              agence={a.type_vendeur === "agence"} verifiee={!!a.annonceur_verifie}
              vitrine={a.annonceur && a.annonceur_nom ? { lien: lienVitrine({ code: a.annonceur, nom: a.annonceur_nom }), nom: a.annonceur_nom } : null}
              prix={prixTexte(a)}
              complement={a.caution_mois ? `+ ${a.caution_mois} mois de caution` : null}
            />
            <Partager annonce={a.id} adresse={adresse} texte={`${a.titre} — ${prixTexte(a)}`} />
            <div className={s.alerteCarte}>
              <span className={s.carteTitre}><Icone nom="cloche" taille={15} /> Alerte</span>
              <p>Recevez par e-mail les nouvelles annonces {pluriel(a.type_nom).toLowerCase()} {vente ? "à vendre" : "à louer"} à {a.commune}.</p>
              <BoutonAlerte adresse={listeLieu} className={s.boutonAlerte} texte="Créer cette alerte" />
              <Link href={listeLieu} className={s.lienClair}>Voir les annonces semblables <Icone nom="fleche" taille={14} /></Link>
            </div>
          </aside>
        </div>

        {autres.length > 0 && (
          <section className={s.similaires} aria-labelledby="similaires">
            <h2 id="similaires" className={s.sectionTitre}>Biens similaires</h2>
            <div className={s.similairesGrille}>
              {autres.map((b) => <CarteAnnonce key={b.id} annonce={b} />)}
            </div>
          </section>
        )}
      </div>

      {/* Téléphone : prix et contact toujours à portée de main */}
      <div className={s.barreBas}>
        <span className={s.barrePrix}>
          {formaterPrix(a.prix)} <small>FCFA{a.loyer_par ? ` / ${uniteLoyer(a.loyer_par)}` : ""}</small>
        </span>
        <a href="#contact" className={s.barreContact}><Icone nom="telephone" taille={16} /> Contacter</a>
      </div>
    </div>
  );
}
