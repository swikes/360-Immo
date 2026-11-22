/*
 * Effets « haut de gamme » : lumière, matière, ralenti.
 *   <Particules>   poussières de lumière qui flottent (flou de profondeur), pour les plans au ralenti
 *   <Rayons>       rayons de lumière qui tournent lentement derrière un élément (moment fort)
 *   <Lueur>        reflet qui balaie une carte ou un badge (à placer dans un parent en overflow: hidden)
 *   <Eclats>       petites étoiles qui jaillissent (badge obtenu, réussite)
 *   <Confettis>    confettis aux couleurs de la marque (fin)
 *   <Flash>        éclair blanc plein écran (photo, impact)
 *   <Vignette>     bords assombris (regard au centre)          <Grain>  grain de film très léger
 *   <Profondeur>   flou d'arrière-plan (mise au point)
 *   <Notification> notification de téléphone qui tombe (icône, application, titre, texte)
 */
import { cloneElement, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { doux, elan, entree, flotte } from "./anim";
import type { Icone } from "./Elements";
import { H, L, P, TITRE } from "./palette";

/** Hasard reproductible */
const hasard = (n: number) => {
  const x = Math.sin(n * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};

export function Particules({ f, nombre = 40, couleur = P.orClair, graine = 1, vitesse = 1, opacite = 0.7, taille = 14 }: {
  f: number; nombre?: number; couleur?: string; graine?: number; vitesse?: number; opacite?: number; taille?: number;
}) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: nombre }, (_, i) => {
        const h1 = hasard(i + graine * 13), h2 = hasard(i * 2.3 + graine), h3 = hasard(i * 5.1 + graine * 7);
        const profondeur = 0.3 + h3 * 0.7; // proche = gros, flou, rapide
        const s = taille * (0.4 + profondeur * 1.6);
        const x = (h1 * L + flotte(f, 6 + h2 * 4, h1) * 40) % L;
        const y = ((h2 * H - f * vitesse * (0.6 + profondeur * 1.4)) % H + H) % H;
        const scintille = 0.55 + 0.45 * Math.sin(f / (8 + h3 * 10) + h1 * 6);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: 999, background: couleur,
            opacity: opacite * scintille * (0.35 + 0.65 * (1 - Math.abs(profondeur - 0.5))), filter: `blur(${(profondeur > 0.75 ? (profondeur - 0.75) * 24 : 0) + 1}px)`,
            boxShadow: `0 0 ${s}px ${couleur}` }} />
        );
      })}
    </AbsoluteFill>
  );
}

export function Rayons({ f, x = L / 2, y = H / 2, couleur = P.orClair, rayon = 1100, nombre = 14, opacite = 0.16, debut = 0 }: {
  f: number; x?: number; y?: number; couleur?: string; rayon?: number; nombre?: number; opacite?: number; debut?: number;
}) {
  const p = doux(f, debut, 18);
  return (
    <svg width={L} height={H} style={{ position: "absolute", inset: 0, opacity: p }}>
      <defs>
        <radialGradient id="rayons-fondu">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <mask id="rayons-masque"><circle cx={x} cy={y} r={rayon} fill="url(#rayons-fondu)" /></mask>
      </defs>
      <g mask="url(#rayons-masque)" transform={`rotate(${f * 0.25} ${x} ${y})`}>
        {Array.from({ length: nombre }, (_, i) => {
          const a = (i / nombre) * Math.PI * 2, b = a + Math.PI / nombre / 1.6;
          return <path key={i} d={`M${x} ${y} L${x + Math.cos(a) * rayon * 1.5} ${y + Math.sin(a) * rayon * 1.5} L${x + Math.cos(b) * rayon * 1.5} ${y + Math.sin(b) * rayon * 1.5} Z`}
            fill={couleur} opacity={opacite} />;
        })}
      </g>
    </svg>
  );
}

/** Reflet qui balaie (une fois) entre debut et debut + duree */
export function Lueur({ f, debut, duree = 18, intensite = 0.7 }: { f: number; debut: number; duree?: number; intensite?: number }) {
  const p = doux(f, debut, duree);
  if (p <= 0 || p >= 1) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
      background: `linear-gradient(105deg, transparent ${p * 140 - 40}%, rgba(255,255,255,${intensite}) ${p * 140 - 25}%, transparent ${p * 140 - 10}%)` }} />
  );
}

function Etoile({ taille, couleur }: { taille: number; couleur: string }) {
  return (
    <svg width={taille} height={taille} viewBox="-10 -10 20 20" style={{ overflow: "visible" }}>
      <path d="M0 -10 Q1.2 -1.2 10 0 Q1.2 1.2 0 10 Q-1.2 1.2 -10 0 Q-1.2 -1.2 0 -10 Z" fill={couleur} />
    </svg>
  );
}

export function Eclats({ f, debut, x, y, nombre = 10, couleur = P.orClair, rayon = 260, taille = 46 }: {
  f: number; debut: number; x: number; y: number; nombre?: number; couleur?: string; rayon?: number; taille?: number;
}) {
  const t = f - debut;
  if (t < 0 || t > 40) return null;
  return (
    <>
      {Array.from({ length: nombre }, (_, i) => {
        const a = (i / nombre) * Math.PI * 2 + hasard(i) * 0.6;
        const d = elan(f, debut, 30) * rayon * (0.6 + hasard(i * 3) * 0.6);
        const s = taille * (0.5 + hasard(i * 7) * 0.8) * (1 - doux(f, debut + 14, 24));
        return (
          <div key={i} style={{ position: "absolute", left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2,
            transform: `rotate(${t * 4}deg)` }}>
            <Etoile taille={s} couleur={i % 3 === 0 ? P.blanc : couleur} />
          </div>
        );
      })}
    </>
  );
}

export function Confettis({ f, debut, nombre = 70, graine = 3 }: { f: number; debut: number; nombre?: number; graine?: number }) {
  const t = (f - debut) / 30;
  if (t < 0) return null;
  const couleurs = [P.vert, P.orClair, P.vertClair, P.or, P.blanc, "#E85D75"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: nombre }, (_, i) => {
        const h1 = hasard(i + graine * 31), h2 = hasard(i * 1.7 + graine), h3 = hasard(i * 4.9 + graine * 5);
        // lancés du bas vers le haut, puis retombent en se balançant
        const vx = (h1 - 0.5) * 900, vy = -1700 - h2 * 900;
        const x = L / 2 + (h1 - 0.5) * 300 + vx * t + Math.sin(t * 6 + h3 * 6) * 30;
        const y = H + 40 + vy * t + 1500 * t * t;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 18 + h3 * 14, height: 10 + h2 * 8, background: couleurs[i % couleurs.length],
            borderRadius: 3, transform: `rotate(${t * 400 * (h2 - 0.5) + h1 * 360}deg) scaleY(${Math.cos(t * 9 + h3 * 6)})` }} />
        );
      })}
    </AbsoluteFill>
  );
}

export function Flash({ f, debut, duree = 10 }: { f: number; debut: number; duree?: number }) {
  const o = interpolate(f, [debut, debut + 1, debut + duree], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: o, pointerEvents: "none" }} /> : null;
}

export function Vignette({ force = 0.45 }: { force?: number }) {
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,${force}) 100%)` }} />;
}

export function Grain({ opacite = 0.06 }: { opacite?: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: opacite, mixBlendMode: "overlay" }}>
      <svg width={L} height={H}>
        <filter id="grain-film"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" /></filter>
        <rect width={L} height={H} filter="url(#grain-film)" />
      </svg>
    </AbsoluteFill>
  );
}

export function Profondeur({ flou, children, style }: { flou: number; children: ReactNode; style?: CSSProperties }) {
  return <AbsoluteFill style={{ filter: flou > 0.2 ? `blur(${flou}px)` : undefined, ...style }}>{children}</AbsoluteFill>;
}

/** Notification de téléphone : tombe d'en haut au ralenti puis se pose (y : position finale) */
export function Notification({ f, debut, icone, fondIcone = P.vert, app = "360Immo.ci", titre, texte, quand = "maintenant", x, y, largeur = 860, sombre = false }: {
  f: number; debut: number; icone: Icone; fondIcone?: string; app?: string; titre: string; texte: string; quand?: string;
  x: number; y: number; largeur?: number; sombre?: boolean;
}) {
  const p = elan(f, debut, 22);
  const pop = entree(f, debut, 12, 170);
  if (f < debut) return null;
  return (
    <div style={{ position: "absolute", left: x - largeur / 2, top: y - (1 - p) * 260, width: largeur, opacity: Math.min(1, (f - debut) / 4),
      transform: `scale(${0.85 + 0.15 * pop}) rotateX(${(1 - p) * 30}deg)`, transformOrigin: "50% 0%",
      background: sombre ? "rgba(28,28,30,0.78)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", borderRadius: 40,
      padding: "26px 30px", display: "flex", gap: 24, alignItems: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
      <div style={{ width: 92, height: 92, borderRadius: 24, background: fondIcone, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {cloneElement(icone, { size: 54, color: P.blanc, strokeWidth: 2.4 })}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontFamily: TITRE, color: sombre ? P.blanc : P.encre }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 600, opacity: 0.6 }}>
          <span>{app}</span><span>{quand}</span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 2, letterSpacing: "-0.01em" }}>{titre}</div>
        <div style={{ fontSize: 33, fontWeight: 500, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{texte}</div>
      </div>
    </div>
  );
}
