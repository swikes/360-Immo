"use client";

/*
 * Mon Espace → Visites : les demandes de visite reçues pour ses annonces et celles qu'on a envoyées.
 *   Reçues : confirmer, proposer un autre créneau (ou, si le visiteur n'a pas de compte, confirmer celui convenu par
 *   téléphone), refuser ; appeler le visiteur ou lui écrire sur WhatsApp.
 *   Envoyées : suivre la réponse, accepter le créneau proposé, annuler.
 *   Une visite confirmée peut être annulée des deux côtés (avec un mot d'explication facultatif).
 * Les visites passées ou annulées sont rangées à part.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChoixCreneau from "@/components/ChoixCreneau";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { rafraichirNonLus } from "@/lib/messages";
import {
  FUSEAU, creneauDe, joursProposes, mesVisites, passe, repondreVisite, texteCreneau, type Action, type Visite,
} from "@/lib/visites";
import f from "./Formulaire.module.css";
import s from "./Visites.module.css";

const enCours = (v: Visite) => (v.statut === "demandee" || v.statut === "confirmee") && !passe(v.creneau);

export default function Visites() {
  const [visites, setVisites] = useState<Visite[] | null>(null);
  const [erreur, setErreur] = useState("");

  const lire = useCallback(async () => {
    try {
      setVisites(await mesVisites());
      setErreur("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    let actif = true;
    mesVisites().then(
      (v) => actif && setVisites(v),
      (e) => actif && setErreur(messageErreur(e)),
    );
    return () => {
      actif = false;
    };
  }, []);

  if (erreur && !visites) {
    return (
      <p className={`${f.message} ${f.messageErreur}`} role="alert">
        <Icone nom="calendrier" taille={16} />
        Vos visites n&apos;ont pas pu être chargées : {erreur}
      </p>
    );
  }
  if (!visites) return <p className={s.attente}>Chargement de vos visites…</p>;
  if (!visites.length) {
    return (
      <div className={s.vide}>
        <Icone nom="calendrier" taille={30} />
        <p>
          Aucune demande de visite pour l&apos;instant. Sur la fiche d&apos;un bien, touchez « Planifier une visite » :
          vous suivrez la réponse ici. Les demandes reçues pour vos annonces arrivent aussi ici.
        </p>
        <Link href="/annonces" className={f.bouton}>Voir les annonces</Link>
      </div>
    );
  }

  const recues = visites.filter((v) => v.role === "annonceur" && enCours(v));
  const envoyees = visites.filter((v) => v.role === "demandeur" && enCours(v));
  const anciennes = visites.filter((v) => !enCours(v)).reverse();
  const carte = (v: Visite) => <CarteVisite key={v.id} v={v} relire={lire} />;
  return (
    <div className={s.visites}>
      {recues.length > 0 && (
        <section className={s.groupe} aria-labelledby="visites-recues">
          <h2 id="visites-recues" className={s.groupeTitre}>Demandes reçues <span className={s.nombre}>{recues.length}</span></h2>
          <ul className={s.liste}>{recues.map(carte)}</ul>
        </section>
      )}
      {envoyees.length > 0 && (
        <section className={s.groupe} aria-labelledby="visites-envoyees">
          <h2 id="visites-envoyees" className={s.groupeTitre}>Mes demandes <span className={s.nombre}>{envoyees.length}</span></h2>
          <ul className={s.liste}>{envoyees.map(carte)}</ul>
        </section>
      )}
      {!recues.length && !envoyees.length && <p className={s.attente}>Aucune visite à venir.</p>}
      {anciennes.length > 0 && (
        <details className={s.anciennes}>
          <summary>Passées et annulées ({anciennes.length})</summary>
          <ul className={s.liste}>{anciennes.map(carte)}</ul>
        </details>
      )}
    </div>
  );
}

type Statut = { texte: string; classe: string };

function statutDe(v: Visite): Statut {
  const annonceur = v.role === "annonceur";
  if (v.statut === "confirmee") return passe(v.creneau) ? { texte: "Visite passée", classe: "" } : { texte: "Confirmée", classe: s.confirmee };
  if (v.statut === "effectuee") return { texte: "Effectuée", classe: "" };
  if (v.statut === "annulee") {
    const parMoi = v.annulee_par === v.role;
    return {
      texte: parMoi ? "Annulée par vous" : annonceur ? "Annulée par le visiteur" : "Annulée par l'annonceur",
      classe: s.annulee,
    };
  }
  if (passe(v.creneau)) return { texte: "Sans réponse", classe: "" };
  if (v.creneau_propose) return annonceur ? { texte: "Autre créneau proposé", classe: s.attenteStatut } : { texte: "Nouveau créneau proposé", classe: s.aTraiter };
  return annonceur ? { texte: "À confirmer", classe: s.aTraiter } : { texte: "En attente de réponse", classe: s.attenteStatut };
}

type Mode = null | "proposer" | "refuser" | "annuler";

function CarteVisite({ v, relire }: { v: Visite; relire: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>(null);
  const [jours] = useState(() => joursProposes());
  const [jour, setJour] = useState(jours[0]);
  const [heure, setHeure] = useState<number | null>(null);
  const [mot, setMot] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const annonceur = v.role === "annonceur";
  const statut = statutDe(v);
  const actif = enCours(v);
  const d = new Date(v.creneau);
  const idTitre = `visite-${v.id}`;

  const agir = async (action: Action, creneau: string | null = null) => {
    setEnvoi(true);
    setErreur("");
    try {
      await repondreVisite(v.id, action, creneau, mot);
      setMode(null);
      setMot("");
      rafraichirNonLus();
      await relire();
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };
  const changerMode = (m: Mode) => {
    setMode(m);
    setMot("");
    setErreur("");
  };

  const message = `Bonjour ${v.nom ?? ""}, je vous contacte au sujet de votre demande de visite sur 360-Immo.ci pour « ${v.annonce.titre} » (réf. ${v.annonce.reference}), ${texteCreneau(v.creneau)}.`;
  const nouveau = jour && heure !== null ? creneauDe(jour, heure) : null;

  return (
    <li className={`${s.visite} ${actif ? "" : s.ancienne}`} aria-labelledby={idTitre}>
      <div className={s.date} aria-hidden="true">
        <span className={s.jourSemaine}>{d.toLocaleDateString("fr-FR", { weekday: "short", timeZone: FUSEAU })}</span>
        <span className={s.jourNombre}>{d.toLocaleDateString("fr-FR", { day: "numeric", timeZone: FUSEAU })}</span>
        <span className={s.mois}>{d.toLocaleDateString("fr-FR", { month: "short", timeZone: FUSEAU })}</span>
        <span className={s.heure}>{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU })}</span>
      </div>
      <div className={s.infos}>
        <div className={s.ligneHaut}>
          <span className={`${s.statut} ${statut.classe}`}>{statut.texte}</span>
          <span className={s.role}>{annonceur ? "Votre annonce" : `Annonceur : ${v.annonceur ?? ""}`}</span>
        </div>
        <h3 id={idTitre} className={s.titre}>
          <span className={s.cache}>Visite du {texteCreneau(v.creneau)} : </span>
          {v.annonce.en_ligne ? <Link href={lienAnnonce(v.annonce)}>{v.annonce.titre}</Link> : v.annonce.titre}
          {!v.annonce.en_ligne && <span className={s.horsLigne}>Plus en ligne</span>}
        </h3>
        <p className={s.quand}><Icone nom="calendrier" taille={14} /> {texteCreneau(v.creneau)}</p>

        {annonceur && (
          <div className={s.visiteur}>
            <span className={s.visiteurNom}>
              <Icone nom="personne" taille={14} /> {v.nom}
              {!v.avec_compte && <span className={s.sansCompte}>sans compte</span>}
            </span>
            {actif && v.telephone && (
              <span className={s.liensContact}>
                <a href={`tel:${v.telephone.replace(/\s/g, "")}`} className={s.lienContact}>
                  <Icone nom="telephone" taille={14} /> {v.telephone}
                </a>
                <a href={`https://wa.me/${v.telephone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener"
                  className={`${s.lienContact} ${s.lienWhatsapp}`}>
                  <IconeWhatsApp /> WhatsApp
                </a>
                {v.email && (
                  <a href={`mailto:${v.email}?subject=${encodeURIComponent(`Visite — ${v.annonce.titre}`)}`} className={s.lienContact}>
                    <Icone nom="email" taille={14} /> {v.email}
                  </a>
                )}
              </span>
            )}
          </div>
        )}
        {v.message && (
          <p className={s.mot}>
            <span className={s.motAuteur}>{annonceur ? "Son message" : "Votre message"} :</span> {v.message}
          </p>
        )}
        {v.creneau_propose && v.statut === "demandee" && (
          <p className={s.propose}>
            <Icone nom="horloge" taille={14} />
            {annonceur ? "Vous avez proposé" : "L'annonceur propose"} : <strong>{texteCreneau(v.creneau_propose)}</strong>
            {annonceur && actif && " — en attente de son accord."}
          </p>
        )}
        {v.reponse && (
          <p className={s.mot}>
            <span className={s.motAuteur}>{annonceur ? "Votre réponse" : "Réponse de l'annonceur"} :</span> {v.reponse}
          </p>
        )}
        {annonceur && actif && !v.avec_compte && v.statut === "demandee" && (
          <p className={s.astuce}>
            {v.nom} n&apos;a pas de compte : votre réponse ne lui parvient que par téléphone ou WhatsApp.
          </p>
        )}

        {actif && mode === null && (
          <div className={s.actions}>
            {annonceur && v.statut === "demandee" && (
              <>
                {!v.creneau_propose && (
                  <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => agir("confirmer")}>
                    <Icone nom="valide" taille={15} /> Confirmer la visite
                  </button>
                )}
                <button type="button" className={s.boutonContour} onClick={() => changerMode("proposer")}>
                  <Icone nom="calendrier" taille={15} /> {v.creneau_propose ? "Changer le créneau proposé" : "Proposer un autre créneau"}
                </button>
                <button type="button" className={s.boutonDiscret} onClick={() => changerMode("refuser")}>Refuser</button>
              </>
            )}
            {!annonceur && v.statut === "demandee" && v.creneau_propose && (
              <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => agir("accepter")}>
                <Icone nom="valide" taille={15} /> Accepter ce créneau
              </button>
            )}
            {(v.statut === "confirmee" || !annonceur) && (
              <button type="button" className={s.boutonDiscret} onClick={() => changerMode("annuler")}>
                {v.statut === "confirmee" ? "Annuler la visite" : "Annuler ma demande"}
              </button>
            )}
          </div>
        )}

        {mode === "proposer" && (
          <div className={s.panneau}>
            <ChoixCreneau jours={jours} jour={jour} heure={heure} onJour={setJour} onHeure={setHeure}
              questions={["Autre jour", "Autre heure"]} />
            <Zone mot={mot} setMot={setMot} etiquette="Un mot pour le visiteur (facultatif)" exemple="Ex : je ne suis pas disponible samedi matin." />
            {!v.avec_compte && (
              <p className={s.astuce}>Sans compte, {v.nom} ne peut pas accepter sur le site : convenez du créneau par téléphone, puis confirmez-le ici.</p>
            )}
            <Erreur erreur={erreur} />
            <div className={s.actions}>
              <button type="button" className={s.boutonPlein} disabled={!nouveau || envoi}
                onClick={() => agir(v.avec_compte ? "proposer" : "confirmer", nouveau)}>
                {v.avec_compte ? "Proposer ce créneau" : "Confirmer ce créneau"}
              </button>
              <button type="button" className={s.boutonDiscret} onClick={() => changerMode(null)}>Retour</button>
            </div>
          </div>
        )}
        {(mode === "refuser" || mode === "annuler") && (
          <div className={s.panneau}>
            <Zone mot={mot} setMot={setMot} etiquette="Raison (facultatif)"
              exemple={mode === "refuser" ? "Ex : le bien vient d'être loué." : "Ex : un empêchement, désolé."} />
            <Erreur erreur={erreur} />
            <div className={s.actions}>
              <button type="button" className={s.boutonDanger} disabled={envoi} onClick={() => agir(mode === "refuser" ? "refuser" : "annuler")}>
                {mode === "refuser" ? "Refuser la demande" : v.statut === "confirmee" ? "Annuler la visite" : "Annuler ma demande"}
              </button>
              <button type="button" className={s.boutonDiscret} onClick={() => changerMode(null)}>Retour</button>
            </div>
          </div>
        )}
        {mode === null && <Erreur erreur={erreur} />}
      </div>
    </li>
  );
}

function Zone({ mot, setMot, etiquette, exemple }: { mot: string; setMot: (m: string) => void; etiquette: string; exemple: string }) {
  return (
    <label className={s.zoneBloc}>
      <span className={s.zoneEtiquette}>{etiquette}</span>
      <textarea className={s.zone} rows={2} maxLength={500} value={mot} onChange={(e) => setMot(e.target.value)} placeholder={exemple} />
    </label>
  );
}

function Erreur({ erreur }: { erreur: string }) {
  if (!erreur) return null;
  return (
    <p className={`${f.message} ${f.messageErreur}`} role="alert">
      <Icone nom="calendrier" taille={16} />
      {erreur}
    </p>
  );
}
