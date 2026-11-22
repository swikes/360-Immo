/*
 * Polices de la boîte à outils (copiées de node_modules par outils/preparer.mjs dans public/polices), chargées avant la
 * première image. Licence SIL OFL : public/polices/OFL-*.txt.
 */
import { continueRender, delayRender, staticFile } from "remotion";

// plages de caractères de @fontsource (latin : français compris, œ et €)
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const POLICES = [
  { famille: "Bricolage Grotesque", fichier: "polices/bricolage-grotesque-latin.woff2", graisse: "200 800", plage: LATIN },
  { famille: "Bricolage Grotesque", fichier: "polices/bricolage-grotesque-latin-ext.woff2", graisse: "200 800", plage: LATIN_EXT },
  { famille: "Caveat Brush", fichier: "polices/caveat-brush-latin.woff2", graisse: "400", plage: LATIN },
  { famille: "Caveat Brush", fichier: "polices/caveat-brush-latin-ext.woff2", graisse: "400", plage: LATIN_EXT },
];

const attente = delayRender("Chargement des polices de la boîte à outils");
Promise.all(
  POLICES.map((p) => {
    const police = new FontFace(p.famille, `url(${staticFile(p.fichier)}) format("woff2")`, { weight: p.graisse, unicodeRange: p.plage });
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
