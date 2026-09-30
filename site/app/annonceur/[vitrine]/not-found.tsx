/*
 * Vitrine introuvable : adresse erronée, ou compte supprimé.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Icone from "@/components/Icone";
import s from "@/components/fiche/Fiche.module.css";

export const metadata: Metadata = { title: "Vitrine introuvable" };

export default function VitrineIntrouvable() {
  return (
    <div className={s.page}>
      <div className={s.introuvable}>
        <Icone nom="personne" taille={40} epaisseur={1.5} />
        <h1 className={s.titre}>Cette vitrine n&apos;existe pas</h1>
        <p>L&apos;adresse contient peut-être une erreur. Les annonces de tous les annonceurs sont dans la liste.</p>
        <div className={s.introuvableLiens}>
          <Link href="/annonces" className={s.boutonPlein}>Voir les annonces</Link>
          <Link href="/" className={s.boutonContour}>Accueil</Link>
        </div>
      </div>
    </div>
  );
}
