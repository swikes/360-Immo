/*
 * Téléphone en relief (perspective CSS) pour le storyboard et la publicité : coque sombre, tranche métallique, reflet,
 * liseré doré, barre d'état, et son reflet au sol. L'écran montre une capture du site (390 × 664 sur téléphone ;
 * 1920 × 1080 en paysage), au pixel près : `children` se place en coordonnées d'écran (pointEcran).
 */
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C } from "../theme";

/** Largeur des captures de téléphone, en pixels CSS */
export const LARGEUR_CAPTURE = 390;
const HAUTEUR_CAPTURE = 664;

/** Échelle, barre d'état et hauteur de l'écran, en pixels, pour un téléphone de cette largeur */
export function mesures(largeur: number, paysage = false) {
  if (paysage) return { k: largeur / 1920, barre: 0, hauteur: largeur * 0.5625 };
  const k = largeur / LARGEUR_CAPTURE;
  const barre = 44 * k;
  return { k, barre, hauteur: barre + HAUTEUR_CAPTURE * k };
}

/** Un point de la capture (pixels CSS du site) → position sur l'écran du téléphone */
export function pointEcran(x: number, y: number, largeur: number, paysage = false) {
  const { k, barre } = mesures(largeur, paysage);
  return { x: x * k, y: barre + y * k };
}

function BarreEtat({ largeur }: { largeur: number }) {
  const k = largeur / LARGEUR_CAPTURE;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 44 * k, background: "#FFFFFF", display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: `0 ${30 * k}px`, fontFamily: "Outfit, sans-serif", fontSize: 15 * k, fontWeight: 600, color: "#111" }}>
      <span>9:41</span>
      <svg width={60 * k} height={14 * k} viewBox="0 0 60 14">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 5} y={10 - i * 3} width="3.5" height={4 + i * 3} rx="1" fill="#111" />)}
        <rect x="36" y="2" width="20" height="10" rx="3" stroke="#111" strokeWidth="1.4" fill="none" />
        <rect x="38" y="4" width="14" height="6" rx="1.4" fill="#111" />
      </svg>
    </div>
  );
}

export function Telephone3D({ ecran, ecran2, melange = 0, largeur = 420, rotation = "rotateY(-24deg) rotateX(8deg)", style, paysage = false, children, reflet = true }: {
  ecran: string; ecran2?: string; melange?: number; largeur?: number; rotation?: string; style?: CSSProperties; paysage?: boolean;
  children?: ReactNode; reflet?: boolean;
}) {
  const bord = largeur * 0.035;
  const { barre, hauteur } = mesures(largeur, paysage);
  const l = largeur + 2 * bord, h = hauteur + 2 * bord;
  const image = (src: string, opacite: number) => (
    <Img src={staticFile(src)} style={{ position: "absolute", left: 0, top: barre, width: largeur, height: hauteur - barre, opacity: opacite }} />
  );
  const coque = (miroir: boolean) => (
    <div style={{ position: "absolute", inset: 0, borderRadius: largeur * (paysage ? 0.05 : 0.13), transform: miroir ? "scaleY(-1)" : undefined,
      background: "linear-gradient(135deg, #3a3f3c 0%, #121514 18%, #0b0d0c 60%, #2b302d 100%)",
      boxShadow: miroir ? "none" : `0 0 0 1.5px ${C.orClair}66, 0 60px 140px rgba(0,0,0,0.65), 0 0 90px ${C.or}26` }}>
      <div style={{ position: "absolute", left: bord, top: bord, width: largeur, height: hauteur, borderRadius: largeur * (paysage ? 0.035 : 0.1),
        overflow: "hidden", background: "#fff" }}>
        {!paysage && <BarreEtat largeur={largeur} />}
        {image(ecran, 1)}
        {ecran2 && melange > 0 && image(ecran2, Math.min(1, melange))}
        {!miroir && children}
        {/* reflet sur la vitre */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 28%, transparent 45%)" }} />
        {!paysage && <div style={{ position: "absolute", left: "50%", top: largeur * 0.022, width: largeur * 0.26, height: largeur * 0.07, marginLeft: -largeur * 0.13,
          borderRadius: 99, background: "#0b0d0c" }} />}
      </div>
    </div>
  );
  return (
    <div style={{ position: "absolute", perspective: 2400, ...style }}>
      <div style={{ position: "relative", width: l, height: h, transform: rotation, transformStyle: "preserve-3d" }}>
        {coque(false)}
        {reflet && (
          <div style={{ position: "absolute", left: 0, top: h + 18, width: l, height: h, opacity: 0.22,
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 35%)" }}>
            {coque(true)}
          </div>
        )}
      </div>
    </div>
  );
}
