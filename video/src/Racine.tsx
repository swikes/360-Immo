/** Les vidéos que Remotion connaît : une par public (scripts.json), au format vertical */
import { Composition } from "remotion";
import "./polices";
import "./motion/polices";
import { PlanchePersonnages } from "./motion/PlanchePersonnages";
import { IMAGES_PUB_ANNONCEURS, PubAnnonceurs } from "./pub-annonceurs/PubAnnonceurs";
import { IMAGES_PUB_DEMARCHEUR, PubDemarcheur } from "./pub-demarcheur/PubDemarcheur";
import { dureeVideo, VIDEOS } from "./donnees";
import { HAUTEUR, IPS, LARGEUR } from "./theme";
import { NOMBRE_PLANCHES, Planches } from "./pub/Planches";
import { IMAGES_PUB, Publicite } from "./pub/Publicite";
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
      {/* publicité 16:9 « Sous tous les angles », 60 s */}
      <Composition id="publicite" component={Publicite} durationInFrames={IMAGES_PUB} fps={IPS} width={1920} height={1080} />
      {/* boîte à outils motion design : planche des personnages (contrôle des poses) */}
      <Composition id="planche-personnages" component={PlanchePersonnages} durationInFrames={1} fps={IPS} width={1080} height={1920} />
      {/* publicité 9:16 « Le démarcheur » (~32 s), boîte à outils src/motion */}
      <Composition id="pub-demarcheur" component={PubDemarcheur} durationInFrames={IMAGES_PUB_DEMARCHEUR} fps={IPS} width={1080} height={1920} />
      {/* publicité 9:16 « Annonceurs » (~47 s) : les atouts d'annoncer sur 360Immo.ci */}
      <Composition id="pub-annonceurs" component={PubAnnonceurs} durationInFrames={IMAGES_PUB_ANNONCEURS} fps={IPS} width={1080} height={1920} />
    </>
  );
}
