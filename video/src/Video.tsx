/** Une vidéo : le fond commun, puis les scènes enchaînées en fondu, chacune avec sa voix off */
import { Fragment } from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Fond } from "./composants/Fond";
import { plan, SCRIPTS, type NomVideo } from "./donnees";
import { Cloture } from "./scenes/Cloture";
import { Demonstration } from "./scenes/Demonstration";
import { Ouverture } from "./scenes/Ouverture";
import { AVANT_VOIX, FONDU, POLICE_TEXTE } from "./theme";

export function Video({ nom }: { nom: NomVideo }) {
  const scenes = plan(nom);
  const premierEcran = scenes.findIndex((s) => s.ecran);
  return (
    <AbsoluteFill style={{ fontFamily: POLICE_TEXTE }}>
      <Fond />
      <TransitionSeries>
        {scenes.map((s, i) => (
          <Fragment key={s.id}>
            {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FONDU })} />}
            <TransitionSeries.Sequence durationInFrames={s.duree}>
              {s.ecran ? <Demonstration scene={s} premiere={i === premierEcran} />
                : i === 0 ? <Ouverture scene={s} />
                : <Cloture scene={s} appel={SCRIPTS[nom].appel} />}
              <Sequence from={AVANT_VOIX} layout="none">
                <Html5Audio src={staticFile(`voix/${nom}-${s.id}.wav`)} />
              </Sequence>
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
