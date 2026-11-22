// Voix d'une publicité « motion design » : chaque personnage est dit en UNE prise (même ton d'une réplique à l'autre),
// puis cette prise est découpée aux longues pauses, une réplique par morceau.
//   node outils/motion/voix.mjs pub-demarcheur
// Lit src/<pub>/repliques.json (prises brutes dans voix-brutes/, gardées hors du dépôt), écrit :
//   - public/voix/<pub>/<id>.wav : chaque réplique, un peu accélérée (« tempo »), même volume pour toutes, 48 kHz ;
//   - src/<pub>/voix.json : durée de chaque réplique (en images) et son enveloppe (volume 0 → 1, une valeur par image),
//     qui fait bouger la bouche des personnages et baisse la musique pendant qu'on parle.
// Il faut ffmpeg. La découpe garde les N - 1 plus longs silences (N répliques) : si une réplique a une longue pause
// au milieu, le contrôle ci-dessous le signale (durées affichées) ; refaire alors la prise avec des pauses plus nettes.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const IPS = 30;
const RACINE = path.join(path.dirname(new URL(import.meta.url).pathname), "../..");
const pub = process.argv[2];
if (!pub) throw new Error("Donner le nom de la publicité : node outils/motion/voix.mjs pub-demarcheur");
const repliques = JSON.parse(readFileSync(path.join(RACINE, "src", pub, "repliques.json"), "utf8"));
const SORTIE = path.join(RACINE, "public/voix", pub);
mkdirSync(SORTIE, { recursive: true });
const brouillon = mkdtempSync(path.join(tmpdir(), "voix-motion-"));
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);

/** Silences d'un fichier : [{ debut, fin }] en secondes (fin infinie : silence jusqu'au bout) */
function lireSilences(fichier) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", fichier, "-af", "silencedetect=noise=-40dB:d=0.2", "-f", "null", "-"]);
  const texte = r.stderr.toString();
  const debuts = [...texte.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const fins = [...texte.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return debuts.map((d, i) => ({ debut: d, fin: fins[i] ?? Infinity }));
}

/** Volume perçu d'un fichier (sonie intégrée, LUFS) */
function sonie(fichier) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", fichier, "-af", "ebur128", "-f", "null", "-"]);
  const m = [...r.stderr.toString().matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  if (!m) throw new Error(`Sonie illisible : ${fichier}`);
  return Number(m[1]);
}

/** Échantillons (flottants, mono, 48 kHz) d'un fichier */
function echantillons(fichier) {
  const brut = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", fichier, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
    { maxBuffer: 1 << 28 });
  return new Float32Array(brut.buffer, brut.byteOffset, brut.byteLength / 4);
}

/** Volume (moyenne quadratique) de chaque image */
function volumes(x) {
  const parImage = 48000 / IPS;
  const n = Math.ceil(x.length / parImage);
  return Array.from({ length: n }, (_, i) => {
    let s = 0;
    const a = Math.floor(i * parImage), b = Math.min(x.length, Math.floor((i + 1) * parImage));
    for (let k = a; k < b; k++) s += x[k] * x[k];
    return Math.sqrt(s / Math.max(1, b - a));
  });
}

const resultat = { _: `Écrit par outils/motion/voix.mjs ${pub} : ne pas modifier à la main.`, ips: IPS, lignes: {} };

for (const [nom, prise] of Object.entries(repliques.prises)) {
  // 1. Accélérée et harmonisée en entier (même volume pour toutes ses répliques)
  const entiere = path.join(brouillon, `${nom}.wav`);
  ffmpeg("-i", path.join(RACINE, prise.fichier), "-af", `atempo=${repliques.tempo},loudnorm=I=-16:TP=-1.5:LRA=11`, "-ar", "48000", "-ac", "1", entiere);
  // 2. Coupée aux N - 1 plus longs silences (hors silence du début et de la fin)
  const tout = lireSilences(entiere);
  const n = prise.lignes.length;
  const interieurs = tout.filter((s) => s.debut > 0.05 && Number.isFinite(s.fin));
  if (interieurs.length < n - 1) throw new Error(`${nom} : ${interieurs.length} pauses trouvées pour ${n} répliques`);
  const coupes = [...interieurs].sort((a, b) => (b.fin - b.debut) - (a.fin - a.debut)).slice(0, n - 1).sort((a, b) => a.debut - b.debut);
  const bornes = [0, ...coupes.flatMap((c) => [c.debut, c.fin]), Infinity];
  const enveloppes = [];
  prise.lignes.forEach((ligne, i) => {
    const debut = Math.max(0, bornes[2 * i] - (i === 0 ? 0 : 0.06));
    const fin = bornes[2 * i + 1] + 0.12;
    const sortie = path.join(SORTIE, `${ligne.id}.wav`);
    const silence = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03";
    ffmpeg("-i", entiere, "-ss", String(debut), ...(Number.isFinite(fin) ? ["-to", String(fin)] : []),
      "-af", `${silence},areverse,${silence},areverse,afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse`, "-ar", "48000", "-ac", "1", sortie);
    // même volume perçu pour toutes les répliques (-16 LUFS), sans écrêter
    const brute = sortie.replace(/\.wav$/, ".brut.wav");
    renameSync(sortie, brute);
    ffmpeg("-i", brute, "-af", `volume=${(-16 - sonie(brute)).toFixed(2)}dB,alimiter=limit=0.89:level=false`, "-ar", "48000", "-ac", "1", sortie);
    rmSync(brute);
    const v = volumes(echantillons(sortie));
    enveloppes.push({ id: ligne.id, v });
  });
  // 3. Enveloppes ramenées à 0 → 1 (95e centile des volumes de ce personnage = 1)
  const tous = enveloppes.flatMap((e) => e.v).sort((a, b) => a - b);
  const reference = tous[Math.floor(tous.length * 0.95)] || 1;
  for (const e of enveloppes) {
    const env = e.v.map((x) => Math.round(Math.min(1, x / reference) * 100) / 100);
    resultat.lignes[e.id] = { personnage: nom, images: env.length, enveloppe: env };
    console.log(`${e.id.padEnd(3)} ${(env.length / IPS).toFixed(2)} s  ${prise.lignes.find((l) => l.id === e.id).texte}`);
  }
}
writeFileSync(path.join(RACINE, "src", pub, "voix.json"), JSON.stringify(resultat) + "\n");
console.log(`→ public/voix/${pub}/*.wav et src/${pub}/voix.json`);
