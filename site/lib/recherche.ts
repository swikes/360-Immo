/*
 * Critères de recherche et adresse de la liste des annonces (mêmes paramètres que la maquette) :
 *   tx=achat|location · duree=mois|jour · type=appartement,villa… (clés : lib/regles-biens.ts) · q=lieu
 *   min · max (prix ou loyer) · pieces=studio|1…5+ · chambres=1…5+ · smin · smax (surface) · meuble=1
 *   com=Piscine|Jardin (commodités) · photos=1 · recentes=1
 *   et, gardés pour la future recherche dans la base : sdb=1…4+ · caution=1…4+ · immeuble=1 · etage=rdc…5+
 */
import { trouver } from "./choix-lieu";
import { chambresMax, cleType, pluriel, reglesPour, typeDeCle, type ReglesCombinees } from "./regles-biens";

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

// ══ Liste des annonces : la recherche décrite par l'adresse de la page ══

export type Tri = "recent" | "prix_asc" | "prix_desc";
export const TRIS: { valeur: Tri; texte: string }[] = [
  { valeur: "recent", texte: "Plus récentes" },
  { valeur: "prix_asc", texte: "Prix croissant" },
  { valeur: "prix_desc", texte: "Prix décroissant" },
];

/** Annonces par page de la liste */
export const PAR_PAGE = 12;

/** Ce que l'adresse /annonces?… demande (mêmes paramètres que l'accueil et la maquette, plus tri, page, verifiees) */
export type EtatRecherche = {
  tx: "achat" | "location" | null;
  duree: "mois" | "jour" | null;
  /** noms des types (« Appartement ») */
  types: string[];
  lieu: string;
  min: string;
  max: string;
  avances: Avances;
  verifiees: boolean;
  tri: Tri;
  page: number;
};

export const RECHERCHE_VIDE: EtatRecherche = {
  tx: null, duree: null, types: [], lieu: "", min: "", max: "", avances: AVANCES_VIDES, verifiees: false, tri: "recent", page: 1,
};

const ETAGES_ADRESSE: Record<string, string> = { rdc: "Rdc", "1er": "1er", "2ème": "2ème", "3ème": "3ème", "4ème": "4ème", "5ème+": "5ème +" };

export function lireAdresse(p: URLSearchParams): EtatRecherche {
  const tx = p.get("tx");
  const duree = p.get("duree");
  const un = (cle: string, valeurs: string[]) => {
    const v = p.get(cle);
    return v && valeurs.includes(v) ? v : null;
  };
  const pieces = un("pieces", ["studio", "1", "2", "3", "4", "5+"]);
  const tri = p.get("sort") ?? p.get("tri");
  return {
    tx: tx === "achat" || tx === "location" ? tx : null,
    duree: tx === "location" && (duree === "mois" || duree === "jour") ? duree : null,
    types: [...new Set((p.get("type") ?? "").split(",").map((t) => typeDeCle(t.trim())).filter((t): t is string => !!t))],
    lieu: (p.get("q") ?? "").trim().slice(0, 80),
    min: chiffres(p.get("min") ?? "").slice(0, 12),
    max: chiffres(p.get("max") ?? "").slice(0, 12),
    avances: {
      pieces: pieces === "studio" ? "Studio" : pieces,
      chambres: un("chambres", ["1", "2", "3", "4", "5+"]),
      sdb: un("sdb", ["1", "2", "3", "4+"]),
      caution: un("caution", ["1", "2", "3", "4+"]),
      smin: chiffres(p.get("smin") ?? "").slice(0, 6),
      smax: chiffres(p.get("smax") ?? "").slice(0, 6),
      meuble: p.get("meuble") === "1",
      photos: p.get("photos") === "1",
      recentes: p.get("recentes") === "1",
      immeuble: p.get("immeuble") === "1",
      etage: ETAGES_ADRESSE[p.get("etage") ?? ""] ?? null,
      commodites: (p.get("com") ?? "").split("|").map((c) => c.trim()).filter(Boolean),
    },
    verifiees: p.get("verifiees") === "1",
    tri: tri === "prix_asc" || tri === "prix_desc" ? tri : "recent",
    page: Math.max(1, Math.min(500, parseInt(p.get("page") ?? "1", 10) || 1)),
  };
}

/** La recherche décrite par les paramètres d'une page (searchParams de Next.js) */
export function lireParametres(parametres: Record<string, string | string[] | undefined>): EtatRecherche {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    for (const v of [valeur ?? []].flat()) p.append(cle, v);
  }
  return lireAdresse(p);
}

/** Règles des types et de la transaction choisis (quels critères ont un sens) */
export const reglesRecherche = (e: EtatRecherche) =>
  reglesPour(e.types, e.tx === "achat" ? "vente" : e.tx === "location" ? "location" : null);

/** Critères avancés qui ont un sens pour les types et la transaction choisis */
export const avancesDe = (e: EtatRecherche) =>
  avancesValables(e.avances, reglesRecherche(e), { location: e.tx === "location", mensuelle: e.duree !== "jour" });

/** Adresse de la liste (ou d'une vitrine : base) pour cette recherche (seulement les critères choisis ;
 *  page 1 et tri par défaut omis) */
export function adresseListe(e: EtatRecherche, base = "/annonces"): string {
  const p = new URLSearchParams();
  if (e.tx) p.set("tx", e.tx);
  if (e.tx === "location" && e.duree) p.set("duree", e.duree);
  const types = e.types.map(cleType).filter(Boolean);
  if (types.length) p.set("type", types.join(","));
  if (e.lieu.trim()) p.set("q", e.lieu.trim());
  if (e.tx && chiffres(e.min)) p.set("min", chiffres(e.min));
  if (e.tx && chiffres(e.max)) p.set("max", chiffres(e.max));
  const a = avancesDe(e);
  if (a.pieces) p.set("pieces", a.pieces.toLowerCase());
  if (a.chambres) p.set("chambres", a.chambres);
  if (a.smin) p.set("smin", a.smin);
  if (a.smax) p.set("smax", a.smax);
  if (a.sdb) p.set("sdb", a.sdb);
  if (a.caution) p.set("caution", a.caution);
  if (a.meuble) p.set("meuble", "1");
  if (a.immeuble) p.set("immeuble", "1");
  if (a.etage) p.set("etage", a.etage.toLowerCase().replace(/\s+/g, ""));
  if (a.commodites.length) p.set("com", a.commodites.join("|"));
  if (a.photos) p.set("photos", "1");
  if (a.recentes) p.set("recentes", "1");
  if (e.verifiees) p.set("verifiees", "1");
  if (e.tri !== "recent") p.set("tri", e.tri);
  if (e.page > 1) p.set("page", String(e.page));
  const q = p.toString();
  return base + (q ? `?${q}` : "");
}

/** Nombre de filtres choisis (bouton « Filtres » sur téléphone) : types, budget, critères avancés, vérifiées */
export function nombreFiltres(e: EtatRecherche): number {
  return e.types.length + (e.tx && (chiffres(e.min) || chiffres(e.max)) ? 1 : 0) + nombreAvances(avancesDe(e)) + (e.verifiees ? 1 : 0);
}

/** Les critères pour la base (fonction rechercher_annonces) : lieu reconnu, critères qui ont un sens seulement */
export function criteresBase(e: EtatRecherche): Record<string, unknown> {
  const c: Record<string, unknown> = { tri: e.tri, page: e.page, par_page: PAR_PAGE };
  if (e.tx) c.tx = e.tx;
  if (e.tx === "location" && e.duree) c.duree = e.duree;
  const types = e.types.map(cleType).filter(Boolean);
  if (types.length) c.types = types;
  if (e.lieu.trim()) {
    const l = trouver(e.lieu);
    if (!l) c.texte = e.lieu.trim();
    else {
      c.ville = l.ville;
      if (l.commune) c.commune = l.commune;
      if (l.quartier) c.quartier = l.quartier;
    }
  }
  if (e.tx && chiffres(e.min)) c.min = Number(chiffres(e.min));
  if (e.tx && chiffres(e.max)) c.max = Number(chiffres(e.max));
  const a = avancesDe(e);
  if (a.pieces) c.pieces = [a.pieces.toLowerCase()];
  if (a.chambres) c.chambres = [a.chambres];
  if (a.sdb) c.sdb = a.sdb;
  if (a.caution) c.caution = a.caution;
  if (a.smin) c.smin = Number(a.smin);
  if (a.smax) c.smax = Number(a.smax);
  if (a.meuble) c.meuble = true;
  if (a.immeuble) c.immeuble = true;
  if (a.etage) c.etage = a.etage === "Rdc" ? "rdc" : a.etage.includes("+") ? `${parseInt(a.etage, 10)}+` : String(parseInt(a.etage, 10));
  if (a.commodites.length) c.com = a.commodites;
  if (a.photos) c.photos = true;
  if (a.recentes) c.recentes = true;
  if (e.verifiees) c.verifiees = true;
  return c;
}

/** Recherche sans aucun critère (ni transaction, ni lieu, ni filtre) */
export const rechercheVide = (e: EtatRecherche) => !e.tx && !e.lieu.trim() && nombreFiltres(e) === 0;

/** Titre de la recherche : « Appartements à louer à Cocody », « Biens à vendre », « Annonces immobilières » */
export function titreRecherche(e: EtatRecherche): string {
  const quoi = e.types.length === 1 ? pluriel(e.types[0]) : e.tx ? "Biens" : "Annonces immobilières";
  const transaction = e.tx === "location" ? " à louer" : e.tx === "achat" ? " à vendre" : "";
  const lieu = e.lieu.trim() ? ` à ${trouver(e.lieu)?.texte ?? e.lieu.trim()}` : "";
  return quoi + transaction + lieu;
}

/** Les critères d'une alerte (comme criteresBase, sans le tri, la page ni « récentes ») */
export function criteresAlerte(e: EtatRecherche): Record<string, unknown> {
  const c = criteresBase(e);
  for (const cle of ["tri", "page", "par_page", "recentes"]) delete c[cle];
  return c;
}

/** Adresse de référence d'une alerte : la recherche, sans tri, page ni « récentes » */
export const adresseAlerte = (e: EtatRecherche) =>
  adresseListe({ ...e, tri: "recent", page: 1, avances: { ...e.avances, recentes: false } });

/** La recherche en quelques mots, en plus de son titre : « 300 000 FCFA max / mois », « 3 pièces », « Meublé »… */
export function resumeRecherche(e: EtatRecherche): string[] {
  const r: string[] = [];
  if (e.tx === "location" && e.duree) r.push(e.duree === "jour" ? "Location à la journée" : "Location au mois");
  const min = e.tx ? Number(chiffres(e.min)) : 0, max = e.tx ? Number(chiffres(e.max)) : 0;
  const unite = e.tx === "location" ? (e.duree === "jour" ? " / jour" : " / mois") : "";
  const f = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  if (min && max) r.push(`${f(min)} à ${f(max)} FCFA${unite}`);
  else if (max) r.push(`${f(max)} FCFA max${unite}`);
  else if (min) r.push(`À partir de ${f(min)} FCFA${unite}`);
  if (e.types.length > 1) r.push(e.types.join(", "));
  const a = avancesDe(e);
  const nombre = (v: string, nom: string) => `${parseInt(v, 10)} ${nom}${v === "1" ? "" : "s"}${v.endsWith("+") ? " et plus" : ""}`;
  if (a.pieces) r.push(a.pieces === "Studio" ? "Studio" : nombre(a.pieces, "pièce"));
  if (a.chambres) r.push(nombre(a.chambres, "chambre"));
  if (a.sdb) r.push(`${a.sdb.replace("+", "")} salle${a.sdb === "1" ? "" : "s"} de bain et plus`);
  if (a.smin && a.smax) r.push(`${a.smin} à ${a.smax} m²`);
  else if (a.smin) r.push(`${a.smin} m² et plus`);
  else if (a.smax) r.push(`${a.smax} m² max`);
  if (a.meuble) r.push("Meublé");
  if (a.etage) r.push(a.etage === "Rdc" ? "Rez-de-chaussée" : `${a.etage} étage`);
  r.push(...a.commodites);
  if (a.photos) r.push("Avec photos");
  if (e.verifiees) r.push("Vérifiées seulement");
  return r;
}
