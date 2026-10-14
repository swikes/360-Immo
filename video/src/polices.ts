/** Polices du site (copiées de site/app/polices par outils/preparer.mjs), chargées avant la première image */
import { continueRender, delayRender, staticFile } from "remotion";

const POLICES = [
  { famille: "Playfair Display", fichier: "polices/playfair-display.woff2", style: "normal", graisse: "400 900" },
  { famille: "Playfair Display", fichier: "polices/playfair-display-italique.woff2", style: "italic", graisse: "400 900" },
  { famille: "Outfit", fichier: "polices/outfit.woff2", style: "normal", graisse: "300 700" },
];

const attente = delayRender("Chargement des polices");
Promise.all(
  POLICES.map((p) => {
    const police = new FontFace(p.famille, `url(${staticFile(p.fichier)}) format("woff2")`, { style: p.style, weight: p.graisse });
    document.fonts.add(police);
    return police.load();
  }),
).then(
  () => continueRender(attente),
  (e) => {
    console.error("Polices introuvables : lancer d'abord node outils/preparer.mjs", e);
    continueRender(attente);
  },
);
