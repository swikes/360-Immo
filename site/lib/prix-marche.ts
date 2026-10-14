/*
 * Prix du marché (supabase/migrations/…_prix_marche.sql) : estimation d'un bien, carte des prix, page d'une commune.
 *
 * Les prix sont ceux DEMANDÉS dans les annonces (en ligne, ou terminées depuis moins de 6 mois) : les prix de vente
 * réels ne sont publiés nulle part en Côte d'Ivoire. Un prix ne s'affiche qu'à partir de 5 annonces semblables ; en
 * dessous : « pas encore assez d'annonces ». Un bien se compare à un bien entier ; seul un terrain à vendre, au m².
 */
import { formaterPrix } from "./format";
import { VILLES_COMMUNES } from "./lieux";
import { AVANCES_VIDES, adresseAnnonces } from "./recherche";
import { cleType, pluriel, regles, typeDeCle, typesProposes } from "./regles-biens";

/** 'prix' (vente), 'm2' (terrain à vendre), 'mois' (location), 'jour' ou 'nuit' (court séjour) */
export type Unite = "prix" | "m2" | "mois" | "jour" | "nuit";
export type Niveau = "quartier" | "commune" | "ville";

/** Réponse de estimer_bien() */
export type Estimation = {
  unite: Unite;
  /** null : pas assez d'annonces semblables, nulle part */
  niveau: Niveau | null;
  lieu: string | null;
  nombre: number;
  mediane: number | null;
  bas: number | null;
  haut: number | null;
  /** niveaux essayés, du plus proche au plus large */
  essais: { niveau: Niveau; lieu: string; nombre: number }[];
  /** identifiants d'annonces en ligne proches du prix du milieu (cartes_annonces) */
  annonces: string[];
};

/** Une commune de la carte des prix (prix_communes) */
export type PrixCommune = { ville: string; commune: string; nombre: number; mediane: number | null; bas: number | null; haut: number | null };

/** Un groupe de biens d'une commune (prix_commune) */
export type GroupePrix = {
  transaction: "vente" | "location"; type_bien: string; unite: Unite; pieces: number | null; meuble: boolean | null;
  nombre: number; mediane: number | null; bas: number | null; haut: number | null;
};
export type PageCommune = { ville: string; commune: string; en_ligne: number; groupes: GroupePrix[] };

/** Nombre d'annonces semblables à partir duquel un prix s'affiche (seuil_prix() dans la base) */
export const SEUIL = 5;

/** Un prix à 3 chiffres significatifs : une estimation n'est pas précise au franc près (327 450 → 327 000) */
export function arrondir(v: number): number {
  if (v <= 0) return 0;
  const pas = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2);
  return Math.round(v / pas) * pas;
}

const UNITES: Record<Unite, string> = { prix: "", m2: " / m²", mois: " / mois", jour: " / jour", nuit: " / nuit" };
/** «  / mois », «  / m² », rien pour un prix de vente */
export const texteUnite = (unite: Unite) => UNITES[unite];
/** « 300 000 FCFA / mois », « 50 000 FCFA / m² », « 185 000 000 FCFA » */
export const prixMarche = (v: number, unite: Unite) => `${formaterPrix(arrondir(v))} FCFA${UNITES[unite]}`;
/** « 290 000 – 335 000 FCFA » (sans l'unité : elle est dite avec le prix du milieu) */
export const fourchette = (bas: number, haut: number) =>
  arrondir(bas) === arrondir(haut) ? `${formaterPrix(arrondir(bas))} FCFA` : `${formaterPrix(arrondir(bas))} – ${formaterPrix(arrondir(haut))} FCFA`;

/** Fiabilité d'un prix, d'après le nombre d'annonces semblables (5 au moins) */
export function fiabilite(nombre: number): { niveau: "bonne" | "moyenne" | "indicative"; texte: string } {
  if (nombre >= 15) return { niveau: "bonne", texte: "Bonne" };
  if (nombre >= 8) return { niveau: "moyenne", texte: "Moyenne" };
  return { niveau: "indicative", texte: "Indicative" };
}

export const annonces = (n: number) => `${n} annonce${n > 1 ? "s" : ""}`;

/** Couleurs des communes sur la carte des prix, de la moins chère à la plus chère (verts du logo, comme la maquette) */
export const TEINTES = ["#B9DEC9", "#7FC3A0", "#39A26F", "#1E5E3F", "#113B27"];

const NIVEAUX: Record<Niveau, string> = { quartier: "le quartier", commune: "la commune", ville: "la ville" };
/** « dans la commune de Cocody », « dans le quartier Riviera 2 », « dans la ville d'Abidjan » */
export function dansLeLieu(niveau: Niveau, lieu: string): string {
  if (niveau === "quartier") return `dans le quartier ${lieu}`;
  const voyelle = /^[aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ]/.test(lieu);
  return `dans ${NIVEAUX[niveau]} ${voyelle ? "d'" : "de "}${lieu}`;
}

/** Libellé d'un groupe de biens : « Appartement 3 pièces, non meublé », « Villa 5 pièces et plus », « Terrain » */
export function libelleGroupe(g: Pick<GroupePrix, "type_bien" | "pieces" | "meuble" | "unite">): string {
  const nom = typeDeCle(g.type_bien) ?? "Bien";
  const pieces = g.pieces == null ? "" : g.pieces >= 5 ? " 5 pièces et plus" : g.pieces === 1 ? " 1 pièce (studio compris)" : ` ${g.pieces} pièces`;
  const meuble = g.meuble == null ? "" : g.meuble ? ", meublé" : ", non meublé";
  const sejour = g.unite === "jour" ? " — à la journée" : g.unite === "nuit" ? " — à la nuit" : "";
  return `${nom}${pieces}${meuble}${sejour}`;
}

// ── Pages par commune : /prix/cocody, /prix/port-bouet, /prix/bouake ──
const motsAdresse = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const slugCommune = (commune: string) => motsAdresse(commune);
export const lienCommune = (commune: string) => `/prix/${slugCommune(commune)}`;

/** [ville, commune] d'après l'adresse de sa page (null si inconnue) */
export function communeDuSlug(slug: string): [string, string] | null {
  return VILLES_COMMUNES.find(([, c]) => slugCommune(c) === slug) ?? null;
}

/** Communes d'une ville (pour les liens « autres communes d'Abidjan ») */
export const communesDe = (ville: string) => VILLES_COMMUNES.filter(([v]) => v === ville).map(([, c]) => c);

/** « Appartements », « Terrains » (titre d'une liste) d'après la clé du type */
export const typesAuPluriel = (cle: string) => pluriel(typeDeCle(cle) ?? "Autres");

/** Clé du type (appartement) d'après son nom (Appartement) */
export const cleDuType = (nom: string) => cleType(nom);

/** « Publier mon annonce à ce prix » : formulaire prérempli (components/publication/Formulaire.tsx : prerempli) */
export function adressePublier(b: {
  type: string; transaction: "vente" | "location"; unite: Unite; ville: string; commune: string | null; quartier: string | null;
  pieces: number | null; meuble: boolean; surface: string; prix: number | null;
}): string {
  const p = new URLSearchParams({ type: b.type, tx: b.transaction });
  if (b.transaction === "location") p.set("loyer", b.unite === "jour" || b.unite === "nuit" ? b.unite : "mois");
  p.set("ville", b.ville);
  if (b.commune) p.set("commune", b.commune);
  if (b.quartier) p.set("quartier", b.quartier);
  if (b.pieces) p.set("pieces", String(b.pieces));
  if (b.meuble) p.set("meuble", "1");
  if (b.surface) p.set("surface", b.surface);
  if (b.prix) p.set("prix", String(b.prix));
  return `/publier?${p.toString()}`;
}

// ── Carte des prix : choix d'après l'adresse /carte-des-prix?tx=achat&type=terrain&pieces=3&meuble=1&duree=jour ──
export type ChoixCarte = {
  tx: "location" | "achat";
  /** clé du type (appartement, terrain…) */
  type: string;
  /** 1 à 5 (5 : 5 et plus) ; null : toutes les tailles */
  pieces: number | null;
  /** location d'un bien qui peut être meublé : meublé ou non (non d'office) */
  meuble: boolean;
  duree: "mois" | "jour";
};

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Ce que l'adresse demande, ramené à ce qui a un sens (un terrain n'a pas de pièces, ne se loue pas à la journée…) */
export function lireChoixCarte(p: Record<string, string | string[] | undefined>): ChoixCarte {
  const tx = premier(p.tx) === "achat" ? "achat" : "location";
  const proposes = typesProposes(tx === "achat" ? "vente" : "location").map((t) => cleType(t));
  const type = proposes.includes(premier(p.type)) ? premier(p.type) : "appartement";
  const r = regles(typeDeCle(type) ?? "Autres");
  const n = Number(premier(p.pieces));
  return {
    tx, type,
    pieces: r.pieces && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null,
    meuble: tx === "location" && r.meuble === true && premier(p.meuble) === "1",
    duree: tx === "location" && r.loyerPar.includes("Jour") && premier(p.duree) === "jour" ? "jour" : "mois",
  };
}

/** Adresse de la carte avec un choix changé (ce qui n'a plus de sens est retiré) */
export function adresseCarte(c: ChoixCarte, changement: Partial<ChoixCarte> = {}): string {
  const x = { ...c, ...changement };
  const p: Record<string, string> = { tx: x.tx, type: x.type };
  if (x.pieces) p.pieces = String(x.pieces);
  if (x.meuble) p.meuble = "1";
  if (x.duree === "jour") p.duree = "jour";
  const propre = lireChoixCarte(p);
  const q = new URLSearchParams({ tx: propre.tx, type: propre.type });
  if (propre.pieces) q.set("pieces", String(propre.pieces));
  if (propre.meuble) q.set("meuble", "1");
  if (propre.duree === "jour") q.set("duree", "jour");
  return `/carte-des-prix?${q.toString()}`;
}

/** Unité des prix de la carte */
export const uniteCarte = (c: ChoixCarte): Unite =>
  c.tx === "achat" ? (c.type === "terrain" ? "m2" : "prix") : c.type === "hotel" ? "nuit" : c.duree === "jour" ? "jour" : "mois";

/** Ce que prix_communes() attend */
export const choixBase = (c: ChoixCarte) => {
  const r = regles(typeDeCle(c.type) ?? "Autres");
  return {
    transaction: c.tx === "achat" ? "vente" as const : "location" as const, type_bien: c.type, unite: uniteCarte(c),
    pieces: c.pieces, meuble: c.tx === "location" && r.meuble === true ? c.meuble : null,
  };
};

/** « Voir les annonces » d'une commune (ou d'un groupe de biens) : la liste des annonces avec les mêmes critères */
export function annoncesDe(commune: string, g: { transaction: "vente" | "location"; type_bien: string; unite: Unite; pieces: number | null; meuble: boolean | null }): string {
  return adresseAnnonces({
    location: g.transaction === "location", journaliere: g.unite === "jour" || g.unite === "nuit",
    types: [typeDeCle(g.type_bien) ?? "Autres"], lieu: commune,
    avances: { ...AVANCES_VIDES, pieces: g.pieces ? (g.pieces >= 5 ? "5+" : String(g.pieces)) : null, meuble: !!g.meuble },
  });
}
