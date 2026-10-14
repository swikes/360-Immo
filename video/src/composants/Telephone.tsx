/*
 * Téléphone dessiné (bord, encoche, barre d'état) qui affiche une capture du site, et la « loupe » : l'élément mis en
 * avant sort de l'écran, agrandi, pendant que le reste s'assombrit.
 */
import type { ReactNode } from "react";
import { Img, interpolate, staticFile } from "remotion";
import type { Ecran } from "../donnees";
import { C, LARGEUR } from "../theme";

export const ECRAN_L = 600;   // largeur de l'écran du téléphone dans la vidéo
export const BARRE = 44;      // barre d'état (heure, réseau, batterie)
export const BORD = 18;
export const TEL_X = (LARGEUR - ECRAN_L) / 2 - BORD;
export const TEL_Y = 410;

/** Où est l'élément à mettre en avant (dans la vidéo), et où va la loupe */
export function geometrie(e: Ecran) {
  const k = ECRAN_L / e.largeur;
  const marge = 10;
  const bx = Math.max(0, e.cible.x - marge), by = Math.max(0, e.cible.y - marge);
  const bw = Math.min(e.largeur, e.cible.x + e.cible.w + marge) - bx;
  const bh = Math.min(e.hauteur, e.cible.y + e.cible.h + marge) - by;
  const cx = TEL_X + BORD + bx * k, cy = TEL_Y + BORD + BARRE + by * k, cw = bw * k, ch = bh * k;
  const zoom = Math.min(1.7, Math.max(1.08, Math.min(860 / cw, 740 / ch)));
  const W = cw * zoom, H = ch * zoom;
  const X = (LARGEUR - W) / 2;
  const Y = Math.min(Math.max(cy + ch / 2 - H / 2, 430), 1400 - H);
  return { k, bx, by, cx, cy, cw, ch, zoom, X, Y };
}

function BarreEtat() {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: BARRE, background: "#FFFFFF", display: "flex",
      alignItems: "center", justifyContent: "space-between", padding: "4px 44px 0", fontFamily: "Outfit, sans-serif",
      fontSize: 22, fontWeight: 600, color: "#111" }}>
      <span>9:41</span>
      <div style={{ position: "absolute", left: "50%", top: 8, width: 150, height: 34, marginLeft: -75, borderRadius: 20, background: "#0d0f0e" }} />
      <svg width="92" height="22" viewBox="0 0 92 22">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 7} y={14 - i * 4} width="5" height={6 + i * 4} rx="1.2" fill="#111" />)}
        <path d="M44 9a12 12 0 0 1 16 0M47 12.5a7 7 0 0 1 10 0M50.5 16a2 2 0 0 1 3 0" stroke="#111" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <rect x="66" y="5" width="22" height="12" rx="3.5" stroke="#111" strokeWidth="1.6" fill="none" />
        <rect x="68.5" y="7.5" width="15" height="7" rx="1.5" fill="#111" />
        <rect x="89" y="9" width="2" height="4" rx="1" fill="#111" />
      </svg>
    </div>
  );
}

export function Telephone({ ecran, children }: { ecran: Ecran; children?: ReactNode }) {
  const h = (ECRAN_L * ecran.hauteur) / ecran.largeur;
  return (
    <div style={{ position: "absolute", left: TEL_X, top: TEL_Y, width: ECRAN_L + 2 * BORD, height: h + BARRE + 2 * BORD,
      borderRadius: 80, background: "#0d0f0e", boxShadow: "0 50px 100px rgba(0,0,0,0.5), inset 0 0 0 3px #30342f" }}>
      <div style={{ position: "absolute", left: BORD, top: BORD, width: ECRAN_L, height: h + BARRE, borderRadius: 62, overflow: "hidden",
        background: "#FFFFFF" }}>
        <BarreEtat />
        <Img src={staticFile(ecran.fichier)} style={{ position: "absolute", left: 0, top: BARRE, width: ECRAN_L, height: h }} />
        {children}
      </div>
    </div>
  );
}

/** Ce qui s'ajoute sur l'écran : l'assombrissement et le cadre doré autour de l'élément */
export function Reperes({ e, anneau, loupe }: { e: Ecran; anneau: number; loupe: number }) {
  const g = geometrie(e);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: C.vertNuit, opacity: 0.55 * Math.min(1, loupe) }} />
      <div style={{ position: "absolute", left: g.bx * g.k, top: BARRE + g.by * g.k, width: g.cw, height: g.ch, borderRadius: 16,
        border: `5px solid ${C.orClair}`, opacity: Math.min(1, anneau) * (1 - Math.min(1, loupe)),
        transform: `scale(${1.15 - 0.15 * anneau})` }} />
    </>
  );
}

/** L'élément agrandi, au-dessus du téléphone ; p : 0 (à sa place) → 1 (agrandi, au centre) ; reflet : passage de lumière */
export function Loupe({ e, p, reflet }: { e: Ecran; p: number; reflet: number }) {
  if (p <= 0.001) return null;
  const g = geometrie(e);
  const zoom = interpolate(p, [0, 1], [1, g.zoom]);
  const echelle = g.k * zoom;
  return (
    <div style={{ position: "absolute", left: interpolate(p, [0, 1], [g.cx, g.X]), top: interpolate(p, [0, 1], [g.cy, g.Y]),
      width: g.cw * zoom, height: g.ch * zoom, borderRadius: 20, overflow: "hidden", background: "#FFFFFF",
      boxShadow: `0 0 0 5px ${C.orClair}, 0 40px 90px rgba(0,0,0,${0.55 * Math.min(1, p)})` }}>
      <Img src={staticFile(e.fichier)} style={{ position: "absolute", left: -g.bx * echelle, top: -g.by * echelle,
        width: e.largeur * echelle, height: e.hauteur * echelle, maxWidth: "none" }} />
      {reflet > 0 && reflet < 1 && (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${interpolate(reflet, [0, 1], [-110, 110])}%)`,
          background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)" }} />
      )}
    </div>
  );
}
