"use client";

/*
 * Message de bienvenue sur l'accueil, juste après la connexion (/?bienvenue=connexion) ou l'inscription
 * (/?bienvenue=inscription) : la personne arrive sur la recherche et sait qu'elle est bien connectée.
 * Il disparaît tout seul après quelques secondes (ou avec ×) et l'adresse redevient « / ».
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import Icone from "@/components/Icone";
import { prenomDe, useCompte } from "@/lib/compte";
import s from "./MessageBienvenue.module.css";

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
  const visible = (quoi === "connexion" || quoi === "inscription") && etat === "connecte";
  const fermer = useCallback(() => router.replace("/", { scroll: false }), [router]);

  useEffect(() => {
    if (!visible) return;
    const minuterie = window.setTimeout(fermer, 10_000);
    return () => window.clearTimeout(minuterie);
  }, [visible, fermer]);

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
