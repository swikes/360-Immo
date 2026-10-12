// Images tirées du logo (svg/, fichiers du graphiste) : icônes du site, image d'aperçu des partages, logo des e-mails.
// À relancer si le logo change : node marque/generer.mjs   (depuis site/ ; utilise le Chromium de Playwright)
//   app/icon.svg            icône de l'onglet (navigateurs récents)
//   app/favicon.ico         icône de l'onglet (16, 32 et 48 pixels, tous navigateurs)
//   app/apple-icon.png      écran d'accueil d'un iPhone (180 × 180)
//   public/icones/*.png     écran d'accueil d'un Android (192, 512, et 512 « masquable »), voir app/manifest.ts
//   app/opengraph-image.png aperçu d'un lien partagé (WhatsApp, Facebook) quand la page n'a pas sa propre photo
//   public/logo/360-immo-logo-email.png  logo des e-mails (les messageries n'affichent pas le SVG)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SITE = path.join(ICI, "..");
const svg = (nom) => readFileSync(path.join(ICI, "svg", nom), "utf8").replace(/<title>.*?<\/title>/, "");
const SYMBOLE_SOMBRE = svg("360-immo-symbole-fond-sombre.svg");
const LOGO = svg("360-immo-logo.svg");
const VERT = "#1E5E3F"; // le vert du logo
const OUTFIT = readFileSync(path.join(SITE, "app/polices/outfit.woff2")).toString("base64");

const navigateur = await chromium.launch();
const page = await navigateur.newPage();

/** Rendu PNG d'un morceau de HTML, à la taille exacte demandée (fond transparent si le HTML n'en a pas) */
async function png(largeur, hauteur, corps) {
  await page.setViewportSize({ width: largeur, height: hauteur });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Outfit; src: url(data:font/woff2;base64,${OUTFIT}) format("woff2"); font-weight: 300 700; }
    html, body { margin: 0; width: ${largeur}px; height: ${hauteur}px; overflow: hidden; background: transparent; }
    svg { display: block; }
  </style></head><body>${corps}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: largeur, height: hauteur } });
}

/** Le symbole clair sur un carré vert (arrondi ou non) ; hauteurPart : hauteur du symbole / côté du carré */
const carre = (cote, { arrondi = 0.22, hauteurPart = 0.7 } = {}) => `
  <div style="width:${cote}px;height:${cote}px;border-radius:${Math.round(cote * arrondi)}px;background:${VERT};
              display:flex;align-items:center;justify-content:center;">
    <div style="height:${Math.round(cote * hauteurPart)}px;">${SYMBOLE_SOMBRE.replace("<svg ", '<svg style="height:100%;width:auto" ')}</div>
  </div>`;

// ── Icône de l'onglet, en SVG : le symbole clair sur un carré vert arrondi ──
const vb = SYMBOLE_SOMBRE.match(/viewBox="([\d.\s-]+)"/)[1].split(/\s+/).map(Number);
const [, , l, h] = vb;
const cote = h / 0.72;
const interieur = SYMBOLE_SOMBRE.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
writeFileSync(path.join(SITE, "app/icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cote.toFixed(2)} ${cote.toFixed(2)}">`
  + `<rect width="${cote.toFixed(2)}" height="${cote.toFixed(2)}" rx="${(cote * 0.22).toFixed(2)}" fill="${VERT}"/>`
  + `<g transform="translate(${((cote - l) / 2).toFixed(2)} ${((cote - h) / 2).toFixed(2)})">${interieur}</g></svg>\n`);

// ── favicon.ico : 16, 32 et 48 pixels (un fichier .ico peut contenir des PNG tels quels) ──
const tailles = [16, 32, 48];
const images = [];
for (const t of tailles) images.push(await png(t, t, carre(t, { arrondi: 0.18, hauteurPart: 0.78 })));
const entete = Buffer.alloc(6 + 16 * images.length);
entete.writeUInt16LE(0, 0);
entete.writeUInt16LE(1, 2);
entete.writeUInt16LE(images.length, 4);
let position = entete.length;
images.forEach((im, i) => {
  const o = 6 + 16 * i;
  entete.writeUInt8(tailles[i], o);
  entete.writeUInt8(tailles[i], o + 1);
  entete.writeUInt16LE(1, o + 4);   // plans
  entete.writeUInt16LE(32, o + 6);  // couleurs
  entete.writeUInt32LE(im.length, o + 8);
  entete.writeUInt32LE(position, o + 12);
  position += im.length;
});
writeFileSync(path.join(SITE, "app/favicon.ico"), Buffer.concat([entete, ...images]));

// ── Écran d'accueil : iPhone (carré plein, iOS arrondit lui-même), Android ──
writeFileSync(path.join(SITE, "app/apple-icon.png"), await png(180, 180, carre(180, { arrondi: 0, hauteurPart: 0.66 })));
mkdirSync(path.join(SITE, "public/icones"), { recursive: true });
writeFileSync(path.join(SITE, "public/icones/icone-192.png"), await png(192, 192, carre(192, { hauteurPart: 0.66 })));
writeFileSync(path.join(SITE, "public/icones/icone-512.png"), await png(512, 512, carre(512, { hauteurPart: 0.66 })));
// « masquable » : Android découpe l'icône (rond, goutte…) ; le symbole reste dans le cercle central
writeFileSync(path.join(SITE, "public/icones/icone-512-masquable.png"), await png(512, 512, carre(512, { arrondi: 0, hauteurPart: 0.5 })));

// ── Aperçu d'un lien partagé : 1200 × 630 ──
writeFileSync(path.join(SITE, "app/opengraph-image.png"), await png(1200, 630, `
  <div style="width:1200px;height:630px;background:#FAF8F3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:42px;
              border-bottom:14px solid ${VERT};box-sizing:border-box;">
    <div style="width:820px;">${LOGO.replace("<svg ", '<svg style="width:100%;height:auto" ')}</div>
    <div style="font-family:Outfit,sans-serif;font-size:40px;font-weight:500;color:#3A3A35;letter-spacing:0.2px;">
      Location et vente immobilière en Côte d'Ivoire
    </div>
  </div>`));

// ── Logo des e-mails : PNG deux fois plus grand qu'affiché (220 pixels de large), net sur les écrans fins ──
writeFileSync(path.join(SITE, "public/logo/360-immo-logo-email.png"),
  await png(440, 79, `<div style="width:440px;">${LOGO.replace("<svg ", '<svg style="width:100%;height:auto" ')}</div>`));

await navigateur.close();
console.log("Images du logo générées.");
