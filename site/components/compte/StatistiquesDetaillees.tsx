"use client";

/*
 * Mon Espace → Statistiques, pour les comptes agence (si les offres payantes sont ouvertes) :
 *   agence abonnée   d'où viennent les visiteurs de ses annonces (page du site, Google, Facebook, WhatsApp…), au total
 *                    et annonce par annonce ; export de tous les chiffres de la période (fichier CSV pour Excel)
 *   sans abonnement  ce que l'abonnement apporterait
 * Les sources se comptent sans cookie, comme l'audience du site (lib/mesure.ts), depuis l'étape 8b.
 */
import { useEffect, useState } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { telechargerCsv } from "@/lib/export-csv";
import { formaterPrix } from "@/lib/format";
import { SOURCES_VUES, statistiquesDetaillees, type SourceVue, type StatistiquesDetaillees as Detail } from "@/lib/offres";
import type { Statistiques } from "@/lib/statistiques";
import f from "./Formulaire.module.css";
import s from "./Statistiques.module.css";

export default function StatistiquesDetaillees({ periode, stats, abonnement }: {
  periode: number; stats: Statistiques; abonnement: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    statistiquesDetaillees(periode).then(
      (x) => {
        if (!actif) return;
        setD(x);
        setRefus(false);
      },
      (e) => {
        if (!actif) return;
        const m = messageErreur(e);
        if (/abonnement agence/.test(m)) setRefus(true);
        else setErreur(m);
      },
    );
    return () => {
      actif = false;
    };
  }, [periode]);

  if (refus) {
    return (
      <section className={`${s.carte} ${s.offre}`} aria-labelledby="stats-sources">
        <h2 id="stats-sources" className={s.carteTitre}><Icone nom="etoile" taille={16} /> D&apos;où viennent vos visiteurs ?</h2>
        <p className={s.carteTexte}>
          Avec l&apos;abonnement agence : d&apos;où viennent les visiteurs de chaque annonce (Google, Facebook, WhatsApp, la liste du
          site…), l&apos;export de vos chiffres pour Excel, le suivi de vos contacts et des remontées incluses chaque mois.
        </p>
        <button type="button" className={s.lienOffre} onClick={abonnement}>Voir l&apos;abonnement agence</button>
      </section>
    );
  }
  if (erreur) return <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>;
  if (!d) return null;

  const total = d.sources.reduce((n, x) => n + x.vues, 0);
  const exporter = () => {
    const sources = Object.keys(SOURCES_VUES) as SourceVue[];
    telechargerCsv(`statistiques-360-immo-${d.du}-au-${d.au}.csv`, [
      ["Référence", "Annonce", "Vues", "Numéros affichés", "Appels", "WhatsApp", "E-mails", "Messages", "Visites", "Rappels",
        "Favoris", "Envois par les alertes", ...sources.map((x) => `Vues : ${SOURCES_VUES[x]}`)],
      ...stats.annonces.map((a) => [a.reference, a.titre, a.vues, a.numeros, a.appels, a.whatsapp, a.emails, a.messages, a.visites,
        a.rappels, a.favoris, a.alertes, ...sources.map((x) => d.annonces[a.id]?.[x] ?? 0)]),
    ]);
  };
  return (
    <section className={s.carte} aria-labelledby="stats-sources">
      <div className={s.carteHaut}>
        <h2 id="stats-sources" className={s.carteTitre}>D&apos;où viennent vos visiteurs</h2>
        <button type="button" className={s.exporter} onClick={exporter}>
          <Icone nom="document" taille={14} /> Exporter mes chiffres (Excel)
        </button>
      </div>
      {total === 0 ? (
        <p className={s.carteTexte}>Pas encore de vue avec sa source sur la période.</p>
      ) : (
        <ul className={s.sources} aria-label="Vues par source">
          {d.sources.map((x) => (
            <li key={x.source}>
              <span className={s.sourceNom}>{SOURCES_VUES[x.source]}</span>
              <span className={s.sourceBarre} aria-hidden="true"><span style={{ width: `${Math.max(2, (x.vues / total) * 100)}%` }} /></span>
              <span className={s.sourceNombre}>{formaterPrix(x.vues)} <small>({Math.round((x.vues / total) * 100)} %)</small></span>
            </li>
          ))}
        </ul>
      )}
      {Object.keys(d.annonces).length > 0 && (
        <details className={s.tableau}>
          <summary>Voir annonce par annonce</summary>
          <ul className={s.sourcesAnnonces}>
            {stats.annonces.filter((a) => d.annonces[a.id]).map((a) => (
              <li key={a.id}>
                <strong>{a.titre}</strong>
                <span>
                  {Object.entries(d.annonces[a.id]).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
                    .map(([src, n]) => `${SOURCES_VUES[src as SourceVue]} : ${n}`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className={s.carteAide}>
        Sans cookie : une vue n&apos;a pas de source quand le navigateur demande à ne pas être suivi. Le numéro de celui qui
        appelle n&apos;est jamais connu du site.
      </p>
    </section>
  );
}
