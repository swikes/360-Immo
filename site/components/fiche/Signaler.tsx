"use client";

/*
 * « Signaler cette annonce », sur la fiche d'un bien, avec ou sans compte : arnaque, bien déjà loué ou vendu, photos
 * trompeuses, prix faux, doublon, autre (avec quelques mots). L'équipe 360-Immo.ci la retrouve dans l'espace
 * Administration → Signalements (lib/admin.ts). Même fenêtre que « Planifier une visite » (PlanifierVisite.module.css).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { MOTIFS_SIGNALEMENT, signalerAnnonce, type MotifSignalement } from "@/lib/admin";
import { messageErreur } from "@/lib/compte";
import f from "@/components/compte/Formulaire.module.css";
import v from "./PlanifierVisite.module.css";
import s from "./Signaler.module.css";

export default function Signaler({ annonce, titre }: { annonce: string; titre: string }) {
  const boite = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<MotifSignalement | null>(null);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);

  useEffect(() => {
    if (ouvert && !boite.current?.open) boite.current?.showModal();
  }, [ouvert]);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    if (!motif) return setErreur("Choisissez la raison du signalement.");
    if (motif === "autre" && message.trim().length < 10) return setErreur("Dites en quelques mots ce qui ne va pas.");
    setEnvoi(true);
    setErreur("");
    try {
      await signalerAnnonce(annonce, motif, message);
      setEnvoye(true);
    } catch (ex) {
      setErreur(messageErreur(ex));
    }
    setEnvoi(false);
  };

  return (
    <>
      <button type="button" className={s.ouvrir} onClick={() => setOuvert(true)} disabled={envoye}>
        <Icone nom="bouclier" taille={14} /> {envoye ? "Annonce signalée, merci" : "Signaler cette annonce"}
      </button>
      {ouvert && (
        <dialog ref={boite} className={v.boite} aria-labelledby={`${id}-titre`} onClose={() => setOuvert(false)}
          onClick={(e) => e.target === boite.current && boite.current?.close()}>
          <div className={v.contenu}>
            <div className={v.haut}>
              <h2 id={`${id}-titre`} className={v.titre}>Signaler cette annonce</h2>
              <button type="button" className={v.fermer} onClick={() => boite.current?.close()} aria-label="Fermer">
                <Icone nom="fermer" taille={20} />
              </button>
            </div>
            <p className={v.sousTitre}>{titre}</p>
            {!envoye ? (
              <form className={`${v.corps} ${f.formulaire}`} onSubmit={envoyer} noValidate>
                <fieldset className={s.motifs}>
                  <legend className={f.etiquette}>Que se passe-t-il ?</legend>
                  {(Object.keys(MOTIFS_SIGNALEMENT) as MotifSignalement[]).map((m) => (
                    <label key={m} className={`${s.motif} ${motif === m ? s.motifChoisi : ""}`}>
                      <input type="radio" name={`${id}-motif`} value={m} checked={motif === m} onChange={() => { setMotif(m); setErreur(""); }} />
                      <span>
                        <strong>{MOTIFS_SIGNALEMENT[m].texte}</strong>
                        <small>{MOTIFS_SIGNALEMENT[m].aide}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className={f.groupe}>
                  <label htmlFor={`${id}-message`} className={f.etiquette}>
                    Précisions {motif === "autre" ? "" : "(facultatif)"}
                  </label>
                  <textarea id={`${id}-message`} className={v.zone} rows={3} maxLength={1000} value={message}
                    onChange={(e) => setMessage(e.target.value)} placeholder="Ex : on m'a demandé de payer avant la visite." />
                </div>
                <p className={v.note}>
                  <Icone nom="bouclier" taille={14} /> L&apos;annonceur ne sait pas qui a signalé son annonce. Ne versez jamais
                  d&apos;argent avant d&apos;avoir visité le bien et vérifié les documents.
                </p>
                {erreur && (
                  <p className={`${f.message} ${f.messageErreur}`} role="alert">
                    <Icone nom="bouclier" taille={16} />
                    {erreur}
                  </p>
                )}
                <button type="submit" className={v.principal} disabled={envoi}>{envoi ? "Envoi…" : "Envoyer le signalement"}</button>
              </form>
            ) : (
              <div className={`${v.corps} ${v.fin}`} role="status">
                <span className={v.rond} aria-hidden="true"><Icone nom="valide" taille={28} /></span>
                <p className={v.finTitre}>Merci !</p>
                <p className={v.finTexte}>L&apos;équipe 360-Immo.ci va vérifier cette annonce et la retirer si besoin.</p>
                <div className={v.boutonsFin}>
                  <button type="button" className={v.secondaire} onClick={() => boite.current?.close()}>Fermer</button>
                </div>
              </div>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
