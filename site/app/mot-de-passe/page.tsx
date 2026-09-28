import type { Metadata } from "next";
import NouveauMotDePasse from "@/components/compte/NouveauMotDePasse";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function PageMotDePasse() {
  return <NouveauMotDePasse />;
}
