/*
 * Fond commun à toutes les scènes, qui continue sans coupure d'une scène à l'autre : dégradé vert de la charte,
 * halos qui dérivent lentement, grand arc doré qui tourne (rappel de la flèche « 360 » du logo).
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, HAUTEUR, IPS, LARGEUR } from "../theme";

export function Fond() {
  const t = useCurrentFrame() / IPS;
  const halo = (couleur: string) => `radial-gradient(circle, ${couleur} 0%, transparent 65%)`;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${C.vertNuit} 0%, ${C.vertFonce} 45%, ${C.vert} 100%)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1200, height: 1200, borderRadius: "50%", background: halo(`${C.or}24`),
        left: -520 + 70 * Math.sin(t / 5), top: -380 + 60 * Math.cos(t / 6) }} />
      <div style={{ position: "absolute", width: 1300, height: 1300, borderRadius: "50%", background: halo(`${C.vertClair}40`),
        left: 340 + 60 * Math.cos(t / 7), top: 1050 + 70 * Math.sin(t / 5) }} />
      <svg width={LARGEUR} height={HAUTEUR} style={{ position: "absolute", inset: 0 }}>
        <circle cx={540} cy={1000} r={780} fill="none" stroke={C.orClair} strokeOpacity={0.13} strokeWidth={3}
          strokeDasharray="3300 1600" strokeLinecap="round" transform={`rotate(${t * 7} 540 1000)`} />
        <circle cx={540} cy={1000} r={660} fill="none" stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={2}
          strokeDasharray="4 18" transform={`rotate(${-t * 4} 540 1000)`} />
      </svg>
    </AbsoluteFill>
  );
}
