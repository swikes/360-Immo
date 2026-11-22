/*
 * Éléments de base, tous animés depuis l'image courante f et leur image d'arrivée « debut » :
 *   <Pastille>  pilule avec icône (points forts)        <Carte>   carte avec icône, qui pivote en arrivant
 *   <Bulle>     bulle de dialogue (personnages)          <Tampon>  coup de tampon (« VÉRIFIÉE »)
 *   <Logo>      logo du site (public/logo)               <Bruit>   un bruitage de public/bruitages à une image donnée
 * Icônes : celles de lucide-react (traits, jamais d'emoji), passées en élément : icone={<House />}.
 */
import { cloneElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Audio, Img, Sequence, staticFile } from "remotion";
import { doux, entree, secousse } from "./anim";
import { MAIN, P, TITRE } from "./palette";

/** Une icône lucide-react en élément : <House /> */
export type Icone = ReactElement<{ size?: number; color?: string; strokeWidth?: number }>;
const icone = (i: Icone | undefined, taille: number, couleur: string, epaisseur = 2.4) =>
  i ? cloneElement(i, { size: taille, color: couleur, strokeWidth: epaisseur }) : null;

/** Pilule : icône dans un rond + texte */
export function Pastille({ texte, f, debut, icone: ic, fond = P.vertPale, couleur = P.vert, fondIcone = P.vert, taille = 52, style }: {
  texte: string; f: number; debut: number; icone?: Icone; fond?: string; couleur?: string; fondIcone?: string; taille?: number;
  style?: CSSProperties;
}) {
  const p = entree(f, debut, 11, 200);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: taille * 0.35, padding: `${taille * 0.28}px ${taille * 0.55}px ${taille * 0.28}px ${taille * 0.28}px`,
      background: fond, borderRadius: 999, fontFamily: TITRE, fontWeight: 700, fontSize: taille, color: couleur, whiteSpace: "nowrap",
      boxShadow: "0 10px 30px rgba(17,59,39,0.10)", transform: `scale(${p})`, opacity: Math.min(1, p * 2), ...style }}>
      {ic && (
        <span style={{ width: taille * 1.15, height: taille * 1.15, borderRadius: 999, background: fondIcone, display: "grid", placeItems: "center",
          transform: `rotate(${(1 - entree(f, debut + 4, 10, 200)) * -90}deg)` }}>
          {icone(ic, taille * 0.7, P.blanc, 3)}
        </span>
      )}
      {texte}
    </div>
  );
}

/** Carte : icône sur un carré pâle, titre, sous-titre ; arrive en pivotant (3D) */
export function Carte({ f, debut, icone: ic, titre, sousTitre, largeur = 340, x, y, rotation = 0, fond = P.blanc, accent = P.vert,
  fondIcone = P.vertPale, enfants, style }: {
  f: number; debut: number; icone?: Icone; titre?: string; sousTitre?: string; largeur?: number; x: number; y: number;
  rotation?: number; fond?: string; accent?: string; fondIcone?: string; enfants?: ReactNode; style?: CSSProperties;
}) {
  const p = entree(f, debut, 12, 150);
  return (
    <div style={{ position: "absolute", left: x - largeur / 2, top: y, width: largeur, perspective: 1400 }}>
      <div style={{ background: fond, borderRadius: largeur * 0.09, padding: largeur * 0.07, boxShadow: "0 24px 60px rgba(28,28,30,0.14), 0 2px 0 rgba(28,28,30,0.06)",
        border: `4px solid ${P.encre}`, transform: `rotateY(${(1 - p) * -80}deg) rotate(${rotation * p}deg) scale(${0.6 + 0.4 * p})`,
        opacity: Math.min(1, p * 2), transformOrigin: "50% 50%", ...style }}>
        {ic && (
          <div style={{ background: fondIcone, borderRadius: largeur * 0.06, height: largeur * 0.62, display: "grid", placeItems: "center" }}>
            {icone(ic, largeur * 0.3, accent, 2.2)}
          </div>
        )}
        {enfants}
        {titre && <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: largeur * 0.12, color: P.encre, marginTop: largeur * 0.05, textAlign: "center" }}>{titre}</div>}
        {sousTitre && <div style={{ fontFamily: TITRE, fontWeight: 600, fontSize: largeur * 0.085, color: P.gris, textAlign: "center" }}>{sousTitre}</div>}
      </div>
    </div>
  );
}

/** Bulle de dialogue ; « queue » : où pointe la pointe (vers le personnage qui parle) */
export function Bulle({ texte, f, debut, fin, x, y, largeur = 560, queue = "bas-gauche", fond = P.blanc, couleur = P.encre, taille = 66, police = MAIN, rotation = -3 }: {
  texte: ReactNode; f: number; debut: number; fin?: number; x: number; y: number; largeur?: number;
  queue?: "bas-gauche" | "bas-droite" | "haut-gauche" | "haut-droite"; fond?: string; couleur?: string; taille?: number; police?: string; rotation?: number;
}) {
  const p = entree(f, debut, 10, 220) * (fin === undefined ? 1 : 1 - doux(f, fin, 6));
  if (p <= 0.001) return null;
  const bas = queue.startsWith("bas"), gauche = queue.endsWith("gauche");
  const origine = `${gauche ? "15%" : "85%"} ${bas ? "100%" : "0%"}`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, transform: `rotate(${rotation}deg) scale(${p})`, transformOrigin: origine }}>
      <div style={{ position: "relative", background: fond, border: `5px solid ${P.encre}`, borderRadius: 48, padding: "28px 38px",
        fontFamily: police, fontSize: taille, lineHeight: 1.05, color: couleur, textAlign: "center", boxShadow: `10px 12px 0 ${P.encre}` }}>
        {texte}
        <svg width={90} height={70} viewBox="0 0 90 70" style={{ position: "absolute", [bas ? "bottom" : "top"]: -62, [gauche ? "left" : "right"]: 60,
          transform: `${gauche ? "" : "scaleX(-1)"} ${bas ? "" : "scaleY(-1)"}` }}>
          <path d="M4 0 L70 0 L10 66 Z" fill={fond} stroke={P.encre} strokeWidth={5} strokeLinejoin="round" />
          <rect x={0} y={-6} width={78} height={9} fill={fond} />
        </svg>
      </div>
    </div>
  );
}

/** Coup de tampon : arrive de très près, s'écrase, la scène tremble */
export function Tampon({ texte, f, debut, fin, icone: ic, couleur = P.vert, x, y, rotation = -12, taille = 96 }: {
  texte: string; f: number; debut: number; fin?: number; icone?: Icone; couleur?: string; x: number; y: number; rotation?: number; taille?: number;
}) {
  if (f < debut || (fin !== undefined && f >= fin + 6)) return null;
  const part = fin === undefined ? 0 : doux(f, fin, 6);
  const t = f - debut;
  const chute = Math.min(1, t / 5);
  const echelle = 3.2 - 2.2 * chute * chute + (t >= 5 ? secousse(f, debut + 5, 8, 0.04) : 0);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${echelle})`,
      opacity: Math.min(1, t / 3) * (1 - part), display: "flex", alignItems: "center", gap: taille * 0.25, padding: `${taille * 0.2}px ${taille * 0.4}px`,
      border: `${taille * 0.09}px solid ${couleur}`, borderRadius: taille * 0.25, color: couleur, fontFamily: TITRE, fontWeight: 800,
      fontSize: taille, letterSpacing: "0.04em", background: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
      {icone(ic, taille * 0.95, couleur, 2.6)}
      {texte}
    </div>
  );
}

/** Logo du site (copié par outils/preparer.mjs) ; « symbole » : la maison seule */
export function Logo({ largeur, sombre = false, symbole = false, style }: { largeur: number; sombre?: boolean; symbole?: boolean; style?: CSSProperties }) {
  const nom = `logo/360-immo-${symbole ? "symbole" : "logo"}${sombre ? "-fond-sombre" : ""}.svg`;
  return <Img src={staticFile(nom)} style={{ width: largeur, display: "block", ...style }} />;
}

export type NomBruit = "fouet" | "pop" | "clic" | "tic" | "ding" | "tampon" | "caisse" | "boing" | "trombone";

/** Un bruitage (outils/motion/bruitages.mjs) qui part à l'image « a » */
export function Bruit({ nom, a, volume = 0.5, vitesse = 1 }: { nom: NomBruit; a: number; volume?: number; vitesse?: number }) {
  return (
    <Sequence from={Math.round(a)} durationInFrames={90} layout="none">
      <Audio src={staticFile(`bruitages/${nom}.wav`)} volume={volume} playbackRate={vitesse} />
    </Sequence>
  );
}
