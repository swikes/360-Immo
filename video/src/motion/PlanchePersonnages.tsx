/*
 * Planche des personnages (contrôle visuel des poses et expressions) :
 *   npx remotion still src/index.ts planche-personnages sortie/planche-personnages.png
 */
import { AbsoluteFill } from "remotion";
import { MAIN, P, TITRE } from "./palette";
import { AWA, Cles, DEMARCHEUR, Personnage, PROPRIETAIRE, TelephoneMain } from "./Personnage";

export function PlanchePersonnages() {
  const etiquette = (x: number, y: number, texte: string) => (
    <div style={{ position: "absolute", left: x - 160, top: y, width: 320, textAlign: "center", fontFamily: MAIN, fontSize: 40, color: P.gris }}>{texte}</div>
  );
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <div style={{ position: "absolute", top: 60, width: "100%", textAlign: "center", fontFamily: TITRE, fontWeight: 800, fontSize: 70, color: P.encre }}>
        Personnages
      </div>
      <Personnage type={AWA} x={270} y={1010} taille={0.85} objetD={<TelephoneMain />} brasD={[30, 120]} sueur={1} yeux="fatigues" sourire={-0.4} />
      {etiquette(270, 1020, "Awa, fatiguée")}
      <Personnage type={DEMARCHEUR} x={790} y={1010} taille={0.85} brasG={[150, -30]} brasD={[20, 60]} objetD={<TelephoneMain />} sourire={1} bouche={0.7} />
      {etiquette(790, 1020, "le démarcheur")}
      <Personnage type={AWA} x={200} y={1840} taille={0.7} yeux="joie" sourire={1} brasG={[160, -10]} brasD={[25, 100]} objetD={<Cles />} saut={20} />
      {etiquette(200, 1845, "contente")}
      <Personnage type={AWA} x={540} y={1840} taille={0.7} yeux="ronds" sourire={-0.2} bouche={0.55} brasG={[40, 110]} brasD={[40, 110]} sourcils={1} saut={20} />
      {etiquette(540, 1845, "surprise")}
      <Personnage type={DEMARCHEUR} x={880} y={1840} taille={0.7} sourire={-1} tete={-8} corps={4} brasG={[10, 20]} brasD={[10, 20]} sourcils={-0.6} />
      {etiquette(880, 1845, "triste")}
      {/* avatar (buste), comme dans l'écran d'appel */}
      <div style={{ position: "absolute", left: 40, top: 30, width: 200, height: 200, borderRadius: 999, overflow: "hidden", background: P.orPale, border: `6px solid ${P.vert}` }}>
        <Personnage type={PROPRIETAIRE} x={100} y={250} taille={0.6} buste sourire={0.8} />
      </div>
    </AbsoluteFill>
  );
}
