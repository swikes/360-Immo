/*
 * Scène « écran du site » : le titre, le téléphone avec la capture, puis l'élément important qui se détache
 * (cadre doré, loupe, reflet) pendant que la voix l'explique.
 */
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Loupe, Reperes, Telephone } from "../composants/Telephone";
import { SousTitres } from "../composants/SousTitres";
import { Titre } from "../composants/Titre";
import { ECRANS, type ScenePlacee } from "../donnees";
import { AVANT_VOIX, FONDU, POLICE_TEXTE } from "../theme";

export function Demonstration({ scene, premiere }: { scene: ScenePlacee; premiere: boolean }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = ECRANS[scene.ecran!];
  // le téléphone flotte doucement ; calculé sur le temps de la vidéo, il ne saute pas d'une scène à l'autre
  const flotte = 9 * Math.sin((scene.debut + f) / 38);
  const entree = premiere ? spring({ frame: f - 2, fps, config: { damping: 20, mass: 1.1 } }) : 1;
  const anneau = spring({ frame: f - 16, fps, config: { damping: 14 } });
  // la loupe se range juste avant le fondu : d'une scène à l'autre, seul l'écran du téléphone change
  const range = interpolate(f, [scene.duree - FONDU - 12, scene.duree - FONDU], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const loupe = spring({ frame: f - 32, fps, config: { damping: 15, mass: 0.9 } }) * range;
  const reflet = (f - 52) / 22;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 92, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Img src={staticFile("logo/360-immo-logo-fond-sombre.svg")} style={{ height: 50 }} />
      </div>
      <div style={{ position: "absolute", top: 196, left: 60, right: 60 }}>
        <Titre texte={scene.titre} />
      </div>
      <AbsoluteFill style={{ transform: `translateY(${flotte + (1 - entree) * 1100}px)` }}>
        <Telephone ecran={e}>
          <Reperes e={e} anneau={anneau} loupe={loupe} />
        </Telephone>
        <Loupe e={e} p={loupe} reflet={reflet} />
      </AbsoluteFill>
      <SousTitres texte={scene.texte} debut={AVANT_VOIX} duree={scene.voixImages} />
      <p style={{ position: "absolute", top: 1612, left: 0, right: 0, margin: 0, textAlign: "center", fontFamily: POLICE_TEXTE,
        fontSize: 26, color: "rgba(250,250,248,0.6)" }}>
        Écrans du site · annonces et chiffres d&apos;exemple
      </p>
    </AbsoluteFill>
  );
}
