"use client";

/*
 * Page /mot-de-passe : choisir un nouveau mot de passe.
 *   - en arrivant par le lien « mot de passe oublié » reçu par e-mail. Ce lien ne connecte pas (lib/compte.ts) : il
 *     sert seulement ici ; une fois le mot de passe changé, la personne est déconnectée de partout et se connecte avec
 *     le nouveau ;
 *   - ou depuis Mon Espace, une fois connecté (la personne reste alors connectée).
 * Lien expiré ou déjà utilisé : on propose d'en recevoir un nouveau.
 * Compte protégé par la double authentification (l'équipe, lib/double-auth.ts) : Supabase n'accepte le nouveau mot
 * de passe qu'avec le code à 6 chiffres de l'application, le lien reçu par e-mail ne suffit pas. Le code est demandé ici.
 */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { messageErreur, useCompte } from "@/lib/compte";
import { donnerCode, etatCode } from "@/lib/double-auth";
import { supabase } from "@/lib/supabase";
import { ChampMotDePasse, ChampTexte } from "./Champs";
import f from "./Formulaire.module.css";
import s from "./Page.module.css";

// Le lien reçu par e-mail arrive avec des informations après « # » (lues puis effacées par Supabase) :
// on les garde dès le chargement pour savoir si le lien a expiré.
const ADRESSE_INITIALE = typeof window === "undefined" ? "" : window.location.hash;
const rien = () => () => {};

export default function NouveauMotDePasse() {
  const { etat, recuperation } = useCompte();
  const peutChanger = etat === "connecte" || !!recuperation;
  const hash = useSyncExternalStore(rien, () => ADRESSE_INITIALE, () => "");
  const lienExpire = /error_code=otp_expired|error=access_denied/.test(hash);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreurs, setErreurs] = useState<{ mdp?: string; confirmation?: string; code?: string }>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState<"" | "connecte" | "lien">("");
  // double authentification : le code de l'application à donner avant de changer le mot de passe (null : pas besoin)
  const [facteur, setFacteur] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!peutChanger) return;
    let actif = true;
    // (en cas d'échec, Supabase refusera le mot de passe avec un message qui dit de donner le code)
    etatCode().then((x) => actif && setFacteur(x.etat === "a_saisir" ? x.facteur : null), () => {});
    return () => {
      actif = false;
    };
  }, [peutChanger]);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const err = {
      mdp: mdp.length >= 8 ? undefined : "Au moins 8 caractères.",
      confirmation: confirmation === mdp ? undefined : "Les mots de passe ne correspondent pas.",
      code: facteur && !/^\d{6}$/.test(code) ? "Le code a 6 chiffres." : undefined,
    };
    setErreurs(err);
    setErreur("");
    if (err.mdp || err.confirmation || err.code) return;
    const sb = supabase();
    if (!sb) return setErreur(messageErreur(new Error("indisponible")));
    const parLien = !!recuperation;
    setEnvoi(true);
    if (facteur) {
      try {
        await donnerCode(facteur, code);
        setFacteur(null);
      } catch (x) {
        setEnvoi(false);
        setCode("");
        return setErreur(messageErreur(x));
      }
    }
    const { error } = await sb.auth.updateUser({ password: mdp });
    if (error) {
      setEnvoi(false);
      return setErreur(messageErreur(error));
    }
    // arrivé par le lien : déconnecté de partout (le lien, et les appareils où l'ancien mot de passe servait)
    if (parLien) await sb.auth.signOut().catch(() => {});
    setEnvoi(false);
    setFait(parLien ? "lien" : "connecte");
  };

  let contenu;
  if (fait === "lien") {
    contenu = (
      <>
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="valide" taille={16} />
          Votre mot de passe est changé. Connectez-vous avec votre nouveau mot de passe.
        </p>
        <Link href="/connexion?suite=/mon-espace" className={f.bouton}>
          Se connecter
        </Link>
      </>
    );
  } else if (fait) {
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
  } else if (peutChanger) {
    contenu = (
      <form className={f.formulaire} onSubmit={envoyer} noValidate>
        <ChampMotDePasse etiquette="Nouveau mot de passe" autoComplete="new-password" placeholder="Min. 8 caractères" valeur={mdp} onChange={setMdp} erreur={erreurs.mdp} avecForce />
        <ChampMotDePasse etiquette="Confirmer le mot de passe" autoComplete="new-password" placeholder="Répétez le mot de passe" valeur={confirmation} onChange={setConfirmation} erreur={erreurs.confirmation} />
        {facteur && (
          <ChampTexte etiquette="Code à 6 chiffres" icone="telephone" valeur={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" erreur={erreurs.code}
            aide="Votre compte est protégé par la double authentification : tapez le code affiché pour 360Immo.ci par votre application (Google Authenticator, Microsoft Authenticator…)." />
        )}
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
