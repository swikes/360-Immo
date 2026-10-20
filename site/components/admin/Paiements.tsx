"use client";

/*
 * Administration → Paiements (offres payantes : supabase/migrations/…_offres.sql) : encaissé sur la période, par offre,
 * paiements échoués ; la liste des paiements (qui, quelle annonce, opérateur, référence chez l'agrégateur, ce qui a été
 * appliqué). Rembourser : l'argent se rend chez l'agrégateur ; ici, on le note avec le motif (ce qui reste de l'offre
 * est retiré, l'action va au journal).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { STATUTS_PAIEMENT, rembourser, tableauPaiements, type CleOffre, type PaiementEquipe, type TableauPaiements } from "@/lib/offres";
import { dateHeure } from "./outils";
import s from "./Admin.module.css";

const PERIODES = [7, 30, 90, 365];
const fcfa = (n: number) => `${formaterPrix(n)} FCFA`;

export default function Paiements() {
  const [jours, setJours] = useState(30);
  const [t, setT] = useState<TableauPaiements | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback((j: number) => tableauPaiements(j).then(setT, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    tableauPaiements(jours).then((x) => actif && setT(x), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [jours]);

  if (!t) return erreur ? <p className={s.erreur} role="alert">{erreur}</p> : <p className={s.attente}>Chargement des paiements…</p>;
  // une tuile par offre (ou groupe d'offres : les 3 formules d'abonnement, les 2 prix de « Bien visité »)
  const offre = (cles: CleOffre[], nom: string) => {
    const nombre = cles.reduce((n, c) => n + (t.par_offre[c]?.nombre ?? 0), 0);
    const montant = cles.reduce((n, c) => n + (t.par_offre[c]?.montant ?? 0), 0);
    return (
      <li className={s.tuile}>
        <span className={s.tuileTitre}>{nom}</span>
        <span className={s.tuileValeur}>{nombre}</span>
        <span className={s.tuileDetail}>{fcfa(montant)}</span>
      </li>
    );
  };
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      <div className={s.puces} role="group" aria-label="Période">
        {PERIODES.map((j) => (
          <button key={j} type="button" className={s.puce} aria-pressed={jours === j} onClick={() => setJours(j)}>
            {j === 365 ? "12 mois" : `${j} jours`}
          </button>
        ))}
      </div>
      <ul className={s.tuiles} aria-label="En bref">
        <li className={s.tuile}>
          <span className={s.tuileTitre}>Encaissé</span>
          <span className={s.tuileValeur}>{formaterPrix(t.encaisse)}</span>
          <span className={s.tuileDetail}>FCFA · {t.nombre} paiement{t.nombre > 1 ? "s" : ""}</span>
        </li>
        {offre(["remontee", "remontee_sup"], "Remontées")}
        {offre(["remontees_3"], "Packs de 3 remontées")}
        {offre(["premium_30"], "Premium 30 jours")}
        {offre(["agence_20", "agence_60", "agence_200"], "Abonnements agences")}
        {offre(["bien_visite", "bien_visite_plus"], "Bien visité")}
        <li className={s.tuile}>
          <span className={s.tuileTitre}>Remboursé</span>
          <span className={s.tuileValeur}>{formaterPrix(t.rembourse)}</span>
          <span className={s.tuileDetail}>FCFA</span>
        </li>
        <li className={s.tuile}>
          <span className={s.tuileTitre}>Échoués</span>
          <span className={s.tuileValeur}>{t.echoues}</span>
          <span className={s.tuileDetail}>{t.en_attente} en attente depuis moins d&apos;un jour</span>
        </li>
      </ul>

      <h2 className={s.groupeTitre}>Paiements ({t.paiements.length})</h2>
      {t.paiements.length === 0 ? (
        <p className={s.aide}>Aucun paiement sur la période.</p>
      ) : (
        <ul className={s.cartes}>
          {t.paiements.map((p) => (
            <Carte key={p.id} p={p} rembourse={async (texte) => {
              setFait(texte);
              await charger(jours);
            }} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Carte({ p, rembourse }: { p: PaiementEquipe; rembourse: (texte: string) => Promise<void> }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const valider = async () => {
    if (motif.trim().length < 5) return setErreur("Écrivez le motif du remboursement.");
    setEnvoi(true);
    setErreur("");
    try {
      await rembourser(p.id, motif.trim());
      await rembourse(`Paiement ${p.reference} noté comme remboursé.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };
  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.badges}>
        <span className={`${s.badge} ${p.statut === "echouee" ? s.badgeAlerte : p.statut === "payee" ? "" : s.badgeInfo}`}>
          {STATUTS_PAIEMENT[p.statut]}
        </span>
        {p.fournisseur === "simulation" && <span className={`${s.badge} ${s.badgeInfo}`}>Essai (simulé)</span>}
      </div>
      <h3 id={`${id}-titre`} className={s.carteTitre}>{p.nom} · {fcfa(p.montant)}</h3>
      <p className={s.meta}>
        {dateHeure(p.payee_le ?? p.cree_le)} · {p.reference}
        {p.moyen && <> · {p.moyen}</>}
        {p.transaction && <> · transaction {p.transaction}</>}
      </p>
      <p className={s.meta}>
        {p.compte ? <>{p.compte.nom ?? "Sans nom"}{p.compte.email && <> · <a href={`mailto:${p.compte.email}`}>{p.compte.email}</a></>}
          {p.compte.telephone && <> · <a href={`tel:${p.compte.telephone.replace(/\s/g, "")}`}>{p.compte.telephone}</a></>}</> : "Compte supprimé"}
        {p.annonce?.reference && (
          <> · annonce <Link href={`/annonces/${p.annonce.reference.toLowerCase()}`} target="_blank">{p.annonce.titre} (réf. {p.annonce.reference})</Link></>
        )}
      </p>
      {p.resultat && <p className={s.description}>{p.resultat}</p>}
      {p.erreur && <p className={s.description}>{p.erreur}</p>}
      {p.statut === "remboursee" && (
        <p className={s.meta}>Remboursé le {dateHeure(p.remboursee_le!)}{p.motif_remboursement ? ` : ${p.motif_remboursement}` : ""}</p>
      )}
      {p.statut === "payee" && !ouvert && (
        <div className={s.actions}>
          <button type="button" className={s.boutonContour} onClick={() => setOuvert(true)}>
            <Icone nom="retour" taille={16} /> Noter un remboursement…
          </button>
        </div>
      )}
      {ouvert && (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>
            Motif du remboursement (rendez d&apos;abord l&apos;argent depuis l&apos;espace de l&apos;agrégateur ; ce qui reste de l&apos;offre est retiré)
          </label>
          <textarea id={`${id}-motif`} className={s.zone} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Annonce retirée par erreur, offre non utilisée." />
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi} onClick={valider}>Noter comme remboursé</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}
    </li>
  );
}
