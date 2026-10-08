"use client";

/*
 * Administration → Agences :
 *   Demandes d'agence   la personne, son compte, le nom demandé ; Valider (nouvelle agence, nom modifiable, ou
 *                       rattachement à une agence existante au nom proche) ou Refuser avec un motif (e-mail)
 *   Agences             nom, badge « Vérifiée », contact, comptes rattachés, annonces en ligne, vitrine ; Modifier
 *                       (nom, téléphone, e-mail, badge « Vérifiée » une fois le RCCM contrôlé)
 * Les agences vérifiées qui ont des annonces en ligne apparaissent sur l'accueil.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import {
  agencesAdmin, demandesAgence, modifierAgence, nomCompte, refuserAgence, validerAgence, type Agence, type DemandeAgence,
} from "@/lib/admin";
import { lienVitrine } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { dateJour } from "./outils";
import s from "./Admin.module.css";

export default function Agences({ relire }: { relire: () => void }) {
  const [demandes, setDemandes] = useState<DemandeAgence[] | null>(null);
  const [agences, setAgences] = useState<Agence[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => Promise.all([demandesAgence(), agencesAdmin()]).then(([d, a]) => {
    setDemandes(d);
    setAgences(a);
  }, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    Promise.all([demandesAgence(), agencesAdmin()]).then(([d, a]) => {
      if (!actif) return;
      setDemandes(d);
      setAgences(a);
    }, (e) => actif && setErreur(messageErreur(e)));
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
  if (!demandes || !agences) return <p className={s.attente}>Chargement des agences…</p>;
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      <section aria-labelledby="demandes-agence" className={s.liste}>
        <h2 id="demandes-agence" className={s.groupeTitre}>Demandes d&apos;agence ({demandes.length})</h2>
        {demandes.length === 0 ? (
          <p className={s.aide}>Aucune demande en attente. Une personne demande un compte agence depuis Mon Espace → Mon profil.</p>
        ) : (
          <ul className={s.cartes}>{demandes.map((d) => <CarteDemande key={d.id} d={d} apres={apres} />)}</ul>
        )}
      </section>
      <section aria-labelledby="liste-agences" className={s.liste}>
        <h2 id="liste-agences" className={s.groupeTitre}>Agences ({agences.length})</h2>
        <p className={s.aide}>
          Les agences <strong>vérifiées</strong> qui ont des annonces en ligne apparaissent sur l&apos;accueil, et leurs annonces
          portent le badge « Vérifiée ». Ne donnez ce badge qu&apos;après avoir contrôlé le RCCM de l&apos;agence.
        </p>
        <ul className={s.cartes}>{agences.map((a) => <CarteAgence key={a.id} a={a} apres={apres} />)}</ul>
      </section>
    </div>
  );
}

function CarteDemande({ d, apres }: { d: DemandeAgence; apres: (texte: string) => void }) {
  const id = useId();
  const [mode, setMode] = useState<"" | "valider" | "refuser">("");
  const [choix, setChoix] = useState<string>("nouvelle");   // « nouvelle » ou l'identifiant d'une agence existante
  const [nom, setNom] = useState(d.demande_agence ?? "");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const personne = nomCompte(d);

  const valider = async () => {
    if (mode === "refuser" && motif.trim().length < 5) return setErreur("Écrivez le motif : la personne le recevra par e-mail.");
    if (mode === "valider" && choix === "nouvelle" && nom.trim().length < 2) return setErreur("Indiquez le nom de l'agence.");
    setEnvoi(true);
    setErreur("");
    try {
      if (mode === "valider") {
        await validerAgence(d.id, choix === "nouvelle" ? { nom } : { agence: choix });
        const agence = choix === "nouvelle" ? nom.trim() : d.semblables.find((x) => x.id === choix)?.nom;
        apres(`${personne} est maintenant un compte agence (« ${agence} ») : la personne est prévenue par e-mail.`);
      } else {
        await refuserAgence(d.id, motif);
        apres(`Demande de ${personne} refusée : la personne est prévenue par e-mail.`);
      }
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <h3 id={`${id}-titre`} className={s.carteTitre}>« {d.demande_agence} »</h3>
      <p className={s.meta}>
        Demandée le {dateJour(d.demande_le)} par <strong>{personne}</strong>
        {d.email && <> · <a href={`mailto:${d.email}`}>{d.email}</a></>}
        {d.telephone && <> · <a href={`tel:${d.telephone.replace(/\s/g, "")}`}>{d.telephone}</a></>}
      </p>
      <p className={s.meta}>
        Inscrit le {dateJour(d.inscrit_le)} · {d.annonces_en_ligne} annonce{d.annonces_en_ligne > 1 ? "s" : ""} en ligne
        {d.refus > 0 && <> · <strong className={s.attention}>{d.refus} refus</strong></>}
      </p>
      {d.semblables.length > 0 && (
        <p className={s.meta}>Agence{d.semblables.length > 1 ? "s" : ""} au nom proche : {d.semblables.map((x) => x.nom).join(", ")}</p>
      )}
      {!mode ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonPlein} onClick={() => setMode("valider")}><Icone nom="valide" taille={16} /> Valider…</button>
          <button type="button" className={s.boutonContour} onClick={() => setMode("refuser")}><Icone nom="fermer" taille={16} /> Refuser…</button>
        </div>
      ) : (
        <div className={s.refus}>
          {mode === "valider" ? (
            <fieldset className={s.choix}>
              <legend className={s.etiquette}>Rattacher le compte à</legend>
              <label className={s.option}>
                <input type="radio" name={`${id}-choix`} checked={choix === "nouvelle"} onChange={() => setChoix("nouvelle")} />
                <span>Une nouvelle agence :</span>
                <input type="text" className={s.champ} aria-label="Nom de la nouvelle agence" value={nom} maxLength={120}
                  onChange={(e) => { setNom(e.target.value); setChoix("nouvelle"); }} />
              </label>
              {d.semblables.map((x) => (
                <label key={x.id} className={s.option}>
                  <input type="radio" name={`${id}-choix`} checked={choix === x.id} onChange={() => setChoix(x.id)} />
                  <span>L&apos;agence existante « {x.nom} »</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif du refus (envoyé par e-mail)</label>
              <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex : Nous n'avons pas trouvé cette agence : envoyez-nous son RCCM." />
            </>
          )}
          <div className={s.actions}>
            <button type="button" className={mode === "valider" ? s.boutonPlein : s.boutonDanger} disabled={envoi} onClick={valider}>
              {mode === "valider" ? "Valider le compte agence" : "Refuser la demande"}
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}

function CarteAgence({ a, apres }: { a: Agence; apres: (texte: string) => void }) {
  const id = useId();
  const [modif, setModif] = useState(false);
  const [champs, setChamps] = useState({ nom: a.nom, telephone: a.telephone ?? "", email: a.email ?? "", verifiee: a.verifiee });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await modifierAgence(a.id, champs);
      setModif(false);
      setEnvoi(false);
      apres(`Agence « ${champs.nom.trim()} » enregistrée.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.annonceurLigne}>
        <h3 id={`${id}-titre`} className={s.carteTitre}>{a.nom}</h3>
        <span className={`${s.badge} ${a.verifiee ? s.badgeOk : ""}`}>{a.verifiee ? "Vérifiée" : "Non vérifiée"}</span>
      </div>
      <p className={s.meta}>
        {[a.telephone, a.email].filter(Boolean).join(" · ") || "Pas de contact"} · créée le {dateJour(a.cree_le)}
        {" "}· {a.annonces_en_ligne} annonce{a.annonces_en_ligne > 1 ? "s" : ""} en ligne
        {a.vitrine && <> · <Link href={lienVitrine(a.vitrine)} target="_blank">Voir la vitrine</Link></>}
      </p>
      <p className={s.meta}>
        Compte{a.comptes.length > 1 ? "s" : ""} : {a.comptes.length ? a.comptes.map((c) => `${c.nom}${c.email ? ` (${c.email})` : ""}`).join(", ") : "aucun"}
      </p>
      {!modif ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonContour} onClick={() => setModif(true)}><Icone nom="document" taille={16} /> Modifier…</button>
        </div>
      ) : (
        <div className={s.refus}>
          <div className={s.champs}>
            <label className={s.etiquette}>Nom<input type="text" className={s.champ} value={champs.nom} maxLength={120}
              onChange={(e) => setChamps({ ...champs, nom: e.target.value })} /></label>
            <label className={s.etiquette}>Téléphone<input type="tel" className={s.champ} value={champs.telephone} placeholder="+225 07 48 32 11 90"
              onChange={(e) => setChamps({ ...champs, telephone: e.target.value })} /></label>
            <label className={s.etiquette}>E-mail<input type="email" className={s.champ} value={champs.email}
              onChange={(e) => setChamps({ ...champs, email: e.target.value })} /></label>
          </div>
          <label className={s.case}>
            <input type="checkbox" checked={champs.verifiee} onChange={(e) => setChamps({ ...champs, verifiee: e.target.checked })} />
            <span>Agence vérifiée (RCCM contrôlé par l&apos;équipe)</span>
          </label>
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={enregistrer}>Enregistrer</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setModif(false); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
