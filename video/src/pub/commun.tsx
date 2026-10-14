/** Éléments communs aux planches du storyboard et à la publicité : fond « studio », arc doré, titres, photos */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, getStaticFiles, Img, staticFile } from "remotion";
import { C, POLICE_TEXTE, POLICE_TITRES } from "../theme";

/** Fond « studio » : vert presque noir, lumière douce ; une mention discrète en bas à droite */
export function Studio({ children, lumiere = "50% 45%", mention = "Image de travail · storyboard" }: { children?: ReactNode; lumiere?: string; mention?: string }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${lumiere}, #1C4A33 0%, #0E2A1D 38%, #050E0A 100%)`, fontFamily: POLICE_TEXTE, overflow: "hidden" }}>
      {children}
      {mention && <div style={{ position: "absolute", right: 28, bottom: 20, color: "rgba(250,250,248,0.4)", fontSize: 20 }}>{mention}</div>}
    </AbsoluteFill>
  );
}

/** Le grand arc doré du logo (flèche « 360 ») ; progres : part tracée, de 0 à 1 */
export function Arc({ cx, cy, r, debut = -30, fin = 230, epaisseur = 5, opacite = 1, progres = 1 }: {
  cx: number; cy: number; r: number; debut?: number; fin?: number; epaisseur?: number; opacite?: number; progres?: number;
}) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(debut), [x2, y2] = p(fin);
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${fin - debut > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  const longueur = (r * Math.PI * (fin - debut)) / 180;
  const trace = { strokeDasharray: longueur, strokeDashoffset: longueur * (1 - Math.max(0, Math.min(1, progres))) };
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: opacite }}>
      <defs><filter id="flou-arc"><feGaussianBlur stdDeviation="10" /></filter>
        <linearGradient id="or-arc" x1="0" x2="1"><stop offset="0" stopColor={C.orClair} stopOpacity={0} /><stop offset="0.6" stopColor={C.orClair} /><stop offset="1" stopColor="#FFF3C4" /></linearGradient></defs>
      <path d={d} stroke={C.orClair} strokeWidth={epaisseur * 5} fill="none" opacity={0.35} filter="url(#flou-arc)" strokeLinecap="round" style={trace} />
      <path d={d} stroke="url(#or-arc)" strokeWidth={epaisseur} fill="none" strokeLinecap="round" style={trace} />
    </svg>
  );
}

export const Titre = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: "absolute", fontFamily: POLICE_TITRES, fontWeight: 700, color: "#fff", fontSize: 72, lineHeight: 1.1, ...style }}>{children}</div>
);
export const Or = ({ children }: { children: ReactNode }) => <span style={{ color: C.orClair, fontStyle: "italic" }}>{children}</span>;

/** Fichiers de public/ (les photos de biens n'y sont que sur la machine de travail : droits de leurs auteurs) */
const fichiers = new Set(getStaticFiles().map((f) => f.name));
export const disponible = (chemin?: string) => !!chemin && fichiers.has(chemin);

/** Une vraie photo (chemin dans public/, ex. photos/annonces/10.jpg), sinon un emplacement à remplir */
export function Photo({ libelle, src, style, image }: { libelle: string; src?: string; style?: CSSProperties; image?: CSSProperties }) {
  if (disponible(src)) {
    return (
      <div style={{ position: "absolute", overflow: "hidden", background: "#222", ...style }}>
        <Img src={staticFile(src!)} style={{ width: "100%", height: "100%", objectFit: "cover", ...image }} />
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", overflow: "hidden", background: "linear-gradient(135deg, #CDB894 0%, #9DA88F 50%, #5E7B6B 100%)", ...style }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 22px, transparent 22px 44px)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
        color: "rgba(255,255,255,0.92)", fontSize: 26, fontWeight: 500, textAlign: "center", padding: 20, fontFamily: POLICE_TEXTE }}>
        <svg width={54} height={54} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.5" /><path d="M8 5l1.5-2h5L16 5" /></svg>
        {libelle}
      </div>
    </div>
  );
}
