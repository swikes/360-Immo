/*
 * Minutage de la publicité « Le démarcheur » : les répliques s'enchaînent dans cet ordre, chacune après un petit
 * « souffle » (en images) compté depuis la fin de la parole de la précédente. Toutes les scènes se calent sur ces
 * répliques : changer une voix (outils/motion/voix.mjs) recale toute la vidéo.
 */
import voix from "./voix.json";

export type Replique = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "D1" | "D2" | "D3" | "D4";

const ORDRE: [Replique, number][] = [
  ["N1", 8], // Chercher une maison à Abidjan…
  ["N2", 6], // Ça fatigue !
  ["D1", 9], // Ma sœur ! Deux pièces…           (entrée du démarcheur)
  ["D2", 8], // Mais frais de visite d'abord…
  ["D3", 8], // Et c'est pas loin hein…
  ["N3", 10], // Avec 360Immo.ci…                  (coup de fouet vers le vert)
  ["N4", 16], // Les annonces sont vérifiées…
  ["N5", 7], // Vous appelez directement…
  ["N6", 8], // Et vous voyez le juste prix…
  ["D4", 12], // Eh Dieu… (le démarcheur, triste ; la musique se coupe)
  ["N7", 26], // 360Immo.ci : trouvez votre maison… (après le trombone)
];

const lignes = voix.lignes as Record<Replique, { enveloppe: number[]; images: number }>;

/** Dernière image où l'on entend vraiment la voix (la suite n'est que la queue du son) */
const finParole = (id: Replique) => {
  const e = lignes[id].enveloppe;
  let fin = e.length;
  while (fin > 0 && e[fin - 1] <= 0.06) fin--;
  return fin;
};

/** Pour chaque réplique : image de départ, fin de la parole, fin du fichier */
export const R = {} as Record<Replique, { debut: number; fin: number; images: number }>;
let curseur = 0;
for (const [id, souffle] of ORDRE) {
  const debut = curseur + souffle;
  R[id] = { debut, fin: debut + finParole(id), images: lignes[id].images };
  curseur = debut + finParole(id);
}

/** Fin de la vidéo : la dernière réplique, puis le temps de lire l'écran de fin */
export const DUREE = R.N7.fin + 28;

/** Ouverture de la bouche d'un personnage (0 → 1) pendant une de ses répliques, à l'image f */
export function bouche(ids: Replique[], f: number) {
  for (const id of ids) {
    const i = Math.round(f - R[id].debut);
    const e = lignes[id].enveloppe;
    if (i >= 0 && i < e.length) return Math.min(1, e[i] * 1.25);
  }
  return 0;
}

/** Quelqu'un parle-t-il autour de l'image f ? (0 → 1, avec un peu d'avance pour baisser la musique à temps) */
export function parole(f: number) {
  let m = 0;
  for (const id of Object.keys(R) as Replique[]) {
    for (let k = -6; k <= 8; k++) {
      const i = Math.round(f + k - R[id].debut);
      const e = lignes[id].enveloppe;
      if (i >= 0 && i < e.length && i < finParole(id) + 4) m = Math.max(m, e[i] > 0.05 ? 1 : 0);
    }
  }
  return m;
}
