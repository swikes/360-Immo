/*
 * Scène d'ouverture : le symbole du logo tombe comme une épingle sur une carte (avec ses ondes), la question,
 * les types de biens qui apparaissent pendant que la voix les cite, et deux écrans du site qui montent en bas.
 */
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Icone } from "../composants/Icone";
import { SousTitres } from "../composants/SousTitres";
import { Titre } from "../composants/Titre";
import { ECRANS, type ScenePlacee } from "../donnees";
import { AVANT_VOIX, C, POLICE_TEXTE } from "../theme";

const SYMBOLE_H = 230;
const SYMBOLE_Y = 200;

function Onde({ debut }: { debut: number }) {
  const f = useCurrentFrame();
  const p = interpolate(f - debut, [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0 || p >= 1) return null;
  const l = 60 + 420 * p;
  return (
    <div style={{ position: "absolute", left: 540 - l / 2, top: SYMBOLE_Y + SYMBOLE_H - (l * 0.3) / 2, width: l, height: l * 0.3,
      borderRadius: "50%", border: `4px solid ${C.orClair}`, opacity: 0.8 * (1 - p) }} />
  );
}

/** Un écran du site qui monte en bas de l'image, puis redescend juste avant la scène suivante (qui amène le téléphone) */
function Apercu({ nom, gauche, angle, debut, fin }: { nom: string; gauche: number; angle: number; debut: number; fin: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = ECRANS[nom];
  if (!e) return null;
  const p = spring({ frame: f - debut, fps, config: { damping: 22, mass: 1.2 } });
  const sortie = interpolate(f, [fin - 28, fin - 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const l = 400;
  return (
    <div style={{ position: "absolute", left: gauche, top: 1180 + (1 - p) * 700 - f * 0.6 + sortie * 800, width: l, height: (l * e.hauteur) / e.largeur,
      borderRadius: 36, overflow: "hidden", transform: `rotate(${angle}deg)`, boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
      border: "8px solid #0d0f0e" }}>
      <Img src={staticFile(e.fichier)} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export function Ouverture({ scene }: { scene: ScenePlacee }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chute = spring({ frame: f - 2, fps, config: { damping: 11, mass: 0.9 } });
  const [gauche, droite] = scene.apercus ?? [];
  return (
    <AbsoluteFill>
      <Apercu nom={gauche} gauche={60} angle={-9} debut={10} fin={scene.duree} />
      <Apercu nom={droite} gauche={620} angle={8} debut={18} fin={scene.duree} />
      <Onde debut={14} />
      <Onde debut={30} />
      <div style={{ position: "absolute", top: SYMBOLE_Y, left: 0, right: 0, display: "flex", justifyContent: "center",
        opacity: Math.min(1, chute * 2), transform: `translateY(${(1 - chute) * -260}px)` }}>
        <Img src={staticFile("logo/360-immo-symbole-fond-sombre.svg")} style={{ height: SYMBOLE_H }} />
      </div>
      <div style={{ position: "absolute", top: 520, left: 60, right: 60 }}>
        <Titre texte={scene.titre} debut={10} taille={98} />
      </div>
      <div style={{ position: "absolute", top: 830, left: 40, right: 40, display: "flex", justifyContent: "center", gap: 22, flexWrap: "wrap" }}>
        {(scene.mots ?? []).map(([icone, mot], i) => {
          const p = spring({ frame: f - AVANT_VOIX - 30 - i * 18, fps, config: { damping: 13 } });
          return (
            <div key={mot} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 30px", borderRadius: 999,
              background: "rgba(255,255,255,0.1)", border: `3px solid ${C.orClair}`, color: "#FFFFFF", fontFamily: POLICE_TEXTE,
              fontSize: 40, fontWeight: 500, opacity: Math.min(1, p), transform: `scale(${0.6 + 0.4 * p})` }}>
              <span style={{ color: C.orClair, display: "flex" }}><Icone nom={icone} taille={40} /></span>
              {mot}
            </div>
          );
        })}
      </div>
      <SousTitres texte={scene.texte} debut={AVANT_VOIX} duree={scene.voixImages} />
    </AbsoluteFill>
  );
}
