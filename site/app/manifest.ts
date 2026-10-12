/*
 * Fiche d'application (/manifest.webmanifest) : nom et icônes quand on ajoute le site à l'écran d'accueil d'un
 * téléphone Android (« Ajouter à l'écran d'accueil »). Les icônes viennent du logo : marque/generer.mjs.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "360-Immo.ci — Location & Vente Immobilière en Côte d'Ivoire",
    short_name: "360-Immo",
    description: "Appartements, villas, maisons, terrains et bureaux à louer ou à vendre partout en Côte d'Ivoire.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-512-masquable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
