/*
 * Sous-titres (beaucoup de vidéos sont regardées sans le son) : le texte de la voix off, par morceaux d'une ou deux
 * lignes. Chaque morceau reste à l'écran le temps qu'il faut pour le dire (au prorata de sa longueur prononcée).
 */
import { Fragment } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, POLICE_TEXTE } from "../theme";

const MARQUE = "360-Immo.ci";

/** Le texte tel qu'il se prononce, pour estimer la durée de chaque morceau */
const aDire = (t: string) => t.replaceAll(MARQUE, "trois cent soixante Immo point C I").replace(/\b20\b/g, "vingt");

/** Coupe après chaque phrase, et après une virgule quand le morceau devient long */
export function morceaux(texte: string): string[] {
  const bouts = texte.replace(/ ([?!:;])/g, " $1").split(/(?<=[.?!:,;])\s+/);
  const r: string[] = [];
  for (const b of bouts) {
    const avant = r.at(-1);
    const finDePhrase = avant !== undefined && /[.?!]$/.test(avant);
    if (avant !== undefined && !finDePhrase && avant.length + b.length < 58) r[r.length - 1] = `${avant} ${b}`;
    else r.push(b);
  }
  return r;
}

/** « Sur 360-Immo.ci, publiez… » : le nom du site en gras et en vert */
function AvecMarque({ texte }: { texte: string }) {
  return (
    <>
      {texte.split(MARQUE).map((bout, i) => (
        <Fragment key={i}>
          {i > 0 && <strong style={{ color: C.vertMoyen, fontWeight: 700 }}>{MARQUE}</strong>}
          {bout}
        </Fragment>
      ))}
    </>
  );
}

export function SousTitres({ texte, debut, duree, bas = 330 }: { texte: string; debut: number; duree: number; bas?: number }) {
  const f = useCurrentFrame() - debut;
  const { fps } = useVideoConfig();
  const liste = morceaux(texte);
  const poids = liste.map((m) => aDire(m).length + 8);
  const total = poids.reduce((a, b) => a + b, 0);
  let cumul = 0;
  const debuts = poids.map((p) => {
    const d = (cumul / total) * duree;
    cumul += p;
    return d;
  });
  const i = Math.max(0, debuts.findLastIndex((d) => f >= d - 3));
  const entree = spring({ frame: f + 6, fps, config: { damping: 20 } });
  const changement = i === 0 ? 1 : interpolate(f - debuts[i] + 3, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, bottom: bas, minHeight: 160, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "22px 40px", borderRadius: 32, background: "rgba(255,255,255,0.97)",
      boxShadow: "0 18px 50px rgba(0,0,0,0.35)", opacity: entree, transform: `translateY(${(1 - entree) * 40}px)` }}>
      <p style={{ margin: 0, fontFamily: POLICE_TEXTE, fontSize: 44, fontWeight: 500, lineHeight: 1.3, color: C.vertFonce,
        textAlign: "center", textWrap: "balance", opacity: changement, transform: `translateY(${(1 - changement) * 12}px)` }}>
        <AvecMarque texte={liste[i].replace(/,$/, "")} />
      </p>
    </div>
  );
}
