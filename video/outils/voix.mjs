// Voix off de chaque scène (src/scripts.json, et la publicité : src/pub/voix.json), puis durée de chaque scène dans
// src/durees.json (les vidéos courtes se calent dessus ; la publicité place chaque réplique à son temps, « debut »).
//   npm run voix                  voix de Google (Gemini, voix « Achird ») : il faut une clé Gemini, dans la variable
//                                 GEMINI_API_KEY ou en secret réseau de l'environnement (voir README.md)
//   npm run voix -- --provisoire  voix de synthèse hors ligne (SVOX Pico, pico2wave), pour caler le rythme sans clé
//   npm run voix -- annonceurs    une seule vidéo
// Les deux finissent au même format : silences du début et de la fin retirés, volume harmonisé, 48 kHz, dans public/voix/.
// Pour la voix d'un comédien : mêmes noms de fichiers dans public/voix/, et leurs durées dans src/durees.json.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import scripts from "../src/scripts.json" with { type: "json" };
import publicite from "../src/pub/voix.json" with { type: "json" };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOSSIER = path.join(ICI, "../public/voix");
// Enregistrements bruts de Google, réutilisés tant que le texte ne change pas (quota gratuit : 10 voix par jour)
const BRUTES = path.join(ICI, "../voix-brutes");
const brouillon = mkdtempSync(path.join(tmpdir(), "voix-"));
mkdirSync(DOSSIER, { recursive: true });

const GEMINI = {
  modele: "gemini-3.8-flash-tts",
  voix: "Achird", // homme, chaleureux : choisie parmi 4 essais
  style: "Français standard de France, voix chaleureuse, souriante et posée, comme une publicité à la radio. "
    + "Marque une longue pause, d'au moins deux secondes, entre deux paragraphes.",
};
/** Le nom du site tel qu'il doit se dire */
const prononcer = (t) => t.replaceAll("360-Immo.ci", "trois cent soixante Immo point cé i");
const empreinte = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

const duree = (fichier) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fichier]).toString());

/** Silences du début et de la fin retirés, volume harmonisé (norme des réseaux sociaux), 48 kHz ; un filtre en plus avant */
function finir(entree, sortie, { debut, fin, avant } = {}) {
  const silence = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05";
  const filtres = [avant, silence, "areverse", silence, "areverse", "loudnorm=I=-16:TP=-1.5:LRA=11"].filter(Boolean).join(",");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...(debut !== undefined ? ["-ss", String(debut), "-to", String(fin)] : []),
    "-i", entree, "-af", filtres, "-ar", "48000", "-ac", "1", sortie]);
}

// ── Voix provisoire (hors ligne) ──
function provisoire(video, scenes) {
  for (const s of scenes) {
    const brut = path.join(brouillon, `${video}-${s.id}.wav`);
    execFileSync("pico2wave", ["-l", "fr-FR", "-w", brut, s.voix ?? s.texte]);
    // un peu plus lente et plus grave que la voix brute
    finir(brut, path.join(DOSSIER, `${video}-${s.id}.wav`), { avant: "asetrate=16000*0.97,aresample=48000,atempo=0.98" });
  }
  return "voix provisoire";
}

// ── Voix de Google (Gemini) ──
/** Un enregistrement : le texte est dit ; le style (ton, pauses) guide la voix sans être lu */
function enregistrer(texte, fichier, style = GEMINI.style) {
  const corps = {
    model: GEMINI.modele,
    input: [{ type: "user_input", content: [{ type: "text", text: texte, annotations: [{ type: "speech_metadata", style }] }] }],
    response_format: { type: "audio", mime_type: "audio/wav" },
    generation_config: { speech_config: [{ voice: GEMINI.voix }] },
    store: false,
  };
  // la clé (si elle est dans GEMINI_API_KEY) passe par un fichier, pas par la ligne de commande ; sans elle, c'est le
  // secret réseau de l'environnement qui l'ajoute en chemin
  const entetes = path.join(brouillon, "entetes");
  writeFileSync(entetes, `Content-Type: application/json\n${process.env.GEMINI_API_KEY ? `x-goog-api-key: ${process.env.GEMINI_API_KEY}\n` : ""}`,
    { mode: 0o600 });
  for (let essai = 1; ; essai++) {
    const reponse = execFileSync("curl", ["-sS", "--max-time", "300", "-w", "\n%{http_code}", "-H", `@${entetes}`, "--data-binary", "@-",
      "https://generativelanguage.googleapis.com/v1beta/interactions"], { input: JSON.stringify(corps), maxBuffer: 64 << 20 }).toString();
    const code = Number(reponse.slice(reponse.lastIndexOf("\n") + 1));
    const json = JSON.parse(reponse.slice(0, reponse.lastIndexOf("\n")) || "{}");
    if (code === 200 && json.status === "completed") {
      const audio = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).filter((c) => c.type === "audio");
      if (audio.length !== 1) throw new Error("Google n'a pas renvoyé un seul enregistrement");
      writeFileSync(fichier, Buffer.from(audio[0].data, "base64"));
      return;
    }
    const message = json.error?.message ?? `réponse ${code}`;
    if (code === 429 && /per day/i.test(message)) throw new Error(`Quota de Google atteint : ${message}`); // inutile d'insister
    if ([429, 500, 503].includes(code) && essai < 6) {
      execFileSync("sleep", [String(10 * essai)]);
      continue;
    }
    throw new Error(`Google : ${message}`);
  }
}

/** Les silences d'au moins 0,35 s : [début, fin] (ffmpeg les écrit dans son journal) */
function silences(fichier) {
  const journal = spawnSync("ffmpeg", ["-hide_banner", "-i", fichier, "-af", "silencedetect=noise=-40dB:d=0.35", "-f", "null", "-"]).stderr.toString();
  return [...journal.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

/**
 * Découpe la prise d'une vidéo en ses scènes, aux n-1 plus longues pauses. Refuse (null) si ces pauses ne se distinguent
 * pas nettement des autres, ou si un morceau n'a pas à peu près la durée que demande son texte.
 */
function decouper(fichier, textes) {
  const total = duree(fichier);
  const n = textes.length;
  const pauses = silences(fichier).filter(([d, f]) => d > 0.05 && f < total - 0.05).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  if (pauses.length < n - 1) return null;
  const retenues = pauses.slice(0, n - 1);
  const plusCourte = Math.min(...retenues.map(([d, f]) => f - d));
  const suivante = pauses[n - 1] ? pauses[n - 1][1] - pauses[n - 1][0] : 0;
  if (plusCourte < 0.8 || plusCourte < suivante * 1.3) return null;
  const bornes = [0, ...retenues.map(([d, f]) => (d + f) / 2).sort((a, b) => a - b), total];
  const morceaux = textes.map((_, i) => [bornes[i], bornes[i + 1]]);
  const lettres = textes.reduce((a, t) => a + t.length, 0);
  const plausibles = morceaux.every(([d, f], i) => {
    const rapport = (f - d) / total / (textes[i].length / lettres);
    return rapport > 0.5 && rapport < 2;
  });
  return plausibles ? morceaux : null;
}

function gemini(video, scenes, style = GEMINI.style) {
  mkdirSync(BRUTES, { recursive: true });
  const textes = scenes.map((s) => prononcer(s.texte));
  // une seule prise pour toute la vidéo : une seule voix du quota, et le même ton d'une scène à l'autre
  const prise = path.join(BRUTES, `${video}-${empreinte([GEMINI, style, textes])}.wav`);
  if (!existsSync(prise)) enregistrer(textes.join("\n\n"), prise, style);
  const morceaux = decouper(prise, textes);
  if (morceaux) {
    scenes.forEach((s, i) => finir(prise, path.join(DOSSIER, `${video}-${s.id}.wav`), { debut: morceaux[i][0], fin: morceaux[i][1] }));
    return "une prise, découpée en scènes";
  }
  // découpe incertaine : une prise par scène
  scenes.forEach((s, i) => {
    const seule = path.join(BRUTES, `${video}-${s.id}-${empreinte([GEMINI, style, textes[i]])}.wav`);
    if (!existsSync(seule)) enregistrer(textes[i], seule, style);
    finir(seule, path.join(DOSSIER, `${video}-${s.id}.wav`));
  });
  return "une prise par scène";
}

const voixProvisoire = process.argv.includes("--provisoire");
const videos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const fichierDurees = path.join(ICI, "../src/durees.json");
const durees = existsSync(fichierDurees) ? JSON.parse(readFileSync(fichierDurees, "utf8")) : {};
for (const [video, { scenes, style }] of Object.entries({ ...scripts, ...publicite })) {
  if (videos.length && !videos.includes(video)) continue;
  const comment = voixProvisoire ? provisoire(video, scenes) : gemini(video, scenes, style);
  durees[video] = Object.fromEntries(scenes.map((s) => [s.id, Math.round(duree(path.join(DOSSIER, `${video}-${s.id}.wav`)) * 100) / 100]));
  console.log(`${video} (${comment}) :`, durees[video]);
}
writeFileSync(fichierDurees, JSON.stringify(durees, null, 2) + "\n");
