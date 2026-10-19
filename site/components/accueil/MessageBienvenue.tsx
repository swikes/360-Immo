"use client";

/*
 * Message de bienvenue sur l'accueil, juste après la connexion (/?bienvenue=connexion) ou l'inscription
 * (/?bienvenue=inscription) : la personne arrive sur la recherche et sait qu'elle est bien connectée.
 * Il disparaît tout seul après quelques secondes (ou avec ×) et l'adresse redevient « / ».
 * Lien de confirmation de l'inscription expiré ou déjà utilisé : on explique comment en recevoir un nouveau.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useSyncExternalStore } from "react";
import Icone from "@/components/Icone";
import { prenomDe, useCompte } from "@/lib/compte";
import s from "./MessageBienvenue.module.css";

// Le lien de confirmation reçu par e-mail revient avec des informations après « # » (effacées par Supabase
// quand le lien est bon) : on les garde dès le chargement pour savoir s'il a expiré.
const ADRESSE_INITIALE = typeof window === "undefined" ? "" : window.location.search + window.location.hash;
const rien = () => () => {};

export default function MessageBienvenue() {
  return (
    <Suspense fallback={null}>
      <Message />
    </Suspense>
  );
}

function Message() {
  const quoi = useSearchParams().get("bienvenue");
  const { etat, utilisateur } = useCompte();
  const router = useRouter();
  const adresse = useSyncExternalStore(rien, () => ADRESSE_INITIALE, () => "");
  const lienExpire = quoi === "inscription" && etat === "anonyme" && /error_code=otp_expired|error=access_denied/.test(adresse);
  const visible = (quoi === "connexion" || quoi === "inscription") && etat === "connecte";
  const fermer = useCallback(() => router.replace("/", { scroll: false }), [router]);

  useEffect(() => {
    if (!visible) return;
    const minuterie = window.setTimeout(fermer, 10_000);
    return () => window.clearTimeout(minuterie);
  }, [visible, fermer]);

  if (lienExpire) {
    return (
      <div className={`${s.message} ${s.attention}`} role="alert">
        <Icone nom="email" taille={18} className={s.icone} />
        <p className={s.texte}>
          Ce lien de confirmation a expiré ou a déjà servi. Connectez-vous : si votre e-mail n&apos;est pas encore
          confirmé, vous pourrez recevoir un nouveau lien.{" "}
          <Link href="/connexion" className={s.lien}>
            Se connecter
          </Link>
        </p>
        <button type="button" className={s.fermer} aria-label="Fermer le message" onClick={fermer}>
          <Icone nom="fermer" taille={15} epaisseur={2.5} />
        </button>
      </div>
    );
  }
  if (!visible) return null;
  const prenom = prenomDe(utilisateur);
  return (
    <div className={s.message} role="status">
      <Icone nom="valide" taille={18} className={s.icone} />
      <p className={s.texte}>
        {quoi === "inscription"
          ? `Votre compte est créé. Bienvenue sur 360-Immo.ci${prenom ? ", " + prenom : ""} !`
          : `Vous êtes connecté. Bon retour${prenom ? ", " + prenom : ""} !`}{" "}
        <Link href="/mon-espace" className={s.lien}>
          Voir mon espace
        </Link>
      </p>
      <button type="button" className={s.fermer} aria-label="Fermer le message" onClick={fermer}>
        <Icone nom="fermer" taille={15} epaisseur={2.5} />
      </button>
    </div>
  );
}
