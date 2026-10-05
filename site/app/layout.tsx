/*
 * Cadre commun à toutes les pages : polices, barre du haut, pied de page.
 */
import type { Metadata } from "next";
import localFont from "next/font/local";
import BarreDuHaut from "@/components/BarreDuHaut";
import DemandeConnexion from "@/components/DemandeConnexion";
import PiedDePage from "@/components/PiedDePage";
import { ADRESSE_SITE } from "@/lib/site";
import "./globals.css";

// Polices rangées avec le site (app/polices : Playfair Display et Outfit de Google Fonts, toutes les graisses dans un
// seul fichier, caractères latins ; licence libre SIL OFL). Ni la construction ni les visites ne dépendent de Google :
// une réponse inattendue de Google Fonts faisait parfois échouer la construction sur Vercel.
const titre = localFont({
  variable: "--font-titre",
  src: [
    { path: "./polices/playfair-display.woff2", weight: "400 900", style: "normal" },
    { path: "./polices/playfair-display-italique.woff2", weight: "400 900", style: "italic" },
  ],
  display: "swap",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});
const texte = localFont({
  variable: "--font-texte",
  src: [{ path: "./polices/outfit.woff2", weight: "300 700", style: "normal" }],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(ADRESSE_SITE),
  title: {
    template: "%s — 360-Immo.ci",
    default: "360-Immo.ci — Location & Vente Immobilière en Côte d'Ivoire",
  },
  description:
    "Appartements, villas, maisons, terrains et bureaux à louer ou à vendre partout en Côte d'Ivoire. " +
    "Publiez votre annonce gratuitement.",
  // Pas de détection automatique des numéros : sur iPhone, un prix comme « 85 000 000 »
  // devenait un lien bleu souligné. Les vrais numéros ont leur propre bouton « Appeler ».
  formatDetection: { telephone: false, date: false, email: false, address: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable}`}>
      <body>
        <BarreDuHaut />
        <main>{children}</main>
        <PiedDePage />
        <DemandeConnexion />
      </body>
    </html>
  );
}
