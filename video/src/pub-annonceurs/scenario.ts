/*
 * Minutage de la publicité « Annonceurs » : les répliques s'enchaînent dans cet ordre, chacune après un petit
 * « souffle » (en images) compté depuis la fin de la parole de la précédente. Toutes les scènes se calent sur ces
 * répliques : changer une voix (outils/motion/voix.mjs) recale toute la vidéo.
 */
import voix from "./voix.json";

export type Replique = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9" | "N10" | "N11" | "D1" | "D2";

const ORDRE: [Replique, number][] = [
  ["N1", 16], // Vous avez un bien à louer… ou à vendre ?   (ouverture au ralenti)
  ["N2", 8], // Et votre téléphone sonne… jour et nuit ?
  ["D1", 8], // Tonton ! Donne-moi la maison…              (le démarcheur)
  ["N3", 16], // Sur 360Immo.ci, vous avez votre vitrine…   (impact, la vitrine)
  ["N4", 6], // Partagez-la en un clic, sur WhatsApp.
  ["N5", 6], // Les clients vous écrivent, demandent une visite…
  ["N6", 8], // Publier ? C'est simple…
  ["N7", 8], // Avec le Premium…
  ["N8", 8], // Faites certifier votre compte…
  ["N9", 8], // Et un agent de 360Immo vient même visiter votre bien.
  ["N10", 8], // Compte sécurisé, contact WhatsApp…
  ["D2", 12], // Eh Dieu… Même moi je vais publier là-bas !
  ["N11", 14], // 360Immo.ci : publiez votre annonce… c'est gratuit !
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
export const DUREE = R.N11.fin + 45;

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
