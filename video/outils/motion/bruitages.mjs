// Bruitages de la boîte à outils « motion design », fabriqués ici par calcul (rien à télécharger, aucun droit à payer) :
//   node outils/motion/bruitages.mjs   →   public/bruitages/<nom>.wav (48 kHz, mono)
// fouet (transition), pop (apparition), clic, tic (compteur), ding (réussite), tampon (coup de tampon), caisse
// (« ka-ching » des pièces), boing (rebond), trombone (« wah wah » triste). Toujours les mêmes (hasard à graine fixe).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const TAUX = 48000;
const DOSSIER = path.join(path.dirname(new URL(import.meta.url).pathname), "../../public/bruitages");
mkdirSync(DOSSIER, { recursive: true });

// hasard reproductible
let graine = 360;
const hasard = () => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const vide = (secondes) => new Float32Array(Math.round(secondes * TAUX));

/** Filtre biquadratique (passe-bas, passe-haut, passe-bande), fréquence éventuellement variable : f(i) */
function filtre(x, type, frequence, q = 0.707) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = typeof frequence === "function" ? frequence(i) : frequence;
    const w = (2 * Math.PI * Math.min(f, TAUX * 0.45)) / TAUX, a = Math.sin(w) / (2 * q), c = Math.cos(w);
    let b0, b1, b2;
    if (type === "bas") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (type === "haut") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [a, 0, -a];
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Oscillateur sinusoïdal à fréquence variable f(t), amplitude a(t) (t en secondes), ajouté à x */
function sinus(x, f, a, debut = 0) {
  let phase = 0;
  for (let i = Math.round(debut * TAUX); i < x.length; i++) {
    const t = i / TAUX - debut;
    phase += (2 * Math.PI * f(t)) / TAUX;
    x[i] += Math.sin(phase) * a(t);
  }
  return x;
}

/** Enveloppe percussive : attaque (s) puis chute exponentielle (constante de temps, s) */
const perc = (attaque, chute) => (t) => (t < attaque ? t / attaque : Math.exp(-(t - attaque) / chute));

function normaliser(x, crete = 0.85) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] = (x[i] / (m || 1)) * crete;
  // petits fondus aux bords (pas de claquement)
  const n = Math.min(240, x.length / 4);
  for (let i = 0; i < n; i++) { x[i] *= i / n; x[x.length - 1 - i] *= i / n; }
  return x;
}

function ecrire(nom, x) {
  const donnees = Buffer.alloc(44 + x.length * 2);
  donnees.write("RIFF", 0); donnees.writeUInt32LE(36 + x.length * 2, 4); donnees.write("WAVE", 8);
  donnees.write("fmt ", 12); donnees.writeUInt32LE(16, 16); donnees.writeUInt16LE(1, 20); donnees.writeUInt16LE(1, 22);
  donnees.writeUInt32LE(TAUX, 24); donnees.writeUInt32LE(TAUX * 2, 28); donnees.writeUInt16LE(2, 32); donnees.writeUInt16LE(16, 34);
  donnees.write("data", 36); donnees.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => donnees.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  writeFileSync(path.join(DOSSIER, `${nom}.wav`), donnees);
  console.log(`public/bruitages/${nom}.wav  ${(x.length / TAUX).toFixed(2)} s`);
}

// ── Fouet : souffle filtré dont la fréquence monte puis redescend (transition rapide)
{
  const d = 0.42, x = vide(d).map(() => hasard());
  const f = (i) => { const t = i / TAUX / d; return 300 + 4200 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 2; };
  const y = filtre(x, "bande", f, 1.4);
  for (let i = 0; i < y.length; i++) { const t = i / TAUX / d; y[i] *= Math.sin(Math.PI * Math.min(1, t)) ** 1.5; }
  ecrire("fouet", normaliser(y, 0.7));
}

// ── Pop : bulle qui éclate (note qui descend très vite)
{
  const x = sinus(vide(0.16), (t) => 380 + 900 * Math.exp(-t / 0.018), perc(0.002, 0.035));
  ecrire("pop", normaliser(x, 0.8));
}

// ── Clic (bouton) et tic (compteur, bloc de bois)
{
  const c = vide(0.06);
  for (let i = 0; i < 90; i++) c[i] = hasard() * Math.exp(-i / 25);
  sinus(c, () => 2400, perc(0.0005, 0.008));
  ecrire("clic", normaliser(filtre(c, "haut", 900), 0.6));
  const t = vide(0.08).map((_, i) => hasard() * Math.exp(-i / 160));
  ecrire("tic", normaliser(filtre(t, "bande", 1900, 4), 0.6));
}

// ── Ding : deux notes claires (réussite, « vérifié »)
{
  const x = vide(1.1);
  sinus(x, () => 1318.5, (t) => 0.6 * perc(0.003, 0.35)(t));
  sinus(x, () => 2637, (t) => 0.15 * perc(0.003, 0.18)(t));
  sinus(x, () => 1760, (t) => 0.6 * perc(0.003, 0.45)(t), 0.11);
  sinus(x, () => 3520, (t) => 0.12 * perc(0.003, 0.2)(t), 0.11);
  ecrire("ding", normaliser(x, 0.7));
}

// ── Tampon : coup sourd et sec (« VÉRIFIÉE »)
{
  const x = sinus(vide(0.4), (t) => 55 + 90 * Math.exp(-t / 0.03), perc(0.001, 0.07));
  const bruit = filtre(vide(0.4).map((_, i) => hasard() * Math.exp(-i / 700)), "bas", 2500);
  for (let i = 0; i < x.length; i++) x[i] += bruit[i] * 0.7;
  ecrire("tampon", normaliser(x, 0.9));
}

// ── Caisse : « ka » (tiroir) puis « ching » (pièces et clochette) : frais de visite, argent
{
  const d = 1.1, x = vide(d);
  const ka = filtre(vide(d).map((_, i) => (i < 3000 ? hasard() * Math.exp(-i / 500) : 0)), "bande", 1200, 1.2);
  for (let i = 0; i < d * TAUX; i++) x[i] += ka[i] * 1.2;
  // partiels métalliques inharmoniques (cloche), et quelques pièces qui tintent
  for (const [f, a, c] of [[2093, 0.5, 0.5], [2793, 0.35, 0.4], [3520, 0.3, 0.3], [4699, 0.2, 0.22], [6272, 0.12, 0.15]])
    sinus(x, () => f, (t) => a * perc(0.002, c)(t), 0.09);
  for (let k = 0; k < 9; k++) {
    const debut = 0.12 + k * 0.045 + Math.abs(hasard()) * 0.03, f = 3800 + hasard() * 1500;
    sinus(x, () => f, (t) => 0.12 * perc(0.001, 0.04)(t), debut);
  }
  ecrire("caisse", normaliser(x, 0.75));
}

// ── Boing : ressort (note qui ondule en descendant)
{
  const x = sinus(vide(0.65), (t) => 140 + 260 * Math.exp(-t / 0.25) * (1 + 0.35 * Math.sin(2 * Math.PI * 14 * t)), perc(0.004, 0.22));
  ecrire("boing", normaliser(x, 0.8));
}

// ── Trombone triste : quatre notes qui descendent, la dernière tremble (« wah wah wah waaah »)
{
  const notes = [[0, 0.32, 233.1], [0.36, 0.32, 220], [0.72, 0.32, 207.7], [1.08, 1.0, 196]];
  const x = vide(2.2);
  for (const [debut, duree, f0] of notes) {
    const longue = duree > 0.5;
    const harm = [1, 0.6, 0.45, 0.3, 0.2, 0.12, 0.08];
    harm.forEach((a, k) => sinus(x, (t) => (f0 * (k + 1)) * (1 + (longue && t > 0.25 ? 0.025 * Math.sin(2 * Math.PI * 5.5 * t) : 0)) * (longue ? 1 - 0.03 * Math.min(1, t / duree) : 1),
      (t) => a * 0.3 * (t < duree ? Math.min(1, t / 0.04) * (t > duree - 0.06 ? (duree - t) / 0.06 : 1) : 0), debut));
  }
  // « wah » : le son s'ouvre puis se ferme (filtre), comme une sourdine
  const y = filtre(x, "bas", (i) => { const t = i / TAUX; const n = notes.findLast(([d]) => t >= d) ?? notes[0]; const u = (t - n[0]) / n[1]; return 400 + 1800 * Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7; }, 1.2);
  ecrire("trombone", normaliser(y, 0.7));
}
