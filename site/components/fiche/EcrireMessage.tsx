"use client";

/*
 * « Envoyer un message » à l'annonceur, sur la fiche d'un bien. Il faut un compte : sans compte, le message est
 * gardé le temps de se connecter (fenêtre « Connectez-vous »), puis retrouvé ici, prêt à partir.
 * La réponse arrive dans Mon Espace → Messages. L'annonceur voit le prénom et l'initiale du nom (« Jean K. »).
 */
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { demanderConnexion } from "@/components/DemandeConnexion";
import Icone from "@/components/Icone";
import { messageErreur, useCompte } from "@/lib/compte";
import { LONGUEUR_MAX, ecrireAnnonceur } from "@/lib/messages";
import s from "./Fiche.module.css";

const cle = (annonce: string) => `360-immo-message:${annonce}`;
function lireBrouillon(annonce: string) {
  try {
    return sessionStorage.getItem(cle(annonce));
  } catch {
    return null;
  }
}
function garderBrouillon(annonce: string, texte: string | null) {
  try {
    if (texte === null) sessionStorage.removeItem(cle(annonce));
    else sessionStorage.setItem(cle(annonce), texte);
  } catch {
    // navigation privée : le message sera à réécrire après la connexion
  }
}
const sansAbonnement = () => () => {};

type Props = { annonce: string; titre: string; reference: string; nom: string };

export default function EcrireMessage({ annonce, titre, reference, nom }: Props) {
  const { etat } = useCompte();
  // message écrit avant de se connecter (retrouvé au retour sur la fiche)
  const brouillon = useSyncExternalStore(sansAbonnement, () => lireBrouillon(annonce), () => null);
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [conversation, setConversation] = useState<string | null>(null);
  const defaut = `Bonjour, je suis intéressé(e) par votre annonce « ${titre} » (réf. ${reference}). Est-elle toujours disponible ?`;
  const valeur = texte ?? brouillon ?? defaut;

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!valeur.trim() || envoi || etat === "chargement") return;
    if (etat !== "connecte") {
      garderBrouillon(annonce, valeur);
      demanderConnexion("message");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      setConversation(await ecrireAnnonceur(annonce, valeur));
      garderBrouillon(annonce, null);
    } catch (er) {
      setErreur(messageErreur(er));
    }
    setEnvoi(false);
  };

  if (conversation) {
    return (
      <p className={s.envoye} role="status">
        <Icone nom="valide" taille={18} />
        <span>
          Message envoyé à {nom}. Sa réponse arrivera dans votre espace.{" "}
          <Link href={`/mon-espace?section=messages&conversation=${conversation}`}>Voir la conversation</Link>
        </span>
      </p>
    );
  }
  if (!ouvert && brouillon === null) {
    return (
      <button type="button" className={s.ecrire} onClick={() => setOuvert(true)}>
        <Icone nom="message" taille={18} /> Envoyer un message
      </button>
    );
  }
  return (
    <form className={s.formMessage} onSubmit={envoyer}>
      <label htmlFor="message-annonceur" className={s.etiquetteMessage}>Votre message à {nom}</label>
      {brouillon !== null && etat === "connecte" && (
        <p className={s.astuce}>Votre message vous attend : relisez-le, puis touchez « Envoyer ».</p>
      )}
      <textarea id="message-annonceur" className={s.zoneMessage} rows={4} maxLength={LONGUEUR_MAX} value={valeur}
        onChange={(e) => setTexte(e.target.value)} />
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      <button type="submit" className={s.afficher} disabled={envoi || !valeur.trim()}>
        <Icone nom="envoyer" taille={17} /> {envoi ? "Envoi…" : "Envoyer"}
      </button>
      <p className={s.discret}>
        {nom} verra votre prénom et l&apos;initiale de votre nom. Sa réponse arrivera dans Mon Espace → Messages.
      </p>
    </form>
  );
}
