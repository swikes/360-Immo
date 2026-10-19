"use client";

/*
 * Formulaire Contact (/contact) : nom, e-mail ou téléphone (l'un des deux au moins), sujet, référence de l'annonce
 * (pour une annonce ou une arnaque), message. Avec un compte : prérempli d'après le profil. Envoi : lib/formulaire-contact.ts
 * (l'équipe est prévenue par e-mail et retrouve la demande dans Administration → Contact), avec le contrôle anti-robot
 * (lib/anti-robot.ts) s'il est réglé.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import ChampTelephone from "@/components/ChampTelephone";
import { ChampTexte } from "@/components/compte/Champs";
import Icone from "@/components/Icone";
import { useAntiRobot } from "@/lib/anti-robot";
import { lireProfil, messageErreur, useCompte } from "@/lib/compte";
import { LISTE_SUJETS, MESSAGE_MAX, MESSAGE_MIN, SUJETS_ANNONCE, SUJETS_CONTACT, type SujetContact } from "@/lib/contact";
import { envoyerContact } from "@/lib/formulaire-contact";
import { PAYS_DEFAUT, complet, decomposer, message as messageTelephone, valide } from "@/lib/telephone";
import f from "@/components/compte/Formulaire.module.css";
import s from "./FormulaireContact.module.css";

type Erreurs = { nom?: string; joindre?: string; email?: string; tel?: string; message?: string };

export default function FormulaireContact({ sujet: sujetDepart, reference: referenceDepart }: { sujet: SujetContact; reference: string }) {
  const { etat, utilisateur } = useCompte();
  const id = useId();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState({ iso: PAYS_DEFAUT.iso, valeur: "" });
  const [sujet, setSujet] = useState<SujetContact>(sujetDepart);
  const [reference, setReference] = useState(referenceDepart);
  const [message, setMessage] = useState("");
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const prerempli = useRef(false);
  const { actif: antiRobotActif, zone: zoneAntiRobot, jeton: jetonAntiRobot } = useAntiRobot();

  // Avec un compte : nom, e-mail et numéro du profil (une seule fois, sans écraser ce qui a été tapé)
  useEffect(() => {
    if (etat !== "connecte" || !utilisateur || prerempli.current) return;
    prerempli.current = true;
    const adresse = utilisateur.email ?? "";
    lireProfil(utilisateur.id).then(
      (p) => {
        setEmail((e) => e || adresse);
        setNom((n) => n || [p.prenom, p.nom].filter(Boolean).join(" "));
        if (p.telephone) setTel((t) => (t.valeur ? t : decomposer(p.telephone)));
      },
      () => {},
    );
  }, [etat, utilisateur]);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const telSaisi = tel.valeur.trim() !== "";
    const err: Erreurs = {
      nom: nom.trim().length >= 2 ? undefined : "Indiquez votre nom.",
      joindre: email.trim() || telSaisi ? undefined : "Indiquez une adresse e-mail ou un numéro de téléphone pour que nous puissions vous répondre.",
      email: !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? undefined : "L'adresse e-mail n'est pas valide.",
      tel: !telSaisi || valide(tel.valeur, tel.iso) ? undefined : messageTelephone(tel.valeur, tel.iso),
      message: message.trim().length < MESSAGE_MIN ? `Écrivez votre message (${MESSAGE_MIN} caractères au moins).` : undefined,
    };
    setErreurs(err);
    setErreur("");
    if (Object.values(err).some(Boolean)) return;
    setEnvoi(true);
    try {
      await envoyerContact({
        nom, email, telephone: telSaisi ? complet(tel.valeur, tel.iso) : "", sujet,
        reference: SUJETS_ANNONCE.includes(sujet) ? reference : "", message,
      }, await jetonAntiRobot());
      setEnvoye(true);
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      setErreur(messageErreur(x));
    }
    setEnvoi(false);
  };

  if (envoye) {
    return (
      <section className={s.carte} aria-labelledby={`${id}-merci`}>
        <div className={s.merci}>
          <span className={s.pastille} aria-hidden="true"><Icone nom="valide" taille={26} /></span>
          <h2 id={`${id}-merci`} className={s.merciTitre}>Merci, votre message est bien envoyé</h2>
          <p>
            Notre équipe l&apos;a reçu et vous répond {email.trim() ? <>à <strong>{email.trim()}</strong></> : "par téléphone"} dès que
            possible.
          </p>
          <div className={s.actions}>
            <Link href="/annonces" className={f.boutonContour}>Voir les annonces</Link>
            <button type="button" className={f.boutonContour} onClick={() => setEnvoye(false)}>Écrire un autre message</button>
          </div>
        </div>
      </section>
    );
  }

  const annonce = SUJETS_ANNONCE.includes(sujet);
  return (
    <form className={`${s.carte} ${f.formulaire}`} onSubmit={envoyer} noValidate aria-label="Écrire à l'équipe">
      <ChampTexte etiquette="Votre nom" icone="personne" autoComplete="name" valeur={nom} onChange={setNom} erreur={erreurs.nom}
        obligatoire maxLength={80} />
      <div className={f.deuxColonnes}>
        <ChampTexte etiquette="E-mail" icone="email" type="email" autoComplete="email" inputMode="email" valeur={email}
          onChange={setEmail} erreur={erreurs.email} maxLength={200} />
        <div className={f.groupe}>
          <label htmlFor={`${id}-tel`} className={f.etiquette}>Téléphone</label>
          <div className={`${s.telephone} ${erreurs.tel ? s.enErreur : ""}`}>
            <ChampTelephone id={`${id}-tel`} iso={tel.iso} valeur={tel.valeur} onChange={(iso, valeur) => setTel({ iso, valeur })}
              invalide={!!erreurs.tel} decrit={erreurs.tel ? `${id}-tel-erreur` : undefined} />
          </div>
          {erreurs.tel && <p id={`${id}-tel-erreur`} className={f.erreur}>{erreurs.tel}</p>}
        </div>
      </div>
      {erreurs.joindre ? <p className={f.erreur} role="alert">{erreurs.joindre}</p>
        : <p className={f.aide}>L&apos;e-mail ou le téléphone, au choix : c&apos;est ainsi que nous vous répondrons.</p>}

      <div className={f.groupe}>
        <label htmlFor={`${id}-sujet`} className={f.etiquette}>Sujet</label>
        <select id={`${id}-sujet`} className={`${f.champ} ${s.choix}`} value={sujet} onChange={(e) => setSujet(e.target.value as SujetContact)}>
          {LISTE_SUJETS.map((x) => <option key={x} value={x}>{SUJETS_CONTACT[x]}</option>)}
        </select>
      </div>
      {sujet === "arnaque" && (
        <p className={`${f.message} ${f.messageInfo}`}>
          <Icone nom="bouclier" taille={16} />
          <span>Pour une annonce du site, le plus rapide est « Signaler cette annonce » sur sa page. Si vous avez payé, déposez aussi plainte auprès de la police ou de la gendarmerie.</span>
        </p>
      )}
      {sujet === "donnees" && (
        <p className={`${f.message} ${f.messageInfo}`}>
          <Icone nom="cadenas" taille={16} />
          <span>Dites-nous ce que vous souhaitez (voir, corriger ou supprimer vos données). Pour vérifier qu&apos;il s&apos;agit bien de vous, écrivez depuis l&apos;adresse e-mail de votre compte. Voir aussi la <Link href="/confidentialite">politique de confidentialité</Link>.</span>
        </p>
      )}
      {annonce && (
        <ChampTexte etiquette="Référence de l'annonce (facultative)" icone="document" valeur={reference} onChange={setReference}
          placeholder="Ex : IMM-2026-01006" maxLength={30} aide="Elle figure sur la page de l'annonce, sous les photos." />
      )}

      <div className={f.groupe}>
        <label htmlFor={`${id}-message`} className={f.etiquette}>
          Votre message<span className={f.obligatoire} aria-hidden="true">*</span>
        </label>
        <textarea id={`${id}-message`} className={s.zone} rows={7} value={message} maxLength={MESSAGE_MAX}
          onChange={(e) => setMessage(e.target.value)} aria-invalid={erreurs.message ? true : undefined} aria-required
          aria-describedby={`${id}-compte${erreurs.message ? ` ${id}-message-erreur` : ""}`}
          placeholder="Expliquez-nous votre demande en quelques phrases." />
        <p id={`${id}-compte`} className={s.compte}>{message.length} / {MESSAGE_MAX.toLocaleString("fr-FR")}</p>
        {erreurs.message && <p id={`${id}-message-erreur`} className={f.erreur}>{erreurs.message}</p>}
      </div>

      {antiRobotActif && <div ref={zoneAntiRobot} className={f.antiRobot} />}
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
      <button type="submit" className={f.bouton} disabled={envoi}>
        <Icone nom="envoyer" taille={17} /> {envoi ? "Envoi…" : "Envoyer mon message"}
      </button>
      <p className={f.aide}>
        Vos coordonnées servent seulement à vous répondre (<Link href="/confidentialite">politique de confidentialité</Link>).
      </p>
    </form>
  );
}
