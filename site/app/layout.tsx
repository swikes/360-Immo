/*
 * Cadre commun à toutes les pages : polices, barre du haut, pied de page.
 */
import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import BarreDuHaut from "@/components/BarreDuHaut";
import PiedDePage from "@/components/PiedDePage";
import "./globals.css";

// Polices téléchargées une fois à la construction du site puis servies par le site lui-même
// (pas d'appel à Google à chaque visite, pas de texte qui « saute » au chargement)
const titre = Playfair_Display({
  variable: "--font-titre",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
});
const texte = Outfit({
  variable: "--font-texte",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s — 360-Immo.ci",
    default: "360-Immo.ci — Location & Vente Immobilière en Côte d'Ivoire",
  },
  description:
    "Appartements, villas, maisons, terrains et bureaux à louer ou à vendre partout en Côte d'Ivoire. " +
    "Publiez votre annonce gratuitement.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable}`}>
      <body>
        <BarreDuHaut />
        <main>{children}</main>
        <PiedDePage />
      </body>
    </html>
  );
}
