/*
 * Planches du storyboard de la publicité 16:9 « Sous tous les angles » (images de travail, une par scène) :
 *   npx remotion render src/index.ts planches sortie/planches --sequence --image-format=png
 * Les écrans viennent du vrai site (site/tests/captures-video.spec.ts → public/ecrans-pub) ; les photos des biens sont
 * des emplacements à remplir avec de vraies photos.
 */
import type { CSSProperties } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Icone } from "../composants/Icone";
import { C, POLICE_TEXTE, POLICE_TITRES } from "../theme";
import { Arc, disponible, Or, Photo, Studio, Titre } from "./commun";
import { Telephone3D } from "./Telephone3D";
import { Ville } from "./Ville";
import POSITIONS from "./positions.json";

const CARTES = POSITIONS.listeOrdinateur;

function Puce({ icone, texte, style }: { icone: string; texte: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", display: "flex", alignItems: "center", gap: 14, padding: "18px 30px", borderRadius: 999, background: "rgba(255,255,255,0.08)",
      border: `2px solid ${C.orClair}`, color: "#fff", fontSize: 34, fontWeight: 500, boxShadow: `0 0 40px ${C.or}33`, ...style }}>
      <span style={{ color: C.orClair, display: "flex" }}><Icone nom={icone} taille={34} /></span>{texte}
    </div>
  );
}

// ── Les 8 planches ──
const P1 = () => (
  <Studio lumiere="62% 45%">
    <Arc cx={1180} cy={560} r={430} debut={-150} fin={150} epaisseur={6} />
    <Telephone3D ecran="ecrans-pub/accueil-telephone.png" largeur={400} rotation="rotateY(-30deg) rotateX(10deg) rotateZ(-5deg)" style={{ left: 960, top: 150 }} />
    <Titre style={{ left: 140, top: 400, fontSize: 64 }}>Trouver. Publier.<br /><Or>Se rencontrer.</Or></Titre>
  </Studio>
);

const P2 = () => (
  <Studio>
    <Telephone3D ecran="ecrans-pub/accueil-ordinateur.png" paysage largeur={1700} rotation="rotateX(4deg) rotateY(-3deg)" reflet={false} style={{ left: 50, top: 50 }} />
  </Studio>
);

const P3 = () => (
  <Studio lumiere="30% 50%">
    <Telephone3D ecran="ecrans-pub/accueil-telephone.png" largeur={390} rotation="rotateY(22deg) rotateX(6deg)" style={{ left: 200, top: 150 }} />
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      {[260, 400, 540, 680].map((y, i) => <path key={i} d={`M 1000 ${y + 40} C 860 ${y + 40}, 820 ${520}, 700 ${560}`} stroke={C.orClair} strokeWidth={2.5} strokeDasharray="8 8" fill="none" opacity={0.7} />)}
    </svg>
    <Puce icone="maison" texte="Appartement" style={{ left: 1000, top: 255 }} />
    <Puce icone="terrain" texte="Cocody, Riviera 2" style={{ left: 1000, top: 395 }} />
    <Puce icone="immeuble" texte="3 pièces" style={{ left: 1000, top: 535 }} />
    <Puce icone="valide" texte="≤ 300 000 FCFA / mois" style={{ left: 1000, top: 675 }} />
    <Titre style={{ left: 1000, top: 110, fontSize: 56 }}>Cherchez <Or>simplement</Or></Titre>
  </Studio>
);

/** Une carte d'annonce du site (capture de la liste, ordinateur), photo remplacée par un emplacement */
function CarteSite({ n, style, libelle, photo }: { n: number; style: CSSProperties; libelle: string; photo?: string }) {
  const c = CARTES[n];
  return (
    <div style={{ position: "absolute", width: c.w, height: c.h, borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,0.55)", background: "#fff", ...style }}>
      <Img src={staticFile("ecrans-pub/liste-ordinateur.png")} style={{ position: "absolute", left: -c.x, top: -c.y, width: 1920, height: 1080, maxWidth: "none" }} />
      <Photo libelle={libelle} src={photo} style={{ left: 0, top: 0, width: c.w, height: c.h * 0.48, fontSize: 19 }} />
    </div>
  );
}
const P4 = () => (
  <Studio>
    <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "rotateY(-14deg) rotateX(6deg)" }}>
        <CarteSite n={0} photo="photos/photo-11.jpg" libelle="Photo réelle : studio" style={{ left: 200, top: 300, transform: "translateZ(-420px)", filter: "blur(2px) brightness(0.8)" }} />
        <CarteSite n={1} photo="photos/photo-16.jpg" libelle="Photo réelle : appartement" style={{ left: 1400, top: 260, transform: "translateZ(-300px)", filter: "blur(1.5px) brightness(0.85)" }} />
        <CarteSite n={2} photo="photos/photo-10.jpg" libelle="Photo réelle : appartement meublé" style={{ left: 800, top: 300, transform: "translateZ(120px) scale(1.15)" }} />
      </div>
    </div>
    <Titre style={{ left: 140, top: 90, fontSize: 52 }}>Des annonces <Or>vérifiées</Or></Titre>
  </Studio>
);

const P5 = () => (
  <AbsoluteFill style={{ fontFamily: POLICE_TEXTE }}>
    <Photo libelle="Photo réelle du bien, plein écran : salon lumineux (puis cuisine, chambre, façade)" src="photos/photo-10.jpg" style={{ inset: 0, fontSize: 34 }} />
    {!disponible("photos/photo-10.jpg") && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 120 + i * 60, top: 90 + i * 40, right: 120 + i * 60, bottom: 220 - i * 40,
      border: "2px dashed rgba(255,255,255,0.35)", borderRadius: 12 }} />)}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, rgba(5,14,10,0.55) 100%)" }} />
    <div style={{ position: "absolute", left: 120, bottom: 70, display: "flex", gap: 18, alignItems: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "18px 28px" }}>
        <div style={{ fontFamily: POLICE_TITRES, fontWeight: 700, fontSize: 40, color: C.vert }}>350 000 FCFA <span style={{ fontSize: 24, fontFamily: POLICE_TEXTE, color: "#555" }}>/ mois</span></div>
        <div style={{ fontSize: 22, color: "#555" }}>Appartement 3 pièces meublé · Riviera 2, Cocody</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.vert, color: "#fff", borderRadius: 14, padding: "22px 30px", fontSize: 26, fontWeight: 600 }}>
        <Icone nom="maison" taille={26} /> Planifier une visite
      </div>
    </div>
    <div style={{ position: "absolute", right: 28, bottom: 20, color: "rgba(255,255,255,0.6)", fontSize: 20 }}>Image de travail · storyboard</div>
  </AbsoluteFill>
);

/** Scène 4, suite : l'arc doré s'ouvre sur la pièce vide de l'annonce et fait apparaître une pièce meublée (ambiance) */
const P5b = () => {
  const cx = 1380, cy = 560, r = 720;
  const etiquette = (texte: string, style: CSSProperties) => (
    <div style={{ position: "absolute", padding: "10px 20px", borderRadius: 999, background: "rgba(5,14,10,0.6)", color: "#fff", fontSize: 22, ...style }}>{texte}</div>
  );
  return (
    <AbsoluteFill style={{ fontFamily: POLICE_TEXTE, background: "#000" }}>
      <Photo libelle="Pièce vide de l'annonce (photo réelle)" src="photos/photo-39.jpg" style={{ inset: 0 }} />
      <div style={{ position: "absolute", inset: 0, clipPath: `circle(${r}px at ${cx}px ${cy}px)` }}>
        <Photo libelle="Pièce meublée (photo d'ambiance)" src="photos/ambiance-4.jpg" style={{ inset: 0 }} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs><filter id="lueur5"><feGaussianBlur stdDeviation="12" /></filter></defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.orClair} strokeWidth={26} opacity={0.45} filter="url(#lueur5)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FFE9A8" strokeWidth={4} />
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(5,14,10,0.55) 0%, transparent 40%)" }} />
      <Titre style={{ left: 110, top: 120, fontSize: 64 }}>Imaginez-vous<br />déjà <Or>chez vous.</Or></Titre>
      {etiquette("Photo de l'annonce", { left: 110, bottom: 70 })}
      {etiquette("Photo d'ambiance", { right: 110, bottom: 70 })}
      <div style={{ position: "absolute", right: 28, bottom: 20, color: "rgba(255,255,255,0.6)", fontSize: 20 }}>Image de travail · storyboard</div>
    </AbsoluteFill>
  );
};

const P6 = () => (
  <Studio lumiere="35% 50%">
    <Telephone3D ecran="ecrans/publier.png" largeur={390} rotation="rotateY(20deg) rotateX(6deg)" style={{ left: 260, top: 150 }} />
    {["photos/photo-14.jpg", "photos/photo-21.jpg", "photos/photo-30.jpg", "photos/photo-39.jpg"].map((src, i) => <Photo key={i} libelle="" src={src} style={{ left: 760 + i * 70, top: 300 - i * 40, width: 150, height: 112, borderRadius: 12,
      transform: `rotate(${-10 + i * 6}deg)`, boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "4px solid #fff" }} />)}
    <Titre style={{ left: 1080, top: 380, fontSize: 64 }}>Votre bien<br />mérite d&apos;être <Or>vu.</Or></Titre>
    <div style={{ position: "absolute", left: 1080, top: 560, color: "rgba(250,250,248,0.85)", fontSize: 32 }}>Publication gratuite · vérifiée par notre équipe</div>
  </Studio>
);

const P7 = () => (
  <Studio lumiere="50% 40%">
    <Ville />
    <Titre style={{ left: 120, top: 90, fontSize: 52 }}>Là où l&apos;offre <Or>rencontre</Or> la demande</Titre>
  </Studio>
);

const P8 = () => (
  <Studio>
    <Arc cx={662} cy={366} r={104} debut={-75} fin={235} epaisseur={4} />
    <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <Img src={staticFile("logo/360-immo-logo-fond-sombre.svg")} style={{ width: 760 }} />
    </div>
    <div style={{ position: "absolute", top: 520, left: 0, right: 0, textAlign: "center", fontFamily: POLICE_TITRES, fontSize: 64, color: "#fff", fontWeight: 700 }}>
      L&apos;immobilier, <Or>sous tous les angles.</Or>
    </div>
    <div style={{ position: "absolute", top: 670, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30 }}>
      <div style={{ padding: "26px 52px", borderRadius: 999, background: `linear-gradient(180deg, ${C.orClair}, ${C.or})`, color: C.vertNuit, fontSize: 38, fontWeight: 600 }}>Rechercher un bien</div>
      <div style={{ padding: "26px 52px", borderRadius: 999, border: `3px solid ${C.orClair}`, color: "#fff", fontSize: 38, fontWeight: 600 }}>Publier une annonce</div>
    </div>
    <div style={{ position: "absolute", top: 820, left: 0, right: 0, textAlign: "center", color: "rgba(250,250,248,0.75)", fontSize: 34, letterSpacing: 2 }}>360-immo.ci</div>
  </Studio>
);

const PLANCHES = [P1, P2, P3, P4, P5, P5b, P6, P7, P8];

export function Planches() {
  const P = PLANCHES[Math.min(useCurrentFrame(), PLANCHES.length - 1)];
  return <P />;
}
export const NOMBRE_PLANCHES = PLANCHES.length;
