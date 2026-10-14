/** Scène de fin : le logo, l'invitation, le bouton (qui bat doucement) et les points forts */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Icone } from "../composants/Icone";
import { Titre } from "../composants/Titre";
import type { ScenePlacee } from "../donnees";
import { C, POLICE_TEXTE } from "../theme";

export function Cloture({ scene, appel }: { scene: ScenePlacee; appel: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 2, fps, config: { damping: 14 } });
  const bouton = spring({ frame: f - 22, fps, config: { damping: 12 } });
  const bat = f > 50 ? 1 + 0.035 * Math.sin((f - 50) / 5) : 1;
  const onde = ((f - 50) % 45) / 45;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", justifyContent: "center",
        opacity: Math.min(1, logo), transform: `scale(${0.8 + 0.2 * logo})` }}>
        <Img src={staticFile("logo/360-immo-logo-fond-sombre.svg")} style={{ width: 780 }} />
      </div>
      <div style={{ position: "absolute", top: 600, left: 60, right: 60 }}>
        <Titre texte={scene.titre} debut={10} taille={92} />
      </div>
      <div style={{ position: "absolute", top: 820, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", opacity: Math.min(1, bouton), transform: `scale(${(0.7 + 0.3 * bouton) * bat})` }}>
          {f > 50 && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `4px solid ${C.orClair}`,
              transform: `scale(${1 + 0.25 * onde}, ${1 + 0.6 * onde})`, opacity: 1 - onde }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "30px 64px", borderRadius: 999,
            background: `linear-gradient(180deg, ${C.orClair}, ${C.or})`, color: C.vertNuit, fontFamily: POLICE_TEXTE, fontSize: 52,
            fontWeight: 600, boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
            {appel} <Icone nom="fleche" taille={48} epaisseur={2.5} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1030, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        {(scene.atouts ?? []).map((a, i) => {
          const p = spring({ frame: f - 36 - i * 8, fps, config: { damping: 16 } });
          return (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 18, color: "#FFFFFF", fontFamily: POLICE_TEXTE, fontSize: 44,
              opacity: Math.min(1, p), transform: `translateX(${interpolate(p, [0, 1], [-60, 0])}px)` }}>
              <span style={{ color: C.orClair, display: "flex" }}><Icone nom="valide" taille={44} /></span>
              {a}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
