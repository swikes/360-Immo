"use client";

/*
 * Administration → Contact : les messages du formulaire Contact (supabase/migrations/…_pages_contact.sql).
 * Nouvelles demandes d'abord : sujet, personne (avec ou sans compte), e-mail, téléphone (appel, WhatsApp), annonce
 * concernée, message ; « Répondre par e-mail » prépare la réponse ; une fois la réponse faite : « Marquer comme traitée ».
 * Les demandes traitées sont supprimées au bout d'un an. Chaque membre de l'équipe reçoit aussi chaque demande par e-mail.
 */
import { useCallback, useEffect, useState } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { SUJETS_CONTACT, type DemandeContact } from "@/lib/contact";
import { demandesContact, traiterContact } from "@/lib/pages-admin";
import { dateHeure } from "./outils";
import s from "./Admin.module.css";

export default function Contacts({ relire }: { relire: () => void }) {
  const [demandes, setDemandes] = useState<DemandeContact[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => demandesContact().then(setDemandes, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    demandesContact().then((d) => actif && setDemandes(d), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  const traiter = async (d: DemandeContact, traitee: boolean) => {
    setErreur("");
    try {
      await traiterContact(d.id, traitee);
      setFait(traitee ? `Demande de ${d.nom} marquée comme traitée.` : `Demande de ${d.nom} remise parmi les nouvelles.`);
      relire();
      await charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };

  if (!demandes) return erreur ? <p className={s.erreur} role="alert">{erreur}</p> : <p className={s.attente}>Chargement des demandes…</p>;
  const nouvelles = demandes.filter((d) => d.statut === "nouvelle");
  const traitees = demandes.filter((d) => d.statut === "traitee");
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      <section aria-labelledby="contact-nouvelles" className={s.liste}>
        <h2 id="contact-nouvelles" className={s.groupeTitre}>Nouvelles demandes ({nouvelles.length})</h2>
        {nouvelles.length === 0 ? (
          <p className={s.aide}>Aucune nouvelle demande. Les visiteurs vous écrivent depuis la page Contact (lien en bas de chaque page).</p>
        ) : (
          <ul className={s.cartes}>{nouvelles.map((d) => <Carte key={d.id} d={d} traiter={traiter} />)}</ul>
        )}
      </section>
      {traitees.length > 0 && (
        <section aria-labelledby="contact-traitees" className={s.liste}>
          <h2 id="contact-traitees" className={s.groupeTitre}>Traitées récemment ({traitees.length})</h2>
          <p className={s.aide}>Elles sont supprimées un an après avoir été traitées.</p>
          <ul className={s.cartes}>{traitees.map((d) => <Carte key={d.id} d={d} traiter={traiter} />)}</ul>
        </section>
      )}
    </div>
  );
}

function Carte({ d, traiter }: { d: DemandeContact; traiter: (d: DemandeContact, traitee: boolean) => void }) {
  const sujet = SUJETS_CONTACT[d.sujet] ?? SUJETS_CONTACT.autre;
  const reponse = `mailto:${d.email}?subject=${encodeURIComponent(`Re : ${sujet} — 360-Immo.ci`)}`;
  return (
    <li className={s.carte} aria-labelledby={`contact-${d.id}`}>
      <div className={s.badges}>
        <span className={`${s.badge} ${d.sujet === "arnaque" ? s.badgeAlerte : d.sujet === "donnees" ? s.badgeInfo : ""}`}>{sujet}</span>
        {d.avec_compte && <span className={s.badge}>A un compte</span>}
      </div>
      <h3 id={`contact-${d.id}`} className={s.carteTitre}>{d.nom}</h3>
      <p className={s.meta}>
        Reçue le {dateHeure(d.cree_le)}
        {d.email && <> · <a href={`mailto:${d.email}`}>{d.email}</a></>}
        {d.telephone && (
          <> · <a href={`tel:${d.telephone.replace(/\s/g, "")}`}>{d.telephone}</a>{" "}
            <a href={`https://wa.me/${d.telephone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className={s.whatsapp}
              aria-label={`WhatsApp ${d.telephone}`}><IconeWhatsApp taille={15} /></a></>
        )}
        {d.reference && <> · annonce <a href={`/annonces/${d.reference.toLowerCase()}`} target="_blank" rel="noopener">réf. {d.reference}</a></>}
      </p>
      <p className={s.description}>{d.message}</p>
      {d.statut === "traitee" && d.traitee_le && (
        <p className={s.meta}>Traitée le {dateHeure(d.traitee_le)}{d.traitee_par ? ` par ${d.traitee_par}` : ""}</p>
      )}
      <div className={s.actions}>
        {d.email && <a href={reponse} className={s.boutonContour}><Icone nom="email" taille={16} /> Répondre par e-mail</a>}
        {d.statut === "nouvelle" ? (
          <button type="button" className={s.boutonPlein} onClick={() => traiter(d, true)}><Icone nom="valide" taille={16} /> Marquer comme traitée</button>
        ) : (
          <button type="button" className={s.boutonContour} onClick={() => traiter(d, false)}>Remettre parmi les nouvelles</button>
        )}
      </div>
    </li>
  );
}
