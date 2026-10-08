/*
 * Annonces en ligne, telles que les visiteurs les voient : leurs types (cartes, fiche d'un bien, résultats d'une
 * recherche) et les petits outils d'affichage (adresse de la fiche, photo, prix, lieu, date).
 * Lecture dans la base, côté serveur : lib/annonces-serveur.ts.
 */
import type { Transaction } from "./regles-biens";

type UniteBase = "nuit" | "jour" | "mois" | "annee";

/** Une annonce pour une carte (liste, accueil, biens similaires) */
export type CarteAnnonce = {
  id: string;
  reference: string;
  transaction: Transaction;
  type_bien: string;
  type_nom: string;
  titre: string;
  prix: number;
  loyer_par: UniteBase | null;
  caution_mois: number | null;
  ville: string;
  commune: string;
  quartier: string | null;
  adresse: string | null;
  surface: number | null;
  surface_nom: string;
  pieces: number | null;
  studio: boolean;
  chambres: number | null;
  sanitaires: number | null;
  sanitaires_nom: string | null;
  meuble: boolean;
  dans_immeuble: boolean;
  etage: number | null;
  commodites: string[];
  type_vendeur: "particulier" | "agence";
  contact_nom: string | null;
  contact_whatsapp: boolean;
  premium: boolean;
  verifiee: boolean;
  publiee_le: string;
  photo: string | null;
  nb_photos: number;
  /** vitrine de l'annonceur : code, nom affiché (agence, ou « Awa K. »), agence ou non, agence vérifiée */
  annonceur: string | null;
  annonceur_nom: string | null;
  annonceur_agence: boolean | null;
  annonceur_verifie: boolean | null;
  /** biens identiques proposés (même résidence, même lotissement) ; 1 : un seul bien */
  disponibles?: number;
};

/** En-tête d'une vitrine */
/** verifiee : agence vérifiée, ou identité vérifiée d'un particulier ; logo : celui de l'agence vérifiée */
export type Vitrine = { code: string; nom: string; agence: boolean; verifiee: boolean; logo?: string | null; membre_depuis: string; total: number };

/** La fiche d'un bien : tout, sauf le contact (demandé à part) */
export type FicheAnnonce = Omit<CarteAnnonce, "photo" | "nb_photos"> & {
  description: string;
  photos: string[];
  vues: number;
  expire_le: string | null;
};

export type Resultats = {
  total: number;
  page: number;
  par_page: number;
  annonces: CarteAnnonce[];
  par_transaction: Partial<Record<Transaction, number>>;
  par_type: Record<string, number>;
};

export const RESULTATS_VIDES: Resultats = { total: 0, page: 1, par_page: 12, annonces: [], par_transaction: {}, par_type: {} };

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Petits outils d'affichage (utilisables partout) ──

/** Adresse publique d'une photo du stockage */
export const urlPhotoPublique = (chemin: string) => `${URL_BASE}/storage/v1/object/public/photos-annonces/${chemin}`;

/** Adresse publique du logo d'une agence vérifiée (dossier « logos ») */
export const urlLogo = (chemin: string) => `${URL_BASE}/storage/v1/object/public/logos/${chemin}`;

/** Texte → mots d'une adresse : « Appartement 3 pièces — Riviera 2 » → appartement-3-pieces-riviera-2 */
const motsAdresse = (texte: string) =>
  texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 80).replace(/-+$/, "");

/** Adresse de la fiche : /annonces/appartement-3-pieces-meuble-a-louer-riviera-2-imm-2026-00001 (lisible, pour Google) */
export function lienAnnonce(a: Pick<CarteAnnonce, "titre" | "reference">): string {
  const mots = motsAdresse(a.titre);
  return `/annonces/${mots ? `${mots}-` : ""}${a.reference.toLowerCase()}`;
}

/** Adresse d'une vitrine : /annonceur/kamika-immobilier-k7p2qx (le nom, puis le code qui seul compte) */
export const lienVitrine = (v: { code: string; nom: string }) => `/annonceur/${motsAdresse(v.nom) || "annonceur"}-${v.code}`;

/** Code d'une adresse de vitrine (…-k7p2qx) */
export const codeVitrineDe = (segment: string) => segment.match(/(?:^|-)([a-z0-9]{6})$/i)?.[1].toLowerCase() ?? null;

/** Référence d'une adresse de fiche (…-imm-2026-00001) */
export const referenceDe = (segment: string) => segment.match(/imm-\d{4}-\d{5}$/i)?.[0].toUpperCase() ?? null;

const UNITES: Record<UniteBase, string> = { nuit: "nuit", jour: "jour", mois: "mois", annee: "an" };
export const uniteLoyer = (u: UniteBase | null) => (u ? UNITES[u] : null);

/** « Riviera 2, Cocody » ; hors d'Abidjan : « Air France 2, Bouaké » */
export const lieuAnnonce = (a: Pick<CarteAnnonce, "quartier" | "commune">) => [a.quartier, a.commune].filter(Boolean).join(", ");

/** Publiée depuis moins de 3 jours (badge « Nouveau ») */
export const estNouvelle = (date: string, maintenant = Date.now()) => maintenant - new Date(date).getTime() < 3 * 86_400_000;

/** « Aujourd'hui », « Hier », « Il y a 5 jours », « Il y a 3 semaines » */
export function depuis(date: string, maintenant = Date.now()): string {
  const jours = Math.floor((maintenant - new Date(date).getTime()) / 86_400_000);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  if (jours < 14) return `Il y a ${jours} jours`;
  if (jours < 60) return `Il y a ${Math.round(jours / 7)} semaines`;
  return `Il y a ${Math.round(jours / 30)} mois`;
}

/** Caractéristiques principales, en clair : « 3 pièces » ou « Studio », « 85 m² », « 2 chambres » */
export function caracteristiques(
  a: Pick<CarteAnnonce, "studio" | "pieces" | "surface" | "chambres">,
): { icone: "pieces" | "surface" | "chambres"; texte: string }[] {
  const c: { icone: "pieces" | "surface" | "chambres"; texte: string }[] = [];
  if (a.studio) c.push({ icone: "pieces", texte: "Studio" });
  else if (a.pieces) c.push({ icone: "pieces", texte: `${a.pieces} pièce${a.pieces > 1 ? "s" : ""}` });
  if (a.surface) c.push({ icone: "surface", texte: `${new Intl.NumberFormat("fr-FR").format(Number(a.surface))} m²` });
  if (a.chambres) c.push({ icone: "chambres", texte: `${a.chambres} chambre${a.chambres > 1 ? "s" : ""}` });
  return c;
}
