/*
 * Petites fonctions d'animation, en images (30 par seconde). Toutes partent de l'image courante de la scène.
 *   entree(f, debut)       0 → 1 avec un léger dépassement (ressort) : apparitions, « pop »
 *   doux(f, debut, duree)  0 → 1 sans dépassement : déplacements, fondus
 *   flotte(f, periode)     -1 → 1 en continu : respiration, objets qui flottent
 */
import { Easing, interpolate, spring } from "remotion";
import { IPS } from "./palette";

/** Ressort : 0 → 1 en ~0,5 s, avec un léger rebond (amorti = 12 : vif ; 18 : sage) */
export function entree(f: number, debut = 0, amorti = 12, raideur = 170) {
  return spring({ frame: f - debut, fps: IPS, config: { damping: amorti, stiffness: raideur, mass: 0.9 } });
}

/** 0 → 1 en douceur entre debut et debut + duree (images) */
export function doux(f: number, debut: number, duree: number, courbe = Easing.bezier(0.33, 0, 0.2, 1)) {
  return interpolate(f, [debut, debut + duree], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: courbe });
}

/** Comme doux, mais vif au départ puis freiné (pour les objets qui arrivent vite) */
export function freine(f: number, debut: number, duree: number) {
  return doux(f, debut, duree, Easing.bezier(0.1, 0.9, 0.2, 1));
}

/** Oscillation -1 → 1 (période en secondes), décalable */
export function flotte(f: number, periode = 2, decalage = 0) {
  return Math.sin(((f / IPS) / periode + decalage) * Math.PI * 2);
}

/** Secousse qui s'éteint : amplitude en pixels, pendant duree images à partir de debut */
export function secousse(f: number, debut: number, duree = 10, amplitude = 14) {
  const t = f - debut;
  if (t < 0 || t > duree) return 0;
  return Math.sin(t * 2.6) * amplitude * (1 - t / duree);
}

/** Mélange linéaire */
export const melange = (a: number, b: number, t: number) => a + (b - a) * t;

/** Entre deux valeurs selon une progression 0 → 1 déjà calculée */
export const entre = (t: number, de: number, a: number) => de + (a - de) * t;

/** Clignement des yeux (true pendant 4 images, toutes les ~3 s, décalé par personnage) */
export function cligne(f: number, decalage = 0) {
  const cycle = 97 + (decalage % 23);
  return (f + decalage) % cycle < 4;
}

/** Ralenti : 0 → 1 vite au début, très lent au milieu (l'instant suspendu), vite à la fin */
export function ralenti(f: number, debut: number, duree: number) {
  return doux(f, debut, duree, Easing.bezier(0.06, 0.72, 0.94, 0.28));
}

/** Élan : arrive très vite puis glisse longtemps, comme au ralenti (0 → 1) */
export function elan(f: number, debut: number, duree: number) {
  return doux(f, debut, duree, Easing.bezier(0.16, 1, 0.3, 1));
}
