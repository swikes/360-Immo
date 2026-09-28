/*
 * Adresse inconnue : page pas encore créée (à propos, aide, mentions légales…) ou lien erroné.
 */
import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Page introuvable" };

export default function PageIntrouvable() {
  return (
    <BientotDisponible
      titre="Page bientôt disponible"
      texte="Cette page n'existe pas encore sur le nouveau site (à propos, aide, contact, mentions légales… arrivent avant le lancement), ou l'adresse contient une erreur."
    />
  );
}
