/*
 * Boîte à outils « motion design » (réutilisable d'une publicité à l'autre, voir SKILL.md du skill pub-motion-design) :
 * couleurs de la charte du site (site/app/globals.css), polices et format.
 * Une nouvelle marque : changer seulement ce fichier (et les logos de public/logo).
 */

/** Couleurs de 360Immo.ci */
export const P = {
  vert: "#1E5E3F", vertMoyen: "#2A7E56", vertClair: "#39A26F", vertPale: "#E9F4EF", vertFonce: "#113B27",
  or: "#C99A2E", orClair: "#E2B54A", orPale: "#FDF5E3", orFonce: "#B07D1E", orTexte: "#8A6212",
  encre: "#1C1C1E", gris: "#6B6B6B", grisClair: "#ADADAD", grisPale: "#F5F5F2", bord: "#E8E8E3",
  creme: "#FAFAF8", blanc: "#FFFFFF",
  rouge: "#E53E3E", rougePale: "#FDEBEB", bleu: "#3182CE", bleuPale: "#EBF8FF",
};

/** Polices : titres expressifs (Bricolage Grotesque) et notes écrites à la main pour l'humour (Caveat Brush) */
export const TITRE = "'Bricolage Grotesque', system-ui, sans-serif";
export const MAIN = "'Caveat Brush', 'Comic Sans MS', cursive";

/** Format vertical : Statuts WhatsApp, TikTok, Reels, Shorts */
export const L = 1080;
export const H = 1920;
export const IPS = 30;

/** Secondes → images */
export const img = (secondes: number) => Math.round(secondes * IPS);
