"use client";

/*
 * Espace Administration (/admin), réservé à l'équipe 360-Immo.ci (compte « admin ») :
 *   Tableau de bord   annonces à vérifier, signalées, en ligne… ; comptes ; activité des 7 derniers jours
 *   À vérifier        chaque annonce envoyée (photos, détails, contact, compte de l'auteur) : Publier, ou Refuser
 *                     avec un motif que l'annonceur lit (AVerifier.tsx)
 *   Signalements      annonces signalées par les visiteurs : retirer avec un motif, ou classer (Signalements.tsx)
 *   Journal           les dernières décisions de l'équipe
 * Sans compte : connexion, puis retour ici. Un autre compte voit « Espace réservé à l'équipe ».
 * La base vérifie elle-même chaque action (supabase/migrations/…_moderation.sql).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { DECISIONS, journalAdmin, tableauAdmin, type LigneJournal, type Tableau } from "@/lib/admin";
import { lireProfil, messageErreur, useCompte } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { rafraichirNonLus } from "@/lib/messages";
import AVerifier from "./AVerifier";
import { dateHeure } from "./outils";
import Signalements from "./Signalements";
import s from "./Admin.module.css";

type Section = "tableau" | "verifier" | "signalements" | "journal";

export default function Administration() {
  const { etat, utilisateur } = useCompte();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (etat === "anonyme") router.replace("/connexion?suite=/admin");
  }, [etat, router]);

  const id = utilisateur?.id;
  useEffect(() => {
    if (!id) return;
    let actif = true;
    lireProfil(id).then((p) => actif && setRole(p.role), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [id]);

  if (erreur) {
    return <Cadre><p className={s.erreur} role="alert">Votre compte n&apos;a pas pu être vérifié : {erreur}</p></Cadre>;
  }
  if (etat !== "connecte" || !role) return <Cadre><p className={s.attente}>Chargement…</p></Cadre>;
  if (role !== "admin") {
    return (
      <Cadre>
        <div className={s.refuse}>
          <Icone nom="cadenas" taille={30} />
          <h1 className={s.titre}>Espace réservé à l&apos;équipe 360-Immo.ci</h1>
          <p>Cette page sert à vérifier les annonces avant leur publication. Votre compte n&apos;y a pas accès.</p>
          <Link href="/mon-espace" className={s.boutonPlein}>Retour à mon espace</Link>
        </div>
      </Cadre>
    );
  }
  return <Espace />;
}

function Cadre({ children }: { children: React.ReactNode }) {
  return <div className={s.page}><div className={s.contenu}>{children}</div></div>;
}

function Espace() {
  const [section, setSection] = useState<Section>("verifier");
  const [tableau, setTableau] = useState<Tableau | null>(null);
  const [erreur, setErreur] = useState("");

  const relire = useCallback(() => {
    tableauAdmin().then((t) => {
      setTableau(t);
      setErreur("");
    }, (e) => setErreur(messageErreur(e)));
    rafraichirNonLus();
  }, []);
  useEffect(() => {
    let actif = true;
    tableauAdmin().then((t) => actif && setTableau(t), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  const onglet = (x: Section, texte: string, icone: NomIcone, nombre?: number) => (
    <button type="button" className={`${s.onglet} ${section === x ? s.ongletActif : ""}`} aria-current={section === x ? "page" : undefined}
      onClick={() => setSection(x)}>
      <Icone nom={icone} taille={16} /> {texte}
      {nombre ? <span className={s.pastille}>{nombre}</span> : null}
    </button>
  );

  return (
    <div className={s.page}>
      <div className={s.contenu}>
        <div className={s.entete}>
          <span className={s.surtitre}>Équipe 360-Immo.ci</span>
          <h1 className={s.titre}>Administration</h1>
          <p className={s.sousTitre}>Vérifiez les annonces avant leur publication et traitez les signalements des visiteurs.</p>
        </div>
        <nav className={s.onglets} aria-label="Administration">
          {onglet("verifier", "À vérifier", "document", tableau?.a_verifier)}
          {onglet("signalements", "Signalements", "bouclier", tableau?.signalees)}
          {onglet("tableau", "Tableau de bord", "statistiques")}
          {onglet("journal", "Journal", "horloge")}
        </nav>
        {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
        {section === "tableau" && (tableau ? <TableauDeBord t={tableau} aller={setSection} /> : <p className={s.attente}>Chargement…</p>)}
        {section === "verifier" && <AVerifier relire={relire} />}
        {section === "signalements" && <Signalements relire={relire} />}
        {section === "journal" && <Journal />}
      </div>
    </div>
  );
}

function TableauDeBord({ t, aller }: { t: Tableau; aller: (s: Section) => void }) {
  const n = formaterPrix;
  const tuile = (titre: string, valeur: number, detail?: string, vers?: Section) => (
    <li className={`${s.tuile} ${vers && valeur ? s.tuileAction : ""}`}>
      <span className={s.tuileTitre}>{titre}</span>
      <span className={s.tuileValeur}>{n(valeur)}</span>
      {detail && <span className={s.tuileDetail}>{detail}</span>}
      {vers && valeur > 0 && <button type="button" className={s.lien} onClick={() => aller(vers)}>Traiter <Icone nom="fleche" taille={13} /></button>}
    </li>
  );
  return (
    <div className={s.tableau}>
      <section aria-labelledby="t-annonces">
        <h2 id="t-annonces" className={s.groupeTitre}>Annonces</h2>
        <ul className={s.tuiles}>
          {tuile("À vérifier", t.a_verifier, t.a_reverifier ? `dont ${t.a_reverifier} déjà publiée${t.a_reverifier > 1 ? "s" : ""}, modifiée${t.a_reverifier > 1 ? "s" : ""}` : undefined, "verifier")}
          {tuile("Signalées", t.signalees, "annonces avec des signalements en attente", "signalements")}
          {tuile("En ligne", t.en_ligne)}
          {tuile("Expirées", t.expirees, "pas renouvelées par leur auteur")}
          {tuile("Refusées ou retirées", t.refusees)}
          {tuile("Brouillons", t.brouillons, "pas encore envoyées")}
        </ul>
      </section>
      <section aria-labelledby="t-comptes">
        <h2 id="t-comptes" className={s.groupeTitre}>Comptes</h2>
        <ul className={s.tuiles}>
          {tuile("Comptes", t.comptes)}
          {tuile("Agences", t.agences)}
          {tuile("Demandes d'agence", t.demandes_agence, "à valider (bientôt dans cet espace)")}
        </ul>
      </section>
      <section aria-labelledby="t-semaine">
        <h2 id="t-semaine" className={s.groupeTitre}>Les 7 derniers jours</h2>
        <ul className={s.tuiles}>
          {tuile("Inscriptions", t.semaine.inscriptions)}
          {tuile("Annonces envoyées", t.semaine.annonces)}
          {tuile("Publiées", t.semaine.publiees)}
          {tuile("Refusées ou retirées", t.semaine.refusees)}
          {tuile("Signalements reçus", t.semaine.signalements)}
        </ul>
      </section>
    </div>
  );
}

function Journal() {
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    journalAdmin().then((l) => actif && setLignes(l), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);
  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!lignes) return <p className={s.attente}>Chargement…</p>;
  if (!lignes.length) return <p className={s.vide}>Aucune décision pour l&apos;instant.</p>;
  return (
    <ul className={s.journal} aria-label="Dernières décisions">
      {lignes.map((l, i) => (
        <li key={`${l.le}-${i}`} className={s.ligneJournal}>
          <span className={`${s.decision} ${s[`decision_${l.decision}`]}`}>{DECISIONS[l.decision]}</span>
          <span className={s.journalTexte}>
            <strong>{l.titre}</strong> <span className={s.ref}>réf. {l.reference}</span>
            {l.motif && <span className={s.motif}>« {l.motif} »</span>}
          </span>
          <span className={s.journalQuand}>{dateHeure(l.le)}{l.par ? ` · ${l.par}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
