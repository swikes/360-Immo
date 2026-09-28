/*
 * Règles des biens immobiliers : ce qui a du sens pour chaque type de bien et chaque transaction.
 * (reprise de js/regles-biens.js de la maquette : même logique, mêmes libellés)
 *
 * Utilisé par la recherche, et bientôt par la publication, les filtres des annonces et l'estimation :
 * pour changer une règle sur tout le site, c'est ici.
 *
 *   reglesPour(["Terrain"], "vente")               → règles d'un bien (formulaire)
 *   reglesPour(["Maison", "Terrain"], "location")  → règles combinées (filtres : un critère est
 *                                                    proposé dès qu'il a du sens pour un des types)
 *   reglesPour([], null)                           → aucun type choisi : tous les critères
 */

export type Transaction = "vente" | "location";
export type UniteLoyer = "Nuit" | "Jour" | "Mois" | "Année";

type Regles = {
  /** l'option « Déjà meublé » est proposée (« toujours » : meublé d'office, option masquée) */
  meuble: boolean | "toujours";
  /** « toujours » : forcément dans un immeuble (on demande l'étage) ;
   *  « option » : peut être dans un immeuble (case « Dans un immeuble » puis étage) */
  etage: "toujours" | "option" | false;
  /** « studio » (Studio, 2, 3…), true (1, 2, 3…), false */
  pieces: "studio" | boolean;
  chambres: boolean;
  /** libellé (« Salles de bain », « Toilettes ») ou false */
  sanitaires: string | false;
  /** peut être mis en vente (sinon : location uniquement) */
  vente: boolean;
  /** unités du loyer en location */
  loyerPar: UniteLoyer[];
  /** mois de caution demandés en location */
  caution: boolean;
  /** libellé de la surface */
  surface: string;
  commodites: string[];
};

// ── Commodités, par famille ──
const INTERIEUR = ["Air conditionné", "Chauffe-eau", "Balcon", "Terrasse", "Jacuzzi", "Cave"];
const RESIDENCE = ["Piscine", "Jardin", "Garage", "Parking", "Ascenseur", "Gardien"];
const SERVICES = ["Fibre / Wifi", "Rénové"];
export const COMMODITES_TERRAIN = [
  "Terrain clôturé",
  "Viabilisé (eau, électricité)",
  "Titre foncier (ACD)",
  "Accès route bitumée",
];
/** Toutes les commodités, dans l'ordre d'affichage */
export const COMMODITES = [...INTERIEUR, ...RESIDENCE, ...SERVICES, ...COMMODITES_TERRAIN];
const sauf = (liste: string[], retirer: string[]) => liste.filter((c) => !retirer.includes(c));

// ── Ce qui a du sens pour chaque type de bien ──
const HABITATION: Regles = {
  meuble: true, etage: false, pieces: true, chambres: true, sanitaires: "Salles de bain", vente: true,
  loyerPar: ["Jour", "Mois", "Année"], caution: true, surface: "Surface",
  commodites: sauf([...INTERIEUR, ...RESIDENCE, ...SERVICES], ["Ascenseur"]),
};
const REGLES: Record<string, Regles> = {
  "Appartement": {
    ...HABITATION,
    etage: "toujours", pieces: "studio", commodites: [...INTERIEUR, ...RESIDENCE, ...SERVICES],
  },
  "Maison": HABITATION,
  "Villa": HABITATION,
  "Terrain": {
    meuble: false, etage: false, pieces: false, chambres: false, sanitaires: false, vente: true,
    loyerPar: ["Mois", "Année"], caution: true, surface: "Superficie",
    commodites: [...COMMODITES_TERRAIN, "Gardien"],
  },
  "Bureau": {
    meuble: true, etage: "option", pieces: true, chambres: false, sanitaires: "Toilettes", vente: true,
    loyerPar: ["Mois", "Année"], caution: true, surface: "Surface",
    commodites: ["Air conditionné", "Balcon", "Terrasse", "Parking", "Ascenseur", "Gardien", "Fibre / Wifi", "Rénové"],
  },
  "Commerce / Magasin": {
    meuble: false, etage: "option", pieces: false, chambres: false, sanitaires: "Toilettes", vente: true,
    loyerPar: ["Mois", "Année"], caution: true, surface: "Surface",
    commodites: ["Air conditionné", "Terrasse", "Parking", "Gardien", "Fibre / Wifi", "Rénové"],
  },
  "Immeuble": {
    meuble: false, etage: false, pieces: false, chambres: false, sanitaires: false, vente: true,
    loyerPar: ["Mois", "Année"], caution: true, surface: "Surface",
    commodites: ["Piscine", "Jardin", "Garage", "Parking", "Ascenseur", "Gardien", "Fibre / Wifi", "Rénové"],
  },
  "Chambre d'hôtel": {
    meuble: "toujours", etage: false, pieces: false, chambres: false, sanitaires: "Salles de bain", vente: false,
    loyerPar: ["Nuit"], caution: false, surface: "Surface",
    commodites: ["Air conditionné", "Chauffe-eau", "Balcon", "Terrasse", "Jacuzzi", "Piscine", "Parking", "Ascenseur", "Fibre / Wifi"],
  },
  "Autres": { ...HABITATION, etage: "option", commodites: [...INTERIEUR, ...RESIDENCE, ...SERVICES] },
};
/** Les types de bien, dans l'ordre des listes */
export const TYPES_BIEN = Object.keys(REGLES);

// Autres noms utilisés dans les listes du site
const ALIAS: Record<string, string> = {
  "Maison / Villa": "Maison",
  "Commerce": "Commerce / Magasin",
  "Magasin": "Commerce / Magasin",
};

export function regles(nom: string): Regles {
  return REGLES[ALIAS[nom] ?? nom] ?? REGLES["Autres"];
}

const unique = <T,>(liste: T[]) => liste.filter((x, i) => liste.indexOf(x) === i);
const ORDRE_LOYER: UniteLoyer[] = ["Nuit", "Jour", "Mois", "Année"];

export type ReglesCombinees = {
  /** option « Déjà meublé » à cocher */
  meuble: boolean;
  meubleToujours: boolean;
  etage: "toujours" | "option" | false;
  pieces: boolean;
  /** « Studio » proposé (appartements) */
  studio: boolean;
  /** « 1 » proposé (autres biens choisis ; sinon « Studio » suffit) */
  unePiece: boolean;
  chambres: boolean;
  sanitaires: string | false;
  vente: boolean;
  location: boolean;
  caution: boolean;
  loyerPar: UniteLoyer[];
  surface: string;
  commodites: string[];
};

/** transaction : "vente", "location" ou null (les deux) */
export function reglesPour(types: string[], transaction: Transaction | null): ReglesCombinees {
  let liste = types.filter(Boolean);
  const aucunType = !liste.length; // « tous les biens »
  if (aucunType) liste = TYPES_BIEN.filter((t) => t !== "Autres");
  const r = liste.map(regles);
  const un = (cle: "chambres" | "vente" | "caution") => r.some((x) => x[cle]);
  const etages = r.map((x) => x.etage);
  const pieces = r.map((x) => x.pieces);
  const location = transaction !== "vente";
  return {
    meuble: r.some((x) => x.meuble === true),
    meubleToujours: r.every((x) => x.meuble === "toujours"),
    etage: etages.includes("option") ? "option" : etages.includes("toujours") ? "toujours" : false,
    pieces: pieces.some(Boolean),
    studio: pieces.includes("studio"),
    unePiece: !aucunType && pieces.includes(true),
    chambres: un("chambres"),
    sanitaires: aucunType
      ? "Salles de bain"
      : unique(r.map((x) => x.sanitaires).filter((s): s is string => !!s)).join(" / ") || false,
    vente: un("vente"),
    location,
    caution: location && transaction === "location" && un("caution"),
    loyerPar:
      transaction === "vente"
        ? []
        : unique(r.flatMap((x) => x.loyerPar)).sort((a, b) => ORDRE_LOYER.indexOf(a) - ORDRE_LOYER.indexOf(b)),
    surface: unique(r.map((x) => x.surface)).length === 1 ? r[0].surface : "Surface",
    // Tous les biens : les commodités propres aux terrains seulement si « Terrain » est choisi
    commodites: COMMODITES.filter(
      (c) => r.some((x) => x.commodites.includes(c)) && !(aucunType && COMMODITES_TERRAIN.includes(c)),
    ),
  };
}

/** Chambres possibles pour un nombre de pièces (le séjour compte pour une pièce) : Studio/1 → 0, 2 → 1, 3 → 2… */
export function chambresMax(pieces: string): number {
  let n = parseInt(pieces, 10);
  if (/studio/i.test(pieces)) n = 1;
  if (!n) return Infinity;
  return /\+/.test(pieces) ? Infinity : n - 1;
}
