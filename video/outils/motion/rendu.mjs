// Fabrique une publicité « motion design » prête à publier :
//   node outils/motion/rendu.mjs pub-demarcheur            →  sortie/pub-demarcheur.mp4 et sortie/pub-demarcheur.jpg
//   node outils/motion/rendu.mjs pub-demarcheur --brouillon →  sortie/pub-demarcheur-brouillon.mp4 (moitié de la taille,
//                                                             rapide) et ses planches de contrôle (sortie/controle/)
// Étapes : copie des polices et du logo (outils/preparer.mjs), bruitages (outils/motion/bruitages.mjs), rendu Remotion,
// puis son remis à -14 LUFS (niveau habituel des réseaux sociaux ; WhatsApp ne corrige pas le volume) et image de
// couverture (écran de fin). Il faut ffmpeg ; les voix doivent être prêtes (outils/motion/voix.mjs).
// Navigateur : celui de Remotion, ou un autre avec la variable NAVIGATEUR (ex. chrome-headless-shell déjà installé).
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(path.dirname(new URL(import.meta.url).pathname), "../..");
const [pub, option] = process.argv.slice(2);
if (!pub) throw new Error("Donner le nom de la publicité : node outils/motion/rendu.mjs pub-demarcheur");
const brouillon = option === "--brouillon";
const lancer = (commande, args) => execFileSync(commande, args, { cwd: RACINE, stdio: "inherit" });

if (!existsSync(path.join(RACINE, "public/voix", pub))) throw new Error(`Voix absentes : node outils/motion/voix.mjs ${pub}`);
lancer("node", ["outils/preparer.mjs"]);
lancer("node", ["outils/motion/bruitages.mjs"]);

const brut = path.join("sortie", `${pub}-brut.mp4`);
const final = path.join("sortie", `${pub}${brouillon ? "-brouillon" : ""}.mp4`);
lancer("npx", ["remotion", "render", "src/index.ts", pub, brut, "--concurrency=4",
  ...(brouillon ? ["--scale=0.5"] : []),
  ...(process.env.NAVIGATEUR ? ["--browser-executable", process.env.NAVIGATEUR] : [])]);

// son à -14 LUFS, image inchangée
lancer("ffmpeg", ["-y", "-loglevel", "error", "-i", brut, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000",
  "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
rmSync(path.join(RACINE, brut));

if (brouillon) {
  lancer("bash", ["outils/motion/planches.sh", final, "12"]);
} else {
  // couverture : l'écran de fin, 1 s avant la fin
  const duree = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(RACINE, final)]).toString());
  const couverture = path.join("sortie", `${pub}.jpg`);
  lancer("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(0, duree - 1)), "-i", final, "-frames:v", "1", "-q:v", "2", couverture]);
}
console.log(`→ ${final}`);
