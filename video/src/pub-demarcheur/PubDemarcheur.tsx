/*
 * Publicité « Le démarcheur » (9:16, ~32 s) : chercher une maison à Abidjan fatigue ; le démarcheur promet, fait payer
 * la visite, et « c'est juste derrière » ; avec 360Immo.ci, annonces vérifiées, contact direct, juste prix ;
 * le démarcheur se demande où il va manger ; fin : logo, points forts, adresse du site.
 * Toutes les images se calent sur les répliques (scenario.ts). Rendu :
 *   npx remotion render src/index.ts pub-demarcheur sortie/pub-demarcheur.mp4
 */
import { BadgeCheck, BedDouble, Building, Building2, Footprints, Hotel, House, MapPin, Maximize2, MousePointerClick, Phone, Scale, Search, Sparkles, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { doux, entree, flotte, secousse } from "../motion/anim";
import { Aplat, Anneaux, Camera, Fouet, Pieces, Soleil } from "../motion/Decor";
import { Doigt, Telephone } from "../motion/Ecran";
import { Bruit, Bulle, Carte, Logo, Pastille, Tampon, type Icone } from "../motion/Elements";
import { Jauge, Nuage, Route } from "../motion/Illustrations";
import { AWA, Cles, DEMARCHEUR, Personnage, TelephoneMain } from "../motion/Personnage";
import { H, L, MAIN, P, TITRE } from "../motion/palette";
import { Compteur, MotFantome, Mots, NoteMain, Trait } from "../motion/Texte";
import { BOUTON_APPELER, EcranAnnonce, EcranContact, ORIGINE_ECRAN, TEL } from "./Ecrans";
import { bouche, DUREE, parole, R, type Replique } from "./scenario";

export { DUREE as IMAGES_PUB_DEMARCHEUR };

// Changements de plan (images)
const T1 = R.D1.debut - 7; // arrivée du démarcheur
const T2 = R.N3.debut - 6; // 360Immo.ci (vert)
const T3 = R.N4.debut - 6; // le téléphone : annonces vérifiées, puis contact
const T5 = R.N6.debut - 6; // juste prix
const T6 = R.D4.debut - 4; // le démarcheur triste (coupe sèche, la musique s'arrête)
const T7 = R.N7.debut - 8; // fin
const FOUET = 9;

/** Un plan : affiché de « de » à « a », entrée et sortie en coup de fouet ou en coupe sèche */
function Plan({ f, de, a, entreeFouet = false, sortieFouet = false, children }: {
  f: number; de: number; a: number; entreeFouet?: boolean; sortieFouet?: boolean; children: ReactNode;
}) {
  if (f < de || f >= a + (sortieFouet ? FOUET : 0)) return null;
  let contenu = <AbsoluteFill>{children}</AbsoluteFill>;
  if (sortieFouet) contenu = <Fouet f={f} debut={a} duree={FOUET} sortie>{contenu}</Fouet>;
  if (entreeFouet) contenu = <Fouet f={f} debut={de} duree={FOUET}>{contenu}</Fouet>;
  return contenu;
}

const dit = (ids: Replique[], f: number) => bouche(ids, f);
const pendant = (f: number, id: Replique, avant = 0, apres = 0) => f >= R[id].debut - avant && f < R[id].fin + apres;

// ───────────────────────── 1. La recherche, la fatigue ─────────────────────────
function Recherche({ f }: { f: number }) {
  const n1 = R.N1.debut, n2 = R.N2.debut;
  const fatigue = doux(f, n2, 10);
  const soupir = Math.max(0, Math.sin(Math.min(1, Math.max(0, (f - n2 - 1) / 14)) * Math.PI));
  const quartiers: [number, number, number, string, Icone][] = [
    [250, 760, -8, "Cocody", <House />], [830, 720, 7, "Yopougon", <Building2 />],
    [200, 1160, 6, "Marcory", <Hotel />], [880, 1130, -6, "Angré", <Building />],
  ];
  // la loupe passe d'une carte à l'autre
  const lx = interpolate(f, [n1 + 14, n1 + 30, n1 + 44, n1 + 58], [250, 830, 200, 880], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ly = interpolate(f, [n1 + 14, n1 + 30, n1 + 44, n1 + 58], [880, 840, 1280, 1250], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <MotFantome texte="ABIDJAN" f={f} debut={0} y={1010} taille={232} opacite={0.06} />
      {quartiers.map(([x, y, r, nom, ic], i) => (
        <Carte key={nom} f={f} debut={i * 4 - 4} x={x} y={y + flotte(f, 2.4, i * 0.25) * 10} rotation={r} largeur={250} icone={ic} titre={nom} />
      ))}
      {f >= n1 + 10 && (
        <div style={{ position: "absolute", left: lx - 100, top: ly - 100, opacity: doux(f, n1 + 10, 6) * (1 - doux(f, n2 - 4, 6)),
          transform: `rotate(${flotte(f, 1.2) * 6}deg)`, filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.25))" }}>
          <Search size={200} color={P.encre} fill="rgba(255,255,255,0.35)" strokeWidth={2.4} />
        </div>
      )}
      <div style={{ position: "absolute", top: 250, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: 1 - doux(f, n2 - 2, 6) }}>
        <Mots texte="Chercher une maison" f={f} debut={n1 + 2} ecart={5} taille={112} />
        <Mots texte="à Abidjan…" f={f} debut={n1 + 30} ecart={5} taille={112} accents={{ Abidjan: { fond: P.orClair, couleur: P.encre } }} />
      </div>
      {/* « Ça fatigue ! » : la chaleur envahit l'écran */}
      <Aplat couleur={P.orClair} f={f} debut={n2 - 2} duree={10} x={540} y={1500} />
      {f >= n2 - 2 && (
        <>
          <Anneaux f={f} couleur={P.blanc} x={540} y={1450} opacite={0.18} ecart={170} nombre={6} />
          <Soleil f={f} x={890} y={260} taille={190} debut={n2} />
          <div style={{ position: "absolute", top: 520, width: L, textAlign: "center", fontFamily: MAIN, fontSize: 210, color: P.encre, lineHeight: 1,
            transform: `rotate(-5deg) scale(${entree(f, n2 + 16, 9, 200)}) translateX(${secousse(f, n2 + 20, 14, 16)}px)` }}>
            Ça fatigue !
          </div>
          <NoteMain texte="(et il fait chaud !)" f={f} debut={n2 + 26} x={330} y={270} rotation={-6} fleche="droite" taille={62} largeur={480} />
        </>
      )}
      <Personnage type={AWA} x={540} y={1990} taille={0.95} f={f} objetD={<TelephoneMain />} brasD={[22 + fatigue * 6, 118 - fatigue * 10]}
        brasG={[8 + fatigue * 4, -4]} yeux={fatigue > 0.5 ? "fatigues" : "ouverts"} regard={0.4} tete={6 + fatigue * 6} corps={fatigue * 3}
        sueur={doux(f, n2 + 4, 8)} sourire={0.35 - fatigue * 0.9} sourcils={-fatigue * 0.3} ecrase={1 - soupir * 0.05} />
    </AbsoluteFill>
  );
}

// ───────────────────────── 2. Le démarcheur ─────────────────────────
function Demarcheur({ f }: { f: number }) {
  const d1 = R.D1.debut, d2 = R.D2.debut, d3 = R.D3.debut;
  const arrivee = entree(f, T1 + 3, 13, 120);
  const xD = 1450 - (1450 - 790) * arrivee;
  const sautD = Math.max(0, Math.sin(Math.min(1, Math.max(0, (f - T1 - 3) / 14)) * Math.PI)) * 120;
  const parle = dit(["D1", "D2", "D3"], f);
  const choc = f >= d2 + 61;
  const loin = f >= d3;
  // gestes du démarcheur (vu en miroir : brasG est son bras du côté droit de l'image)
  const coucou: [number, number] = [128 + flotte(f, 0.5) * 14, -40];
  const brasG: [number, number] = loin ? [150, -6] : f >= d2 ? [40, -70] : f < d1 + 30 ? coucou : [30, 60];
  const brasD: [number, number] = f >= d2 && !loin ? [62, -42] : [22, 64];
  const pastilles: [string, Icone, number][] = [
    ["2 pièces", <BedDouble />, d1 + 29], ["Spacieux", <Maximize2 />, d1 + 52], ["Propre-propre", <Sparkles />, d1 + 75],
  ];
  return (
    <AbsoluteFill style={{ background: P.orPale }}>
      <Anneaux f={f} couleur={P.or} x={540} y={1300} opacite={0.14} ecart={180} nombre={6} />
      {/* ce qu'il promet */}
      <div style={{ position: "absolute", top: 250, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 30,
        opacity: 1 - doux(f, d2 - 4, 6) }}>
        {pastilles.map(([t, ic, a]) => (
          <Pastille key={t} texte={t} f={f} debut={a} icone={ic} taille={76} fond={P.blanc} couleur={P.encre} fondIcone={P.or} />
        ))}
      </div>
      <Bulle texte="Ma sœur !" f={f} debut={d1} fin={d1 + 34} x={400} y={560} largeur={480} queue="bas-droite" taille={96} />
      <NoteMain texte="le démarcheur" f={f} debut={d1 + 36} fin={d2 - 2} x={790} y={735} rotation={5} fleche="bas" taille={76} largeur={460} />
      {/* les frais de visite */}
      <Bulle texte="Frais de visite d'abord…" f={f} debut={d2} fin={d2 + 58} x={280} y={520} largeur={660} queue="bas-droite" taille={80} />
      <Tampon texte="5 000 F" f={f} debut={d2 + 61} fin={d3 - 2} couleur={P.rouge} x={540} y={400} rotation={-9} taille={160} />
      <Pieces f={f} debut={d2 + 62} mode="gerbe" x={330} y={1350} nombre={14} taille={100} graine={3} />
      <NoteMain texte="Avant même de visiter ?!" f={f} debut={d2 + 70} fin={d3 - 2} x={540} y={640} rotation={-5} taille={80} largeur={800} couleur={P.rouge} />
      {/* « c'est juste derrière là-bas » */}
      {loin && (
        <>
          <Route f={f} debut={d3 + 4} duree={48} x={0} y={0} largeur={L} hauteur={1100}
            d="M1030 900 C 1060 760, 760 820, 800 640 S 420 640, 500 470 S 160 420, 190 250" fin={{ x: 190, y: 250 }} />
          <div style={{ position: "absolute", right: 60, top: 110, display: "flex", alignItems: "center", gap: 20, padding: "16px 36px 16px 16px",
            borderRadius: 999, background: P.blanc, boxShadow: "0 10px 30px rgba(0,0,0,0.10)", fontFamily: TITRE, fontWeight: 800, fontSize: 64,
            color: P.encre, transform: `scale(${entree(f, d3 + 6, 12, 180)})`, transformOrigin: "100% 50%" }}>
            <span style={{ width: 84, height: 84, borderRadius: 999, background: P.rouge, display: "grid", placeItems: "center" }}>
              <Footprints size={50} color={P.blanc} strokeWidth={2.6} />
            </span>
            <Compteur f={f} debut={d3 + 6} duree={46} de={0.1} a={8.5} style={{ minWidth: 250, textAlign: "right" }}
              format={(n) => (n < 1 ? `${Math.round((n * 1000) / 50) * 50} m` : `${n.toFixed(1).replace(".", ",")} km`)} />
          </div>
          <NoteMain texte="« juste derrière »" f={f} debut={d3 + 40} x={460} y={190} rotation={-4} fleche="gauche" taille={62} largeur={460} />
        </>
      )}
      <Personnage type={AWA} x={270} y={1890} taille={1.04} f={f} regard={1} tete={choc ? -4 : 2}
        yeux={loin ? "fatigues" : choc ? "ronds" : "ouverts"} sourcils={choc && !loin ? 1 : f >= d1 + 60 ? -0.4 : 0}
        sourire={choc ? -0.3 : f >= d1 + 60 ? -0.1 : 0.4} bouche={choc && !loin && f < d2 + 90 ? 0.55 : 0}
        saut={choc && !loin ? Math.max(0, Math.sin(Math.min(1, (f - d2 - 61) / 10) * Math.PI)) * 50 : 0}
        sueur={loin ? doux(f, d3 + 20, 8) : 0} brasG={choc && !loin ? [40, 110] : [10, -6]} brasD={choc && !loin ? [40, 110] : [26, 40]} />
      <Personnage type={DEMARCHEUR} x={xD} y={1890} taille={1.08} f={f} miroir saut={sautD} bouche={parle} sourire={0.9} tete={-4 + flotte(f, 0.7) * 3}
        corps={loin ? -4 : f >= d2 ? 3 : 0} brasG={brasG} brasD={brasD} objetD={f < d2 ? <TelephoneMain /> : undefined} sourcils={f >= d2 && !loin ? 0.6 : 0} />
    </AbsoluteFill>
  );
}

// ───────────────────────── 3. 360Immo.ci : fini les palabres ─────────────────────────
function Solution({ f }: { f: number }) {
  const n3 = R.N3.debut;
  const coup = n3 + 86; // « palabres » rayé
  const passe = Math.min(1, entree(f, n3 + 18, 14, 140)) * (1 - doux(f, coup + 6, 8));
  return (
    <AbsoluteFill>
      <Aplat couleur={P.vert} f={f} debut={T2} duree={10} x={540} y={760} />
      <Anneaux f={f} couleur={P.blanc} x={540} y={760} opacite={0.07} ecart={200} nombre={6} />
      <div style={{ position: "absolute", top: 520, width: L, display: "flex", justifyContent: "center", transform: `scale(${entree(f, n3 + 2, 11, 160)})` }}>
        <Logo largeur={820} sombre />
      </div>
      <div style={{ position: "absolute", top: 900, width: L, display: "flex", justifyContent: "center" }}>
        <Mots texte="C'est fini les" f={f} debut={n3 + 56} ecart={7} taille={112} couleur={P.blanc} />
      </div>
      <div style={{ position: "absolute", top: 1050, width: L, textAlign: "center", fontFamily: MAIN, fontSize: 250, lineHeight: 1, color: P.orClair,
        transform: `scale(${entree(f, n3 + 78, 10, 200)}) rotate(-3deg)` }}>
        palabres
      </div>
      <Trait f={f} debut={coup} duree={7} type="barre" x={200} y={1100} largeur={680} hauteur={150} couleur={P.rouge} epaisseur={26} />
      {/* le démarcheur passe une tête… et repart */}
      <Personnage type={DEMARCHEUR} x={870} y={2720 - 440 * passe} taille={0.95} f={f} miroir sourire={f >= coup ? -0.8 : 0.6}
        sourcils={f >= coup ? 1 : 0} bouche={f >= coup ? 0.5 : 0} brasG={[20, 30]} brasD={[20, 30]} tete={-6} />
    </AbsoluteFill>
  );
}

// ───────────────────────── 4–5. Le téléphone : annonces vérifiées, contact direct ─────────────────────────
function Telephones({ f }: { f: number }) {
  const n4 = R.N4.debut, n5 = R.N5.debut;
  const monte = entree(f, T3 + 2, 14, 120);
  const changement = doux(f, n5 - 4, 8);
  const appel = n5 + 24;
  const bouton = { x: ORIGINE_ECRAN.x + BOUTON_APPELER.x, y: ORIGINE_ECRAN.y + BOUTON_APPELER.y };
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <Anneaux f={f} couleur={P.vert} x={TEL.x} y={TEL.y} opacite={0.07} ecart={200} nombre={6} />
      <div style={{ position: "absolute", top: 220, width: L, display: "flex", justifyContent: "center" }}>
        {f < n5 - 2 ? (
          <Mots texte="Annonces vérifiées" f={f} debut={n4} ecart={6} taille={104} sortie={n5 - 8} accents={{ vérifiées: { fond: P.vertPale, couleur: P.vert } }} />
        ) : (
          <Mots texte="Contact direct" f={f} debut={n5} ecart={6} taille={104} accents={{ direct: { fond: P.orClair, couleur: P.encre } }} />
        )}
      </div>
      <Telephone x={TEL.x} y={TEL.y + (1 - monte) * 1400} largeur={TEL.largeur} rotation={(1 - monte) * 8}>
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${-changement * 30}%)`, opacity: 1 - changement }}>
          <EcranAnnonce f={f} verifiee={n4 + 20} />
        </div>
        {changement > 0 && (
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - changement) * 30}%)`, opacity: changement }}>
            <EcranContact f={f} appel={appel} />
          </div>
        )}
      </Telephone>
      {f < n5 - 4 && <Tampon texte="VÉRIFIÉE" icone={<BadgeCheck />} f={f} debut={n4 + 20} couleur={P.vert} x={TEL.x} y={ORIGINE_ECRAN.y + 250} rotation={-11} taille={92} />}
      <Doigt f={f} etapes={[{ a: n5 + 4, x: 940, y: 1620 }, { a: n5 + 18, x: bouton.x + 40, y: bouton.y + 10 }]} clics={[appel - 3]} taille={150} />
      <div style={{ position: "absolute", top: 1745, width: L, display: "flex", justifyContent: "center", gap: 24 }}>
        <Pastille texte="Le propriétaire" f={f} debut={n5 + 40} icone={<UserRound />} taille={44} fond={P.blanc} couleur={P.encre} />
        <Pastille texte="L'agence" f={f} debut={n5 + 58} icone={<Building2 />} taille={44} fond={P.blanc} couleur={P.encre} />
      </div>
    </AbsoluteFill>
  );
}

// ───────────────────────── 6. Le juste prix du quartier ─────────────────────────
function JustePrix({ f }: { f: number }) {
  const n6 = R.N6.debut;
  const content = f >= n6 + 40;
  return (
    <AbsoluteFill style={{ background: P.vertPale }}>
      <Anneaux f={f} couleur={P.vert} x={540} y={980} opacite={0.08} ecart={190} nombre={6} />
      <div style={{ position: "absolute", top: 200, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Mots texte="Le juste prix" f={f} debut={n6 + 6} ecart={6} taille={124} accents={{ juste: { fond: P.orClair, couleur: P.encre } }} />
        <Mots texte="du quartier" f={f} debut={n6 + 30} ecart={6} taille={92} couleur={P.vert} />
      </div>
      <div style={{ position: "absolute", top: 640, width: L, display: "flex", justifyContent: "center" }}>
        <Jauge f={f} debut={n6} taille={860} cible={0} />
      </div>
      <div style={{ position: "absolute", top: 1250, width: L, display: "flex", justifyContent: "center" }}>
        <Pastille texte="Votre quartier" f={f} debut={n6 + 30} icone={<MapPin />} taille={50} fond={P.blanc} couleur={P.encre} />
      </div>
      <Personnage type={AWA} x={540} y={2290} taille={0.86} f={f} yeux={content ? "joie" : "ouverts"} sourire={content ? 1 : 0.3}
        regard={0} brasG={content ? [150, -20] : [10, -6]} brasD={content ? [150, -20] : [10, -6]} saut={content ? Math.abs(flotte(f, 0.6)) * 26 : 0} />
    </AbsoluteFill>
  );
}

// ───────────────────────── 7. « Eh Dieu… moi je vais manger où ? » ─────────────────────────
function Triste({ f }: { f: number }) {
  const d4 = R.D4.debut;
  return (
    <AbsoluteFill style={{ background: "#DCE2E7" }}>
      <Camera f={f - T6} duree={R.D4.fin - T6 + 20} de={1} a={1.1} origine="50% 60%">
      <Bulle texte="Eh Dieu… Moi je vais manger où maintenant ?" f={f} debut={d4 + 2} x={90} y={110} largeur={900} queue="bas-droite" taille={70} rotation={-2} />
      <Nuage f={f} debut={d4 + 8} x={560} y={470} largeur={380} />
      <Personnage type={DEMARCHEUR} x={540} y={1800} taille={1.02} f={f} bouche={dit(["D4"], f)} sourire={-1} sourcils={-0.7}
        tete={-14 + flotte(f, 2) * 2} corps={3} ecrase={0.96} brasG={[4, 8]} brasD={[4, 8]} />
      <NoteMain texte="Courage, tonton !" f={f} debut={d4 + 56} x={860} y={1020} rotation={8} taille={76} couleur={P.vert} largeur={360} />
      </Camera>
    </AbsoluteFill>
  );
}

// ───────────────────────── 8. Fin : logo, points forts, adresse ─────────────────────────
function Fin({ f }: { f: number }) {
  const n7 = R.N7.debut;
  const clic = n7 + 116;
  const presse = f >= clic - 3 && f < clic + 3 ? 0.93 : 1;
  const sautAwa = f >= n7 + 60 ? Math.abs(Math.sin(((f - n7 - 60) / 30) * Math.PI * 1.6)) * 60 : 0;
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <Anneaux f={f} couleur={P.vert} x={540} y={1100} opacite={0.07} ecart={210} nombre={6} />
      <div style={{ position: "absolute", top: 140, width: L, display: "flex", justifyContent: "center", transform: `scale(${entree(f, n7 + 2, 11, 160)})` }}>
        <Logo largeur={740} />
      </div>
      <div style={{ position: "absolute", top: 380, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Mots texte="Trouvez votre maison…" f={f} debut={n7 + 52} ecart={7} taille={86} largeur={1040} />
        <Mots texte="sans vous fatiguer !" f={f} debut={n7 + 84} ecart={6} taille={86} largeur={1040} accents={{ fatiguer: { fond: P.vert, couleur: P.blanc } }} />
      </div>
      <div style={{ position: "absolute", top: 660, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Pastille texte="Annonces vérifiées" f={f} debut={n7 + 12} icone={<BadgeCheck />} taille={46} />
        <Pastille texte="Contact direct" f={f} debut={n7 + 20} icone={<Phone />} taille={46} />
        <Pastille texte="Juste prix" f={f} debut={n7 + 28} icone={<Scale />} taille={46} />
      </div>
      <div style={{ position: "absolute", top: 1020, width: L, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "30px 56px", borderRadius: 999, background: P.vert, color: P.blanc,
          fontFamily: TITRE, fontWeight: 800, fontSize: 64, boxShadow: `0 18px 40px rgba(30,94,63,0.35)`,
          transform: `scale(${entree(f, n7 + 40, 11, 180) * presse})` }}>
          <MousePointerClick size={60} color={P.orClair} strokeWidth={2.4} /> www.360immo.ci
        </div>
      </div>
      <Personnage type={AWA} x={540} y={2130} taille={0.88} f={f} yeux="joie" sourire={1} saut={sautAwa} objetD={<Cles />}
        brasD={[150 + flotte(f, 0.4) * 10, -20]} brasG={[150 - flotte(f, 0.4) * 10, -20]} tete={flotte(f, 0.8) * 4} />
      <Doigt f={f} etapes={[{ a: clic - 22, x: 1010, y: 1500 }, { a: clic - 4, x: 780, y: 1110 }]} clics={[clic]} taille={140} />
    </AbsoluteFill>
  );
}

// ───────────────────────── Son : voix, musique (baissée pendant la parole), bruitages ─────────────────────────
function Son() {
  const musique = (i: number) => {
    const baisse = 0.42 - 0.27 * parole(i);
    const coupe = i >= T6 - 2 && i < T7 ? 0 : 1;
    const debut = interpolate(i, [0, 8], [0.4, 1], { extrapolateRight: "clamp" });
    const fin = interpolate(i, [DUREE - 20, DUREE - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return baisse * coupe * debut * fin;
  };
  return (
    <>
      <Audio src={staticFile("musique/pub-demarcheur.mp3")} volume={musique} />
      {(Object.keys(R) as Replique[]).map((id) => (
        <Sequence key={id} from={R[id].debut} durationInFrames={R[id].images + 4} layout="none">
          <Audio src={staticFile(`voix/pub-demarcheur/${id}.wav`)} volume={id.startsWith("D") ? 1 : 0.95} />
        </Sequence>
      ))}
      {/* 1 */}
      {[0, 1, 2, 3].map((i) => <Bruit key={i} nom="pop" a={R.N1.debut + 6 + i * 5} volume={0.22} />)}
      <Bruit nom="fouet" a={R.N2.debut - 4} volume={0.3} vitesse={1.3} />
      <Bruit nom="boing" a={R.N2.debut + 18} volume={0.25} />
      {/* 2 */}
      <Bruit nom="fouet" a={T1 - 2} volume={0.45} />
      <Bruit nom="boing" a={T1 + 6} volume={0.35} />
      <Bruit nom="pop" a={R.D1.debut} volume={0.3} />
      {[29, 52, 75].map((d) => <Bruit key={d} nom="pop" a={R.D1.debut + d} volume={0.3} />)}
      <Bruit nom="pop" a={R.D2.debut} volume={0.3} />
      <Bruit nom="tampon" a={R.D2.debut + 65} volume={0.55} />
      <Bruit nom="caisse" a={R.D2.debut + 62} volume={0.5} />
      {Array.from({ length: 12 }, (_, i) => <Bruit key={i} nom="tic" a={R.D3.debut + 8 + i * 4} volume={0.35} vitesse={1 + i * 0.04} />)}
      {/* 3 */}
      <Bruit nom="fouet" a={T2 - 3} volume={0.45} />
      <Bruit nom="pop" a={R.N3.debut + 2} volume={0.35} />
      <Bruit nom="tampon" a={R.N3.debut + 86} volume={0.35} vitesse={1.4} />
      <Bruit nom="boing" a={R.N3.debut + 92} volume={0.3} vitesse={1.2} />
      {/* 4–5 */}
      <Bruit nom="fouet" a={T3 - 3} volume={0.45} />
      <Bruit nom="tampon" a={R.N4.debut + 24} volume={0.55} />
      <Bruit nom="ding" a={R.N4.debut + 27} volume={0.35} />
      <Bruit nom="clic" a={R.N5.debut + 21} volume={0.6} />
      <Bruit nom="pop" a={R.N5.debut + 40} volume={0.25} />
      <Bruit nom="pop" a={R.N5.debut + 58} volume={0.25} />
      {/* 6 */}
      <Bruit nom="fouet" a={T5 - 3} volume={0.45} />
      <Bruit nom="ding" a={R.N6.debut + 36} volume={0.3} />
      {/* 7 */}
      <Bruit nom="trombone" a={R.D4.fin + 1} volume={0.42} vitesse={1.3} />
      {/* 8 */}
      <Bruit nom="fouet" a={T7 - 3} volume={0.45} />
      {[12, 20, 28].map((d) => <Bruit key={d} nom="pop" a={R.N7.debut + d} volume={0.25} />)}
      <Bruit nom="clic" a={R.N7.debut + 116} volume={0.6} />
      <Bruit nom="ding" a={R.N7.debut + 118} volume={0.4} />
    </>
  );
}

export function PubDemarcheur() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: P.creme, overflow: "hidden", width: L, height: H }}>
      <Plan f={f} de={0} a={T1} sortieFouet><Recherche f={f} /></Plan>
      <Plan f={f} de={T1} a={T2} entreeFouet sortieFouet><Demarcheur f={f} /></Plan>
      <Plan f={f} de={T2} a={T3}><Solution f={f} /></Plan>
      <Plan f={f} de={T3} a={T5} entreeFouet sortieFouet><Telephones f={f} /></Plan>
      <Plan f={f} de={T5} a={T6} entreeFouet><JustePrix f={f} /></Plan>
      <Plan f={f} de={T6} a={T7} sortieFouet><Triste f={f} /></Plan>
      <Plan f={f} de={T7} a={DUREE} entreeFouet><Fin f={f} /></Plan>
      <Son />
    </AbsoluteFill>
  );
}
