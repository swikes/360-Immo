"use client";

/*
 * Mon Espace → Paiements (offres payantes, lib/offres.ts) : le résultat d'un paiement au retour de la page de
 * paiement (/mon-espace?section=paiements&paiement=…), ce qui est payé d'avance (remontées, jours Premium gardés)
 * et l'historique des paiements (reçu de chacun envoyé par e-mail).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { dateComplete, formaterPrix } from "@/lib/format";
import { STATUTS_PAIEMENT, mesOffres, monPaiement, type MesOffres, type Paiement } from "@/lib/offres";
import { relancerEmails } from "@/lib/relance-emails";
import f from "./Formulaire.module.css";
import s from "./MesPaiements.module.css";

export default function MesPaiements({ paiement }: { paiement: string | null }) {
  const [offres, setOffres] = useState<MesOffres | null>(null);
  const [retour, setRetour] = useState<Paiement | null>(null);
  const [erreur, setErreur] = useState("");

  const lire = useCallback(() => Promise.all([mesOffres(), paiement ? monPaiement(paiement) : null]), [paiement]);
  const afficher = ([o, p]: [MesOffres, Paiement | null]) => {
    setOffres(o);
    setRetour(p);
  };
  const charger = () => lire().then(afficher, (e) => setErreur(messageErreur(e)));
  useEffect(() => {
    let actif = true;
    lire().then((x) => actif && afficher(x), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [lire]);
  // Paiement reçu : le reçu part tout de suite par e-mail
  useEffect(() => {
    if (retour?.statut === "payee") relancerEmails();
  }, [retour?.statut]);

  if (erreur) return <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>;
  if (!offres) return <p className={s.attente}>Chargement de vos paiements…</p>;

  return (
    <div className={s.liste}>
      {retour && <Resultat p={retour} relire={charger} />}

      <section className={s.carte} aria-labelledby="titre-avance">
        <h2 id="titre-avance" className={s.carteTitre}>Payé d&apos;avance</h2>
        {offres.remontees === 0 && offres.jours_premium === 0 ? (
          <p className={s.texte}>Rien pour l&apos;instant. Un pack de remontées ou des jours Premium gardés apparaîtront ici.</p>
        ) : (
          <ul className={s.avance}>
            {offres.remontees > 0 && (
              <li>
                <Icone nom="monter" taille={16} />
                <span>
                  <strong>{offres.remontees} remontée{offres.remontees > 1 ? "s" : ""}</strong> à utiliser
                  {offres.remontees_fin ? ` avant le ${dateComplete(offres.remontees_fin)}` : ""} (Mes annonces → « Faire voir mon annonce »)
                </span>
              </li>
            )}
            {offres.jours_premium > 0 && (
              <li>
                <Icone nom="etoile" taille={16} />
                <span>
                  <strong>{offres.jours_premium} jour{offres.jours_premium > 1 ? "s" : ""} Premium</strong> gardés, à mettre sur une
                  autre de vos annonces en ligne
                </span>
              </li>
            )}
          </ul>
        )}
        <Link href="/mon-espace?section=annonces" className={s.lien} onClick={() => window.scrollTo(0, 0)}>Voir mes annonces</Link>
      </section>

      <section className={s.carte} aria-labelledby="titre-historique">
        <h2 id="titre-historique" className={s.carteTitre}>Historique</h2>
        {offres.paiements.length === 0 ? (
          <p className={s.texte}>
            Aucun paiement. Découvrez <Link href="/offres" className={s.lien}>nos offres</Link> pour faire voir vos annonces.
          </p>
        ) : (
          <ul className={s.paiements}>
            {offres.paiements.map((p) => (
              <li key={p.id} className={s.paiement}>
                <div className={s.paiementHaut}>
                  <span className={s.nom}>{p.nom}</span>
                  <span className={s.montant}>{formaterPrix(p.montant)} FCFA</span>
                </div>
                <div className={s.meta}>
                  <span className={`${s.statut} ${s[`statut_${p.statut}`]}`}>{STATUTS_PAIEMENT[p.statut]}</span>
                  <span>{dateComplete(p.payee_le ?? p.cree_le)}</span>
                  {p.annonce?.titre && <span>· {p.annonce.titre}</span>}
                  <span className={s.reference}>· {p.reference}</span>
                </div>
                {p.statut === "payee" && p.resultat && <p className={s.resultat}>{p.resultat}</p>}
                {p.statut === "echouee" && p.erreur && <p className={s.resultat}>{p.erreur}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Ce qui s'est passé pour le paiement d'où l'on revient */
function Resultat({ p, relire }: { p: Paiement; relire: () => void }) {
  if (p.statut === "payee" || p.statut === "remboursee") {
    return (
      <p className={`${f.message} ${f.messageSucces}`} role="status">
        <Icone nom="valide" taille={16} />
        <span>
          <strong>Paiement reçu : {formaterPrix(p.montant)} FCFA</strong> ({p.nom}). {p.resultat} Le reçu vous est envoyé par e-mail.
        </span>
      </p>
    );
  }
  if (p.statut === "echouee") {
    return (
      <p className={`${f.message} ${f.messageErreur}`} role="alert">
        <Icone nom="cadenas" taille={16} />
        <span>
          <strong>Le paiement n&apos;a pas abouti</strong>{p.erreur ? ` (${p.erreur})` : ""} : rien n&apos;a été débité ni changé.
          Vous pouvez réessayer depuis Mes annonces.
        </span>
      </p>
    );
  }
  return (
    <p className={`${f.message} ${f.messageInfo}`} role="status">
      <Icone nom="horloge" taille={16} />
      <span>
        Paiement en attente de confirmation par l&apos;opérateur. Validez-le sur votre téléphone si ce n&apos;est pas fait.{" "}
        <button type="button" className={s.lienBouton} onClick={relire}>Actualiser</button>
      </span>
    </p>
  );
}
