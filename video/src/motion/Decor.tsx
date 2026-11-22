/*
 * Décors et mouvements de caméra :
 *   <Aplat>       fond de couleur pleine qui envahit l'écran (cercle qui grandit depuis un point, ou volet)
 *   <Anneaux>     cercles concentriques fins qui respirent (fond « produit »)
 *   <Pieces>      pièces de monnaie (francs CFA) qui pleuvent ou jaillissent
 *   <Fouet>       entrée ou sortie « coup de fouet » : glissement très rapide avec flou de bougé horizontal
 *   <Camera>      zoom et décalage lents de toute une scène (rien n'est jamais immobile)
 *   <Soleil>      soleil qui tape (chaleur d'Abidjan)
 */
import { useId, type ReactNode } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { doux, flotte } from "./anim";
import { H, L, P } from "./palette";

export function Aplat({ couleur, f, debut, duree = 12, x = L / 2, y = H / 2, mode = "cercle" }: {
  couleur: string; f: number; debut: number; duree?: number; x?: number; y?: number; mode?: "cercle" | "volet-haut" | "volet-gauche";
}) {
  const p = doux(f, debut, duree);
  if (p <= 0) return null;
  const rayon = Math.hypot(Math.max(x, L - x), Math.max(y, H - y)) * p * 1.02;
  const clip = mode === "cercle" ? `circle(${rayon}px at ${x}px ${y}px)`
    : mode === "volet-haut" ? `inset(${(1 - p) * 100}% 0 0 0)` : `inset(0 ${(1 - p) * 100}% 0 0)`;
  return <AbsoluteFill style={{ background: couleur, clipPath: clip }} />;
}

export function Anneaux({ f, couleur = P.vert, x = L / 2, y = H / 2, nombre = 4, ecart = 190, opacite = 0.08 }: {
  f: number; couleur?: string; x?: number; y?: number; nombre?: number; ecart?: number; opacite?: number;
}) {
  return (
    <svg width={L} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: nombre }, (_, i) => (
        <circle key={i} cx={x} cy={y} r={(i + 1) * ecart + flotte(f, 3, i * 0.2) * 10} fill="none" stroke={couleur} strokeWidth={3} opacity={opacite} />
      ))}
    </svg>
  );
}

/** Hasard reproductible (même pièce au même endroit à chaque rendu) */
const hasard = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function Piece({ taille, tour }: { taille: number; tour: number }) {
  const largeur = Math.abs(Math.cos(tour));
  return (
    <svg width={taille} height={taille} viewBox="0 0 100 100" style={{ transform: `scaleX(${0.15 + 0.85 * largeur})`, overflow: "visible" }}>
      <circle cx={50} cy={54} r={46} fill={P.orFonce} />
      <circle cx={50} cy={48} r={46} fill={P.orClair} />
      <circle cx={50} cy={48} r={36} fill="none" stroke={P.orFonce} strokeWidth={4} opacity={0.6} />
      <text x={50} y={66} textAnchor="middle" fontFamily="'Bricolage Grotesque', sans-serif" fontWeight={800} fontSize={50} fill={P.orFonce}>F</text>
      <path d="M22 30 Q30 18 44 14" stroke="#FFF6D8" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

/** Pluie de pièces (mode « pluie ») ou gerbe qui jaillit d'un point (mode « gerbe ») */
export function Pieces({ f, debut, nombre = 18, mode = "pluie", x = L / 2, y = H / 2, taille = 110, graine = 1 }: {
  f: number; debut: number; nombre?: number; mode?: "pluie" | "gerbe"; x?: number; y?: number; taille?: number; graine?: number;
}) {
  const t = (f - debut) / 30;
  if (t < 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: nombre }, (_, i) => {
        const h1 = hasard(i + graine * 100), h2 = hasard(i * 3.7 + graine), h3 = hasard(i * 7.3 + graine * 2);
        let px: number, py: number;
        const s = taille * (0.6 + 0.6 * h3);
        if (mode === "pluie") {
          const depart = h2 * 0.8;
          const u = Math.max(0, t - depart);
          px = h1 * L;
          py = -200 + u * u * 900 + u * 500;
        } else {
          const angle = -Math.PI / 2 + (h1 - 0.5) * 2.2;
          const vitesse = 1300 + h2 * 900;
          px = x + Math.cos(angle) * vitesse * t;
          py = y + Math.sin(angle) * vitesse * t + 2200 * t * t;
        }
        return (
          <div key={i} style={{ position: "absolute", left: px - s / 2, top: py - s / 2, transform: `rotate(${(h1 - 0.5) * 60 + t * 90 * (h2 - 0.5)}deg)` }}>
            <Piece taille={s} tour={t * (6 + h3 * 6) + h1 * 6} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** Entrée (sens > 0 : arrive de la droite) ou sortie (sortie : part vers la gauche) en coup de fouet, avec flou de bougé */
export function Fouet({ f, debut, duree = 9, sens = 1, sortie = false, distance = 1400, children }: {
  f: number; debut: number; duree?: number; sens?: 1 | -1; sortie?: boolean; distance?: number; children: ReactNode;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = interpolate(f, [debut, debut + duree], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: sortie ? (t) => t * t * t : (t) => 1 - Math.pow(1 - t, 4) });
  const decalage = sortie ? -sens * distance * p : sens * distance * (1 - p);
  // vitesse ≈ dérivée : flou fort au milieu du mouvement, nul aux extrémités
  const vitesse = sortie ? 3 * p * p : 4 * Math.pow(1 - p, 3);
  const flou = Math.min(60, vitesse * 40);
  if (sortie && p >= 1) return null;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="-50%" y="0" width="200%" height="100%"><feGaussianBlur stdDeviation={`${flou} 0`} /></filter>
      </svg>
      <AbsoluteFill style={{ transform: `translateX(${decalage}px)`, filter: flou > 0.5 ? `url(#${id})` : undefined }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Mouvement de caméra lent : zoom de « de » à « a » pendant la scène, et léger décalage */
export function Camera({ f, duree, de = 1, a = 1.06, dx = 0, dy = 0, children, origine = "50% 50%" }: {
  f: number; duree: number; de?: number; a?: number; dx?: number; dy?: number; children: ReactNode; origine?: string;
}) {
  const p = doux(f, 0, duree);
  return (
    <AbsoluteFill style={{ transform: `translate(${dx * p}px, ${dy * p}px) scale(${de + (a - de) * p})`, transformOrigin: origine }}>
      {children}
    </AbsoluteFill>
  );
}

export function Soleil({ f, x, y, taille = 300, debut = 0 }: { f: number; x: number; y: number; taille?: number; debut?: number }) {
  const p = doux(f, debut, 12);
  return (
    <svg width={taille * 2} height={taille * 2} viewBox="-100 -100 200 200" style={{ position: "absolute", left: x - taille, top: y - taille,
      transform: `scale(${p}) rotate(${f * 0.6}deg)` }}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-5} y={-92 - flotte(f, 0.8, i * 0.15) * 4} width={10} height={24} rx={5} fill={P.orClair} transform={`rotate(${i * 30})`} />
      ))}
      <circle r={52} fill={P.orClair} />
      <circle r={40} fill="#F6CF6A" />
    </svg>
  );
}
