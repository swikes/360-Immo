// Fabrique les vidéos : sortie/<nom>.mp4, une par public de scripts.json (ou seulement celles données : npm run rendu -- annonceurs).
// Avant : les captures du site (public/ecrans) et la voix off (npm run voix) ; voir README.md.
// Navigateur : celui de Playwright s'il est installé, sinon Remotion télécharge le sien ; ou NAVIGATEUR=/chemin/vers/chrome.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import scripts from "../src/scripts.json" with { type: "json" };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.join(ICI, "..");

function navigateurPlaywright() {
  const dossier = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), ".cache/ms-playwright");
  if (!existsSync(dossier)) return null;
  for (const d of readdirSync(dossier).filter((x) => x.startsWith("chromium_headless_shell-")).sort().reverse()) {
    const chemin = path.join(dossier, d, "chrome-linux/headless_shell");
    if (existsSync(chemin)) return chemin;
  }
  return null;
}

execFileSync("node", [path.join(ICI, "preparer.mjs")], { stdio: "inherit" });
const navigateur = process.env.NAVIGATEUR || navigateurPlaywright();
const videos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scripts);
for (const nom of videos) {
  execFileSync("npx", ["remotion", "render", "src/index.ts", nom, `sortie/${nom}.mp4`,
    ...(navigateur ? ["--browser-executable", navigateur] : [])], { stdio: "inherit", cwd: RACINE });
  // image d'aperçu (couverture sur WhatsApp, Facebook, YouTube…) : la dernière seconde, avec le logo et le bouton
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-sseof", "-1", "-i", `sortie/${nom}.mp4`, "-frames:v", "1",
    "-q:v", "2", `sortie/${nom}.jpg`], { stdio: "inherit", cwd: RACINE });
}
