"use client";

/*
 * Mon Espace → Statistiques : ce que deviennent ses annonces, sur 7, 30 ou 90 jours (comparés aux jours d'avant).
 *   En bref          vues des fiches, contacts (et leur part des vues), mises en favori, envois par les alertes
 *   Vues par jour    colonnes (survol ou flèches du clavier : vues et contacts du jour) ; chiffres jour par jour
 *   Les visiteurs    numéros affichés, appels, WhatsApp, e-mails, messages, visites, rappels, partages
 *   Par annonce      chiffres, prix face aux annonces semblables, conseils (lib/statistiques.ts)
 * Les chiffres viennent de la base (statistiques_annonceur) ; l'annonceur ne se compte pas lui-même.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import {
  PERIODES, conseils, contacts, evolution, mesStatistiques, positionPrix, tauxContact,
  type Chiffres, type Periode, type StatAnnonce, type Statistiques as Stats,
} from "@/lib/statistiques";
import f from "./Formulaire.module.css";
import s from "./Statistiques.module.css";

const nombre = (n: number) => formaterPrix(n);
const dateCourte = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dateLongue = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${nombre(n)} ${n > 1 ? mots : mot}`;

export default function Statistiques({ annonce = null }: { annonce?: string | null }) {
  const [periode, setPeriode] = useState<Periode>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    mesStatistiques(periode).then(
      (r) => {
        if (!actif) return;
        setStats(r);
        setErreur("");
        setChargement(false);
      },
      (e) => {
        if (!actif) return;
        setErreur(messageErreur(e));
        setChargement(false);
      },
    );
    return () => {
      actif = false;
    };
  }, [periode]);

  // Venue de Mes annonces : l'annonce choisie
  const cible = useRef(false);
  useEffect(() => {
    if (!stats || !annonce || cible.current) return;
    cible.current = true;
    document.getElementById(`stat-${annonce}`)?.scrollIntoView({ block: "start" });
  }, [stats, annonce]);

  const choisir = (p: Periode) => {
    if (p === periode) return;
    setChargement(true);
    setPeriode(p);
  };

  if (erreur && !stats) {
    return (
      <p className={`${f.message} ${f.messageErreur}`} role="alert">
        <Icone nom="statistiques" taille={16} />
        Vos statistiques n&apos;ont pas pu être chargées : {erreur}
      </p>
    );
  }
  if (!stats) return <p className={s.attente}>Chargement de vos statistiques…</p>;
  if (!stats.annonces.length) {
    return (
      <div className={s.vide}>
        <Icone nom="statistiques" taille={30} />
        <p>
          Vos statistiques apparaîtront ici dès votre première annonce en ligne : vues, numéros affichés, messages,
          visites, et des conseils pour trouver preneur plus vite.
        </p>
        <Link href="/publier" className={f.bouton}>Publier une annonce</Link>
      </div>
    );
  }

  const t = stats.totaux, a = stats.avant;
  const taux = tauxContact(t);
  return (
    <div className={`${s.stats} ${chargement ? s.chargement : ""}`} aria-busy={chargement || undefined}>
      <div className={s.barre}>
        <div className={s.periodes} role="radiogroup" aria-label="Période">
          {PERIODES.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === periode}
              className={`${s.periode} ${p === periode ? s.periodeChoisie : ""}`} onClick={() => choisir(p)}>
              {p} jours
            </button>
          ))}
        </div>
        <span className={s.dates}>Du {dateLongue(stats.du)} au {dateLongue(stats.au)}</span>
      </div>
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}

      <ul className={s.tuiles} aria-label="En bref">
        <Tuile titre="Vues des fiches" valeur={nombre(t.vues)} evo={ecart(t.vues, a.vues, stats.jours)} icone="voir" />
        <Tuile titre="Contacts" valeur={nombre(contacts(t))} evo={ecart(contacts(t), contacts(a), stats.jours)} icone="telephone"
          detail={taux === null ? undefined : `soit ${virgule(taux)} % des vues`}
          aide="Numéros affichés, messages, visites et rappels demandés" />
        <Tuile titre="Mises en favori" valeur={nombre(t.favoris)} evo={ecart(t.favoris, a.favoris, stats.jours)} icone="coeur" />
        <Tuile titre="Envois par les alertes" valeur={nombre(t.alertes)} evo={ecart(t.alertes, a.alertes, stats.jours)} icone="cloche"
          aide="Fois où vos annonces sont arrivées par e-mail chez des personnes qui cherchent ce bien" />
      </ul>

      <section className={s.carte} aria-labelledby="stats-jours">
        <div className={s.carteHaut}>
          <h2 id="stats-jours" className={s.carteTitre}>Vues par jour</h2>
          <span className={s.carteAide}>Survolez ou touchez une colonne : vues et contacts du jour</span>
        </div>
        <Colonnes jours={stats.par_jour} />
        <details className={s.tableau}>
          <summary>Voir les chiffres jour par jour</summary>
          <div className={s.defilement}>
            <table>
              <thead><tr><th scope="col">Jour</th><th scope="col">Vues</th><th scope="col">Contacts</th></tr></thead>
              <tbody>
                {[...stats.par_jour].reverse().map((j) => (
                  <tr key={j.jour}><th scope="row">{dateLongue(j.jour)}</th><td>{nombre(j.vues)}</td><td>{nombre(j.contacts)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className={s.carte} aria-labelledby="stats-gestes">
        <div className={s.carteHaut}>
          <h2 id="stats-gestes" className={s.carteTitre}>Ce que font les visiteurs</h2>
        </div>
        <Gestes c={t} />
      </section>

      <section aria-labelledby="stats-annonces" className={s.parAnnonce}>
        <h2 id="stats-annonces" className={s.groupeTitre}>Par annonce <span className={s.nombre}>{stats.annonces.length}</span></h2>
        <ul className={s.annonces}>
          {stats.annonces.map((x) => <CarteAnnonce key={x.id} a={x} jours={stats.jours} choisie={x.id === annonce} />)}
        </ul>
      </section>
    </div>
  );
}

type Ecart = { sens: "hausse" | "baisse" | null; texte: string };
const virgule = (n: number) => String(n).replace(".", ",");

/** Écart avec la période d'avant : « ▲ +20 % par rapport aux 30 jours d'avant » */
function ecart(actuel: number, avant: number, jours: number): Ecart {
  const e = evolution(actuel, avant);
  if (e === null) return { sens: null, texte: `rien non plus les ${jours} jours d'avant` };
  if (e === "nouveau") return { sens: "hausse", texte: `▲ rien les ${jours} jours d'avant` };
  return { sens: e > 0 ? "hausse" : e < 0 ? "baisse" : null, texte: `${e > 0 ? "▲ +" : e < 0 ? "▼ " : "= "}${e} % par rapport aux ${jours} jours d'avant` };
}
function Tuile({ titre, valeur, detail, evo, icone, aide }: {
  titre: string; valeur: string; detail?: string; evo: Ecart; icone: NomIcone; aide?: string;
}) {
  return (
    <li className={s.tuile}>
      <span className={s.tuileTitre}><Icone nom={icone} taille={14} /> {titre}</span>
      <span className={s.tuileValeur}>
        {valeur}
        {detail && <small>{detail}</small>}
      </span>
      <span className={`${s.evolution} ${evo.sens === "hausse" ? s.hausse : evo.sens === "baisse" ? s.baisse : ""}`}>{evo.texte}</span>
      {aide && <span className={s.tuileAide}>{aide}</span>}
    </li>
  );
}

/** Colonnes des vues par jour ; survol, toucher ou flèches du clavier : le jour, ses vues et ses contacts */
function Colonnes({ jours }: { jours: Stats["par_jour"] }) {
  const [actif, setActif] = useState<number | null>(null);
  const max = Math.max(...jours.map((j) => j.vues), 0);
  // graduations rondes : 0, la moitié, le haut
  const pas = max <= 4 ? 1 : Math.pow(10, Math.floor(Math.log10(max / 2)));
  const haut = Math.max(Math.ceil(max / 2 / pas) * pas * 2, 2);
  const total = jours.reduce((n, j) => n + j.vues, 0);
  const touche = (e: KeyboardEvent) => {
    if (!jours.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActif((i) => Math.min(jours.length - 1, Math.max(0, (i ?? jours.length) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setActif(null);
  };
  const j = actif === null ? null : jours[actif];
  const milieu = Math.floor((jours.length - 1) / 2);
  return (
    <div className={s.graphique}>
      <div className={s.zone} tabIndex={0} role="group" onKeyDown={touche} onBlur={() => setActif(null)}
        aria-label={`Vues par jour : ${pluriel(total, "vue")} en ${jours.length} jours, ${max} au plus en un jour. Flèches gauche et droite : chiffres de chaque jour.`}
        onPointerLeave={() => setActif(null)}>
        {[haut, haut / 2, 0].map((g) => (
          <span key={g} className={s.graduation} style={{ bottom: `${(g / haut) * 100}%` }}>
            <span className={s.graduationTexte}>{nombre(g)}</span>
          </span>
        ))}
        <div className={s.colonnes}>
          {jours.map((x, i) => (
            <div key={x.jour} className={`${s.colonne} ${actif === i ? s.colonneActive : ""}`}
              onPointerEnter={() => setActif(i)} onPointerDown={() => setActif(i)}>
              <span className={s.barreJour} style={{ height: `${(x.vues / haut) * 100}%` }} />
            </div>
          ))}
        </div>
        {j && actif !== null && (
          <div className={s.bulle} role="status"
            style={{ left: `${((actif + 0.5) / jours.length) * 100}%`, transform: `translateX(${actif < jours.length / 4 ? "-15%" : actif > (jours.length * 3) / 4 ? "-85%" : "-50%"})` }}>
            <strong>{pluriel(j.vues, "vue")}</strong>
            <span>{pluriel(j.contacts, "contact")}</span>
            <small>{dateLongue(j.jour)}</small>
          </div>
        )}
      </div>
      <div className={s.axe} aria-hidden="true">
        <span>{jours[0] && dateCourte(jours[0].jour)}</span>
        {jours.length > 2 && <span>{dateCourte(jours[milieu].jour)}</span>}
        <span>{jours.length > 1 && dateCourte(jours[jours.length - 1].jour)}</span>
      </div>
    </div>
  );
}

const GESTES: { cle: keyof Chiffres; texte: string }[] = [
  { cle: "numeros", texte: "Numéros affichés" },
  { cle: "appels", texte: "Appels lancés" },
  { cle: "whatsapp", texte: "WhatsApp ouverts" },
  { cle: "emails", texte: "E-mails ouverts" },
  { cle: "messages", texte: "Nouveaux messages" },
  { cle: "visites", texte: "Demandes de visite" },
  { cle: "rappels", texte: "Demandes de rappel" },
  { cle: "partages", texte: "Partages" },
];

/** Gestes des visiteurs : barres horizontales d'une seule couleur, valeur au bout */
function Gestes({ c }: { c: Chiffres }) {
  const max = Math.max(...GESTES.map((g) => c[g.cle]), 1);
  return (
    <ul className={s.gestes} aria-label="Gestes des visiteurs">
      {GESTES.map((g) => (
        <li key={g.cle} className={s.geste}>
          <span className={s.gesteNom}>{g.texte}</span>
          <span className={s.gestePiste} aria-hidden="true">
            {c[g.cle] > 0 && <span className={s.gesteBarre} style={{ width: `${(c[g.cle] / max) * 100}%` }} />}
          </span>
          <span className={s.gesteValeur}>{nombre(c[g.cle])}</span>
        </li>
      ))}
    </ul>
  );
}

function CarteAnnonce({ a, jours, choisie }: { a: StatAnnonce; jours: number; choisie: boolean }) {
  const prix = positionPrix(a);
  const liste = conseils(a, jours);
  const etat = a.en_ligne ? "En ligne" : a.statut === "archivee" ? "Retirée (vendu ou loué)" : "Expirée";
  const detailContacts = [
    a.numeros && pluriel(a.numeros, "numéro affiché", "numéros affichés"), a.messages && pluriel(a.messages, "message"),
    a.visites && pluriel(a.visites, "visite"), a.rappels && pluriel(a.rappels, "rappel"),
  ].filter(Boolean).join(" · ");
  const idTitre = `stat-titre-${a.id}`;
  let positionTexte: ReactNode = null;
  if (prix) {
    const ecart = prix.ecart >= 10 ? `${prix.ecart} % au-dessus` : prix.ecart <= -10 ? `${-prix.ecart} % en dessous` : "dans la moyenne";
    positionTexte = (
      <p className={s.prix}>
        <span>
          Votre prix : <strong>{nombre(a.prix_compare ?? 0)} {prix.unite}</strong> · annonces semblables à {a.commune} :{" "}
          {nombre(prix.mediane)} {prix.unite} (prix du milieu de {a.comparables})
        </span>
        <span className={`${s.ecart} ${prix.ecart >= 15 ? s.ecartHaut : prix.ecart <= -10 ? s.ecartBas : s.ecartJuste}`}>{ecart}</span>
      </p>
    );
  } else if (a.en_ligne) {
    positionTexte = <p className={s.note}>Pas encore assez d&apos;annonces semblables à {a.commune} pour comparer le prix.</p>;
  }

  return (
    <li id={`stat-${a.id}`} className={`${s.annonce} ${choisie ? s.annonceChoisie : ""}`} aria-labelledby={idTitre}>
      <div className={s.annonceHaut}>
        <h3 id={idTitre} className={s.annonceTitre}>
          {a.en_ligne ? <Link href={lienAnnonce(a)}>{a.titre}</Link> : a.titre}
        </h3>
        <span className={`${s.etat} ${a.en_ligne ? s.etatEnLigne : ""}`}>{etat}</span>
      </div>
      <p className={s.meta}>
        {a.type_nom} · {a.commune} · réf. {a.reference} · {pluriel(a.vues_total, "vue")} depuis la publication
      </p>
      <dl className={s.mini}>
        <div><dt>Vues</dt><dd>{nombre(a.vues)}</dd></div>
        <div><dt>Contacts</dt><dd>{nombre(contacts(a))}</dd></div>
        <div><dt>Favoris</dt><dd>{nombre(a.favoris)}</dd></div>
        <div><dt>Alertes</dt><dd>{nombre(a.alertes)}</dd></div>
      </dl>
      {detailContacts && <p className={s.note}>{detailContacts}</p>}
      {positionTexte}
      {liste.length > 0 && (
        <ul className={s.conseils} aria-label="Conseils">
          {liste.map((c) => (
            <li key={c.texte} className={`${s.conseil} ${c.ton === "attention" ? s.conseilAttention : c.ton === "bien" ? s.conseilBien : ""}`}>
              <Icone nom={c.ton === "bien" ? "valide" : c.ton === "attention" ? "cloche" : "plus"} taille={14} />
              <span>{c.texte}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
