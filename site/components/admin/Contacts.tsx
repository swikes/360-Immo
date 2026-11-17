"use client";

/*
 * Administration → Contact : les messages du formulaire Contact (supabase/migrations/…_pages_contact.sql).
 * Nouvelles demandes d'abord : sujet, personne (avec ou sans compte), e-mail, téléphone (appel, WhatsApp), annonce
 * concernée, message. « Répondre » : la réponse part par e-mail au nom de 360Immo.ci (adresse d'envoi du site), jamais
 * de la boîte personnelle d'un membre de l'équipe ; elle reste dans l'historique de la demande, marquée traitée
 * (supabase/migrations/…_reponses_contact.sql). Réponse par téléphone : « Marquer comme traitée ».
 * Les demandes traitées sont supprimées au bout d'un an. Chaque membre de l'équipe reçoit aussi chaque demande par e-mail.
 */
import { useCallback, useEffect, useState } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { SUJETS_CONTACT, type DemandeContact } from "@/lib/contact";
import { demandesContact, repondreContact, traiterContact } from "@/lib/pages-admin";
import { relancerEmails } from "@/lib/relance-emails";
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

  /** envoie la réponse ; null si elle est partie, sinon le message d'erreur (affiché sur la carte) */
  const repondre = async (d: DemandeContact, reponse: string): Promise<string | null> => {
    try {
      await repondreContact(d.id, reponse);
      relancerEmails();
      setErreur("");
      setFait(`Réponse envoyée à ${d.nom} (${d.email}), au nom de 360Immo.ci. La demande est marquée comme traitée.`);
      relire();
      await charger();
      return null;
    } catch (e) {
      return messageErreur(e);
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
          <ul className={s.cartes}>{nouvelles.map((d) => <Carte key={d.id} d={d} traiter={traiter} repondre={repondre} />)}</ul>
        )}
      </section>
      {traitees.length > 0 && (
        <section aria-labelledby="contact-traitees" className={s.liste}>
          <h2 id="contact-traitees" className={s.groupeTitre}>Traitées récemment ({traitees.length})</h2>
          <p className={s.aide}>Elles sont supprimées un an après avoir été traitées.</p>
          <ul className={s.cartes}>{traitees.map((d) => <Carte key={d.id} d={d} traiter={traiter} repondre={repondre} />)}</ul>
        </section>
      )}
    </div>
  );
}

function Carte({ d, traiter, repondre }: {
  d: DemandeContact; traiter: (d: DemandeContact, traitee: boolean) => void;
  repondre: (d: DemandeContact, reponse: string) => Promise<string | null>;
}) {
  const sujet = SUJETS_CONTACT[d.sujet] ?? SUJETS_CONTACT.autre;
  const reponses = d.reponses ?? [];
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const envoyer = async () => {
    if (texte.trim().length < 2) return setErreur("Écrivez votre réponse.");
    setEnvoi(true);
    setErreur("");
    const probleme = await repondre(d, texte);
    setEnvoi(false);
    if (probleme) return setErreur(probleme);
    setTexte("");
    setOuvert(false);
  };
  return (
    <li className={s.carte} aria-labelledby={`contact-${d.id}`}>
      <div className={s.badges}>
        <span className={`${s.badge} ${d.sujet === "arnaque" ? s.badgeAlerte : d.sujet === "donnees" ? s.badgeInfo : ""}`}>{sujet}</span>
        {d.avec_compte && <span className={s.badge}>A un compte</span>}
      </div>
      <h3 id={`contact-${d.id}`} className={s.carteTitre}>{d.nom}</h3>
      <p className={s.meta}>
        Reçue le {dateHeure(d.cree_le)}
        {d.email && <> · {d.email}</>}
        {d.telephone && (
          <> · <a href={`tel:${d.telephone.replace(/\s/g, "")}`}>{d.telephone}</a>{" "}
            <a href={`https://wa.me/${d.telephone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className={s.whatsapp}
              aria-label={`WhatsApp ${d.telephone}`}><IconeWhatsApp taille={15} /></a></>
        )}
        {d.reference && <> · annonce <a href={`/annonces/${d.reference.toLowerCase()}`} target="_blank" rel="noopener">réf. {d.reference}</a></>}
      </p>
      <p className={s.description}>{d.message}</p>
      {reponses.map((r, i) => (
        <div key={i} className={s.refus}>
          <p className={s.meta}>Réponse envoyée le {dateHeure(r.cree_le)}{r.par ? ` par ${r.par}` : ""}, au nom de 360Immo.ci</p>
          <p className={s.description}>{r.message}</p>
        </div>
      ))}
      {d.statut === "traitee" && d.traitee_le && (
        <p className={s.meta}>Traitée le {dateHeure(d.traitee_le)}{d.traitee_par ? ` par ${d.traitee_par}` : ""}</p>
      )}
      {ouvert ? (
        <div className={s.refus}>
          <label htmlFor={`${d.id}-reponse`} className={s.etiquette}>
            Votre réponse à {d.nom} : elle part par e-mail à {d.email}, au nom de 360Immo.ci (pas de votre adresse personnelle)
          </label>
          <textarea id={`${d.id}-reponse`} className={s.zone} rows={6} maxLength={5000} value={texte} onChange={(e) => setTexte(e.target.value)}
            placeholder="Ex : Merci pour votre message. Pour publier une annonce de terrain…" />
          <p className={s.aide}>« Bonjour {d.nom}, » est ajouté au début, la signature « L&apos;équipe 360Immo.ci » à la fin, et son message en dessous. Sa réponse arrivera dans la boîte du site.</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={envoyer}>
              <Icone nom="email" taille={16} /> {envoi ? "Envoi…" : "Envoyer la réponse"}
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setOuvert(false); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className={s.actions}>
          {d.email && (
            <button type="button" className={d.statut === "nouvelle" ? s.boutonPlein : s.boutonContour} onClick={() => setOuvert(true)}>
              <Icone nom="email" taille={16} /> {reponses.length ? "Répondre de nouveau" : "Répondre"}
            </button>
          )}
          {d.statut === "nouvelle" ? (
            <button type="button" className={d.email ? s.boutonContour : s.boutonPlein} onClick={() => traiter(d, true)}><Icone nom="valide" taille={16} /> Marquer comme traitée</button>
          ) : (
            <button type="button" className={s.boutonContour} onClick={() => traiter(d, false)}>Remettre parmi les nouvelles</button>
          )}
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
