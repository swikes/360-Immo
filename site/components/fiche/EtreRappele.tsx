"use client";

/*
 * « Être rappelé », sur la fiche d'un bien : avec ou sans compte, on laisse son nom, son numéro, le moment où l'on
 * préfère être appelé et un mot facultatif. L'annonceur retrouve la demande dans Mon Espace → Rappels (et la reçoit
 * par e-mail). Même fenêtre que « Planifier une visite » (PlanifierVisite.module.css) : centrée sur ordinateur, qui
 * monte du bas de l'écran sur téléphone.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import ChampTelephone from "@/components/ChampTelephone";
import { ChampTexte } from "@/components/compte/Champs";
import Icone from "@/components/Icone";
import { lireProfil, messageErreur, useCompte } from "@/lib/compte";
import { rafraichirNonLus } from "@/lib/messages";
import { MOMENTS_RAPPEL, demanderRappel, type MomentRappel } from "@/lib/rappels";
import { PAYS_DEFAUT, complet, decomposer, message as messageTelephone, valide } from "@/lib/telephone";
import f from "@/components/compte/Formulaire.module.css";
import s from "./PlanifierVisite.module.css";
import r from "./EtreRappele.module.css";

type Props = { annonce: string; titre: string; nom: string };

export default function EtreRappele({ annonce, titre, nom }: Props) {
  const { etat, utilisateur } = useCompte();
  const boite = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [nomDemandeur, setNomDemandeur] = useState("");
  const [tel, setTel] = useState({ iso: PAYS_DEFAUT.iso, valeur: "" });
  const [moment, setMoment] = useState<MomentRappel>("vite");
  const [mot, setMot] = useState("");
  const [erreurs, setErreurs] = useState<{ nom?: string; tel?: string }>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const prerempli = useRef(false);
  const connecte = etat === "connecte" && !!utilisateur;

  const ouvrir = () => {
    if (envoyee) {
      setEnvoyee(false);
      setMot("");
    }
    setErreur("");
    setOuvert(true);
  };

  useEffect(() => {
    if (ouvert && !boite.current?.open) boite.current?.showModal();
  }, [ouvert]);

  // Avec un compte : nom et numéro du profil (une seule fois, sans écraser ce qui a été tapé)
  useEffect(() => {
    if (!ouvert || !connecte || prerempli.current) return;
    prerempli.current = true;
    lireProfil(utilisateur.id).then(
      (p) => {
        setNomDemandeur((n) => n || [p.prenom, p.nom].filter(Boolean).join(" "));
        if (p.telephone) setTel((t) => (t.valeur ? t : decomposer(p.telephone)));
      },
      () => {},
    );
  }, [ouvert, connecte, utilisateur]);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const err = {
      nom: nomDemandeur.trim().length >= 2 ? undefined : "Indiquez votre prénom et votre nom.",
      tel: valide(tel.valeur, tel.iso) ? undefined : messageTelephone(tel.valeur, tel.iso),
    };
    setErreurs(err);
    setErreur("");
    if (err.nom || err.tel) return;
    setEnvoi(true);
    try {
      await demanderRappel(annonce, { nom: nomDemandeur, telephone: complet(tel.valeur, tel.iso), moment, message: mot });
      setEnvoyee(true);
      if (connecte) rafraichirNonLus();
    } catch (ex) {
      setErreur(messageErreur(ex));
    }
    setEnvoi(false);
  };

  const quand = MOMENTS_RAPPEL[moment];
  return (
    <>
      <button type="button" className={s.ouvrir} onClick={ouvrir}>
        <Icone nom="telephone" taille={18} />
        Être rappelé
      </button>
      {ouvert && (
        <dialog
          ref={boite}
          className={s.boite}
          aria-labelledby={`${id}-titre`}
          onClose={() => setOuvert(false)}
          onClick={(e) => e.target === boite.current && boite.current?.close()}
        >
          <div className={s.contenu}>
            <div className={s.haut}>
              <h2 id={`${id}-titre`} className={s.titre}>Être rappelé</h2>
              <button type="button" className={s.fermer} onClick={() => boite.current?.close()} aria-label="Fermer">
                <Icone nom="fermer" taille={20} />
              </button>
            </div>
            <p className={s.sousTitre}>{titre} · {nom}</p>

            {!envoyee ? (
              <form className={`${s.corps} ${f.formulaire}`} onSubmit={envoyer} noValidate>
                <p className={s.note}>
                  <Icone nom="telephone" taille={14} /> Laissez votre numéro : {nom} vous appelle au moment qui vous arrange.
                </p>
                <ChampTexte etiquette="Prénom et nom" icone="personne" autoComplete="name" valeur={nomDemandeur}
                  onChange={setNomDemandeur} erreur={erreurs.nom} obligatoire maxLength={80} />
                <div className={f.groupe}>
                  <label htmlFor={`${id}-tel`} className={f.etiquette}>
                    Téléphone<span className={f.obligatoire} aria-hidden="true">*</span>
                  </label>
                  <div className={`${s.telephone} ${erreurs.tel ? s.enErreur : ""}`}>
                    <ChampTelephone id={`${id}-tel`} iso={tel.iso} valeur={tel.valeur} onChange={(iso, valeur) => setTel({ iso, valeur })}
                      invalide={!!erreurs.tel} decrit={erreurs.tel ? `${id}-tel-erreur` : undefined} />
                  </div>
                  {erreurs.tel && <p id={`${id}-tel-erreur`} className={f.erreur} role="alert">{erreurs.tel}</p>}
                </div>
                <fieldset className={r.moments}>
                  <legend className={f.etiquette}>Quand vous rappeler ?</legend>
                  <div className={r.choix}>
                    {(Object.keys(MOMENTS_RAPPEL) as MomentRappel[]).map((m) => (
                      <button key={m} type="button" className={`${r.puce} ${m === moment ? r.choisie : ""}`} aria-pressed={m === moment}
                        onClick={() => setMoment(m)}>
                        {MOMENTS_RAPPEL[m].texte}
                        {MOMENTS_RAPPEL[m].heures && <small>{MOMENTS_RAPPEL[m].heures}</small>}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className={f.groupe}>
                  <label htmlFor={`${id}-mot`} className={f.etiquette}>Un mot pour l&apos;annonceur (facultatif)</label>
                  <textarea id={`${id}-mot`} className={s.zone} rows={2} maxLength={500} value={mot} onChange={(e) => setMot(e.target.value)}
                    placeholder="Ex : je cherche à emménager début novembre." />
                </div>
                {erreur && (
                  <p className={`${f.message} ${f.messageErreur}`} role="alert">
                    <Icone nom="telephone" taille={16} />
                    {erreur}
                  </p>
                )}
                <button type="submit" className={s.principal} disabled={envoi}>
                  {envoi ? "Envoi…" : "Demander à être rappelé"}
                </button>
              </form>
            ) : (
              <div className={`${s.corps} ${s.fin}`} role="status">
                <span className={s.rond} aria-hidden="true"><Icone nom="valide" taille={28} /></span>
                <p className={s.finTitre}>Demande envoyée !</p>
                <p className={s.finTexte}>
                  {nom} va vous rappeler au <span className={s.numero}>{complet(tel.valeur, tel.iso)}</span>
                  {moment === "vite" ? " dès que possible." : ` ${quand.texte.charAt(0).toLowerCase()}${quand.texte.slice(1)} (${quand.heures}).`}
                </p>
                <div className={s.boutonsFin}>
                  {connecte && <Link href="/mon-espace?section=rappels" className={s.principal}>Suivre ma demande</Link>}
                  <button type="button" className={s.secondaire} onClick={() => boite.current?.close()}>Fermer</button>
                </div>
              </div>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
