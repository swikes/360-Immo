"use client";

/*
 * Page de paiement simulée (essais seulement, jamais sur le site en ligne : lib/paiements-serveur.ts). Elle imite
 * la page de l'agrégateur : choix de l'opérateur, puis « payé » ou « refusé » ; le serveur du site donne la réponse
 * à la base (app/api/paiements/simulation), et l'on revient à Mon Espace → Paiements.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Icone from "@/components/Icone";
import { messageErreur, useCompte } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { monPaiement, type Paiement } from "@/lib/offres";
import f from "@/components/compte/Formulaire.module.css";
import p from "@/components/compte/Page.module.css";
import s from "./PaiementSimule.module.css";

const MOYENS = ["Orange Money", "MTN MoMo", "Moov Money", "Wave"];

export default function PaiementSimule() {
  return (
    <Suspense fallback={null}>
      <Simulation />
    </Suspense>
  );
}

function Simulation() {
  const id = useSearchParams().get("paiement") ?? "";
  const { etat } = useCompte();
  const router = useRouter();
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [moyen, setMoyen] = useState(MOYENS[3]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (etat !== "connecte" || !id) return;
    monPaiement(id).then((x) => (x ? setPaiement(x) : setErreur("Paiement introuvable.")), (e) => setErreur(messageErreur(e)));
  }, [etat, id]);

  const repondre = async (issue: "payee" | "echouee") => {
    setEnvoi(true);
    setErreur("");
    const r = await fetch("/api/paiements/simulation", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paiement: id, issue, moyen }),
    }).catch(() => null);
    if (!r?.ok) {
      const corps = (await r?.json().catch(() => null)) as { message?: string } | null;
      setErreur(corps?.message ?? "Le paiement simulé n'a pas pu être enregistré.");
      setEnvoi(false);
      return;
    }
    router.replace(`/mon-espace?section=paiements&paiement=${encodeURIComponent(id)}`);
  };

  return (
    <section className={p.page}>
      <div className={`${p.carte} ${s.carte}`}>
        <span className={s.essai}><Icone nom="cadenas" taille={14} /> Paiement simulé — mode essai, aucun argent n&apos;est débité</span>
        <h1 className={p.titre}>Payer par Mobile Money</h1>
        {etat === "anonyme" && <p className={p.attente}>Connectez-vous pour payer.</p>}
        {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
        {paiement && (
          <>
            <dl className={s.recap}>
              <div><dt>Offre</dt><dd>{paiement.nom}</dd></div>
              {paiement.annonce?.titre && <div><dt>Annonce</dt><dd>{paiement.annonce.titre}</dd></div>}
              <div><dt>Montant</dt><dd className={s.montant}>{formaterPrix(paiement.montant)} FCFA</dd></div>
              <div><dt>Référence</dt><dd>{paiement.reference}</dd></div>
            </dl>
            {paiement.statut === "en_attente" ? (
              <>
                <fieldset className={s.moyens}>
                  <legend className={f.etiquette}>Opérateur</legend>
                  {MOYENS.map((m) => (
                    <label key={m} className={`${s.moyen} ${moyen === m ? s.moyenChoisi : ""}`}>
                      <input type="radio" name="moyen" value={m} checked={moyen === m} onChange={() => setMoyen(m)} /> {m}
                    </label>
                  ))}
                </fieldset>
                <button type="button" className={f.bouton} disabled={envoi} onClick={() => repondre("payee")}>
                  Valider le paiement de {formaterPrix(paiement.montant)} FCFA
                </button>
                <button type="button" className={f.boutonContour} disabled={envoi} onClick={() => repondre("echouee")}>
                  Simuler un refus (solde insuffisant)
                </button>
              </>
            ) : (
              <button type="button" className={f.bouton} onClick={() => router.replace(`/mon-espace?section=paiements&paiement=${encodeURIComponent(id)}`)}>
                Voir le résultat
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
