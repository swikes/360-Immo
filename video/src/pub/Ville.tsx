/*
 * Ville isométrique (scène 6) : des immeubles, des villas et la lagune, des annonces qui flottent au-dessus des biens,
 * reliées par des lignes dorées aux personnes qui cherchent. Dessin vectoriel aux couleurs du site. Avec `f` (image de
 * la scène), la ville se construit : bâtiments, puis annonces, puis lignes, puis personnes.
 */
import { staticFile } from "remotion";
import { C, POLICE_TEXTE } from "../theme";
import { disponible } from "./commun";

const S = 40; // taille d'une case
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const OX = 1000, OY = 390;
const iso = (x: number, y: number, z = 0) => [OX + (x - y) * COS * S, OY + (x + y) * SIN * S - z * S] as const;
const pts = (l: (readonly [number, number])[]) => l.map((p) => p.join(",")).join(" ");

type Bat = { x: number; y: number; w: number; d: number; h: number; teinte: "creme" | "vert" | "sable"; toit?: boolean };
const TEINTES = {
  creme: ["#FAFAF8", "#E4DED0", "#CFC6B2"],
  sable: ["#F1E6CF", "#DCCBA8", "#C4B08A"],
  vert: ["#4FA37B", "#2A7E56", "#1E5E3F"],
};

const etape = (f: number, debut: number, duree: number) => Math.max(0, Math.min(1, (f - debut) / duree));
const adoucir = (p: number) => 1 - Math.pow(1 - p, 3);

function Batiment({ b, p = 1 }: { b: Bat; p?: number }) {
  const [haut, gauche, droite] = TEINTES[b.teinte];
  const { x, y, w, d, h } = b;
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const faceG = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)];
  const faceD = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)];
  // fenêtres : petites bandes claires sur la face droite
  const fenetres = [];
  for (let k = 0.6; k < h - 0.3; k += 0.7) {
    const a = iso(x + w, y + 0.2, k), bb = iso(x + w, y + d - 0.2, k);
    fenetres.push(<line key={k} x1={a[0]} y1={a[1]} x2={bb[0]} y2={bb[1]} stroke={b.teinte === "vert" ? "#9FD8BC" : "#FFF7E0"} strokeOpacity={0.55} strokeWidth={3} />);
  }
  return (
    <g opacity={p} transform={`translate(0, ${(1 - adoucir(p)) * 70})`}>
      <polygon points={pts(faceG)} fill={gauche} />
      <polygon points={pts(faceD)} fill={droite} />
      {fenetres}
      <polygon points={pts(top)} fill={haut} />
      {b.toit && <polygon points={pts([iso(x, y, h), iso(x + w, y, h), iso(x + w / 2, y + d / 2, h + 0.7)])} fill={C.or} opacity={0.85} />}
    </g>
  );
}

const BATIMENTS: Bat[] = [
  // le Plateau : tours
  { x: 1, y: 1, w: 2, d: 2, h: 7, teinte: "vert" }, { x: 4, y: 0.5, w: 1.6, d: 1.6, h: 9, teinte: "creme" },
  { x: 1.2, y: 4, w: 1.8, d: 1.8, h: 5, teinte: "creme" }, { x: 4.2, y: 3.4, w: 2, d: 2, h: 6, teinte: "vert" },
  // résidences
  { x: 9, y: 1, w: 3, d: 1.6, h: 3, teinte: "sable" }, { x: 9, y: 4, w: 3, d: 1.6, h: 3.5, teinte: "creme" },
  // villas (Cocody)
  { x: 13.5, y: 1, w: 1.6, d: 1.6, h: 1.2, teinte: "creme", toit: true }, { x: 16, y: 1.5, w: 1.6, d: 1.6, h: 1.2, teinte: "sable", toit: true },
  { x: 13.8, y: 4, w: 1.6, d: 1.6, h: 1.2, teinte: "sable", toit: true }, { x: 16.3, y: 4.5, w: 1.6, d: 1.6, h: 1.2, teinte: "creme", toit: true },
];

function Carte({ x, y, z, prix, lieu, photo, p = 1 }: { x: number; y: number; z: number; prix: string; lieu: string; photo?: string; p?: number }) {
  const [px, py] = iso(x, y, z);
  const e = 0.6 + 0.4 * adoucir(p);
  const id = `cadre-${x}-${y}`.replace(/\./g, "_");
  return (
    <g opacity={p} transform={`translate(${px}, ${py}) scale(${e}) translate(-95, -120)`}>
      <rect width={190} height={118} rx={14} fill="#FFFFFF" />
      <clipPath id={id}><rect x={8} y={8} width={174} height={58} rx={9} /></clipPath>
      {disponible(`photos/${photo}`)
        ? <image href={staticFile(`photos/${photo}`)} x={8} y={8} width={174} height={58} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
        : <rect x={8} y={8} width={174} height={58} rx={9} fill="url(#photo)" />}
      <text x={12} y={88} fontFamily="Playfair Display" fontWeight={700} fontSize={17} fill={C.vert}>{prix}</text>
      <text x={12} y={107} fontFamily={POLICE_TEXTE} fontSize={13} fill="#555">{lieu}</text>
    </g>
  );
}

export function Ville({ f = 999 }: { f?: number }) {
  const sol = [iso(-1, -1), iso(19, -1), iso(19, 8), iso(-1, 8)];
  const lagune = [iso(-1, 8.5), iso(19, 8.5), iso(19, 12), iso(-1, 12)];
  const personnes = [iso(4, 13, 0), iso(10, 14, 0), iso(16, 13, 0)];
  const cartes = [
    { x: 4.8, y: 1.3, z: 9.3, prix: "350 000 FCFA / mois", lieu: "Plateau", photo: "photo-04.jpg" },
    { x: 10.5, y: 4.5, z: 5, prix: "180 000 FCFA / mois", lieu: "Marcory", photo: "photo-20.jpg" },
    { x: 16.8, y: 2.2, z: 3, prix: "95 000 000 FCFA", lieu: "Cocody", photo: "photo-37.jpg" },
  ];
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="photo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9c7a3" /><stop offset="1" stopColor="#8a9e8f" /></linearGradient>
        <filter id="lueur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <polygon points={pts(sol)} fill="#0F3524" stroke={C.orClair} strokeOpacity={0.25} />
      <polygon points={pts(lagune)} fill="#0E3D45" opacity={0.9} />
      {[...BATIMENTS].sort((a, b) => (a.x + a.y) - (b.x + b.y)).map((b, i) => <Batiment key={i} b={b} p={etape(f, 4 + i * 4, 22)} />)}
      {/* lignes de mise en relation : de chaque annonce vers une personne qui cherche */}
      {cartes.map((c, i) => {
        const [ax, ay] = iso(c.x, c.y, c.z);
        const [bx, by] = personnes[i];
        const d = `M ${ax} ${ay - 2} C ${ax} ${ay + 160}, ${bx} ${by - 220}, ${bx} ${by - 40}`;
        const p = adoucir(etape(f, 95 + i * 12, 30));
        return (
          <g key={i}>
            <path d={d} stroke={C.orClair} strokeWidth={8} fill="none" opacity={0.35} filter="url(#lueur)" pathLength={1} strokeDasharray={`${p} 1`} />
            <path d={d} stroke={C.orClair} strokeWidth={2.5} fill="none" strokeDasharray="10 8" opacity={p} />
          </g>
        );
      })}
      {personnes.map(([x, y], i) => (
        <g key={i} opacity={etape(f, 115 + i * 12, 12)} transform={`translate(${x}, ${y - 40}) scale(${0.6 + 0.4 * adoucir(etape(f, 115 + i * 12, 12))})`}>
          <circle r={34} fill={C.vertNuit} stroke={C.orClair} strokeWidth={3} />
          <circle cy={-9} r={9} fill={C.creme} />
          <path d="M -15 17 a 15 13 0 0 1 30 0" fill={C.creme} />
        </g>
      ))}
      {cartes.map((c, i) => <Carte key={i} {...c} p={etape(f, 60 + i * 10, 16)} />)}
    </svg>
  );
}
