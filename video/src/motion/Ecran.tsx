/*
 * Téléphone et doigt :
 *   <Telephone>  téléphone stylisé (encoche, barre d'état) ; son écran affiche ce qu'on lui donne
 *   <Doigt>      main qui se déplace d'un point à l'autre et appuie (onde au moment du clic)
 */
import { Pointer } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { interpolate } from "remotion";
import { doux } from "./anim";
import { P, TITRE } from "./palette";

export function Telephone({ x, y, largeur = 560, rotation = 0, echelle = 1, fondEcran = P.creme, children, style }: {
  x: number; y: number; largeur?: number; rotation?: number; echelle?: number; fondEcran?: string; children?: ReactNode; style?: CSSProperties;
}) {
  const hauteur = largeur * 2.05, bord = largeur * 0.035;
  return (
    <div style={{ position: "absolute", left: x - largeur / 2, top: y - hauteur / 2, width: largeur, height: hauteur,
      transform: `rotate(${rotation}deg) scale(${echelle})`, ...style }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: largeur * 0.15, background: "#1B1D1F",
        boxShadow: "0 40px 90px rgba(17,59,39,0.28), inset 0 0 0 3px #3A3D40" }} />
      <div style={{ position: "absolute", inset: bord, borderRadius: largeur * 0.12, background: fondEcran, overflow: "hidden" }}>
        {/* barre d'état */}
        <div style={{ height: largeur * 0.11, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `0 ${largeur * 0.08}px`, fontFamily: TITRE, fontWeight: 700, fontSize: largeur * 0.04, color: P.encre }}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: largeur * 0.012, alignItems: "flex-end" }}>
            {[0.4, 0.6, 0.8, 1].map((h, i) => <span key={i} style={{ width: largeur * 0.011, height: largeur * 0.03 * h, background: P.encre, borderRadius: 2 }} />)}
            <span style={{ width: largeur * 0.06, height: largeur * 0.028, border: `2px solid ${P.encre}`, borderRadius: 5, marginLeft: largeur * 0.015, position: "relative" }}>
              <span style={{ position: "absolute", inset: 2, right: "30%", background: P.encre, borderRadius: 2 }} />
            </span>
          </span>
        </div>
        <div style={{ position: "absolute", top: largeur * 0.11, left: 0, right: 0, bottom: 0 }}>{children}</div>
      </div>
      {/* encoche */}
      <div style={{ position: "absolute", top: bord + largeur * 0.025, left: "50%", width: largeur * 0.28, height: largeur * 0.065,
        marginLeft: -largeur * 0.14, borderRadius: 999, background: "#0B0C0D" }} />
    </div>
  );
}

/** Doigt : se déplace entre les étapes ({ a: image, x, y }) et appuie aux images « clics » */
export function Doigt({ f, etapes, clics = [], taille = 150 }: {
  f: number; etapes: { a: number; x: number; y: number }[]; clics?: number[]; taille?: number;
}) {
  if (f < etapes[0].a - 8) return null;
  const images = etapes.map((e) => e.a);
  const opts = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t: number) => t * t * (3 - 2 * t) } as const;
  const x = etapes.length > 1 ? interpolate(f, images, etapes.map((e) => e.x), opts) : etapes[0].x;
  const y = etapes.length > 1 ? interpolate(f, images, etapes.map((e) => e.y), opts) : etapes[0].y;
  const apparition = doux(f, etapes[0].a - 8, 8);
  const appui = clics.reduce((m, c) => Math.max(m, f >= c - 3 && f < c + 5 ? 1 - Math.abs(f - c) / 5 : 0), 0);
  return (
    <>
      {clics.map((c) => {
        const t = f - c;
        if (t < 0 || t > 16) return null;
        return (
          <div key={c} style={{ position: "absolute", left: x - 60 - t * 5, top: y - 60 - t * 5, width: 120 + t * 10, height: 120 + t * 10,
            borderRadius: 999, border: `6px solid ${P.orClair}`, opacity: 1 - t / 16 }} />
        );
      })}
      <div style={{ position: "absolute", left: x - taille * 0.32, top: y - taille * 0.08, opacity: apparition,
        transform: `scale(${(0.8 + 0.2 * apparition) * (1 - appui * 0.14)}) rotate(-12deg)`, transformOrigin: "30% 10%",
        filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.25))" }}>
        <Pointer size={taille} color={P.encre} fill={P.blanc} strokeWidth={1.6} />
      </div>
    </>
  );
}
