/*
 * Petites illustrations plates, réutilisables :
 *   <Maison>   maison à toit en tuiles, palmier, soleil (photo d'annonce stylisée)
 *   <Nuage>    nuage gris qui pleut (tristesse, mauvaise nouvelle)
 *   <Jauge>    jauge en demi-cercle : trois zones (bas, juste, élevé) et une aiguille, sans chiffres
 *   <Route>    chemin en pointillés qui se dessine jusqu'à une épingle (distance, trajet)
 */
import { MapPin } from "lucide-react";
import { interpolate } from "remotion";
import { doux, entree, flotte } from "./anim";
import { P, TITRE } from "./palette";

export function Maison({ largeur, hauteur, f = 0, ciel = "#BFE3F2", mur = "#F6E7CF", toit = "#C8553D" }: {
  largeur: number; hauteur: number; f?: number; ciel?: string; mur?: string; toit?: string;
}) {
  return (
    <svg width={largeur} height={hauteur} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <rect width={400} height={260} fill={ciel} />
      <circle cx={330} cy={58} r={30} fill="#FCE38A" />
      <ellipse cx={90 + flotte(f, 6) * 6} cy={50} rx={42} ry={14} fill="#FFFFFF" opacity={0.85} />
      <rect y={200} width={400} height={60} fill="#7BC47F" />
      <rect y={214} width={400} height={46} fill="#5DAE68" />
      {/* palmier */}
      <path d="M318 214 Q322 160 334 120" stroke="#8B5E3C" strokeWidth={9} fill="none" strokeLinecap="round" />
      {[-60, -20, 20, 60, 100].map((a, i) => (
        <path key={i} d="M0 0 Q30 -14 62 8" stroke="#2E8B57" strokeWidth={12} fill="none" strokeLinecap="round"
          transform={`translate(334 120) rotate(${a + flotte(f, 2.5, i * 0.1) * 4})`} />
      ))}
      {/* maison */}
      <rect x={90} y={120} width={200} height={94} fill={mur} />
      <rect x={90} y={196} width={200} height={18} fill="#E8D2B0" />
      <path d="M74 126 L190 62 L306 126 Z" fill={toit} />
      <path d="M74 126 L306 126 L300 134 L80 134 Z" fill="#A8432F" />
      <rect x={172} y={150} width={38} height={64} rx={4} fill="#1E5E3F" />
      <circle cx={202} cy={184} r={3} fill="#E2B54A" />
      {[110, 236].map((x) => (
        <g key={x}>
          <rect x={x} y={148} width={36} height={32} rx={3} fill="#9FD3E8" stroke="#FFFFFF" strokeWidth={4} />
          <path d={`M${x + 18} 148 L${x + 18} 180`} stroke="#FFFFFF" strokeWidth={3} />
        </g>
      ))}
      <rect x={40} y={190} width={50} height={24} rx={10} fill="#3E9B57" />
      <circle cx={52} cy={188} r={6} fill="#E85D75" /><circle cx={72} cy={186} r={6} fill="#F2C94C" />
    </svg>
  );
}

export function Nuage({ f, debut, x, y, largeur = 360 }: { f: number; debut: number; x: number; y: number; largeur?: number }) {
  const p = entree(f, debut, 14, 140);
  const t = f - debut;
  return (
    <svg width={largeur} height={largeur * 1.1} viewBox="0 0 200 220" style={{ position: "absolute", left: x - largeur / 2, top: y,
      transform: `scale(${p}) translateX(${flotte(f, 3) * 4}px)`, overflow: "visible" }}>
      {t > 6 && Array.from({ length: 9 }, (_, i) => {
        const y0 = ((t * 9 + i * 37) % 120) + 80;
        return <path key={i} d={`M${30 + i * 18} ${y0} l-5 14`} stroke="#5B8DB8" strokeWidth={5} strokeLinecap="round" opacity={0.8} />;
      })}
      <path d="M40 90 Q14 90 16 66 Q18 44 44 46 Q50 14 86 16 Q116 16 126 40 Q150 30 168 48 Q190 66 176 86 Q170 96 150 96 L48 96 Q40 96 40 90 Z" fill="#8E9AA6" />
      <path d="M48 96 L150 96 Q170 96 176 86 Q160 92 140 88 Q100 96 48 88 Z" fill="#73808C" />
    </svg>
  );
}

/** Jauge : aiguille de -90° (bas) à +90° (élevé) ; « cible » où elle se pose (0 = milieu = juste) */
export function Jauge({ f, debut, taille = 640, cible = 0, etiquettes = ["Trop bas", "Juste prix", "Trop cher"] }: {
  f: number; debut: number; taille?: number; cible?: number; etiquettes?: [string, string, string];
}) {
  const p = entree(f, debut, 12, 150);
  // l'aiguille hésite : part à fond à droite, revient, puis se pose sur la cible
  const angle = interpolate(f, [debut + 6, debut + 16, debut + 26, debut + 36], [-80, 70, -30, cible], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) });
  const arc = (a0: number, a1: number) => {
    const r = 150, rad = (a: number) => ((a - 90) * Math.PI) / 180;
    const [x0, y0, x1, y1] = [200 + r * Math.cos(rad(a0)), 200 + r * Math.sin(rad(a0)), 200 + r * Math.cos(rad(a1)), 200 + r * Math.sin(rad(a1))];
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const zone = doux(f, debut + 34, 8);
  return (
    <svg width={taille} height={taille * 0.66} viewBox="0 0 400 264" style={{ transform: `scale(${p})`, overflow: "visible" }}>
      <path d={arc(-90, -32)} stroke={P.bleu} strokeWidth={48} fill="none" />
      <path d={arc(-28, 28)} stroke={P.vertClair} strokeWidth={48 + zone * 14} fill="none" />
      <path d={arc(32, 90)} stroke={P.rouge} strokeWidth={48} fill="none" />
      <g transform={`rotate(${angle} 200 200)`}>
        <path d="M192 200 L200 70 L208 200 Z" fill={P.encre} />
      </g>
      <circle cx={200} cy={200} r={22} fill={P.encre} />
      <circle cx={200} cy={200} r={9} fill={P.orClair} />
      <g fontFamily={TITRE} fontWeight={700} fontSize={22} fill={P.gris} textAnchor="middle">
        <text x={46} y={250}>{etiquettes[0]}</text>
        <text x={354} y={250}>{etiquettes[2]}</text>
      </g>
      <text x={200} y={22} textAnchor="middle" fontFamily={TITRE} fontWeight={800} fontSize={30} fill={P.vert} opacity={zone}>{etiquettes[1]}</text>
    </svg>
  );
}

/** Route en pointillés (chemin SVG « d » dans un repère largeur × hauteur) qui se dessine, épingle au bout */
export function Route({ f, debut, duree, d, largeur, hauteur, x, y, fin }: {
  f: number; debut: number; duree: number; d: string; largeur: number; hauteur: number; x: number; y: number; fin: { x: number; y: number };
}) {
  const p = doux(f, debut, duree, (t) => t);
  const epingle = entree(f, debut + duree - 4, 10, 200);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, height: hauteur }}>
      <svg width={largeur} height={hauteur} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <mask id="masque-route">
            <path d={d} pathLength={1} stroke="#FFFFFF" strokeWidth={40} fill="none" strokeDasharray={1} strokeDashoffset={1 - p} />
          </mask>
        </defs>
        <path d={d} stroke={P.encre} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray="4 30" mask="url(#masque-route)" />
      </svg>
      <div style={{ position: "absolute", left: fin.x - 60, top: fin.y - 110, transform: `scale(${epingle})`, transformOrigin: "50% 100%" }}>
        <MapPin size={120} color={P.blanc} fill={P.rouge} strokeWidth={1.8} />
      </div>
    </div>
  );
}
