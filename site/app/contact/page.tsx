/*
 * Contact (/contact) : formulaire pour écrire à l'équipe, avec ou sans compte (components/contact/FormulaireContact).
 * Le sujet et l'annonce concernée peuvent venir de l'adresse (/contact?sujet=partenariat, /contact?annonce=IMM-…).
 */
import type { Metadata } from "next";
import Link from "next/link";
import FormulaireContact from "@/components/contact/FormulaireContact";
import Icone from "@/components/Icone";
import { estSujet, type SujetContact } from "@/lib/contact";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Contact : écrire à l'équipe",
  description: "Une question, un problème avec une annonce, un partenariat ? Écrivez à l'équipe 360-Immo.ci.",
  alternates: { canonical: "/contact" },
};

export default async function Contact({ searchParams }: PageProps<"/contact">) {
  const p = await searchParams;
  const annonce = typeof p.annonce === "string" ? p.annonce.slice(0, 30) : "";
  const sujet: SujetContact = estSujet(p.sujet) ? p.sujet : annonce ? "annonce" : "question";

  return (
    <div className={s.page}>
      <header className={s.entete}>
        <div className={s.contenu}>
          <span className={s.surtitre}>Contact</span>
          <h1 className={s.titre}>Écrire à l&apos;équipe 360-Immo.ci</h1>
          <p className={s.sousTitre}>Une question, un problème avec une annonce, un partenariat ? Notre équipe vous répond par e-mail ou par téléphone.</p>
        </div>
      </header>
      <div className={`${s.contenu} ${s.corps}`}>
        <FormulaireContact sujet={sujet} reference={annonce} />
        <aside className={s.cote} aria-label="Avant d'écrire">
          <Link href="/aide" className={s.action}>
            <Icone nom="document" taille={20} />
            <span><strong>Aide & FAQ</strong> La réponse à votre question y est peut-être déjà.</span>
          </Link>
          <div className={s.encart}>
            <Icone nom="bouclier" taille={20} />
            <p>
              <strong>Une annonce suspecte ?</strong> Touchez « Signaler cette annonce » sur sa page : notre équipe l&apos;examine.
              Ne payez jamais avant d&apos;avoir visité le bien.
            </p>
          </div>
          <Link href="/mon-espace" className={s.action}>
            <Icone nom="personne" taille={20} />
            <span><strong>Votre compte et vos annonces</strong> Mon Espace : annonces, messages, visites, vérification.</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
