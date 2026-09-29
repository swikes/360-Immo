/*
 * Fiche d'un bien introuvable : annonce retirée (vendue, louée), expirée, ou adresse erronée.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Icone from "@/components/Icone";
import s from "@/components/fiche/Fiche.module.css";

export const metadata: Metadata = { title: "Annonce plus en ligne" };

export default function AnnonceIntrouvable() {
  return (
    <div className={s.page}>
      <div className={s.introuvable}>
        <Icone nom="maison" taille={40} epaisseur={1.5} />
        <h1 className={s.titre}>Cette annonce n&apos;est plus en ligne</h1>
        <p>Le bien a peut-être été vendu ou loué, ou l&apos;annonce a expiré. D&apos;autres biens vous attendent.</p>
        <div className={s.introuvableLiens}>
          <Link href="/annonces" className={s.boutonPlein}>Voir les annonces</Link>
          <Link href="/" className={s.boutonContour}>Accueil</Link>
        </div>
      </div>
    </div>
  );
}
