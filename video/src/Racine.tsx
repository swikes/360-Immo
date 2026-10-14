/** Les vidéos que Remotion connaît : une par public (scripts.json), au format vertical */
import { Composition } from "remotion";
import "./polices";
import { dureeVideo, VIDEOS } from "./donnees";
import { HAUTEUR, IPS, LARGEUR } from "./theme";
import { Video } from "./Video";

export function Racine() {
  return (
    <>
      {VIDEOS.map((nom) => (
        <Composition key={nom} id={nom} component={Video} durationInFrames={dureeVideo(nom)} fps={IPS} width={LARGEUR} height={HAUTEUR}
          defaultProps={{ nom }} />
      ))}
    </>
  );
}
