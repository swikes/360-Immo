/** Titre d'une scène : les mots montent l'un après l'autre ; *mot* : en doré et en italique */
import type { CSSProperties } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, POLICE_TITRES } from "../theme";

/** « Un bien à *louer* ? » → [{ mot: "Un" }, …, { mot: "louer", accent: true }, { mot: " ?" }] (« ? » reste collé) */
export function motsDuTitre(texte: string) {
  return texte.replace(/ ([?!:;])/g, " $1").split(/(\*[^*]+\*)/).filter(Boolean).flatMap((bout) => {
    const accent = bout.startsWith("*");
    return bout.replace(/\*/g, "").split(" ").filter(Boolean).map((mot) => ({ mot, accent }));
  });
}

export function Titre({ texte, debut = 4, taille = 84, style }: { texte: string; debut?: number; taille?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mots = motsDuTitre(texte);
  return (
    <h1 style={{ margin: 0, fontFamily: POLICE_TITRES, fontWeight: 700, fontSize: taille, lineHeight: 1.12, color: "#FFFFFF",
      textAlign: "center", textWrap: "balance", ...style }}>
      {mots.map((m, i) => {
        const p = spring({ frame: f - debut - i * 3, fps, config: { damping: 18, mass: 0.7 } });
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: Math.min(1, p), transform: `translateY(${(1 - p) * 44}px)`,
            color: m.accent ? C.orClair : undefined, fontStyle: m.accent ? "italic" : undefined }}>
            {m.mot}{i < mots.length - 1 && !mots[i + 1].mot.startsWith("\u202F") ? " " : ""}
          </span>
        );
      })}
    </h1>
  );
}
