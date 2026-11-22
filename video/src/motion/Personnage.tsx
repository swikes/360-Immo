/*
 * Personnage articulé, dessiné en formes plates (style « motion design »), animable image par image :
 *   - bras en deux parties (épaule, coude) : angles en degrés, 0 = bras le long du corps, positif = vers l'extérieur ;
 *   - tête inclinable, corps qui penche, saute ou s'écrase ;
 *   - visage : yeux (ouverts, fermés, plissés de joie, ronds de surprise, fatigués), sourcils, bouche qui s'ouvre avec la
 *     voix (ouverture 0 → 1, donnée par l'enveloppe de la voix : voir outils/pub/voix.py) et qui sourit ou fait la moue ;
 *   - goutte de sueur, objet tenu en main (téléphone, clé…).
 * Les personnages (couleurs, coiffure, tenue, accessoires) sont décrits par un TypePersonnage : AWA, DEMARCHEUR…
 * Repère du dessin : 400 × 920, pieds au sol à y = 900 ; on le place et on le met à l'échelle avec x, y et taille.
 */
import { useId, type ReactNode } from "react";

export type Yeux = "ouverts" | "fermes" | "joie" | "ronds" | "fatigues" | "mi-clos";

export type TypePersonnage = {
  peau: string;
  peauOmbre: string;
  coiffure: "foulard" | "court" | "tresses";
  cheveux: string;
  /** haut : couleur de fond, et motif wax (deux couleurs) facultatif */
  haut: string;
  motifHaut?: [string, string];
  bas: string;
  motifBas?: [string, string];
  jupe?: boolean;
  chaussures: string;
  foulard?: [string, string, string];
  lunettes?: boolean;
  chaine?: boolean;
  boucles?: boolean;
  dentOr?: boolean;
  curedent?: boolean;
  joues?: string;
};

export const AWA: TypePersonnage = {
  peau: "#8A5536", peauOmbre: "#734428", coiffure: "foulard", cheveux: "#1A120E",
  haut: "#2A7E56", bas: "#E2B54A", motifBas: ["#1E5E3F", "#FDF5E3"], jupe: true, chaussures: "#5A3A26",
  foulard: ["#E2B54A", "#1E5E3F", "#C0392B"], boucles: true, joues: "#E07A5F",
};

export const DEMARCHEUR: TypePersonnage = {
  peau: "#5E3622", peauOmbre: "#4A2918", coiffure: "court", cheveux: "#140D0A",
  haut: "#F07D2E", motifHaut: ["#22408F", "#FFF3DC"], bas: "#2F3B52", chaussures: "#F4F4F0",
  lunettes: true, chaine: true, dentOr: true, curedent: true,
};

/** Un propriétaire (fiable, sobre) pour les avatars */
export const PROPRIETAIRE: TypePersonnage = {
  peau: "#6E4129", peauOmbre: "#5A3420", coiffure: "court", cheveux: "#2A1F1A",
  haut: "#FFFFFF", bas: "#1E5E3F", chaussures: "#3B2A20",
};

export type Pose = {
  /** bras gauche (à gauche de l'image) et droit : [épaule, coude] en degrés */
  brasG?: [number, number];
  brasD?: [number, number];
  /** inclinaison de la tête, du corps (degrés) ; saut (px, vers le haut) ; écrasement (1 = normal, < 1 = tassé) */
  tete?: number;
  corps?: number;
  saut?: number;
  ecrase?: number;
  /** visage */
  yeux?: Yeux;
  regard?: number;
  sourcils?: number;
  bouche?: number;
  sourire?: number;
  sueur?: number;
  /** objet tenu dans la main gauche ou droite (dessiné dans le repère de la main) */
  objetG?: ReactNode;
  objetD?: ReactNode;
  /** respiration (image courante) */
  f?: number;
};

type Props = Pose & {
  type: TypePersonnage;
  x: number;
  y: number;
  taille?: number;
  /** retourné horizontalement (regarde vers la gauche) */
  miroir?: boolean;
  /** buste seulement (avatars) */
  buste?: boolean;
  style?: React.CSSProperties;
};

const HAUT_BRAS = 150, AVANT_BRAS = 132;

/** Bras pendant, dessiné à partir de l'épaule (0, 0), dans le repère du côté (déjà retourné pour le bras droit) */
function Bras({ epaule, coude, manche, peau, objet }: { epaule: number; coude: number; manche: string; peau: string; objet?: ReactNode }) {
  return (
    <g transform={`rotate(${epaule})`}>
      <line x1={0} y1={0} x2={0} y2={HAUT_BRAS} stroke={manche} strokeWidth={50} strokeLinecap="round" />
      <g transform={`translate(0 ${HAUT_BRAS}) rotate(${coude})`}>
        <line x1={0} y1={0} x2={0} y2={AVANT_BRAS - 10} stroke={peau} strokeWidth={36} strokeLinecap="round" />
        {/* bout de manche courte au coude */}
        <circle cx={0} cy={0} r={22} fill={manche} />
        <circle cx={0} cy={AVANT_BRAS} r={25} fill={peau} />
        {objet && <g transform={`translate(0 ${AVANT_BRAS}) rotate(${-epaule - coude})`}>{objet}</g>}
      </g>
    </g>
  );
}

function Oeil({ cx, cy, yeux, regard, peau }: { cx: number; cy: number; yeux: Yeux; regard: number; peau: string }) {
  const noir = "#1A110D";
  if (yeux === "fermes") return <path d={`M${cx - 13} ${cy + 2} Q${cx} ${cy + 8} ${cx + 13} ${cy + 2}`} stroke={noir} strokeWidth={6} fill="none" strokeLinecap="round" />;
  if (yeux === "joie") return <path d={`M${cx - 14} ${cy + 5} Q${cx} ${cy - 12} ${cx + 14} ${cy + 5}`} stroke={noir} strokeWidth={6.5} fill="none" strokeLinecap="round" />;
  const r = yeux === "ronds" ? 1.35 : 1;
  return (
    <g>
      <ellipse cx={cx + regard * 4} cy={cy} rx={11 * r} ry={14 * r} fill={noir} />
      <circle cx={cx + regard * 4 + 4 * r} cy={cy - 5 * r} r={3.6 * r} fill="#FFFFFF" />
      {(yeux === "fatigues" || yeux === "mi-clos") && (
        <path d={`M${cx - 17} ${cy - 18} L${cx + 17} ${cy - 18} L${cx + 17} ${cy + (yeux === "mi-clos" ? 1 : -2)} Q${cx} ${cy + (yeux === "mi-clos" ? 6 : 2)} ${cx - 17} ${cy + (yeux === "mi-clos" ? 1 : -2)} Z`}
          fill={peau} />
      )}
    </g>
  );
}

/** Bouche : ouverture 0 → 1 (voix), sourire -1 → 1 */
function Bouche({ ouverture, sourire, dentOr, large }: { ouverture: number; sourire: number; dentOr?: boolean; large: number }) {
  const cx = 200, cy = 238, demi = 22 * large;
  const o = Math.max(0, Math.min(1, ouverture));
  if (o < 0.08) {
    const creux = 12 * sourire;
    return <path d={`M${cx - demi} ${cy - 3 * sourire} Q${cx} ${cy + creux} ${cx + demi} ${cy - 3 * sourire}`} stroke="#2A140E" strokeWidth={6} fill="none" strokeLinecap="round" />;
  }
  const h = 8 + 30 * o;
  const haut = cy - 4 * sourire;
  return (
    <g>
      <path d={`M${cx - demi} ${haut} Q${cx} ${haut + 4 + 6 * sourire} ${cx + demi} ${haut} Q${cx + demi * 0.7} ${haut + h + 8 * sourire} ${cx} ${haut + h + 6 * Math.max(0, sourire)} Q${cx - demi * 0.7} ${haut + h + 8 * sourire} ${cx - demi} ${haut} Z`}
        fill="#4A1516" />
      <ellipse cx={cx} cy={haut + h * 0.78} rx={demi * 0.55} ry={h * 0.25} fill="#D2645C" />
      <path d={`M${cx - demi * 0.8} ${haut + 2} Q${cx} ${haut + 8} ${cx + demi * 0.8} ${haut + 2} L${cx + demi * 0.7} ${haut + 8} Q${cx} ${haut + 13} ${cx - demi * 0.7} ${haut + 8} Z`} fill="#FFFFFF" />
      {dentOr && <rect x={cx + 3} y={haut + 3} width={10} height={9} rx={2} fill="#F2C94C" stroke="#B88A1C" strokeWidth={1.5} />}
    </g>
  );
}

function Motif({ id, fond, motif }: { id: string; fond: string; motif: [string, string] }) {
  return (
    <pattern id={id} width={56} height={56} patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
      <rect width={56} height={56} fill={fond} />
      <circle cx={14} cy={14} r={9} fill={motif[0]} />
      <circle cx={14} cy={14} r={4} fill={motif[1]} />
      <path d="M42 30 L50 42 L42 54 L34 42 Z" fill={motif[1]} opacity={0.9} />
      <circle cx={42} cy={42} r={3} fill={motif[0]} />
      <path d="M0 0 M28 0 L34 8 L28 16 L22 8 Z" fill={motif[0]} opacity={0.55} />
    </pattern>
  );
}

export function Personnage(props: Props) {
  const t = props.type;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const f = props.f ?? 0;
  const souffle = Math.sin((f / 30) * Math.PI * 0.9) * 0.006;
  const brasG = props.brasG ?? [8, -6], brasD = props.brasD ?? [8, -6];
  const yeux = props.yeux ?? "ouverts";
  const sourcils = props.sourcils ?? 0;
  const ecrase = props.ecrase ?? 1;
  const taille = props.taille ?? 1;
  const vue = props.buste ? "40 0 320 400" : "0 0 400 920";
  const largeurVue = props.buste ? 320 : 400, hauteurVue = props.buste ? 400 : 920;
  const hautId = `haut${uid}`, basId = `bas${uid}`, foulardId = `foul${uid}`;
  const large = t === DEMARCHEUR ? 1.25 : 1;

  return (
    <svg viewBox={vue} width={largeurVue * taille} height={hauteurVue * taille}
      style={{ position: "absolute", left: props.x - (largeurVue * taille) / 2, top: props.y - hauteurVue * taille, overflow: "visible",
        transform: props.miroir ? "scaleX(-1)" : undefined, ...props.style }}>
      <defs>
        {t.motifHaut && <Motif id={hautId} fond={t.haut} motif={t.motifHaut} />}
        {t.motifBas && <Motif id={basId} fond={t.bas} motif={t.motifBas} />}
        {t.foulard && <Motif id={foulardId} fond={t.foulard[0]} motif={[t.foulard[1], t.foulard[2]]} />}
      </defs>
      {!props.buste && <ellipse cx={200} cy={902} rx={130 - (props.saut ?? 0) * 0.3} ry={15} fill="#000000" opacity={0.1} />}
      <g transform={`translate(0 ${-(props.saut ?? 0)}) rotate(${props.corps ?? 0} 200 900) translate(200 900) scale(${1 + (1 - ecrase) * 0.4} ${ecrase + souffle}) translate(-200 -900)`}>
        {/* jambes et chaussures */}
        {!props.buste && (
          <g>
            {t.jupe ? (
              <>
                <rect x={160} y={700} width={30} height={170} rx={14} fill={t.peau} />
                <rect x={212} y={700} width={30} height={170} rx={14} fill={t.peau} />
              </>
            ) : (
              <>
                <rect x={138} y={540} width={58} height={330} rx={26} fill={t.bas} />
                <rect x={204} y={540} width={58} height={330} rx={26} fill={t.bas} />
                <rect x={196} y={560} width={8} height={120} fill="#000000" opacity={0.12} />
              </>
            )}
            <path d="M128 866 Q128 846 160 846 L196 846 Q204 846 204 862 L204 880 Q204 892 190 892 L134 892 Q122 892 128 866 Z" fill={t.chaussures} />
            <path d="M272 866 Q272 846 240 846 L204 846 Q196 846 196 862 L196 880 Q196 892 210 892 L266 892 Q278 892 272 866 Z" fill={t.chaussures} />
            <rect x={130} y={884} width={70} height={8} rx={4} fill="#000000" opacity={0.15} />
            <rect x={200} y={884} width={70} height={8} rx={4} fill="#000000" opacity={0.15} />
          </g>
        )}
        {/* bras gauche (derrière le corps quand il pend) */}
        <g transform="translate(116 330)">
          <Bras epaule={brasG[0]} coude={brasG[1]} manche={t.motifHaut ? `url(#${hautId})` : t.haut} peau={t.peau} objet={props.objetG} />
        </g>
        {/* corps : haut (avec motif), jupe */}
        <path d="M112 330 Q112 292 150 288 L250 288 Q288 292 288 330 L280 560 Q278 580 258 580 L142 580 Q122 580 120 560 Z"
          fill={t.motifHaut ? `url(#${hautId})` : t.haut} />
        <path d="M250 288 Q288 292 288 330 L280 560 Q278 580 258 580 L236 580 Q262 470 250 288 Z" fill="#000000" opacity={0.08} />
        {t.jupe && (
          <path d="M126 540 L274 540 L318 740 Q320 756 300 756 L100 756 Q80 756 82 740 Z" fill={t.motifBas ? `url(#${basId})` : t.bas} />
        )}
        {/* cou et col */}
        <rect x={176} y={244} width={48} height={60} rx={18} fill={t.peau} />
        <rect x={176} y={262} width={48} height={20} fill={t.peauOmbre} opacity={0.6} />
        <path d="M160 288 Q200 330 240 288" fill={t.peau} />
        {t.chaine && (
          <g>
            <path d="M164 292 Q200 352 236 292" stroke="#E6B93A" strokeWidth={7} fill="none" strokeDasharray="2 7" strokeLinecap="round" />
            <circle cx={200} cy={330} r={11} fill="#E6B93A" stroke="#B88A1C" strokeWidth={2} />
          </g>
        )}
        {/* tête */}
        <g transform={`rotate(${props.tete ?? 0} 200 270)`}>
          {t.coiffure === "foulard" && <ellipse cx={200} cy={128} rx={100} ry={70} fill={t.cheveux} />}
          <ellipse cx={108} cy={178} rx={16} ry={22} fill={t.peauOmbre} />
          <ellipse cx={292} cy={178} rx={16} ry={22} fill={t.peauOmbre} />
          {t.boucles && (
            <g fill="none" stroke="#E6B93A" strokeWidth={6}>
              <circle cx={104} cy={216} r={16} />
              <circle cx={296} cy={216} r={16} />
            </g>
          )}
          <ellipse cx={200} cy={172} rx={92} ry={106} fill={t.peau} />
          <path d="M248 80 Q300 120 290 190 Q282 250 230 276 Q276 210 248 80 Z" fill={t.peauOmbre} opacity={0.55} />
          {/* coiffure */}
          {t.coiffure === "court" && (
            <path d="M110 150 Q104 70 160 58 Q200 50 240 58 Q296 70 290 150 Q284 112 262 100 Q200 84 138 100 Q116 112 110 150 Z" fill={t.cheveux} />
          )}
          {t.coiffure === "foulard" && t.foulard && (
            <g>
              <path d="M96 140 Q92 40 200 30 Q308 40 304 140 Q300 110 268 98 Q200 82 132 98 Q100 110 96 140 Z" fill={`url(#${foulardId})`} />
              <path d="M150 34 Q200 -40 262 22 Q240 -6 204 4 Q178 10 150 34 Z" fill={`url(#${foulardId})`} />
              <path d="M226 30 Q300 -14 300 50 Q284 20 226 30 Z" fill={t.foulard[1]} />
              <path d="M96 140 Q100 110 132 98 Q200 82 268 98 Q300 110 304 140" stroke="#000000" strokeOpacity={0.12} strokeWidth={6} fill="none" />
            </g>
          )}
          {/* sourcils */}
          <g stroke="#1A110D" strokeWidth={7} strokeLinecap="round" fill="none">
            <path d={`M146 ${136 - sourcils * 8} Q164 ${128 - sourcils * 10} 184 ${136 - sourcils * 4 + Math.min(0, sourcils) * -6}`} />
            <path d={`M216 ${136 - sourcils * 4 + Math.min(0, sourcils) * -6} Q236 ${128 - sourcils * 10} 254 ${136 - sourcils * 8}`} />
          </g>
          {/* yeux (ou lunettes noires) */}
          {t.lunettes ? (
            <g>
              <path d="M136 158 L190 158 Q194 196 166 198 Q138 198 136 168 Z" fill="#111111" />
              <path d="M210 158 L264 158 Q262 198 234 198 Q206 196 210 158 Z" fill="#111111" />
              <rect x={186} y={160} width={28} height={7} rx={3} fill="#111111" />
              <path d="M146 166 L162 166" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
              <path d="M220 166 L236 166" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
            </g>
          ) : (
            <g>
              <Oeil cx={166} cy={176} yeux={yeux} regard={props.regard ?? 0} peau={t.peau} />
              <Oeil cx={234} cy={176} yeux={yeux} regard={props.regard ?? 0} peau={t.peau} />
            </g>
          )}
          {t.joues && <g fill={t.joues} opacity={0.28}><ellipse cx={142} cy={214} rx={18} ry={11} /><ellipse cx={258} cy={214} rx={18} ry={11} /></g>}
          {/* nez */}
          <path d="M196 196 Q186 214 196 220 Q204 224 212 218" stroke={t.peauOmbre} strokeWidth={6} fill="none" strokeLinecap="round" />
          <Bouche ouverture={props.bouche ?? 0} sourire={props.sourire ?? 0.5} dentOr={t.dentOr} large={large} />
          {t.curedent && (props.bouche ?? 0) < 0.2 && <line x1={226} y1={240} x2={262} y2={226} stroke="#D9B37A" strokeWidth={4} strokeLinecap="round" />}
          {/* sueur */}
          {(props.sueur ?? 0) > 0 && (
            <path d="M292 108 Q306 132 300 144 Q292 154 282 146 Q276 136 292 108 Z" fill="#7CC4F2" stroke="#3B8FD0" strokeWidth={2}
              opacity={props.sueur} transform={`translate(0 ${(1 - (props.sueur ?? 0)) * -10})`} />
          )}
        </g>
        {/* bras droit (devant) */}
        <g transform="translate(284 330) scale(-1 1)">
          <Bras epaule={brasD[0]} coude={brasD[1]} manche={t.motifHaut ? `url(#${hautId})` : t.haut} peau={t.peau}
            objet={props.objetD ? <g transform="scale(-1 1)">{props.objetD}</g> : undefined} />
        </g>
      </g>
    </svg>
  );
}

/** Téléphone tenu en main (dans le repère de la main) */
export function TelephoneMain({ ecran = "#1E5E3F" }: { ecran?: string }) {
  return (
    <g transform="translate(-30 -70)">
      <rect x={0} y={0} width={60} height={110} rx={12} fill="#16181A" />
      <rect x={5} y={8} width={50} height={92} rx={7} fill={ecran} />
      <rect x={22} y={3} width={16} height={3} rx={1.5} fill="#333" />
    </g>
  );
}

/** Clés (dans le repère de la main) */
export function Cles() {
  return (
    <g transform="translate(-10 -10)">
      <circle cx={10} cy={10} r={14} fill="none" stroke="#E6B93A" strokeWidth={6} />
      <rect x={18} y={6} width={46} height={9} rx={4} fill="#E6B93A" />
      <rect x={50} y={14} width={7} height={12} rx={2} fill="#E6B93A" />
      <rect x={40} y={14} width={6} height={9} rx={2} fill="#E6B93A" />
    </g>
  );
}
