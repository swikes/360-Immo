/*
 * Page « Nos offres » (/offres) : ce que gagnent les annonceurs à remonter leur annonce ou à passer en Premium, les
 * prix (lus dans la base, table « offres ») et les règles. Visible seulement quand le paiement est ouvert
 * (NEXT_PUBLIC_PAIEMENTS : lib/offres.ts).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageOffres from "@/components/offres/PageOffres";
import { lireOffres } from "@/lib/annonces-serveur";

// Faite à la première visite, puis gardée 10 minutes (un prix changé dans Supabase arrive au plus 10 minutes après)
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Nos offres pour les annonceurs",
  description: "Publier reste gratuit. Remontez votre annonce en tête de la liste ou passez-la en Premium, payé par Mobile Money.",
  alternates: { canonical: "/offres" },
};

export default async function Page() {
  if (!process.env.NEXT_PUBLIC_PAIEMENTS?.trim()) notFound();
  const offres = await lireOffres();
  const prix = Object.fromEntries(offres.map((o) => [o.cle, o.prix])) as Record<string, number>;
  return <PageOffres prix={prix} />;
}
