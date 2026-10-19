"use client";

/*
 * Erreur pendant l'affichage d'une page (base de données momentanément injoignable…) : message en français et
 * « Réessayer ». Une page déjà préparée reste servie depuis le cache pendant une panne : cet écran ne concerne que les
 * pages pas encore en cache. Le statut reste une erreur (500), jamais « introuvable » : Google ne retire pas la page.
 */
import Link from "next/link";
import s from "@/components/BientotDisponible.module.css";

export default function ErreurPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={s.page}>
      <div className={s.carte}>
        <span className={s.surtitre}>Service momentanément indisponible</span>
        <h1 className={s.titre}>Cette page ne peut pas s&apos;afficher pour l&apos;instant</h1>
        <p className={s.texte}>
          Le site n&apos;arrive pas à joindre sa base de données. Réessayez dans quelques instants : rien n&apos;a été supprimé.
        </p>
        <div className={s.boutons}>
          <button type="button" className={s.btnPlein} onClick={reset}>Réessayer</button>
          <Link href="/" className={s.btnContour}>Retour à l&apos;accueil</Link>
        </div>
      </div>
    </section>
  );
}
