"use client";

/*
 * Alertes de recherche (table alertes ; envoi chaque matin : supabase/migrations/…_alertes_emails.sql et
 * …_alertes_souhaits.sql) : ses nouvelles annonces arrivent par e-mail, chaque jour ou chaque semaine.
 * L'alerte se règle dans la fenêtre « Créer une alerte » (components/FenetreAlerte.tsx), remplie d'après la recherche
 * affichée, avec un plan propre à chaque type de bien (planAlerte) :
 *   essentiels (bloquants)   louer / acheter, type, lieu, budget (plafond strict ; minimum s'il est donné),
 *                            pièces au moins, surface au moins (terrain, bureau, commerce), titre foncier (terrain)
 *   souhaits (non bloquants) meublé, chambres au moins, surface au moins (logement), commodités : les annonces qui en
 *                            ont le plus arrivent en premier dans l'e-mail, avec ✓ / ✗
 * Sans compte, l'alerte réglée est gardée le temps de se connecter, puis créée.
 * Le lien « Arrêter cette alerte » des e-mails marche sans connexion (jeton de l'alerte).
 */
import { formaterPrix } from "./format";
import { trouver } from "./choix-lieu";
import { adresseListe, avancesDe, AVANCES_VIDES, chiffres, lireAdresse, RECHERCHE_VIDE, titreRecherche, type EtatRecherche } from "./recherche";
import { aLaJournee, auMois, cleType, reglesPour, typesProposes } from "./regles-biens";
import { supabase } from "./supabase";

export type Frequence = "quotidienne" | "hebdomadaire";
export type Alerte = {
  id: string;
  nom: string;
  adresse: string;
  frequence: Frequence | "immediate";
  active: boolean;
  cree_le: string;
  dernier_envoi: string | null;
  /** v = 2 : réglée dans la fenêtre (choix : ce qui y a été choisi) ; sinon : critères de la recherche d'origine */
  criteres: Record<string, unknown>;
};

/** 10 alertes par compte (comme la base) */
export const ALERTES_MAX = 10;

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

/** La recherche d'une adresse de la liste (/annonces?…) */
export const rechercheDe = (adresse: string): EtatRecherche =>
  lireAdresse(new URLSearchParams(adresse.includes("?") ? adresse.slice(adresse.indexOf("?") + 1) : ""));

// ══ L'alerte réglée dans la fenêtre ══

/** Ce qui est choisi dans la fenêtre (gardé avec l'alerte, pour la modifier) */
export type ChoixAlerte = {
  tx: "location" | "achat" | null;
  /** location : au mois (ou à l'année) ou à la journée (ou à la nuit) */
  duree: "mois" | "jour";
  /** noms des types (« Appartement ») ; aucun : tous les biens */
  types: string[];
  lieu: string;
  /** budget en FCFA (chiffres) : plafond strict ; minimum facultatif */
  min: string;
  max: string;
  /** essentiel : pièces au moins */
  pieces: number | null;
  /** m² au moins (chiffres) : essentiel pour un terrain, un bureau ou un commerce ; souhait pour un logement */
  surface: string;
  /** essentiel (terrain) : titre foncier (ACD) */
  acd: boolean;
  /** souhaits */
  meuble: boolean;
  chambres: number | null;
  commodites: string[];
};

export const CHOIX_VIDE: ChoixAlerte = {
  tx: null, duree: "mois", types: [], lieu: "", min: "", max: "", pieces: null, surface: "", acd: false,
  meuble: false, chambres: null, commodites: [],
};

export const ACD = "Titre foncier (ACD)";
/** Types dont la surface est essentielle (elle compte pour l'usage et figure souvent sur les papiers) */
const SURFACE_ESSENTIELLE = ["Terrain", "Bureau", "Commerce / Magasin"];
const transaction = (c: ChoixAlerte) => (c.tx === "achat" ? "vente" : c.tx === "location" ? "location" : null);

/** Le plan d'alerte des types et de la transaction choisis : ce que la fenêtre propose, essentiel ou souhait */
export function planAlerte(c: ChoixAlerte) {
  const r = reglesPour(c.types, transaction(c));
  const terrain = c.types.includes("Terrain");
  const hotel = c.types.length > 0 && c.types.every((t) => t === "Chambre d'hôtel");
  return {
    /** location : durées possibles (une chambre d'hôtel : à la nuit seulement) */
    durees: (c.tx === "location" ? [...(auMois(r) ? ["mois"] : []), ...(aLaJournee(r) ? ["jour"] : [])] : []) as ChoixAlerte["duree"][],
    /** budget : « Loyer par mois », « Prix par nuit », « Prix de vente »… et son unité */
    budget: c.tx === "achat" ? "Prix de vente" : c.tx !== "location" ? "Budget"
      : c.duree === "jour" ? (hotel ? "Prix par nuit" : "Prix par jour") : "Loyer par mois",
    unite: c.tx !== "location" ? "" : c.duree === "jour" ? (hotel ? " / nuit" : " / jour") : " / mois",
    pieces: r.pieces,
    surface: (c.types.length > 0 && c.types.every((t) => SURFACE_ESSENTIELLE.includes(t)) ? "essentiel"
      : r.meubleToujours ? null : "souhait") as "essentiel" | "souhait" | null,
    /** « Superficie » (terrain) ou « Surface » */
    nomSurface: r.surface,
    acd: terrain,
    meuble: r.meuble && !r.meubleToujours,
    chambres: r.chambres,
    /** commodités souhaitables (le titre foncier, s'il est proposé, est un essentiel à part) */
    commodites: r.commodites.filter((x) => !(terrain && x === ACD)),
  };
}

/** Ne garde que ce qui a un sens pour les types et la transaction choisis */
export function choixValable(c: ChoixAlerte): ChoixAlerte {
  const types = c.types.filter((t) => typesProposes(transaction(c)).includes(t));
  const p = planAlerte({ ...c, types });
  const duree = p.durees.includes(c.duree) ? c.duree : (p.durees[0] ?? "mois");
  const plan = planAlerte({ ...c, types, duree });
  return {
    tx: c.tx, duree, types, lieu: c.lieu.trim().slice(0, 80),
    min: c.tx ? chiffres(c.min).slice(0, 12) : "", max: c.tx ? chiffres(c.max).slice(0, 12) : "",
    pieces: plan.pieces ? c.pieces : null,
    surface: plan.surface ? chiffres(c.surface).slice(0, 6) : "",
    acd: plan.acd && c.acd,
    meuble: plan.meuble && c.meuble,
    chambres: plan.chambres ? c.chambres : null,
    commodites: c.commodites.filter((x) => plan.commodites.includes(x)),
  };
}

/** Ce qui manque pour créer l'alerte (null : tout va bien) */
export function problemeAlerte(c: ChoixAlerte): string | null {
  if (!c.tx) return "Choisissez d'abord : louer ou acheter.";
  if (!c.lieu.trim() && !c.types.length && !chiffres(c.max) && !chiffres(c.min)) {
    return "Indiquez au moins un lieu, un type de bien ou un budget : sinon, toutes les annonces vous arriveraient.";
  }
  if (chiffres(c.min) && chiffres(c.max) && Number(chiffres(c.min)) > Number(chiffres(c.max))) {
    return "Le minimum dépasse le maximum : corrigez le budget.";
  }
  return null;
}

/** La fenêtre remplie d'après une recherche : pièces et surface deviennent « au moins », le titre foncier un essentiel */
export function choixDepuisRecherche(e: EtatRecherche): ChoixAlerte {
  const a = avancesDe(e);
  const pieces = a.pieces ? parseInt(a.pieces, 10) : NaN;
  return choixValable({
    tx: e.tx, duree: e.duree ?? "mois", types: e.types, lieu: e.lieu.trim() ? (trouver(e.lieu)?.texte ?? e.lieu.trim()) : "",
    min: e.min, max: e.max,
    pieces: pieces > 1 ? pieces : null,   // studio ou 1 pièce : peu importe
    surface: a.smin,
    // un terrain à acheter : titre foncier exigé d'office (on peut le décocher)
    acd: a.commodites.includes(ACD) || (e.tx === "achat" && e.types.length === 1 && e.types[0] === "Terrain"),
    meuble: a.meuble,
    chambres: a.chambres ? parseInt(a.chambres, 10) : null,
    commodites: a.commodites.filter((x) => x !== ACD),
  });
}

/** Les choix d'une alerte enregistrée (celles d'avant la fenêtre : d'après leur recherche) */
export function choixDe(a: Pick<Alerte, "adresse" | "criteres">): ChoixAlerte {
  const choix = a.criteres?.v === 2 ? (a.criteres.choix as Partial<ChoixAlerte> | undefined) : undefined;
  return choix ? choixValable({ ...CHOIX_VIDE, ...choix }) : choixDepuisRecherche(rechercheDe(a.adresse));
}

const etatDe = (c: ChoixAlerte): EtatRecherche => ({
  ...RECHERCHE_VIDE, tx: c.tx, duree: c.tx === "location" ? c.duree : null, types: c.types, lieu: c.lieu, min: c.min, max: c.max,
  avances: { ...AVANCES_VIDES, smin: planAlerte(c).surface === "essentiel" ? c.surface : "" },
});

/** Nom, adresse (« Voir les annonces » ; une alerte par adresse et par compte) et critères pour la base */
export function construireAlerte(choix: ChoixAlerte): { nom: string; adresse: string; criteres: Record<string, unknown> } {
  const c = choixValable(choix);
  const p = planAlerte(c);
  const e = etatDe(c);
  // Adresse de la liste ; pièces au moins et titre foncier en plus (la liste ne les filtre pas : elle en montre davantage)
  const q = new URLSearchParams(adresseListe(e).split("?")[1] ?? "");
  if (c.pieces) q.set("pmin", String(c.pieces));
  if (c.acd) q.set("acd", "1");
  const k: Record<string, unknown> = { v: 2, tx: c.tx };
  if (c.tx === "location") k.duree = c.duree;
  const types = c.types.map(cleType).filter(Boolean);
  if (types.length) k.types = types;
  if (c.lieu) {
    const l = trouver(c.lieu);
    if (!l) k.texte = c.lieu;
    else {
      k.ville = l.ville;
      if (l.commune) k.commune = l.commune;
      if (l.quartier) k.quartier = l.quartier;
    }
  }
  if (c.min) k.min = Number(c.min);
  if (c.max) k.max = Number(c.max);
  if (c.pieces) k.pieces_min = c.pieces;
  if (p.surface === "essentiel" && c.surface) k.surface_min = Number(c.surface);
  if (c.acd) k.acd = true;
  const souhaits: Record<string, unknown> = {};
  if (c.meuble) souhaits.meuble = true;
  if (c.chambres) souhaits.chambres = c.chambres;
  if (p.surface === "souhait" && c.surface) souhaits.surface = Number(c.surface);
  if (c.commodites.length) souhaits.com = c.commodites;
  k.souhaits = souhaits;
  k.choix = c;
  return { nom: titreRecherche(e).slice(0, 80), adresse: `/annonces?${q}`, criteres: k };
}

/** Essentiels et souhaits en clair : « Location au mois », « 150 000 FCFA max / mois », « 3 pièces et + »… */
export function resumeAlerte(choix: ChoixAlerte): { essentiels: string[]; souhaits: string[] } {
  const c = choixValable(choix);
  const p = planAlerte(c);
  const essentiels: string[] = [];
  if (c.tx === "location") essentiels.push(c.duree === "jour" ? "Location à la journée" : "Location au mois");
  if (c.types.length > 1) essentiels.push(c.types.join(", "));
  const min = Number(c.min), max = Number(c.max), f = formaterPrix;
  if (min && max) essentiels.push(`${f(min)} à ${f(max)} FCFA${p.unite}`);
  else if (max) essentiels.push(`${f(max)} FCFA max${p.unite}`);
  else if (min) essentiels.push(`À partir de ${f(min)} FCFA${p.unite}`);
  if (c.pieces) essentiels.push(`${c.pieces} pièces et +`);
  if (p.surface === "essentiel" && c.surface) essentiels.push(`${f(Number(c.surface))} m² et +`);
  if (c.acd) essentiels.push(ACD);
  const souhaits: string[] = [];
  if (c.meuble) souhaits.push("Meublé");
  if (c.chambres) souhaits.push(`${c.chambres} chambre${c.chambres > 1 ? "s" : ""} et +`);
  if (p.surface === "souhait" && c.surface) souhaits.push(`${f(Number(c.surface))} m² et +`);
  souhaits.push(...c.commodites);
  return { essentiels, souhaits };
}

/** Crée l'alerte ; « existe » si le compte a déjà une alerte avec ces essentiels */
export async function creerAlerte(choix: ChoixAlerte, frequence: Frequence = "quotidienne"): Promise<{ resultat: "creee" | "existe"; nom: string }> {
  const a = construireAlerte(choix);
  const { error } = await client().from("alertes").insert({ ...a, frequence });
  if (error?.code === "23505") return { resultat: "existe", nom: a.nom };
  if (error) throw error;
  return { resultat: "creee", nom: a.nom };
}

export async function mesAlertes(): Promise<Alerte[]> {
  const { data, error } = await client()
    .from("alertes")
    .select("id, nom, adresse, frequence, active, cree_le, dernier_envoi, criteres")
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return data as Alerte[];
}

export async function modifierAlerte(id: string, champs: Partial<Pick<Alerte, "frequence" | "active" | "nom" | "adresse" | "criteres">>) {
  const { error } = await client().from("alertes").update(champs).eq("id", id);
  if (error?.code === "23505") throw new Error("Vous avez déjà une autre alerte avec ces critères : modifiez plutôt celle-là.");
  if (error) throw error;
}

export async function supprimerAlerte(id: string) {
  const { error } = await client().from("alertes").delete().eq("id", id);
  if (error) throw error;
}

/** Lien des e-mails : l'alerte de ce jeton (null : lien plus valable) */
export async function alerteParJeton(jeton: string): Promise<{ nom: string; active: boolean; adresse: string } | null> {
  const { data, error } = await client().rpc("alerte_par_jeton", { jeton });
  if (error) {
    if (error.code === "22P02") return null; // jeton mal écrit
    throw error;
  }
  return data as { nom: string; active: boolean; adresse: string } | null;
}

export async function arreterAlerte(jeton: string): Promise<boolean> {
  const { data, error } = await client().rpc("arreter_alerte", { jeton });
  if (error) throw error;
  return data as boolean;
}

// ── Alerte réglée sans compte : gardée le temps de se connecter ──
const CLE_ATTENTE = "360-immo-alerte-en-attente";
/** page : la recherche du bouton « Créer une alerte » qui la créera au retour */
export type AlerteEnAttente = { page: string; choix: ChoixAlerte; frequence: Frequence };
export function garderAlerteEnAttente(a: AlerteEnAttente | null) {
  try {
    if (a === null) sessionStorage.removeItem(CLE_ATTENTE);
    else sessionStorage.setItem(CLE_ATTENTE, JSON.stringify(a));
  } catch {
    // navigation privée : l'alerte sera à redemander après la connexion
  }
}
export function alerteEnAttente(): AlerteEnAttente | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(CLE_ATTENTE) ?? "null") as AlerteEnAttente | null;
    return a && typeof a.page === "string" && a.choix ? { ...a, choix: choixValable({ ...CHOIX_VIDE, ...a.choix }) } : null;
  } catch {
    return null;
  }
}
