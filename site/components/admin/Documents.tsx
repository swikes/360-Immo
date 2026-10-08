"use client";

/*
 * Administration → Documents : les demandes de vérification envoyées depuis Mon Espace → Vérification.
 *   Identité   pièce d'identité (recto, verso) et photo de la personne tenant la pièce
 *   Agence     RCCM et logo de l'agence
 *   Bien       titre de propriété ou mandat d'une annonce
 * Chaque document s'ouvre par un lien valable 10 minutes (dossier privé). Valider donne le badge ; Refuser demande un
 * motif, que la personne reçoit par e-mail. Dans les deux cas, les documents sont ensuite supprimés du dossier privé.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import { nomCompte } from "@/lib/admin";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { taille } from "@/lib/photos";
import {
  demandesVerification, liensDocuments, MOTIFS_REFUS_DOCUMENTS, NOM_PIECE, traiterVerification, type DemandeVerification,
} from "@/lib/verifications";
import { dateHeure, dateJour } from "./outils";
import s from "./Admin.module.css";

const SUJETS = { identite: "Identité", agence: "Agence", bien: "Bien" } as const;

export default function Documents({ relire }: { relire: () => void }) {
  const [demandes, setDemandes] = useState<DemandeVerification[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => demandesVerification().then(setDemandes, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    demandesVerification().then((d) => actif && setDemandes(d), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);
  const apres = (texte: string) => {
    setFait(texte);
    relire();
    void charger();
  };

  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!demandes) return <p className={s.attente}>Chargement des documents…</p>;
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      <p className={s.aide}>
        Ouvrez chaque document et comparez-le au compte : nom, photo, validité de la pièce ; nom de l&apos;agence sur le RCCM ;
        lieu et superficie du bien sur le titre. Les documents sont supprimés dès votre décision : ne les enregistrez pas ailleurs.
      </p>
      {demandes.length === 0 ? (
        <p className={s.vide}>Aucun document à vérifier.</p>
      ) : (
        <ul className={s.cartes}>{demandes.map((d) => <CarteDemande key={d.id} d={d} apres={apres} />)}</ul>
      )}
    </div>
  );
}

function CarteDemande({ d, apres }: { d: DemandeVerification; apres: (texte: string) => void }) {
  const id = useId();
  const [liens, setLiens] = useState<Record<string, string> | null>(null);
  const [erreurLiens, setErreurLiens] = useState("");
  const [mode, setMode] = useState<"" | "valider" | "refuser">("");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const personne = nomCompte(d.compte);
  const sujet = d.type === "identite" ? personne : d.type === "agence" ? `« ${d.agence ?? ""} »` : `« ${d.annonce?.titre ?? ""} »`;

  useEffect(() => {
    let actif = true;
    liensDocuments(d.fichiers).then((l) => actif && setLiens(l), (e) => actif && setErreurLiens(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [d.fichiers]);

  const decider = async () => {
    if (mode === "refuser" && motif.trim().length < 5) return setErreur("Écrivez le motif : la personne le recevra par e-mail.");
    setEnvoi(true);
    setErreur("");
    try {
      await traiterVerification(d, mode === "valider" ? "valider" : "refuser", motif);
      apres(mode === "valider"
        ? `${SUJETS[d.type]} ${sujet} : vérification validée, badge donné. ${personne} est prévenu(e) par e-mail ; les documents sont supprimés.`
        : `${SUJETS[d.type]} ${sujet} : vérification refusée. ${personne} reçoit le motif par e-mail ; les documents sont supprimés.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.badges}><span className={`${s.badge} ${s.badgeInfo}`}>{SUJETS[d.type]}</span></div>
      <h3 id={`${id}-titre`} className={s.carteTitre}>
        {d.type === "bien" && d.annonce ? (
          d.annonce.en_ligne ? <Link href={lienAnnonce(d.annonce)} target="_blank">{d.annonce.titre}</Link> : d.annonce.titre
        ) : d.type === "agence" ? `Agence « ${d.agence ?? ""} »` : personne}
      </h3>
      {d.annonce && (
        <p className={s.meta}>
          Réf. {d.annonce.reference}{d.annonce.commune ? ` · ${d.annonce.commune}` : ""} · {d.annonce.en_ligne ? "en ligne" : "en vérification"}
        </p>
      )}
      <p className={s.meta}>
        Envoyée le {dateHeure(d.cree_le)} par <strong>{personne}</strong>
        {d.compte.email && <> · <a href={`mailto:${d.compte.email}`}>{d.compte.email}</a></>}
        {d.compte.telephone && <> · <a href={`tel:${d.compte.telephone.replace(/\s/g, "")}`}>{d.compte.telephone}</a></>}
      </p>
      <p className={s.meta}>
        Inscrit le {dateJour(d.compte.inscrit_le)} · {d.compte.annonces_en_ligne} annonce{d.compte.annonces_en_ligne > 1 ? "s" : ""} en ligne
        {d.compte.refus > 0 && <> · <strong className={s.attention}>{d.compte.refus} refus</strong></>}
        {d.compte.signalements > 0 && <> · <strong className={s.attention}>{d.compte.signalements} signalement{d.compte.signalements > 1 ? "s" : ""}</strong></>}
      </p>
      {d.note && <p className={s.description}>« {d.note} »</p>}

      <ul className={s.documents} aria-label="Documents envoyés">
        {d.fichiers.map((x) => {
          const lien = liens?.[x.chemin];
          const image = x.type.startsWith("image/");
          return (
            <li key={x.chemin} className={s.document}>
              <span className={s.documentNom}>{NOM_PIECE[x.piece] ?? x.piece}</span>
              {!lien ? (
                <span className={s.documentApercu}>{erreurLiens ? "Lien indisponible" : "…"}</span>
              ) : image ? (
                <a href={lien} target="_blank" rel="noopener" className={s.documentApercu} aria-label={`Ouvrir : ${NOM_PIECE[x.piece] ?? x.piece}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lien} alt="" />
                </a>
              ) : (
                <a href={lien} target="_blank" rel="noopener" className={`${s.documentApercu} ${s.documentPdf}`}>
                  <Icone nom="document" taille={26} /> Ouvrir le PDF
                </a>
              )}
              <span className={s.documentDetail}>{x.nom} · {taille(x.taille)}</span>
            </li>
          );
        })}
      </ul>
      {erreurLiens && <p className={s.erreur} role="alert">Les documents n&apos;ont pas pu être ouverts : {erreurLiens}</p>}

      {!mode ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonPlein} onClick={() => setMode("valider")}><Icone nom="valide" taille={16} /> Valider…</button>
          <button type="button" className={s.boutonContour} onClick={() => setMode("refuser")}><Icone nom="fermer" taille={16} /> Refuser…</button>
        </div>
      ) : mode === "valider" ? (
        <div className={s.confirmation}>
          <span>
            {d.type === "identite" ? `Confirmer l'identité de ${personne} ?` : d.type === "agence" ? `Donner le badge « Agence vérifiée » à ${sujet}${d.fichiers.some((x) => x.piece === "logo") ? " et afficher son logo" : ""} ?` : `Donner le badge « Bien vérifié » à ${sujet} ?`}
          </span>
          <button type="button" className={s.boutonPlein} disabled={envoi} onClick={decider}>Oui, valider</button>
          <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setMode("")}>Non</button>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif du refus (envoyé par e-mail : la personne renvoie les bons documents)</label>
          <div className={s.puces} role="group" aria-label="Motifs courants">
            {MOTIFS_REFUS_DOCUMENTS[d.type].map((m) => (
              <button key={m} type="button" className={s.puce} onClick={() => setMotif(m)}>{m.split(" :")[0]}</button>
            ))}
          </div>
          <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Photo floue : on doit pouvoir lire toute la pièce." />
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi} onClick={decider}>Refuser la vérification</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
