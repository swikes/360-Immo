/*
 * Téléphone en relief (perspective CSS) pour les planches de la publicité : coque sombre, tranche métallique, reflet,
 * liseré doré, et son reflet au sol. La vidéo finale le reprendra en vraie 3D (three.js).
 */
import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C } from "../theme";

export function Telephone3D({ ecran, largeur = 420, rotation = "rotateY(-24deg) rotateX(8deg)", style, paysage = false, children, reflet = true }: {
  ecran: string; largeur?: number; rotation?: string; style?: CSSProperties; paysage?: boolean; children?: ReactNode; reflet?: boolean;
}) {
  const bord = largeur * 0.035;
  const hauteurEcran = paysage ? largeur * 0.5625 : largeur * (664 + 44) / 390;
  const l = largeur + 2 * bord, h = hauteurEcran + 2 * bord;
  const coque = (miroir: boolean) => (
    <div style={{ position: "absolute", inset: 0, borderRadius: largeur * 0.13, transform: miroir ? "scaleY(-1)" : undefined,
      background: "linear-gradient(135deg, #3a3f3c 0%, #121514 18%, #0b0d0c 60%, #2b302d 100%)",
      boxShadow: miroir ? "none" : `0 0 0 1.5px ${C.orClair}66, 0 60px 140px rgba(0,0,0,0.65), 0 0 90px ${C.or}26` }}>
      <div style={{ position: "absolute", left: bord, top: bord, width: largeur, height: hauteurEcran, borderRadius: largeur * 0.1,
        overflow: "hidden", background: "#fff" }}>
        <Img src={staticFile(ecran)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        {children}
        {/* reflet sur la vitre */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 28%, transparent 45%)" }} />
        {!paysage && <div style={{ position: "absolute", left: "50%", top: largeur * 0.025, width: largeur * 0.26, height: largeur * 0.07, marginLeft: -largeur * 0.13,
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
