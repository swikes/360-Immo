/** Les vidéos que Remotion connaît : une par public (scripts.json), au format vertical */
import { Composition } from "remotion";
import "./polices";
import { dureeVideo, VIDEOS } from "./donnees";
import { HAUTEUR, IPS, LARGEUR } from "./theme";
import { NOMBRE_PLANCHES, Planches } from "./pub/Planches";
import { Video } from "./Video";

export function Racine() {
  return (
    <>
      {VIDEOS.map((nom) => (
        <Composition key={nom} id={nom} component={Video} durationInFrames={dureeVideo(nom)} fps={IPS} width={LARGEUR} height={HAUTEUR}
          defaultProps={{ nom }} />
      ))}
      {/* storyboard de la publicité 16:9 : une image par scène */}
      <Composition id="planches" component={Planches} durationInFrames={NOMBRE_PLANCHES} fps={IPS} width={1920} height={1080} />
    </>
  );
}
