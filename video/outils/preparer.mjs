// Copie dans public/ ce que les vidéos reprennent du site : ses polices (avec leur licence) et son logo.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.join(ICI, "../../site");
const PUBLIC = path.join(ICI, "../public");

const copies = {
  polices: ["app/polices", ["playfair-display.woff2", "playfair-display-italique.woff2", "outfit.woff2", "OFL-Playfair-Display.txt", "OFL-Outfit.txt"]],
  logo: ["public/logo", ["360-immo-logo-fond-sombre.svg", "360-immo-symbole-fond-sombre.svg"]],
};
for (const [dossier, [source, fichiers]] of Object.entries(copies)) {
  mkdirSync(path.join(PUBLIC, dossier), { recursive: true });
  for (const f of fichiers) cpSync(path.join(SITE, source, f), path.join(PUBLIC, dossier, f));
}
