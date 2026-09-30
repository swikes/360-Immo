/*
 * /ma-vitrine : raccourci vers sa propre vitrine (menu ☰). Sans compte : connexion, puis retour ici.
 */
import type { Metadata } from "next";
import VersMaVitrine from "@/components/vitrine/VersMaVitrine";

export const metadata: Metadata = { title: "Ma vitrine", robots: { index: false } };

export default function PageMaVitrine() {
  return <VersMaVitrine />;
}
