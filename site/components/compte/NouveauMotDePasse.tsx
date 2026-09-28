"use client";

/*
 * Page /mot-de-passe : choisir un nouveau mot de passe.
 *   - en arrivant par le lien « mot de passe oublié » reçu par e-mail (Supabase connecte la personne avec ce lien) ;
 *   - ou depuis Mon Espace, une fois connecté.
 * Lien expiré ou déjà utilisé : on propose d'en recevoir un nouveau.
 */
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { messageErreur, useCompte } from "@/lib/compte";
import { supabase } from "@/lib/supabase";
import { ChampMotDePasse } from "./Champs";
import f from "./Formulaire.module.css";
import s from "./Page.module.css";

// Le lien reçu par e-mail arrive avec des informations après « # » (lues puis effacées par Supabase) :
// on les garde dès le chargement pour savoir si le lien a expiré.
const ADRESSE_INITIALE = typeof window === "undefined" ? "" : window.location.hash;
const rien = () => () => {};

export default function NouveauMotDePasse() {
  const { etat } = useCompte();
  const hash = useSyncExternalStore(rien, () => ADRESSE_INITIALE, () => "");
  const lienExpire = /error_code=otp_expired|error=access_denied/.test(hash);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreurs, setErreurs] = useState<{ mdp?: string; confirmation?: string }>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const err = {
      mdp: mdp.length >= 8 ? undefined : "Au moins 8 caractères.",
      confirmation: confirmation === mdp ? undefined : "Les mots de passe ne correspondent pas.",
    };
    setErreurs(err);
    setErreur("");
    if (err.mdp || err.confirmation) return;
    const sb = supabase();
    if (!sb) return setErreur(messageErreur(new Error("indisponible")));
    setEnvoi(true);
    const { error } = await sb.auth.updateUser({ password: mdp });
    setEnvoi(false);
    if (error) setErreur(messageErreur(error));
    else setFait(true);
  };

  let contenu;
  if (fait) {
    contenu = (
      <>
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="valide" taille={16} />
          Votre mot de passe est changé. Utilisez-le à votre prochaine connexion.
        </p>
        <Link href="/mon-espace" className={f.bouton}>
          Aller à mon espace
        </Link>
      </>
    );
  } else if (etat === "chargement") {
    contenu = <p className={s.attente}>Vérification du lien…</p>;
  } else if (etat === "connecte") {
    contenu = (
      <form className={f.formulaire} onSubmit={envoyer} noValidate>
        <ChampMotDePasse etiquette="Nouveau mot de passe" autoComplete="new-password" placeholder="Min. 8 caractères" valeur={mdp} onChange={setMdp} erreur={erreurs.mdp} avecForce />
        <ChampMotDePasse etiquette="Confirmer le mot de passe" autoComplete="new-password" placeholder="Répétez le mot de passe" valeur={confirmation} onChange={setConfirmation} erreur={erreurs.confirmation} />
        {erreur && (
          <p className={`${f.message} ${f.messageErreur}`} role="alert">
            <Icone nom="cadenas" taille={16} />
            {erreur}
          </p>
        )}
        <button type="submit" className={f.bouton} disabled={envoi}>
          {envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    );
  } else {
    contenu = (
      <>
        <p className={`${f.message} ${lienExpire ? f.messageErreur : f.messageInfo}`} role="status">
          <Icone nom="horloge" taille={16} />
          {lienExpire
            ? "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau : il arrive en quelques minutes."
            : "Pour choisir un nouveau mot de passe, ouvrez le lien reçu par e-mail, ou demandez-en un."}
        </p>
        <Link href="/connexion?oubli=1" className={f.bouton}>
          Recevoir un nouveau lien
        </Link>
      </>
    );
  }

  return (
    <section className={s.page}>
      <div className={s.carte}>
        <span className={s.surtitre}>Mon compte</span>
        <h1 className={s.titre}>Nouveau mot de passe</h1>
        {contenu}
      </div>
    </section>
  );
}
