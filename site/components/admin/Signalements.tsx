"use client";

/*
 * Administration → Signalements : les annonces signalées par les visiteurs, les plus signalées d'abord, avec chaque
 * raison et message. Retirer l'annonce (motif lu par l'annonceur), ou classer les signalements (rien à reprocher ;
 * note pour l'équipe, facultative).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import { MOTIFS_SIGNALEMENT, annoncesSignalees, traiterSignalements, type AnnonceSignalee } from "@/lib/admin";
import { prixTexte } from "@/lib/annonces";
import { lienAnnonce, urlPhotoPublique } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { dateHeure } from "./outils";
import s from "./Admin.module.css";

export default function Signalements({ relire }: { relire: () => void }) {
  const [liste, setListe] = useState<AnnonceSignalee[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  useEffect(() => {
    let actif = true;
    annoncesSignalees().then((l) => actif && setListe(l), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  const traite = useCallback((x: AnnonceSignalee, texte: string) => {
    setListe((l) => l && l.filter((y) => y.annonce.id !== x.annonce.id));
    setFait(texte);
    relire();
  }, [relire]);

  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!liste) return <p className={s.attente}>Chargement des signalements…</p>;
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      {liste.length === 0 ? (
        <div className={s.vide}>
          <Icone nom="bouclier" taille={28} />
          <p>Aucun signalement en attente.</p>
        </div>
      ) : (
        <ul className={s.cartes}>
          {liste.map((x) => <Carte key={x.annonce.id} x={x} traite={traite} />)}
        </ul>
      )}
    </div>
  );
}

function Carte({ x, traite }: { x: AnnonceSignalee; traite: (x: AnnonceSignalee, texte: string) => void }) {
  const id = useId();
  const a = x.annonce;
  const [mode, setMode] = useState<"" | "retirer" | "classer">("");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const ouvrir = (m: "retirer" | "classer") => {
    setMode(m);
    setErreur("");
    // Retirer : motif préparé d'après la raison la plus citée, à compléter
    if (m === "retirer" && !motif) setMotif(`Annonce signalée : ${MOTIFS_SIGNALEMENT[x.signalements[0].motif].texte.toLowerCase()}.`);
  };
  const valider = async () => {
    if (mode === "retirer" && motif.trim().length < 5) return setErreur("Écrivez le motif : l'annonceur le lira.");
    setEnvoi(true);
    setErreur("");
    try {
      await traiterSignalements(a.id, mode as "retirer" | "classer", motif);
      traite(x, mode === "retirer" ? `« ${a.titre} » est retirée du site : l'annonceur est prévenu.` : `Signalements de « ${a.titre} » classés.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.signaleHaut}>
        <span className={s.vignette}>
          {a.photo ? <PhotoCadree src={urlPhotoPublique(a.photo)} /> : <Icone nom="maison" taille={22} />}
        </span>
        <div className={s.signaleTexte}>
          <h2 id={`${id}-titre`} className={s.carteTitre}>
            {a.en_ligne ? <Link href={lienAnnonce(a)} target="_blank">{a.titre}</Link> : a.titre}
          </h2>
          <p className={s.meta}>
            {prixTexte(a.prix, a.loyer_par)} · {a.commune} · réf. {a.reference} · {a.annonceur}
            {a.contact_telephone && <> · <a href={`tel:${a.contact_telephone.replace(/\s/g, "")}`}>{a.contact_telephone}</a></>}
          </p>
          {!a.en_ligne && <span className={s.badge}>Plus en ligne</span>}
        </div>
        <span className={`${s.badge} ${s.badgeAlerte}`}>{x.nombre} signalement{x.nombre > 1 ? "s" : ""}</span>
      </div>
      <ul className={s.signalements} aria-label="Signalements">
        {x.signalements.map((g, i) => (
          <li key={i}>
            <strong>{MOTIFS_SIGNALEMENT[g.motif].texte}</strong>
            {g.message && <span className={s.message}>« {g.message} »</span>}
            <span className={s.meta}>{dateHeure(g.le)} · {g.avec_compte ? "avec un compte" : "sans compte"}</span>
          </li>
        ))}
      </ul>
      {!mode ? (
        <div className={s.actions}>
          {a.en_ligne && (
            <button type="button" className={s.boutonDanger} onClick={() => ouvrir("retirer")}>
              <Icone nom="fermer" taille={16} /> Retirer l&apos;annonce…
            </button>
          )}
          <button type="button" className={s.boutonContour} onClick={() => ouvrir("classer")}>
            <Icone nom="valide" taille={16} /> Rien à reprocher : classer…
          </button>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>
            {mode === "retirer" ? "Motif du retrait (l'annonceur le lit et peut corriger son annonce)" : "Note pour l'équipe (facultative)"}
          </label>
          <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder={mode === "retirer" ? "Ex : Arnaque confirmée : argent demandé avant la visite." : "Ex : Vérifiée par téléphone avec l'annonceur."} />
          <div className={s.actions}>
            <button type="button" className={mode === "retirer" ? s.boutonDanger : s.boutonPlein} disabled={envoi} onClick={valider}>
              {mode === "retirer" ? "Retirer l'annonce" : "Classer les signalements"}
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
