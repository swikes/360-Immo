/*
 * Publicité 16:9 « Sous tous les angles » (60 s) — version de travail : les 7 scènes du storyboard, animées à partir
 * des vrais écrans du site (public/ecrans-pub, positions dans positions.json), des photos de la machine de travail
 * (public/photos, hors dépôt), de la voix off (public/voix/publicite-*.wav, src/pub/voix.json) et d'une musique
 * (public/musique/provisoire.wav). npx remotion render src/index.ts publicite sortie/publicite.mp4
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Icone } from "../composants/Icone";
import durees from "../durees.json";
import { C, POLICE_TEXTE, POLICE_TITRES } from "../theme";
import { Arc, disponible, Or, Studio, Titre } from "./commun";
import POSITIONS from "./positions.json";
import { mesures, pointEcran, Telephone3D } from "./Telephone3D";
import { Ville } from "./Ville";
import VOIX from "./voix.json";

export const IMAGES_PUB = 1800;
const IPS = 30;
/** Début et durée de chaque scène, en images */
const SCENES = {
  accroche: [0, 150], entree: [150, 180], recherche: [330, 300], immersion: [630, 300], annonceurs: [930, 300], ville: [1230, 270], fin: [1500, 300],
} as const;
const FONDU = 12;

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sortie = Easing.out(Easing.cubic);
const douce = Easing.inOut(Easing.cubic);
/** Progression de 0 à 1 entre deux images */
const lin = (f: number, a: number, b: number, easing = douce) => interpolate(f, [a, b], [0, 1], { ...borne, easing });
/** Monte puis redescend (apparition brève) */
const bosse = (f: number, debut: number, duree: number) => Math.min(lin(f, debut, debut + 6), 1 - lin(f, debut + duree - 6, debut + duree));

const PHOTO = (n: string) => `photos/annonces/${n}.jpg`;
const ECRAN = (nom: string) => `ecrans-pub/${nom}.png`;

/** Un toucher du doigt : point blanc et onde dorée */
function Toucher({ x, y, f, debut, echelle = 1 }: { x: number; y: number; f: number; debut: number; echelle?: number }) {
  const t = f - debut;
  if (t < 0 || t > 26) return null;
  const onde = t / 26;
  const r = (14 + 46 * onde) * echelle;
  return (
    <>
      <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%",
        border: `${3 * echelle}px solid ${C.orClair}`, opacity: 1 - onde }} />
      <div style={{ position: "absolute", left: x - 13 * echelle, top: y - 13 * echelle, width: 26 * echelle, height: 26 * echelle, borderRadius: "50%",
        background: "rgba(255,255,255,0.9)", boxShadow: "0 4px 14px rgba(0,0,0,0.35)", opacity: t < 10 ? 1 : 1 - (t - 10) / 16 }} />
    </>
  );
}

function Puce({ icone, texte, style }: { icone: string; texte: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", borderRadius: 999, whiteSpace: "nowrap",
      background: "rgba(10,30,20,0.75)", border: `2px solid ${C.orClair}`, color: "#fff", fontSize: 32, fontWeight: 500, fontFamily: POLICE_TEXTE,
      boxShadow: `0 0 40px ${C.or}33`, ...style }}>
      <span style={{ color: C.orClair, display: "flex" }}><Icone nom={icone} taille={32} /></span>{texte}
    </div>
  );
}

/** Mots d'un titre qui montent l'un après l'autre */
function Mots({ f, debut, mots, style }: { f: number; debut: number; mots: ReactNode[]; style?: CSSProperties }) {
  return (
    <Titre style={style}>
      {mots.map((m, i) => {
        const p = lin(f, debut + i * 7, debut + i * 7 + 16, sortie);
        return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 36}px)`, marginRight: "0.25em" }}>{m}</span>;
      })}
    </Titre>
  );
}

const Etiquette = ({ texte, style }: { texte: string; style?: CSSProperties }) => (
  <div style={{ position: "absolute", padding: "9px 18px", borderRadius: 999, background: "rgba(5,14,10,0.62)", color: "#fff", fontSize: 21,
    fontFamily: POLICE_TEXTE, ...style }}>{texte}</div>
);

// ── Scène 1 : l'accroche ──
function Accroche() {
  const f = useCurrentFrame();
  const tour = lin(f, 0, 110, sortie);
  const pousse = lin(f, 106, 150, Easing.in(Easing.cubic));
  const L = 400, { hauteur } = mesures(L), bord = L * 0.035, W = L + 2 * bord, H = hauteur + 2 * bord;
  const X0 = 1010, Y0 = 130, cx = X0 + W / 2, cy = Y0 + H / 2;
  const reste = 1 - pousse;
  const rotation = `rotateY(${(-58 + 36 * tour) * reste}deg) rotateX(${(12 - 6 * tour) * reste}deg) rotateZ(${(-6 + 3 * tour) * reste}deg)`;
  const mots = ["Trouver.", "Publier.", <Or key="o">Se rencontrer.</Or>];
  return (
    <Studio lumiere="62% 45%" mention="">
      <Arc cx={1180} cy={560} r={430} debut={-150} fin={150} epaisseur={6} progres={lin(f, 0, 45, sortie)} opacite={reste} />
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cx}px ${cy}px`,
        transform: `translate(${(960 - cx) * pousse}px, ${(540 - cy) * pousse}px) scale(${1 + 5.4 * pousse})`, opacity: lin(f, 4, 24) }}>
        <Telephone3D ecran={ECRAN("accueil-telephone")} largeur={L} rotation={rotation} style={{ left: X0, top: Y0 }} reflet={pousse < 0.3} />
      </div>
      <div style={{ opacity: 1 - lin(f, 92, 108) }}>
        <Mots f={f} debut={24} mots={mots} style={{ left: 140, top: 430, fontSize: 70, width: 760 }} />
      </div>
      <AbsoluteFill style={{ background: "#F7F6F2", opacity: lin(f, 136, 150) }} />
    </Studio>
  );
}

// ── Scène 2 : entrer dans le site ──
function Entree() {
  const f = useCurrentFrame();
  const L = 1700, { k, hauteur } = mesures(L, true), bord = L * 0.035, W = L + 2 * bord, H = hauteur + 2 * bord;
  const X0 = (1920 - W) / 2, Y0 = (1080 - H) / 2;
  const recul = lin(f, 0, 50, sortie);
  const pousse = lin(f, 120, 180, Easing.in(Easing.cubic));
  const r = POSITIONS.accueilOrdinateur.recherche;
  const fx = X0 + bord + (r.x + r.w / 2) * k, fy = Y0 + bord + (r.y + r.h / 2) * k;
  return (
    <Studio mention="">
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${fx}px ${fy}px`, transform: `scale(${1 + 1.7 * pousse})` }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 540px", transform: `scale(${1.32 - 0.32 * recul})` }}>
          <Telephone3D ecran={ECRAN("accueil-ordinateur")} paysage largeur={L} reflet={false} style={{ left: X0, top: Y0 }}
            rotation={`rotateX(${4 * recul * (1 - pousse)}deg) rotateY(${-3 * recul * (1 - pousse)}deg)`}>
            {POSITIONS.accueilOrdinateur.onglets.map((o, i) => (
              <div key={i} style={{ position: "absolute", left: o.x * k - 6, top: o.y * k - 6, width: o.w * k + 12, height: o.h * k + 12, borderRadius: 12,
                border: `3px solid ${C.orClair}`, boxShadow: `0 0 18px ${C.or}88`, opacity: bosse(f, 52 + i * 16, 22) }} />
            ))}
          </Telephone3D>
        </div>
      </div>
      <AbsoluteFill style={{ background: "#F7F6F2", opacity: 1 - lin(f, 0, 14) }} />
    </Studio>
  );
}

// ── Scène 3 : rechercher ──
const CARTES = POSITIONS.listeOrdinateur;
const carte = (reference: string) => CARTES.find((c) => c.reference === reference) ?? CARTES[0];

/** Une carte d'annonce du site (découpée dans la capture de la liste, sur ordinateur) */
function Carte({ reference, style }: { reference: string; style?: CSSProperties }) {
  const c = carte(reference);
  return (
    <div style={{ position: "absolute", width: c.w, height: c.h, borderRadius: 16, overflow: "hidden", background: "#fff", boxShadow: "0 40px 90px rgba(0,0,0,0.55)", ...style }}>
      <Img src={staticFile(ECRAN("liste-ordinateur"))} style={{ position: "absolute", left: -c.x, top: -c.y, width: 1920, height: 1080, maxWidth: "none" }} />
    </div>
  );
}

function Recherche() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = 390, bord = L * 0.035, { hauteur } = mesures(L), W = L + 2 * bord, H = hauteur + 2 * bord;
  const X0 = 210, Y0 = 135;
  const entree = lin(f, 0, 22, sortie);
  const depart = lin(f, 138, 168);
  const a = POSITIONS.accueilTelephone;
  const centre = (b: { x: number; y: number; w: number; h: number }) => pointEcran(b.x + b.w / 2, b.y + b.h / 2, L);
  const gestes = [
    { t: 26, b: a.onglets[0], icone: "maison", texte: "Louer" },
    { t: 52, b: a.lieu, icone: "terrain", texte: "Cocody, Riviera 2" },
    { t: 78, b: a.type, icone: "immeuble", texte: "Appartement" },
    { t: 104, b: a.budget, icone: "valide", texte: "≤ 400 000 FCFA / mois" },
  ];
  const vers = (p: { x: number; y: number }) => ({ x: X0 + bord + p.x, y: Y0 + bord + p.y });
  // les cartes : la centrale est l'annonce qu'on ouvrira ensuite (IMM-2026-01001)
  const disposition = [
    { reference: "IMM-2026-01003", x: 190, y: 300, z: -420, flou: 2 },
    { reference: "IMM-2026-01016", x: 1430, y: 270, z: -300, flou: 1.5 },
    { reference: "IMM-2026-01001", x: 808, y: 290, z: 120, flou: 0 },
  ];
  const glisse = lin(f, 190, 245);
  const focus = lin(f, 238, 262);
  const grand = lin(f, 262, 300, Easing.inOut(Easing.quad));
  const centrale = carte("IMM-2026-01001");
  const echelleFocus = 1.6;
  const cw = centrale.w * echelleFocus, chh = centrale.h * echelleFocus;
  const cartePlate = { left: 960 - cw / 2, top: 540 - chh / 2 };
  const photo0 = { x: cartePlate.left, y: cartePlate.top, w: cw, h: (centrale.photo?.h ?? 245) * echelleFocus };
  const photoRect = {
    x: interpolate(grand, [0, 1], [photo0.x, 0]), y: interpolate(grand, [0, 1], [photo0.y, 0]),
    w: interpolate(grand, [0, 1], [photo0.w, 1920]), h: interpolate(grand, [0, 1], [photo0.h, 1080]),
  };
  return (
    <Studio lumiere="35% 50%" mention="">
      {/* téléphone, gestes et choix */}
      <div style={{ position: "absolute", inset: 0, opacity: entree * (1 - depart), transform: `translateX(${-260 * depart}px)` }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${X0 + W / 2}px ${Y0 + H / 2}px`, transform: `scale(${1.25 - 0.25 * entree})` }}>
          <Telephone3D ecran={ECRAN("accueil-telephone")} largeur={L} rotation="rotateY(20deg) rotateX(5deg)" style={{ left: X0, top: Y0 }}>
            {gestes.map((g, i) => { const p = centre(g.b); return <Toucher key={i} x={p.x} y={p.y} f={f} debut={g.t} />; })}
            {(() => { const p = centre(a.rechercher); return <Toucher x={p.x} y={p.y} f={f} debut={130} />; })()}
          </Telephone3D>
        </div>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {gestes.map((g, i) => {
            const q = spring({ frame: f - g.t - 3, fps, config: { damping: 18 } });
            const d = `M ${X0 + W - 20} ${Y0 + H * 0.42} C ${X0 + W + 120} ${Y0 + H * 0.42}, 900 ${300 + i * 125}, 1000 ${300 + i * 125}`;
            return <path key={i} d={d} stroke={C.orClair} strokeWidth={2.5} strokeDasharray="8 8" fill="none" opacity={0.75 * Math.min(1, q)} />;
          })}
        </svg>
        {gestes.map((g, i) => {
          const q = spring({ frame: f - g.t - 3, fps, config: { damping: 15 } });
          const depuis = vers(centre(g.b));
          const x = interpolate(q, [0, 1], [depuis.x - 60, 1000]), y = interpolate(q, [0, 1], [depuis.y - 30, 270 + i * 125]);
          return <Puce key={i} icone={g.icone} texte={g.texte} style={{ left: x, top: y, opacity: Math.min(1, q * 1.5), transform: `scale(${0.5 + 0.5 * Math.min(1, q)})`, transformOrigin: "left center" }} />;
        })}
        <div style={{ opacity: lin(f, 8, 26) }}><Mots f={f} debut={8} mots={["Cherchez", <Or key="o">simplement</Or>]} style={{ left: 1000, top: 140, fontSize: 58 }} /></div>
      </div>

      {/* les annonces jaillissent et se disposent en profondeur */}
      {f >= 150 && (
        <div style={{ position: "absolute", inset: 0, perspective: 1800, opacity: 1 - lin(f, 241, 250) }}>
          <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d",
            transform: `translateX(${-90 * glisse}px) rotateY(${-14 + 6 * glisse}deg) rotateX(6deg)` }}>
            {disposition.map((d, i) => {
              const q = spring({ frame: f - 150 - i * 6, fps, config: { damping: 17, mass: 0.9 } });
              const ox = interpolate(q, [0, 1], [X0 + 120, d.x]), oy = interpolate(q, [0, 1], [Y0 + 300, d.y]);
              const echelle = (0.3 + 0.7 * Math.min(1, q)) * (d.z > 0 ? 1.15 : 1);
              // la carte centrale s'efface d'un coup quand sa copie à plat la recouvre (pas de texte en double)
              const relaie = d.z > 0 ? 1 - lin(f, 240, 242) : 1;
              return <Carte key={d.reference} reference={d.reference} style={{ left: ox, top: oy, opacity: Math.min(1, q * 2) * relaie,
                transform: `translateZ(${d.z * Math.min(1, q)}px) scale(${echelle})`, filter: d.flou ? `blur(${d.flou}px) brightness(0.82)` : undefined }} />;
            })}
          </div>
        </div>
      )}
      {/* la carte centrale vient au premier plan : elle part de là où on la voit en relief, pour ne pas laisser de « fantôme » */}
      {f >= 230 && (() => {
        const k = lin(f, 238, 262, Easing.inOut(Easing.cubic));
        const echelle = interpolate(k, [0, 1], [1.25, echelleFocus]);
        const cx = interpolate(k, [0, 1], [852, 960]), cy = interpolate(k, [0, 1], [515, 540]);
        return <Carte reference="IMM-2026-01001" style={{ left: cx - (centrale.w * echelle) / 2, top: cy - (centrale.h * echelle) / 2, transformOrigin: "top left",
          transform: `scale(${echelle})`, width: centrale.w, height: centrale.h, opacity: lin(f, 238, 241) * (1 - lin(f, 296, 300)) }} />;
      })()}
      <div style={{ opacity: lin(f, 172, 190) * (1 - focus) }}><Mots f={f} debut={172} mots={["Des annonces", <Or key="o">vérifiées</Or>]} style={{ left: 140, top: 90, fontSize: 54 }} /></div>
      {/* la photo de la carte centrale s'agrandit jusqu'au plein écran */}
      {f >= 262 && (
        <div style={{ position: "absolute", left: photoRect.x, top: photoRect.y, width: photoRect.w, height: photoRect.h, overflow: "hidden",
          borderRadius: 16 * (1 - grand) }}>
          <Img src={staticFile(PHOTO("10"))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </Studio>
  );
}

// ── Scène 4 : découvrir le bien en immersion ──
function PleinEcran({ src, f, debut, fin, zoom = [1, 1.1], decalage = [0, -30] }: { src: string; f: number; debut: number; fin: number; zoom?: [number, number]; decalage?: [number, number] }) {
  const p = lin(f, debut, fin, Easing.linear);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${interpolate(p, [0, 1], zoom)}) translateX(${interpolate(p, [0, 1], decalage)}px)` }} />
    </AbsoluteFill>
  );
}

function Immersion() {
  const f = useCurrentFrame();
  const ambiance = "photos/ambiance-6.jpg";
  const cx = 1320, cy = 560;
  const rayon = interpolate(lin(f, 150, 205), [0, 1], [0, 1500]);
  // retour à la fiche : la photo plein écran redevient la grande photo de la fiche (ordinateur)
  const fiche = POSITIONS.ficheOrdinateur;
  const s0 = 1920 / fiche.photo.w;
  const z = lin(f, 222, 256);
  const echelle = s0 + (1 - s0) * z;
  const tx = (960 - s0 * (fiche.photo.x + fiche.photo.w / 2)) * (1 - z), ty = (540 - s0 * (fiche.photo.y + fiche.photo.h / 2)) * (1 - z);
  const v = fiche.visite;
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: POLICE_TEXTE }}>
      <PleinEcran src={PHOTO("10")} f={f} debut={0} fin={100} />
      <AbsoluteFill style={{ opacity: lin(f, 84, 100) }}><PleinEcran src={PHOTO("14")} f={f} debut={84} fin={215} zoom={[1.04, 1.16]} decalage={[20, -20]} /></AbsoluteFill>
      {/* le cercle doré s'ouvre sur une pièce meublée (photo d'ambiance) */}
      {f >= 150 && (
        <>
          <AbsoluteFill style={{ clipPath: `circle(${rayon}px at ${cx}px ${cy}px)` }}>
            <PleinEcran src={ambiance} f={f} debut={150} fin={225} zoom={[1.08, 1.0]} decalage={[0, 0]} />
          </AbsoluteFill>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - lin(f, 196, 210) }}>
            <defs><filter id="lueur-cercle"><feGaussianBlur stdDeviation="12" /></filter></defs>
            <circle cx={cx} cy={cy} r={rayon} fill="none" stroke={C.orClair} strokeWidth={26} opacity={0.45} filter="url(#lueur-cercle)" />
            <circle cx={cx} cy={cy} r={rayon} fill="none" stroke="#FFE9A8" strokeWidth={4} />
          </svg>
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,14,10,0.6) 0%, transparent 45%)", opacity: bosse(f, 158, 62) }} />
          <div style={{ opacity: bosse(f, 160, 58) }}><Mots f={f} debut={162} mots={["Imaginez-vous", "déjà", <Or key="o">chez vous.</Or>]} style={{ left: 110, top: 130, fontSize: 64, width: 640 }} /></div>
        </>
      )}
      <Etiquette texte="Photo de l'annonce" style={{ left: 60, bottom: 50, opacity: 1 - lin(f, 165, 185) }} />
      <Etiquette texte="Photo d'ambiance" style={{ right: 60, bottom: 50, opacity: bosse(f, 170, 50) }} />
      {/* la fiche du bien, puis « Planifier une visite » */}
      {f >= 212 && (
        <AbsoluteFill style={{ opacity: lin(f, 212, 224), background: "#fff" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${echelle})` }}>
            <Img src={staticFile(ECRAN("fiche-ordinateur"))} style={{ position: "absolute", inset: 0, width: 1920, height: 1080 }} />
            <Img src={staticFile(ECRAN("fiche-visite-ordinateur"))} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, opacity: lin(f, 272, 284) }} />
            <Toucher x={v.x + v.w / 2} y={v.y + v.h / 2} f={f} debut={262} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ── Scène 5 : une opportunité pour les annonceurs ──
function Annonceurs() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = 390, bord = L * 0.035;
  const X0 = 250, Y0 = 135;
  const tour = lin(f, 0, 42, sortie);
  const grille = POSITIONS.publierPhotos.grille;
  const ecart = 10, cw = (grille.w - ecart) / 2, chh = (grille.h - ecart) / 2;
  const cellules = [0, 1, 2, 3].map((i) => ({ x: grille.x + (i % 2) * (cw + ecart), y: grille.y + Math.floor(i / 2) * (chh + ecart) }));
  const arrivees = [62, 78, 94, 110];
  const phaseB = f >= 176;
  const envoyer = POSITIONS.publierEnvoi.envoyer;
  const en = pointEcran(envoyer.x + envoyer.w / 2, envoyer.y + envoyer.h / 2, L);
  const enLigne = lin(f, 238, 248);
  const fin = lin(f, 268, 292);
  return (
    <Studio lumiere="35% 50%" mention="">
      <div style={{ position: "absolute", inset: 0, opacity: lin(f, 0, 14) * (1 - fin) }}>
        <Telephone3D largeur={L} style={{ left: X0, top: Y0 }} rotation={`rotateY(${-60 + 78 * tour}deg) rotateX(5deg)`}
          ecran={phaseB ? ECRAN("publier-apercu-telephone") : ECRAN("publier-photos-telephone")}
          ecran2={phaseB ? ECRAN("publier-envoi-telephone") : ECRAN("publier-apercu-telephone")}
          melange={phaseB ? lin(f, 176, 190) : lin(f, 150, 166)}>
          {!phaseB && cellules.map((c, i) => {
            const p = pointEcran(c.x, c.y, L);
            const { k } = mesures(L);
            return <div key={i} style={{ position: "absolute", left: p.x - 1, top: p.y - 1, width: cw * k + 2, height: chh * k + 2, background: "#F3F1EA",
              borderRadius: 8, opacity: (1 - lin(f, arrivees[i], arrivees[i] + 8)) * (1 - lin(f, 150, 166)) }} />;
          })}
          {phaseB && <Toucher x={en.x} y={en.y} f={f} debut={206} />}
        </Telephone3D>
        {/* les photos s'envolent d'une pile et se rangent dans l'annonce */}
        {["14", "21", "30", "39"].map((n, i) => {
          const q = spring({ frame: f - arrivees[i] + 20, fps, config: { damping: 18, mass: 0.8 } });
          const cible = pointEcran(cellules[i].x + cw / 2, cellules[i].y + chh / 2, L);
          const tx = X0 + bord + cible.x, ty = Y0 + bord + cible.y;
          const depart = { x: 980 + i * 60, y: 250 - i * 34 };
          const x = interpolate(q, [0, 1], [depart.x, tx]), y = interpolate(q, [0, 1], [depart.y, ty]);
          const largeur = interpolate(q, [0, 1], [190, cw]);
          const visible = f >= arrivees[i] - 36 && f < arrivees[i] + 6;
          return visible && (
            <div key={n} style={{ position: "absolute", left: x - largeur / 2, top: y - largeur * 0.38, width: largeur, height: largeur * 0.76, borderRadius: 10,
              overflow: "hidden", border: "4px solid #fff", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", transform: `rotate(${(1 - q) * (-12 + i * 7)}deg)`,
              opacity: lin(f, arrivees[i] - 36, arrivees[i] - 28) * (1 - lin(f, arrivees[i], arrivees[i] + 6)) }}>
              <Img src={staticFile(PHOTO(n))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
        <Mots f={f} debut={54} mots={["Votre bien", "mérite", "d'être", <Or key="o">vu.</Or>]} style={{ left: 1060, top: 360, fontSize: 66, width: 720 }} />
        <div style={{ position: "absolute", left: 1060, top: 560, color: "rgba(250,250,248,0.88)", fontSize: 32, fontFamily: POLICE_TEXTE, opacity: lin(f, 92, 108) }}>
          Publication gratuite · vérifiée par notre équipe
        </div>
        {/* statut de l'annonce : en vérification, puis en ligne */}
        {f >= 214 && (
          <div style={{ position: "absolute", left: 1060, top: 660, display: "flex", alignItems: "center", gap: 12, padding: "14px 26px", borderRadius: 999,
            fontFamily: POLICE_TEXTE, fontSize: 30, fontWeight: 600, opacity: lin(f, 214, 222),
            background: enLigne > 0.5 ? C.vertMoyen : "#F5E7C4", color: enLigne > 0.5 ? "#fff" : "#8A6516",
            transform: `scale(${1 + 0.12 * Math.sin(Math.PI * enLigne)})`, transformOrigin: "left center" }}>
            <Icone nom={enLigne > 0.5 ? "valide" : "bouclier"} taille={30} />
            {enLigne > 0.5 ? "En ligne" : "En vérification par l'équipe"}
          </div>
        )}
      </div>
    </Studio>
  );
}

// ── Scène 6 : connecter l'offre et la demande ──
function Quartiers() {
  const f = useCurrentFrame();
  const converge = lin(f, 228, 270);
  return (
    <Studio lumiere="50% 40%" mention="">
      <div style={{ position: "absolute", inset: 0, transformOrigin: "1000px 600px",
        transform: `scale(${0.94 + 0.1 * lin(f, 0, 270, Easing.linear)}) translateY(${-20 * lin(f, 0, 270, Easing.linear)}px)`, opacity: 1 - converge }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <ellipse cx={1000} cy={600} rx={860} ry={340} fill="none" stroke={C.orClair} strokeWidth={3} strokeDasharray="1400 900"
            strokeDashoffset={-f * 9} opacity={0.45 * lin(f, 10, 40)} />
        </svg>
        <Ville f={f} />
      </div>
      <div style={{ opacity: lin(f, 120, 140) * (1 - converge) }}>
        <Mots f={f} debut={120} mots={["Là où l'offre", <Or key="o">rencontre</Or>, "la demande"]} style={{ left: 120, top: 90, fontSize: 54 }} />
      </div>
      {/* les lignes dorées convergent vers le centre et se referment en arc */}
      {f >= 228 && <Arc cx={960} cy={540} r={interpolate(converge, [0, 1], [700, 120])} debut={-90} fin={250} epaisseur={4} progres={1} opacite={converge} />}
    </Studio>
  );
}

// ── Scène 7 : révélation finale et appel à l'action ──
function Fin() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 14, fps, config: { damping: 14 } });
  const boutons = [0, 1].map((i) => spring({ frame: f - 86 - i * 8, fps, config: { damping: 13 } }));
  const bat = f > 160 ? 1 + 0.025 * Math.sin((f - 160) / 6) : 1;
  return (
    <Studio mention="">
      <Arc cx={662} cy={366} r={104} debut={-75} fin={235} epaisseur={4} progres={lin(f, 0, 40, sortie)} />
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: Math.min(1, logo), transform: `scale(${0.85 + 0.15 * logo})` }}>
        <Img src={staticFile("logo/360-immo-logo-fond-sombre.svg")} style={{ width: 760 }} />
      </div>
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Mots f={f} debut={48} mots={["L'immobilier,", <Or key="a">sous</Or>, <Or key="b">tous</Or>, <Or key="c">les</Or>, <Or key="d">angles.</Or>]} style={{ position: "relative", fontSize: 64 }} />
      </div>
      <div style={{ position: "absolute", top: 670, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30, fontFamily: POLICE_TEXTE }}>
        <div style={{ padding: "26px 52px", borderRadius: 999, background: `linear-gradient(180deg, ${C.orClair}, ${C.or})`, color: C.vertNuit, fontSize: 38, fontWeight: 600,
          opacity: Math.min(1, boutons[0]), transform: `scale(${(0.7 + 0.3 * Math.min(1, boutons[0])) * bat})` }}>Rechercher un bien</div>
        <div style={{ padding: "26px 52px", borderRadius: 999, border: `3px solid ${C.orClair}`, color: "#fff", fontSize: 38, fontWeight: 600,
          opacity: Math.min(1, boutons[1]), transform: `scale(${0.7 + 0.3 * Math.min(1, boutons[1])})` }}>Publier une annonce</div>
      </div>
      <div style={{ position: "absolute", top: 820, left: 0, right: 0, textAlign: "center", color: "rgba(250,250,248,0.85)", fontSize: 40, letterSpacing: 2,
        fontFamily: POLICE_TEXTE, opacity: lin(f, 118, 136) }}>360-immo.ci</div>
    </Studio>
  );
}

// ── La publicité : scènes, mentions, voix et musique ──
type Replique = { id: string; debut: number; texte: string };
const REPLIQUES = VOIX.publicite.scenes as Replique[];
const DUREES_VOIX = (durees as Record<string, Record<string, number>>).publicite ?? {};

export function Publicite() {
  const f = useCurrentFrame();
  // la musique s'efface sous la voix, en douceur (un tiers de seconde), puis revient
  const sousLaVoix = (image: number) => Math.max(0, ...REPLIQUES.map((r) => {
    const debut = r.debut * IPS, fin = (r.debut + (DUREES_VOIX[r.id] ?? 4)) * IPS;
    return Math.min(lin(image, debut - 10, debut - 1, Easing.linear), 1 - lin(image, fin + 2, fin + 12, Easing.linear));
  }));
  const morceau = (nom: keyof typeof SCENES, contenu: ReactNode, avant = 0, apres = 0) => {
    const [debut, duree] = SCENES[nom];
    return <Sequence key={nom} from={debut - avant} durationInFrames={duree + avant + apres}>{contenu}</Sequence>;
  };
  return (
    <AbsoluteFill style={{ background: "#050E0A", fontFamily: POLICE_TEXTE }}>
      {morceau("accroche", <Accroche />, 0, FONDU)}
      {morceau("entree", <Entree />)}
      {morceau("recherche", <Recherche />)}
      {morceau("immersion", <Immersion />)}
      {morceau("annonceurs", <Annonceurs />)}
      {morceau("ville", <AbsoluteFill style={{ opacity: lin(f, 1230, 1244) }}><Quartiers /></AbsoluteFill>)}
      {morceau("fin", <Fin />)}
      {/* mentions */}
      <div style={{ position: "absolute", right: 26, top: 20, padding: "6px 14px", borderRadius: 8, background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)",
        fontSize: 18, fontWeight: 600, letterSpacing: 1 }}>VERSION DE TRAVAIL — NE PAS DIFFUSER</div>
      {f >= 330 && f < 1230 && (
        <div style={{ position: "absolute", left: 26, bottom: 18, color: "rgba(255,255,255,0.75)", fontSize: 18, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
          Annonces et photos de démonstration
        </div>
      )}
      {/* voix off et musique */}
      {REPLIQUES.filter((r) => disponible(`voix/publicite-${r.id}.wav`)).map((r) => (
        <Sequence key={r.id} from={Math.round(r.debut * IPS)} layout="none">
          <Html5Audio src={staticFile(`voix/publicite-${r.id}.wav`)} />
        </Sequence>
      ))}
      {disponible("musique/provisoire.wav") && (
        <Html5Audio src={staticFile("musique/provisoire.wav")} volume={(image) => 0.6 - 0.28 * sousLaVoix(image)} />
      )}
    </AbsoluteFill>
  );
}
