/*
 * Ce que montrent les vidéos :
 *   scripts.json  le texte de chaque scène (titre, voix off, sous-titres) — c'est lui qu'on modifie ;
 *   durees.json   la durée de la voix off de chaque scène (npm run voix) ;
 *   ecrans.json   les captures du site et l'élément à mettre en avant (site/tests/captures-video.spec.ts).
 */
import scripts from "./scripts.json";
import durees from "./durees.json";
import ecrans from "./ecrans.json";
import { APRES_VOIX, AVANT_VOIX, FONDU, IPS, TENUE_FIN } from "./theme";

export type Scene = {
  id: string;
  ecran: string | null;            // capture du site (ecrans.json) ; null : ouverture ou fin
  titre: string;                   // *mot* : en doré et en italique
  texte: string;                   // ce que dit la voix off, tel qu'il s'écrit (sous-titres)
  voix?: string;                   // le même texte, tel qu'il se prononce (« trois cent soixante Immo point C I »)
  mots?: [string, string][];       // ouverture : [icône, mot] qui apparaissent l'un après l'autre
  apercus?: string[];              // ouverture : captures montrées en bas de l'écran
  atouts?: string[];               // fin : les points forts, cochés
};
export type Script = { titre: string; appel: string; scenes: Scene[] };
export type Ecran = { fichier: string; largeur: number; hauteur: number; cible: { x: number; y: number; w: number; h: number } };

export type NomVideo = keyof typeof scripts;
export const VIDEOS = Object.keys(scripts) as NomVideo[];
export const SCRIPTS = scripts as unknown as Record<NomVideo, Script>;
export const ECRANS = ecrans as Record<string, Ecran>;
const DUREES = durees as Record<string, Record<string, number>>;

export type ScenePlacee = Scene & { duree: number; debut: number; voixImages: number };

/** Les scènes d'une vidéo, chacune calée sur sa voix off, avec son début dans la vidéo (les fondus se chevauchent) */
export function plan(nom: NomVideo): ScenePlacee[] {
  const scenes = SCRIPTS[nom].scenes;
  let debut = 0;
  return scenes.map((s, i) => {
    const voixImages = Math.ceil((DUREES[nom]?.[s.id] ?? 3) * IPS);
    const duree = AVANT_VOIX + voixImages + APRES_VOIX + (i === scenes.length - 1 ? TENUE_FIN : 0);
    const placee = { ...s, duree, debut, voixImages };
    debut += duree - FONDU;
    return placee;
  });
}

export function dureeVideo(nom: NomVideo) {
  const fin = plan(nom).at(-1)!;
  return fin.debut + fin.duree;
}
