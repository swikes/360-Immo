/*
 * Critères de recherche et adresse de la liste des annonces (mêmes paramètres que la maquette) :
 *   tx=achat|location · duree=mois|jour · type=appartement,villa… (clés : lib/regles-biens.ts) · q=lieu
 *   min · max (prix ou loyer) · pieces=studio|1…5+ · chambres=1…5+ · smin · smax (surface) · meuble=1
 *   com=Piscine|Jardin (commodités) · photos=1 · recentes=1
 *   et, gardés pour la future recherche dans la base : sdb=1…4+ · caution=1…4+ · immeuble=1 · etage=rdc…5+
 */
import { chambresMax, cleType, type ReglesCombinees } from "./regles-biens";

/** Critères avancés (« Plus de critères ») tels que choisis */
export type Avances = {
  pieces: string | null;
  chambres: string | null;
  sdb: string | null;
  caution: string | null;
  smin: string;
  smax: string;
  meuble: boolean;
  photos: boolean;
  recentes: boolean;
  immeuble: boolean;
  etage: string | null;
  commodites: string[];
};

export const AVANCES_VIDES: Avances = {
  pieces: null, chambres: null, sdb: null, caution: null, smin: "", smax: "",
  meuble: false, photos: false, recentes: false, immeuble: false, etage: null, commodites: [],
};

export type Criteres = {
  location: boolean;
  journaliere?: boolean;
  types?: string[];
  lieu?: string;
  min?: string;
  max?: string;
  avances?: Avances;
};

/** Montant saisi (« 500 000 », « 500000 FCFA ») → chiffres seuls */
export const chiffres = (texte = "") => texte.replace(/\D/g, "");

/**
 * Ne garde que les critères qui ont un sens pour le type de bien et la transaction (lib/regles-biens.ts) :
 * « 3 pièces » disparaît si l'on passe à un terrain, la caution si l'on passe à l'achat, etc.
 */
export function avancesValables(a: Avances, r: ReglesCombinees, o: { location: boolean; mensuelle: boolean }): Avances {
  const pieces = r.pieces && a.pieces && (a.pieces !== "Studio" || r.studio) && (a.pieces !== "1" || r.unePiece) ? a.pieces : null;
  const max = pieces ? chambresMax(pieces) : Infinity;
  const chambres = r.chambres && a.chambres && parseInt(a.chambres, 10) <= max ? a.chambres : null;
  const immeuble = r.etage === "option" && a.immeuble;
  const etage = r.etage === "toujours" || immeuble ? a.etage : null;
  return {
    pieces, chambres,
    sdb: r.sanitaires ? a.sdb : null,
    caution: o.location && o.mensuelle && r.caution ? a.caution : null,
    smin: chiffres(a.smin), smax: chiffres(a.smax),
    meuble: r.meuble && a.meuble,
    photos: a.photos, recentes: a.recentes,
    immeuble, etage,
    commodites: a.commodites.filter((c) => r.commodites.includes(c)),
  };
}

/** Nombre de critères avancés choisis (affiché sur le bouton « Plus de critères ») */
export function nombreAvances(a: Avances): number {
  return [a.pieces, a.chambres, a.sdb, a.caution, a.smin || a.smax, a.meuble, a.photos, a.recentes, a.immeuble, a.etage]
    .filter(Boolean).length + a.commodites.length;
}

export function adresseAnnonces(c: Criteres): string {
  const p = new URLSearchParams();
  if (c.location) {
    p.set("tx", "location");
    p.set("duree", c.journaliere ? "jour" : "mois");
  } else {
    p.set("tx", "achat");
  }
  const types = (c.types ?? []).map(cleType).filter(Boolean);
  if (types.length) p.set("type", types.join(","));
  const lieu = c.lieu?.trim();
  if (lieu) p.set("q", lieu);
  const min = chiffres(c.min), max = chiffres(c.max);
  if (min) p.set("min", min);
  if (max) p.set("max", max);
  const a = c.avances;
  if (a) {
    if (a.pieces) p.set("pieces", a.pieces.toLowerCase());
    if (a.chambres) p.set("chambres", a.chambres);
    const smin = chiffres(a.smin), smax = chiffres(a.smax);
    if (smin) p.set("smin", smin);
    if (smax) p.set("smax", smax);
    if (a.meuble) p.set("meuble", "1");
    if (a.commodites.length) p.set("com", a.commodites.join("|"));
    if (a.photos) p.set("photos", "1");
    if (a.recentes) p.set("recentes", "1");
    if (a.sdb) p.set("sdb", a.sdb);
    if (a.caution) p.set("caution", a.caution);
    if (a.immeuble) p.set("immeuble", "1");
    if (a.etage) p.set("etage", a.etage.toLowerCase().replace(/\s+/g, ""));
  }
  return "/annonces?" + p.toString();
}
