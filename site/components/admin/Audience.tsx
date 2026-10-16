"use client";

/*
 * Administration → Audience : fréquentation du site (par jour, heure, jour de la semaine, mois), d'où viennent les
 * visiteurs, ce qu'ils font, biens les plus aimés, meilleurs annonceurs, recherches (fréquentes, sans résultat,
 * budgets), demande et offre par commune, vérification des annonces, annonces sans contact, réactivité des annonceurs,
 * comptes actifs, pages introuvables. Chiffres anonymes, sans cookie (lib/mesure.ts, supabase/migrations/…_audience.sql).
 */
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { audienceAdmin, type Audience as Donnees, type LigneRecherche, type PeriodeAudience } from "@/lib/admin";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { ADRESSE_SITE } from "@/lib/site";
import { dateHeure, dateJour } from "./outils";
import s from "./Audience.module.css";

const nombre = (n: number) => formaterPrix(n);
const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${nombre(n)} ${n > 1 ? mots : mot}`;
const part = (a: number, b: number) => (b > 0 ? Math.round((a * 100) / b) : null);
const dateCourte = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dateLongue = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const moisCourt = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
const moisLong = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
/** « 3 h », « 2 jours » */
function duree(heures: number | null): string {
  if (heures === null) return "—";
  if (heures < 1) return `${Math.max(1, Math.round(heures * 60))} min`;
  if (heures < 48) return `${nombre(Math.round(heures * 10) / 10)} h`;
  return pluriel(Math.round(heures / 24), "jour");
}

const PERIODES: { jours: PeriodeAudience; texte: string }[] = [
  { jours: 7, texte: "7 jours" }, { jours: 30, texte: "30 jours" }, { jours: 90, texte: "90 jours" }, { jours: 365, texte: "12 mois" },
];
const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const PAGES: Record<string, string> = {
  accueil: "Accueil", liste: "Liste des annonces", fiche: "Fiche d'un bien", vitrine: "Vitrine d'un annonceur", carte_prix: "Carte des prix",
  prix_commune: "Prix d'une commune", estimation: "Estimation", blog: "Blog", article: "Article du blog", publier: "Publier une annonce",
  compte: "Connexion", mon_espace: "Mon Espace", contact: "Contact", informations: "À propos, aide, pages légales", introuvable: "Page introuvable",
  autre: "Autres pages",
};
const SOURCES: Record<string, string> = {
  direct: "Accès direct (adresse tapée, favori, appli)", google: "Google", autres_moteurs: "Autres moteurs de recherche", facebook: "Facebook",
  instagram: "Instagram", whatsapp: "WhatsApp", tiktok: "TikTok", youtube: "YouTube", x: "X (Twitter)", linkedin: "LinkedIn", email: "E-mail",
  sms: "SMS", autre_site: "Autres sites",
};
const APPAREILS: Record<string, string> = { telephone: "Téléphone", tablette: "Tablette", ordinateur: "Ordinateur" };
const TRANCHES: { cle: string; titre: string; transaction: "location" | "achat"; duree: "" | "mois" | "jour"; tranches: string[] }[] = [
  { cle: "mois", titre: "Location au mois (FCFA)", transaction: "location", duree: "mois", tranches: ["moins de 100 000 / mois", "100 000 à 200 000 / mois",
    "200 000 à 300 000 / mois", "300 000 à 500 000 / mois", "500 000 à 1 million / mois", "1 million et plus / mois"] },
  { cle: "achat", titre: "Achat (FCFA)", transaction: "achat", duree: "", tranches: ["moins de 10 millions", "10 à 25 millions", "25 à 50 millions",
    "50 à 100 millions", "100 millions et plus"] },
  { cle: "jour", titre: "Location à la journée (FCFA)", transaction: "location", duree: "jour", tranches: ["moins de 25 000 / jour", "25 000 à 50 000 / jour",
    "50 000 à 100 000 / jour", "100 000 et plus / jour"] },
];

function transactionTexte(t: string, d: string): string {
  if (t === "achat") return "Achat";
  if (t === "location") return d === "jour" ? "Location à la journée" : d === "mois" ? "Location au mois" : "Location";
  return "Location ou achat";
}

export default function Audience() {
  const [jours, setJours] = useState<PeriodeAudience>(30);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  // nouvelle période : l'ancienne reste affichée, plus pâle, jusqu'à l'arrivée des chiffres
  const choisir = (j: PeriodeAudience) => {
    if (j === jours) return;
    setChargement(true);
    setJours(j);
  };
  useEffect(() => {
    let actif = true;
    audienceAdmin(jours).then(
      (d) => actif && (setDonnees(d), setErreur(""), setChargement(false)),
      (e) => actif && (setErreur(messageErreur(e)), setChargement(false)),
    );
    return () => {
      actif = false;
    };
  }, [jours]);

  if (erreur && !donnees) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!donnees) return <p className={s.attente}>Chargement…</p>;
  const d = donnees;
  const t = d.totaux;
  const periode = jours === 365 ? "12 mois" : `${jours} jours`;

  return (
    <div className={`${s.audience} ${chargement ? s.chargement : ""}`} aria-busy={chargement}>
      {/* Période : une seule ligne, au-dessus de tout */}
      <div className={s.entete}>
        <div className={s.periodes} role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <button key={p.jours} type="button" className={`${s.periode} ${jours === p.jours ? s.periodeChoisie : ""}`}
              aria-pressed={jours === p.jours} onClick={() => choisir(p.jours)}>
              {p.texte}
            </button>
          ))}
        </div>
        <span className={s.dates}>du {dateCourte(d.du)} au {dateCourte(d.au)}</span>
        <span className={s.anonyme}><Icone nom="cadenas" taille={13} /> Chiffres anonymes : ni cookie, ni adresse IP, rien relié à une personne</span>
      </div>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}

      {/* ── Fréquentation ── */}
      <section className={s.section} aria-labelledby="a-frequentation">
        <h2 id="a-frequentation" className={s.titre}>Fréquentation</h2>
        <ul className={s.tuiles}>
          <Tuile titre="Visites" icone="personne" valeur={nombre(t.visites)} evolution={evolution(t.visites, t.visites_avant, periode)} />
          <Tuile titre="Pages vues" icone="voir" valeur={nombre(t.vues)} evolution={evolution(t.vues, t.vues_avant, periode)} />
          <Tuile titre="Pages par visite" icone="document" valeur={t.visites ? nombre(Math.round((t.vues / t.visites) * 10) / 10) : "—"} />
          <Tuile titre="Aujourd'hui" icone="horloge" valeur={nombre(t.visites_aujourdhui)} detail={`visite${t.visites_aujourdhui > 1 ? "s" : ""} · ${pluriel(t.vues_aujourdhui, "page vue", "pages vues")}`} />
        </ul>
        <Carte titre="Visites par jour" aide="Survolez ou touchez une colonne pour le détail">
          <Colonnes nom="Visites par jour" quoi="Jour" points={d.par_jour.map((x) => ({ etiquette: dateCourte(x.jour), titre: dateLongue(x.jour), valeur: x.visites, detail: pluriel(x.vues, "page vue", "pages vues") }))}
            reperes="debut-milieu-fin" />
        </Carte>
        <div className={s.deux}>
          <Carte titre="Heures d'affluence" aide={`Visites selon l'heure (Abidjan), sur ${periode}`}>
            <Colonnes nom="Visites selon l'heure" quoi="Heure" points={d.par_heure.map((x) => ({ etiquette: `${x.heure} h`, titre: `De ${x.heure} h à ${x.heure + 1} h`, valeur: x.visites,
              detail: pluriel(x.vues, "page vue", "pages vues") }))} reperes="toutes-les-6" plusHaut />
          </Carte>
          <Carte titre="Jours de la semaine" aide={`Visites selon le jour, sur ${periode}`}>
            <Colonnes nom="Visites selon le jour de la semaine" quoi="Jour" points={d.par_jour_semaine.map((x) => ({ etiquette: JOURS_SEMAINE[x.jour - 1].slice(0, 3),
              titre: JOURS_SEMAINE[x.jour - 1], valeur: x.visites, detail: pluriel(x.vues, "page vue", "pages vues") }))} reperes="toutes" plusHaut />
          </Carte>
        </div>
        <Carte titre="Visites par mois" aide="Les 12 derniers mois, quelle que soit la période choisie">
          <Colonnes nom="Visites par mois" quoi="Mois" points={d.par_mois.map((x) => ({ etiquette: moisCourt(x.mois), titre: moisLong(x.mois), valeur: x.visites,
            detail: pluriel(x.vues, "page vue", "pages vues") }))} reperes="mois" />
        </Carte>
        <div className={s.trois}>
          <Carte titre="D'où viennent les visiteurs">
            <Barres nom="Visites selon leur origine" vide="Pas encore de visite" lignes={d.sources.map((x) => ({ nom: SOURCES[x.source] ?? x.source, valeur: x.visites }))} pourcentages />
          </Carte>
          <Carte titre="Appareils">
            <Barres nom="Visites selon l'appareil" vide="Pas encore de visite" lignes={d.appareils.map((x) => ({ nom: APPAREILS[x.appareil] ?? x.appareil, valeur: x.visites }))} pourcentages />
          </Carte>
          <Carte titre="Pages les plus vues">
            <Barres nom="Pages vues selon la page" vide="Pas encore de page vue" lignes={d.pages.slice(0, 8).map((x) => ({ nom: PAGES[x.page] ?? x.page, valeur: x.vues }))} />
          </Carte>
        </div>
        <Campagnes campagnes={d.campagnes} />
      </section>

      {/* ── Ce que font les visiteurs ── */}
      <section className={s.section} aria-labelledby="a-parcours">
        <h2 id="a-parcours" className={s.titre}>Ce que font les visiteurs</h2>
        <Parcours p={d.parcours} />
      </section>

      {/* ── Classements ── */}
      <section className={s.section} aria-labelledby="a-classements">
        <h2 id="a-classements" className={s.titre}>Classements</h2>
        <div className={s.deux}>
          <Carte titre="Biens les plus aimés" aide="Nombre de favoris (cœurs), depuis la publication">
            {d.favoris.length ? (
              <Tableau entetes={["Annonce", "Favoris", "Vues"]} lignes={d.favoris.map((a) => [
                <span key="a" className={s.annonce}>
                  {a.en_ligne ? <Link href={lienAnnonce(a)}>{a.titre}</Link> : <span>{a.titre}</span>}
                  <small>
                    {a.reference} · {a.commune} · {nombre(a.prix)} FCFA{a.transaction === "location" ? ` / ${a.loyer_par === "jour" ? "jour" : a.loyer_par === "nuit" ? "nuit" : a.loyer_par === "annee" ? "an" : "mois"}` : ""}
                    {!a.en_ligne && " · plus en ligne"}
                  </small>
                </span>,
                <span key="f">{nombre(a.favoris)}{a.nouveaux > 0 && <small className={s.nouveaux}>+{nombre(a.nouveaux)} sur {periode}</small>}</span>,
                nombre(a.vues),
              ])} />
            ) : <p className={s.vide}>Aucun favori pour l&apos;instant.</p>}
          </Carte>
          <Carte titre="Meilleurs annonceurs" aide={`Annonces en ligne ; contacts reçus sur ${periode}`}>
            {d.annonceurs.length ? (
              <Tableau entetes={["Annonceur", "En ligne", "Annonces", "Vues", "Contacts"]} lignes={d.annonceurs.map((a) => [
                <span key="n" className={s.annonce}>{a.nom || "Sans nom"}<small>{a.agence ? "Agence" : "Particulier"}</small></span>,
                nombre(a.en_ligne), nombre(a.annonces), nombre(a.vues), nombre(a.contacts),
              ])} />
            ) : <p className={s.vide}>Aucune annonce pour l&apos;instant.</p>}
          </Carte>
        </div>
      </section>

      {/* ── Recherches ── */}
      <Recherches d={d} periode={periode} />

      {/* ── Fonctionnement du site ── */}
      <section className={s.section} aria-labelledby="a-fonctionnement">
        <h2 id="a-fonctionnement" className={s.titre}>Fonctionnement</h2>
        <Fonctionnement d={d} periode={periode} />
      </section>
    </div>
  );
}

// ══ Morceaux ══

type Evolution = { texte: string; sens: "hausse" | "baisse" | null };
function evolution(actuel: number, avant: number, periode: string): Evolution {
  if (!avant) return { texte: actuel ? `rien les ${periode} d'avant` : "", sens: actuel ? "hausse" : null };
  const e = Math.round(((actuel - avant) * 100) / avant);
  return { texte: `${e > 0 ? "▲ +" : e < 0 ? "▼ " : "= "}${e} % par rapport aux ${periode} d'avant`, sens: e > 0 ? "hausse" : e < 0 ? "baisse" : null };
}

function Tuile({ titre, valeur, detail, evolution: evo, icone, aide }: { titre: string; valeur: string; detail?: string; evolution?: Evolution; icone: NomIcone; aide?: string }) {
  return (
    <li className={s.tuile}>
      <span className={s.tuileTitre}><Icone nom={icone} taille={14} /> {titre}</span>
      <span className={s.tuileValeur}>{valeur}{detail && <small>{detail}</small>}</span>
      {evo?.texte && <span className={`${s.evolution} ${evo.sens === "hausse" ? s.hausse : evo.sens === "baisse" ? s.baisse : ""}`}>{evo.texte}</span>}
      {aide && <span className={s.tuileAide}>{aide}</span>}
    </li>
  );
}

function Carte({ titre, aide, children }: { titre: string; aide?: string; children: ReactNode }) {
  return (
    <div className={s.carte}>
      <div className={s.carteHaut}>
        <h3 className={s.carteTitre}>{titre}</h3>
        {aide && <span className={s.carteAide}>{aide}</span>}
      </div>
      {children}
    </div>
  );
}

type Point = { etiquette: string; titre: string; valeur: number; detail?: string };
/**
 * Colonnes d'une seule couleur ; survol, toucher ou flèches du clavier : le détail de la colonne. Le plus haut est
 * écrit au-dessus de sa colonne (plusHaut). Les chiffres sont aussi dans un tableau, sous le graphique.
 */
function Colonnes({ nom, quoi, points, reperes, plusHaut = false }: {
  nom: string; quoi: string; points: Point[]; reperes: "debut-milieu-fin" | "toutes" | "toutes-les-6" | "mois"; plusHaut?: boolean;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.valeur), 0);
  const pas = max <= 4 ? 1 : Math.pow(10, Math.floor(Math.log10(max / 2)));
  const haut = Math.max(Math.ceil(max / 2 / pas) * pas * 2, 2);
  const total = points.reduce((n, p) => n + p.valeur, 0);
  const sommet = max > 0 ? points.findIndex((p) => p.valeur === max) : -1;
  const touche = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActif((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setActif(null);
  };
  const p = actif === null ? null : points[actif];
  const visibles = new Set(reperes === "toutes" || reperes === "mois" ? points.map((_, i) => i)
    : reperes === "toutes-les-6" ? points.map((_, i) => i).filter((i) => i % 6 === 0)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1]);
  return (
    <div className={s.graphique}>
      <div className={s.zone} tabIndex={0} role="group" onKeyDown={touche} onBlur={() => setActif(null)} onPointerLeave={() => setActif(null)}
        aria-label={`${nom} : ${nombre(total)} en tout${sommet >= 0 ? `, le plus : ${points[sommet].titre} (${nombre(max)})` : ""}. Flèches gauche et droite : chiffres de chaque colonne.`}>
        {[haut, haut / 2, 0].map((g) => (
          <span key={g} className={s.graduation} style={{ bottom: `${(g / haut) * 100}%` }}>
            <span className={s.graduationTexte}>{nombre(g)}</span>
          </span>
        ))}
        <div className={s.colonnes}>
          {points.map((x, i) => (
            <div key={i} className={`${s.colonne} ${actif === i ? s.colonneActive : ""}`} onPointerEnter={() => setActif(i)} onPointerDown={() => setActif(i)}>
              {plusHaut && i === sommet && actif === null && <span className={s.sommet} style={{ bottom: `${(x.valeur / haut) * 100}%` }}>{nombre(x.valeur)}</span>}
              <span className={s.barreColonne} style={{ height: `${(x.valeur / haut) * 100}%` }} />
            </div>
          ))}
        </div>
        {p && actif !== null && (
          <div className={s.bulle} role="status"
            style={{ left: `${((actif + 0.5) / points.length) * 100}%`, transform: `translateX(${actif < points.length / 4 ? "-15%" : actif > (points.length * 3) / 4 ? "-85%" : "-50%"})` }}>
            <strong>{pluriel(p.valeur, "visite")}</strong>
            {p.detail && <span>{p.detail}</span>}
            <small>{p.titre}</small>
          </div>
        )}
      </div>
      <div className={s.axe} aria-hidden="true">
        {/* mois : sur téléphone, un sur trois (en partant du dernier), pour qu'ils ne se chevauchent pas */}
        {points.map((x, i) => (
          <span key={i} className={`${s.axeCase} ${reperes === "mois" && (points.length - 1 - i) % 3 ? s.axeCaseSecondaire : ""}`}>
            {visibles.has(i) ? x.etiquette : ""}
          </span>
        ))}
      </div>
      <details className={s.tableauVue}>
        <summary>Voir les chiffres</summary>
        <div className={s.defilement}>
          <table>
            <thead><tr><th scope="col">{quoi}</th><th scope="col">Visites</th><th scope="col">Détail</th></tr></thead>
            <tbody>
              {points.map((x, i) => <tr key={i}><th scope="row">{x.titre}</th><td>{nombre(x.valeur)}</td><td>{x.detail ?? ""}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Barres horizontales d'une seule couleur, valeur (et part du total) au bout */
function Barres({ nom, lignes, vide, pourcentages = false }: { nom: string; lignes: { nom: string; valeur: number; detail?: string }[]; vide: string; pourcentages?: boolean }) {
  if (!lignes.length) return <p className={s.vide}>{vide}.</p>;
  const max = Math.max(...lignes.map((l) => l.valeur), 1);
  const total = lignes.reduce((n, l) => n + l.valeur, 0);
  return (
    <ul className={s.barres} aria-label={nom}>
      {lignes.map((l) => (
        <li key={l.nom} className={s.ligneBarre}>
          <span className={s.barreNom}>{l.nom}{l.detail && <small>{l.detail}</small>}</span>
          <span className={s.piste} aria-hidden="true">{l.valeur > 0 && <span className={s.barre} style={{ width: `${(l.valeur / max) * 100}%` }} />}</span>
          <span className={s.barreValeur}>{nombre(l.valeur)}{pourcentages && total > 0 && <small>{part(l.valeur, total)} %</small>}</span>
        </li>
      ))}
    </ul>
  );
}

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: ReactNode[][] }) {
  return (
    <div className={s.tableauDefile}>
      <table className={s.tableau}>
        <thead><tr>{entetes.map((e, i) => <th key={e} scope="col" className={i ? s.chiffre : undefined}>{e}</th>)}</tr></thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>{l.map((c, j) => (j ? <td key={j} className={s.chiffre}>{c}</td> : <th key={j} scope="row">{c}</th>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Campagnes : visites venues d'un lien marqué (?utm_source=…&utm_campaign=…), et fabrique de liens */
function Campagnes({ campagnes }: { campagnes: Donnees["campagnes"] }) {
  const [nomCampagne, setNomCampagne] = useState("");
  const [source, setSource] = useState("whatsapp");
  const [page, setPage] = useState("/");
  const [copie, setCopie] = useState(false);
  const mot = nomCampagne.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const lien = mot ? `${ADRESSE_SITE.replace(/\/$/, "")}${page}?utm_source=${source}&utm_campaign=${mot}` : "";
  const copier = () => {
    navigator.clipboard?.writeText(lien).then(() => {
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    }, () => undefined);
  };
  return (
    <Carte titre="Campagnes" aide="Visites venues d'un lien de campagne (publicité, message WhatsApp, affiche…)">
      {campagnes.length ? (
        <Tableau entetes={["Campagne", "Source", "Visites"]} lignes={campagnes.map((c) => [c.campagne, SOURCES[c.source] ?? c.source, nombre(c.visites)])} />
      ) : <p className={s.vide}>Aucune visite venue d&apos;un lien de campagne sur la période.</p>}
      <div className={s.fabrique}>
        <span className={s.fabriqueTitre}><Icone nom="lien" taille={14} /> Créer un lien de campagne</span>
        <p className={s.note}>Partagez ce lien plutôt que l&apos;adresse simple : les visites qu&apos;il amène sont comptées ici, sous le nom choisi.</p>
        <div className={s.fabriqueChamps}>
          <label>Nom de la campagne
            <input type="text" value={nomCampagne} maxLength={60} placeholder="Ex : pub octobre" onChange={(e) => setNomCampagne(e.target.value)} />
          </label>
          <label>Partagé sur
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {["whatsapp", "facebook", "instagram", "tiktok", "youtube", "sms", "email", "affiche"].map((x) => (
                <option key={x} value={x}>{x === "affiche" ? "Affiche, flyer (QR code)" : SOURCES[x]}</option>
              ))}
            </select>
          </label>
          <label>Page d&apos;arrivée
            <select value={page} onChange={(e) => setPage(e.target.value)}>
              <option value="/">Accueil</option>
              <option value="/annonces">Liste des annonces</option>
              <option value="/publier">Publier une annonce</option>
              <option value="/estimation">Estimation</option>
            </select>
          </label>
        </div>
        {lien && (
          <div className={s.lienCampagne}>
            <code>{lien}</code>
            <button type="button" className={s.boutonContour} onClick={copier}>{copie ? "Copié" : "Copier"}</button>
          </div>
        )}
      </div>
    </Carte>
  );
}

/** Ce que font les visiteurs : chaque geste, comparé au nombre de visites */
function Parcours({ p }: { p: Donnees["parcours"] }) {
  const contacts = p.numeros + p.appels + p.whatsapp + p.emails + p.messages + p.visites_demandees + p.rappels;
  const etapes = [
    { nom: "Visites", valeur: p.visites },
    { nom: "Recherches", valeur: p.recherches, detail: "liste des annonces, avec des critères" },
    { nom: "Fiches de biens ouvertes", valeur: p.fiches },
    { nom: "Contacts vers les annonceurs", valeur: contacts,
      detail: [p.numeros && pluriel(p.numeros, "numéro affiché", "numéros affichés"), p.appels && pluriel(p.appels, "appel"), p.whatsapp && `${nombre(p.whatsapp)} WhatsApp`,
        p.emails && pluriel(p.emails, "e-mail"), p.messages && pluriel(p.messages, "message"), p.visites_demandees && pluriel(p.visites_demandees, "visite demandée", "visites demandées"),
        p.rappels && pluriel(p.rappels, "rappel")].filter(Boolean).join(" · ") || undefined },
    { nom: "Favoris ajoutés", valeur: p.favoris },
    { nom: "Annonces partagées", valeur: p.partages },
    { nom: "Alertes créées", valeur: p.alertes },
    { nom: "Inscriptions", valeur: p.inscriptions },
    { nom: "Annonces envoyées", valeur: p.annonces_envoyees },
    { nom: "Annonces publiées", valeur: p.annonces_publiees },
  ];
  return (
    <Carte titre="Gestes des visiteurs" aide="Sur la période ; la part est comparée au nombre de visites">
      <ul className={s.barres} aria-label="Gestes des visiteurs">
        {etapes.map((e, i) => {
          const pc = i > 0 ? part(e.valeur, p.visites) : null;
          return (
            <li key={e.nom} className={s.ligneBarre}>
              <span className={s.barreNom}>{e.nom}{e.detail && <small>{e.detail}</small>}</span>
              <span className={s.piste} aria-hidden="true">{e.valeur > 0 && <span className={s.barre} style={{ width: `${Math.min(100, (e.valeur / Math.max(p.visites, ...etapes.map((x) => x.valeur), 1)) * 100)}%` }} />}</span>
              <span className={s.barreValeur}>{nombre(e.valeur)}{pc !== null && <small>{pc} %</small>}</span>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}

function ligneRecherche(r: LigneRecherche): string {
  return [transactionTexte(r.transaction, r.duree), r.type_nom, r.lieu || "partout", r.budget && `budget ${r.budget}`].filter(Boolean).join(" · ");
}

function Recherches({ d, periode }: { d: Donnees; periode: string }) {
  const r = d.recherches;
  return (
    <section className={s.section} aria-labelledby="a-recherches">
      <h2 id="a-recherches" className={s.titre}>Recherches</h2>
      <ul className={s.tuiles}>
        <Tuile titre="Recherches" icone="recherche" valeur={nombre(r.total)} detail={`sur ${periode}`} />
        <Tuile titre="Sans résultat" icone="moins" valeur={nombre(r.sans_resultat)} detail={r.total ? `${part(r.sans_resultat, r.total)} % des recherches` : undefined}
          aide="Des biens que les visiteurs cherchent et qui manquent sur le site" />
      </ul>
      <div className={s.trois}>
        <Carte titre="Lieux les plus recherchés">
          <Barres nom="Recherches selon le lieu" vide="Pas encore de recherche avec un lieu"
            lignes={r.lieux.map((l) => ({ nom: l.lieu, valeur: l.nombre, detail: l.sans_resultat ? `dont ${nombre(l.sans_resultat)} sans résultat` : undefined }))} />
        </Carte>
        <Carte titre="Types de bien">
          <Barres nom="Recherches selon le type de bien" vide="Pas encore de recherche" lignes={r.types.map((x) => ({ nom: x.nom, valeur: x.nombre }))} pourcentages />
        </Carte>
        <Carte titre="Location ou achat">
          <Barres nom="Recherches selon la transaction" vide="Pas encore de recherche"
            lignes={r.transactions.map((x) => ({ nom: transactionTexte(x.transaction, x.duree), valeur: x.nombre }))} pourcentages />
        </Carte>
      </div>
      <div className={s.deux}>
        <Carte titre="Recherches les plus fréquentes">
          {r.combinaisons.length ? (
            <Tableau entetes={["Recherche", "Nombre"]} lignes={r.combinaisons.map((x) => [ligneRecherche(x), nombre(x.nombre)])} />
          ) : <p className={s.vide}>Pas encore de recherche.</p>}
        </Carte>
        <Carte titre="Recherches sans résultat" aide="Les biens à trouver en priorité">
          {r.sans_resultat_detail.length ? (
            <Tableau entetes={["Recherche", "Nombre"]} lignes={r.sans_resultat_detail.map((x) => [ligneRecherche(x), nombre(x.nombre)])} />
          ) : <p className={s.vide}>Toutes les recherches ont trouvé au moins un bien.</p>}
        </Carte>
      </div>
      <Carte titre="Demande et offre par commune"
        aide={`Recherches sur ${periode} ; annonces en ligne aujourd'hui ; « Annonces à trouver » : plus de 5 recherches par annonce en ligne`}>
        {d.demande_offre.length ? (
          <Tableau entetes={["Commune", "Recherches", "Location", "Achat", "Annonces en ligne", ""]} lignes={d.demande_offre.map((x) => {
            const manque = x.recherches >= 10 && x.offre * 5 < x.recherches;
            return [
              x.commune === x.ville ? x.ville : `${x.commune} (${x.ville})`, nombre(x.recherches), nombre(x.location), nombre(x.achat),
              <span key="o">{nombre(x.offre)}<small className={s.detailChiffre}>{nombre(x.offre_location)} loc. · {nombre(x.offre_achat)} vente</small></span>,
              manque ? <span key="m" className={s.manque}><Icone nom="plus" taille={12} /> Annonces à trouver</span> : "",
            ];
          })} />
        ) : <p className={s.vide}>Pas encore de recherche par commune.</p>}
      </Carte>
      <Budgets d={d} />
    </section>
  );
}

/** Budgets recherchés et prix des annonces en ligne : part de chaque tranche, côte à côte (deux couleurs, avec légende) */
function Budgets({ d }: { d: Donnees }) {
  const groupes = TRANCHES.map((g) => {
    const recherches = g.tranches.map((t) => d.recherches.budgets.find((b) => b.transaction === g.transaction && b.duree === g.duree && b.budget === t)?.nombre ?? 0);
    const annonces = g.tranches.map((t) => d.prix_en_ligne.find((b) => b.transaction === g.transaction && b.duree === g.duree && b.budget === t)?.annonces ?? 0);
    const totalR = recherches.reduce((a, b) => a + b, 0);
    const totalA = annonces.reduce((a, b) => a + b, 0);
    return { ...g, recherches, annonces, totalR, totalA };
  }).filter((g) => g.totalR > 0 || (g.cle !== "jour" && g.totalA > 0));
  return (
    <Carte titre="Budgets recherchés et prix des annonces" aide="Part de chaque tranche : budget maximum des recherches, prix des annonces en ligne">
      <div className={s.legende} aria-hidden="true">
        <span><i className={s.cleRecherches} /> Budgets recherchés</span>
        <span><i className={s.cleAnnonces} /> Annonces en ligne</span>
      </div>
      {groupes.length ? groupes.map((g) => (
        <div key={g.cle} className={s.groupeBudgets}>
          <h4 className={s.sousTitre}>{g.titre} <small>{pluriel(g.totalR, "recherche")} avec budget · {pluriel(g.totalA, "annonce")}</small></h4>
          <ul className={s.paires} aria-label={g.titre}>
            {g.tranches.map((t, i) => {
              const pr = part(g.recherches[i], g.totalR) ?? 0;
              const pa = part(g.annonces[i], g.totalA) ?? 0;
              return (
                <li key={t} className={s.paire} aria-label={`${t} : ${pr} % des budgets recherchés, ${pa} % des annonces en ligne`}>
                  <span className={s.barreNom}>{t}</span>
                  <span className={s.duo} aria-hidden="true">
                    <span className={s.duoLigne}>
                      <span className={s.piste}>{pr > 0 && <span className={`${s.barre} ${s.barreRecherches}`} style={{ width: `${pr}%` }} />}</span>
                      <span className={s.duoValeur}>{pr} %</span>
                    </span>
                    <span className={s.duoLigne}>
                      <span className={s.piste}>{pa > 0 && <span className={`${s.barre} ${s.barreAnnonces}`} style={{ width: `${pa}%` }} />}</span>
                      <span className={s.duoValeur}>{pa} %</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )) : <p className={s.vide}>Pas encore de recherche avec un budget.</p>}
      {groupes.length > 0 && (
        <details className={s.tableauVue}>
          <summary>Voir les chiffres</summary>
          <div className={s.defilement}>
            <table>
              <thead><tr><th scope="col">Tranche</th><th scope="col">Recherches</th><th scope="col">Annonces en ligne</th></tr></thead>
              <tbody>
                {groupes.flatMap((g) => g.tranches.map((t, i) => (
                  <tr key={`${g.cle}-${t}`}><th scope="row">{t}</th><td>{nombre(g.recherches[i])}</td><td>{nombre(g.annonces[i])}</td></tr>
                )))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Carte>
  );
}

function Fonctionnement({ d, periode }: { d: Donnees; periode: string }) {
  const v = d.verification;
  const r = d.reactivite;
  const c = d.comptes;
  const decisions = v.publiees + v.refusees;
  const taux = (a: number, b: number) => (b ? `${part(a, b)} %` : "—");
  return (
    <>
      <div className={s.groupe}>
        <h3 className={s.sousTitre}>Vérification des annonces</h3>
        <ul className={s.tuiles}>
          <Tuile titre="Délai de vérification" icone="horloge" valeur={duree(v.delai_median_heures)} aide="Temps du milieu entre l'envoi et la décision (publiée ou refusée)" />
          <Tuile titre="En attente" icone="document" valeur={nombre(v.en_attente)} detail={v.en_attente ? `la plus ancienne depuis ${duree(v.plus_ancienne_heures)}` : undefined} />
          <Tuile titre="Publiées" icone="valide" valeur={nombre(v.publiees)} detail={`sur ${periode}`} />
          <Tuile titre="Refusées" icone="fermer" valeur={nombre(v.refusees)} detail={decisions ? `${part(v.refusees, decisions)} % des décisions` : undefined}
            aide={v.retirees ? `et ${pluriel(v.retirees, "annonce retirée", "annonces retirées")}` : undefined} />
        </ul>
        {v.motifs.length > 0 && (
          <Carte titre="Motifs de refus les plus fréquents">
            <Barres nom="Motifs de refus" vide="" lignes={v.motifs.map((m) => ({ nom: m.motif, valeur: m.nombre }))} />
          </Carte>
        )}
      </div>
      <div className={s.groupe}>
        <h3 className={s.sousTitre}>Réactivité des annonceurs</h3>
        <ul className={s.tuiles}>
          <Tuile titre="Messages répondus" icone="message" valeur={taux(r.messages_repondus, r.messages)} detail={r.messages ? `${nombre(r.messages_repondus)} sur ${nombre(r.messages)}` : undefined} />
          <Tuile titre="Première réponse" icone="horloge" valeur={duree(r.premiere_reponse_heures)} aide="Temps du milieu avant la première réponse de l'annonceur" />
          <Tuile titre="Visites traitées" icone="calendrier" valeur={taux(r.visites_traitees, r.visites)} detail={r.visites ? `${nombre(r.visites_traitees)} sur ${nombre(r.visites)}` : undefined} />
          <Tuile titre="Rappels faits" icone="telephone" valeur={taux(r.rappels_faits, r.rappels)} detail={r.rappels ? `${nombre(r.rappels_faits)} sur ${nombre(r.rappels)}` : undefined} />
        </ul>
      </div>
      <div className={s.groupe}>
        <h3 className={s.sousTitre}>Comptes</h3>
        <ul className={s.tuiles}>
          <Tuile titre="Inscriptions" icone="personne" valeur={nombre(c.inscriptions)} evolution={evolution(c.inscriptions, c.inscriptions_avant, periode)} />
          <Tuile titre="Actifs (7 jours)" icone="entree" valeur={nombre(c.actifs_7)} aide="Connectés au moins une fois ces 7 derniers jours" />
          <Tuile titre="Actifs (30 jours)" icone="entree" valeur={nombre(c.actifs_30)} />
          <Tuile titre="Comptes en tout" icone="grille" valeur={nombre(c.total)} />
        </ul>
      </div>
      <div className={s.deux}>
        <Carte titre="Annonces sans contact" aide="En ligne depuis 14 jours ou plus, sans aucun contact : à relancer ou à améliorer">
          <p className={s.chiffreCle}>
            <strong>{nombre(d.sans_contact.nombre)}</strong> sur {pluriel(d.sans_contact.en_ligne, "annonce en ligne", "annonces en ligne")}
          </p>
          {d.sans_contact.annonces.length > 0 && (
            <Tableau entetes={["Annonce", "Publiée le", "Vues"]} lignes={d.sans_contact.annonces.map((a) => [
              <span key="a" className={s.annonce}><Link href={lienAnnonce(a)}>{a.titre}</Link><small>{a.reference} · {a.commune}</small></span>,
              dateJour(a.publiee_le), nombre(a.vues),
            ])} />
          )}
        </Carte>
        <Carte titre="Pages introuvables" aide="Liens cassés ou annonces plus en ligne, les plus demandés">
          {d.introuvables.length ? (
            <Tableau entetes={["Adresse", "Fois", "Dernière"]} lignes={d.introuvables.map((x) => [<code key="c" className={s.chemin}>{x.chemin}</code>, nombre(x.nombre), dateHeure(x.dernier_le)])} />
          ) : <p className={s.vide}>Aucune page introuvable demandée.</p>}
        </Carte>
      </div>
    </>
  );
}
