// Voix off provisoire de chaque scène (src/scripts.json) : synthèse vocale française hors ligne (SVOX Pico, pico2wave),
// volume harmonisé (ffmpeg), puis durée de chaque scène dans src/durees.json (la vidéo se cale dessus).
// À remplacer par la voix d'un comédien (ou d'un service de voix) : mêmes noms de fichiers dans public/voix/.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import scripts from "../src/scripts.json" with { type: "json" };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOSSIER = path.join(ICI, "../public/voix");
mkdirSync(DOSSIER, { recursive: true });
const brouillon = mkdtempSync(path.join(tmpdir(), "voix-"));
const durees = {};

for (const [video, { scenes }] of Object.entries(scripts)) {
  durees[video] = {};
  for (const s of scenes) {
    const brut = path.join(brouillon, `${video}-${s.id}.wav`);
    const fichier = path.join(DOSSIER, `${video}-${s.id}.wav`);
    execFileSync("pico2wave", ["-l", "fr-FR", "-w", brut, s.voix ?? s.texte]);
    // silences du début et de la fin retirés (la vidéo place elle-même ses pauses), un peu plus lent et plus grave que
    // la voix brute, volume harmonisé (norme des réseaux sociaux), 48 kHz
    const silence = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05";
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", brut,
      "-af", `${silence},areverse,${silence},areverse,asetrate=16000*0.97,aresample=48000,atempo=0.98,loudnorm=I=-16:TP=-1.5:LRA=11`,
      "-ar", "48000", fichier]);
    const duree = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fichier]).toString());
    durees[video][s.id] = Math.round(duree * 100) / 100;
  }
}
writeFileSync(path.join(ICI, "../src/durees.json"), JSON.stringify(durees, null, 2) + "\n");
console.log(durees);
