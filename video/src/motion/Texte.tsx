/*
 * Typographie animée :
 *   <Mots>       les mots arrivent un par un (ressort, flou qui se dissipe) ; certains mots en « pastille » colorée
 *   <MotFantome> un mot géant, très pâle, derrière la scène (profondeur, rappel du thème)
 *   <Trait>      trait dessiné à la main qui se trace : souligné, barré, entouré
 *   <NoteMain>   petite note manuscrite avec sa flèche (l'humour, les apartés)
 */
import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import { doux, entree } from "./anim";
import { MAIN, P, TITRE } from "./palette";

type Accent = { fond: string; couleur: string };

export function Mots({
  texte, f, debut = 0, ecart = 3, taille = 110, couleur = P.encre, poids = 800, police = TITRE, largeur = 940,
  accents = {}, interligne = 1.08, style, sortie,
}: {
  texte: string;
  f: number;
  debut?: number;
  /** images entre deux mots */
  ecart?: number;
  taille?: number;
  couleur?: string;
  poids?: number;
  police?: string;
  largeur?: number;
  /** mots mis en pastille : { "palabres": { fond, couleur } } (sans la ponctuation) */
  accents?: Record<string, Accent>;
  interligne?: number;
  style?: CSSProperties;
  /** image où les mots repartent (vers le haut, en fondu) */
  sortie?: number;
}) {
  const mots = texte.split(" ");
  const part = sortie === undefined ? 0 : doux(f, sortie, 8);
  return (
    <div style={{ width: largeur, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline",
      columnGap: taille * 0.26, rowGap: taille * 0.12, fontFamily: police, fontWeight: poids, fontSize: taille,
      lineHeight: interligne, color: couleur, letterSpacing: "-0.03em", textAlign: "center", ...style }}>
      {mots.map((mot, i) => {
        const p = entree(f, debut + i * ecart, 13, 190);
        const visible = Math.min(1, p * 1.6);
        const accent = accents[mot.replace(/[!?.,…:;]+$/u, "")];
        const fondPastille = accent ? entree(f, debut + i * ecart + 2, 14, 160) : 0;
        return (
          <span key={i} style={{
            display: "inline-block", position: "relative", opacity: visible * (1 - part),
            transform: `translateY(${(1 - p) * taille * 0.5 - part * 60}px) scale(${0.7 + 0.3 * p})`,
            filter: `blur(${(1 - visible) * 10}px)`, color: accent ? accent.couleur : undefined,
            padding: accent ? `0 ${taille * 0.2}px` : undefined,
          }}>
            {accent && (
              <span style={{ position: "absolute", inset: `${taille * 0.04}px 0 ${taille * 0.02}px 0`, borderRadius: taille * 0.3,
                background: accent.fond, transform: `scale(${fondPastille}) rotate(${-2 + 2 * fondPastille}deg)`, zIndex: -1 }} />
            )}
            {mot}
          </span>
        );
      })}
    </div>
  );
}

/** Mot géant et pâle, qui grossit très lentement (derrière tout) */
export function MotFantome({ texte, f, debut = 0, couleur = P.encre, taille = 380, y = 960, opacite = 0.05 }: {
  texte: string; f: number; debut?: number; couleur?: string; taille?: number; y?: number; opacite?: number;
}) {
  const p = doux(f, debut, 14);
  return (
    <div style={{ position: "absolute", left: -400, right: -400, top: y - taille * 0.6, textAlign: "center", fontFamily: TITRE,
      fontWeight: 800, fontSize: taille, letterSpacing: "-0.05em", color: couleur, opacity: opacite * p, whiteSpace: "nowrap",
      transform: `scale(${1.15 - 0.15 * p + (f - debut) * 0.0008})` }}>
      {texte}
    </div>
  );
}

/** Trait à la main qui se dessine : « souligne » (vague sous un mot), « barre » (rayure), « cercle » (entoure) */
export function Trait({ f, debut, duree = 10, type, x, y, largeur, hauteur = 60, couleur = P.or, epaisseur = 14 }: {
  f: number; debut: number; duree?: number; type: "souligne" | "barre" | "cercle";
  x: number; y: number; largeur: number; hauteur?: number; couleur?: string; epaisseur?: number;
}) {
  const p = doux(f, debut, duree);
  const L = largeur, H = hauteur;
  const d = type === "souligne" ? `M4 ${H * 0.6} Q${L * 0.3} ${H * 0.2} ${L * 0.55} ${H * 0.5} T${L - 4} ${H * 0.35}`
    : type === "barre" ? `M0 ${H * 0.62} L${L} ${H * 0.4} M${L * 0.06} ${H * 0.4} L${L * 0.96} ${H * 0.68}`
    : `M${L * 0.52} ${H * 0.04} C${L * 1.05} ${H * 0.02} ${L * 1.04} ${H * 0.98} ${L * 0.48} ${H * 0.96} C${L * -0.04} ${H * 0.94} ${L * -0.02} ${H * 0.06} ${L * 0.58} ${H * 0.1}`;
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={d} pathLength={1} stroke={couleur} strokeWidth={epaisseur} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
}

/** Note manuscrite avec une flèche courbe (vers la gauche, la droite ou le bas) */
export function NoteMain({ texte, f, debut, fin, x, y, rotation = -4, couleur = P.encre, taille = 64, fleche, largeur = 520 }: {
  texte: string; f: number; debut: number; fin?: number; x: number; y: number; rotation?: number; couleur?: string; taille?: number;
  fleche?: "gauche" | "droite" | "bas" | "haut"; largeur?: number;
}) {
  const p = entree(f, debut, 12, 180) * (fin === undefined ? 1 : 1 - doux(f, fin, 6));
  if (p <= 0.001) return null;
  const trace = doux(f, debut + 4, 10);
  const chemins = {
    gauche: "M150 20 Q80 -10 20 40 M20 40 L50 38 M20 40 L28 12",
    droite: "M10 20 Q80 -10 140 40 M140 40 L110 38 M140 40 L132 12",
    bas: "M60 0 Q100 50 70 100 M70 100 L60 72 M70 100 L92 80",
    haut: "M60 100 Q100 50 70 0 M70 0 L60 28 M70 0 L92 20",
  } as const;
  return (
    <div style={{ position: "absolute", left: x - largeur / 2, top: y, width: largeur, textAlign: "center",
      transform: `rotate(${rotation}deg) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ fontFamily: MAIN, fontSize: taille, color: couleur, lineHeight: 1 }}>{texte}</div>
      {fleche && (
        <svg width={160} height={110} viewBox="-5 -10 170 120" style={{ position: "absolute", overflow: "visible",
          left: fleche === "gauche" ? -120 : fleche === "droite" ? largeur - 40 : largeur / 2 - 70,
          top: fleche === "bas" ? taille * 1.1 : fleche === "haut" ? -120 : taille * 0.2 }}>
          <path d={chemins[fleche]} pathLength={1} stroke={couleur} strokeWidth={6} fill="none" strokeLinecap="round"
            strokeDasharray={1} strokeDashoffset={1 - trace} />
        </svg>
      )}
    </div>
  );
}

/** Compteur qui défile (nombres), avec un format libre : ex. (n) => `${n.toFixed(1)} km` */
export function Compteur({ f, debut, duree, de, a, format, style }: {
  f: number; debut: number; duree: number; de: number; a: number; format: (n: number) => string; style?: CSSProperties;
}) {
  const n = interpolate(f, [debut, debut + duree], [de, a], { extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t) });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(n)}</span>;
}
