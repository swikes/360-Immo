import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaiementSimule from "@/components/offres/PaiementSimule";

export const metadata: Metadata = { title: "Paiement (essai)", robots: { index: false } };

/** Page de paiement imitée, pour les essais seulement (lib/paiements-serveur.ts) */
export default function PagePaiementSimule() {
  if (process.env.NEXT_PUBLIC_PAIEMENTS?.trim() !== "simulation") notFound();
  return <PaiementSimule />;
}
