// Copie dans public/ ce que les vidéos reprennent du site : ses polices (avec leur licence) et son logo.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.join(ICI, "../../site");
const PUBLIC = path.join(ICI, "../public");

const copies = {
  polices: ["app/polices", ["playfair-display.woff2", "playfair-display-italique.woff2", "outfit.woff2", "OFL-Playfair-Display.txt", "OFL-Outfit.txt"]],
  logo: ["public/logo", ["360-immo-logo-fond-sombre.svg", "360-immo-symbole-fond-sombre.svg", "360-immo-logo.svg", "360-immo-symbole.svg"]],
};
for (const [dossier, [source, fichiers]] of Object.entries(copies)) {
  mkdirSync(path.join(PUBLIC, dossier), { recursive: true });
  for (const f of fichiers) cpSync(path.join(SITE, source, f), path.join(PUBLIC, dossier, f));
}

// Polices de la boîte à outils motion design (src/motion/polices.ts), installées par npm : Bricolage Grotesque et Caveat Brush
const MODULES = path.join(ICI, "../node_modules");
const polices = {
  "bricolage-grotesque-latin.woff2": "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  "bricolage-grotesque-latin-ext.woff2": "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-wght-normal.woff2",
  "caveat-brush-latin.woff2": "@fontsource/caveat-brush/files/caveat-brush-latin-400-normal.woff2",
  "caveat-brush-latin-ext.woff2": "@fontsource/caveat-brush/files/caveat-brush-latin-ext-400-normal.woff2",
  "OFL-Bricolage-Grotesque.txt": "@fontsource-variable/bricolage-grotesque/LICENSE",
  "OFL-Caveat-Brush.txt": "@fontsource/caveat-brush/LICENSE",
};
for (const [nom, source] of Object.entries(polices)) cpSync(path.join(MODULES, source), path.join(PUBLIC, "polices", nom));
