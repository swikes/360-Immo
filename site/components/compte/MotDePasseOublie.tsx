"use client";

/*
 * Fenêtre « Mot de passe oublié ? » : envoie par e-mail un lien vers /mot-de-passe pour en choisir un nouveau.
 * Affichée seulement quand elle est ouverte (elle repart de zéro à chaque ouverture).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { supabase } from "@/lib/supabase";
import { ChampTexte, emailValide } from "./Champs";
import f from "./Formulaire.module.css";
import s from "./Connexion.module.css";

type Props = { fermer: () => void; emailInitial: string };

export default function MotDePasseOublie({ fermer, emailInitial }: Props) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(emailInitial);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState("");

  useEffect(() => {
    const d = fenetre.current;
    if (d && !d.open) d.showModal();
  }, []);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValide(email)) return setErreur("Veuillez saisir un e-mail valide.");
    const sb = supabase();
    if (!sb) return setErreur(messageErreur(new Error("indisponible")));
    setEnvoi(true);
    setErreur("");
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/mot-de-passe`,
    });
    setEnvoi(false);
    if (error) setErreur(messageErreur(error));
    else setEnvoye(email.trim());
  };

  return (
    <dialog
      ref={fenetre}
      className={s.fenetre}
      aria-labelledby="titre-oubli"
      onClose={fermer}
      // Toucher le fond grisé referme la fenêtre
      onClick={(e) => e.target === fenetre.current && fenetre.current?.close()}
    >
      <div className={s.fenetreContenu}>
        <h2 id="titre-oubli" className={s.fenetreTitre}>
          Mot de passe oublié ?
        </h2>
        {envoye ? (
          <>
            <p className={`${f.message} ${f.messageSucces}`} role="status">
              <Icone nom="valide" taille={16} />
              <span>
                Si un compte existe avec <strong>{envoye}</strong>, un lien vient de lui être envoyé pour choisir un
                nouveau mot de passe. Pensez à regarder dans les courriers indésirables (spam).
              </span>
            </p>
            <button type="button" className={f.bouton} onClick={() => fenetre.current?.close()}>
              Fermer
            </button>
          </>
        ) : (
          <form className={f.formulaire} onSubmit={envoyer} noValidate>
            <p className={s.fenetreTexte}>
              Saisissez l&apos;e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.
            </p>
            <ChampTexte
              etiquette="E-mail"
              icone="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="votre@email.com"
              valeur={email}
              onChange={setEmail}
              erreur={erreur}
              autoFocus
            />
            <div className={s.fenetreBoutons}>
              <button type="button" className={f.boutonContour} onClick={() => fenetre.current?.close()}>
                Annuler
              </button>
              <button type="submit" className={f.bouton} disabled={envoi}>
                {envoi ? "Envoi…" : "Envoyer le lien"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
