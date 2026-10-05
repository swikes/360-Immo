"use client";

/*
 * Fenêtre « Connectez-vous » : quand un visiteur sans compte touche un cœur (favoris) ou envoie un message.
 * Une seule fenêtre pour tout le site (placée dans app/layout.tsx) ; demanderConnexion() l'ouvre.
 * « Se connecter » et « Créer un compte » ramènent ensuite à la page en cours.
 */
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import Icone from "@/components/Icone";
import { useCompte } from "@/lib/compte";
import s from "./DemandeConnexion.module.css";

type Raison = "favori" | "message";
let raison: Raison | null = null;
const abonnes = new Set<() => void>();
const changer = (r: Raison | null) => {
  raison = r;
  abonnes.forEach((f) => f());
};

/** Ouvre la fenêtre (le cœur ou le message retiennent eux-mêmes ce qu'il faudra faire après la connexion) */
export const demanderConnexion = (r: Raison) => changer(r);

const TEXTES: Record<Raison, { titre: string; texte: string; icone: "coeur" | "message" }> = {
  favori: {
    titre: "Gardez vos coups de cœur",
    texte: "Connectez-vous ou créez votre compte gratuit : vos favoris vous suivent sur tous vos appareils. Cette annonce y sera ajoutée dès votre connexion.",
    icone: "coeur",
  },
  message: {
    titre: "Écrire à l'annonceur",
    texte: "Connectez-vous ou créez votre compte gratuit pour envoyer votre message et recevoir la réponse dans votre espace. Votre message est gardé en attendant.",
    icone: "message",
  },
};

export default function DemandeConnexion() {
  const r = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => raison,
    () => null,
  );
  const { etat } = useCompte();
  const boite = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (r && !boite.current?.open) boite.current?.showModal();
  }, [r]);
  if (!r) return null;

  const t = TEXTES[r];
  const suite = encodeURIComponent(window.location.pathname + window.location.search + (r === "message" ? "#contact" : ""));
  return (
    <dialog ref={boite} className={s.boite} aria-labelledby="demande-connexion" onClose={() => changer(null)}
      onClick={(e) => e.target === boite.current && boite.current?.close()}>
      <div className={s.contenu}>
        <span className={s.icone} aria-hidden="true"><Icone nom={t.icone} taille={22} /></span>
        <h2 id="demande-connexion" className={s.titre}>{t.titre}</h2>
        {etat === "indisponible" ? (
          <p className={s.texte}>Les comptes ne sont pas encore disponibles sur ce site.</p>
        ) : (
          <>
            <p className={s.texte}>{t.texte}</p>
            <div className={s.boutons}>
              <Link href={`/connexion?suite=${suite}`} className={s.plein} onClick={() => boite.current?.close()}>Se connecter</Link>
              <Link href={`/connexion?mode=inscription&suite=${suite}`} className={s.contour} onClick={() => boite.current?.close()}>
                Créer un compte
              </Link>
            </div>
          </>
        )}
        <button type="button" className={s.fermer} onClick={() => boite.current?.close()}>Plus tard</button>
      </div>
    </dialog>
  );
}
