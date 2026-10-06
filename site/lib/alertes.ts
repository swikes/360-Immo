"use client";

/*
 * Alertes de recherche (table alertes ; envoi chaque matin : supabase/migrations/…_alertes_emails.sql) :
 * une recherche de la liste des annonces, gardée par le compte ; ses nouvelles annonces arrivent par e-mail, chaque
 * jour ou chaque semaine. Sans compte, l'alerte demandée est gardée le temps de se connecter, puis créée.
 * Le lien « Arrêter cette alerte » des e-mails marche sans connexion (jeton de l'alerte).
 */
import { adresseAlerte, criteresAlerte, lireAdresse, rechercheVide, titreRecherche, type EtatRecherche } from "./recherche";
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

/** Une recherche sans critère ne fait pas une alerte (toutes les annonces) */
export const alertePossible = (adresse: string) => !rechercheVide(rechercheDe(adresse));

/** Crée l'alerte de cette recherche ; « existe » si le compte l'a déjà */
export async function creerAlerte(adresse: string, frequence: Frequence = "quotidienne"): Promise<"creee" | "existe"> {
  const e = rechercheDe(adresse);
  const { error } = await client().from("alertes").insert({
    nom: titreRecherche(e).slice(0, 80), adresse: adresseAlerte(e), criteres: criteresAlerte(e), frequence,
  });
  if (error?.code === "23505") return "existe";
  if (error) throw error;
  return "creee";
}

export async function mesAlertes(): Promise<Alerte[]> {
  const { data, error } = await client()
    .from("alertes")
    .select("id, nom, adresse, frequence, active, cree_le, dernier_envoi")
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return data as Alerte[];
}

export async function modifierAlerte(id: string, champs: Partial<Pick<Alerte, "frequence" | "active">>) {
  const { error } = await client().from("alertes").update(champs).eq("id", id);
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

// ── Alerte demandée sans compte : gardée le temps de se connecter ──
const CLE_ATTENTE = "360-immo-alerte-en-attente";
export function garderAlerteEnAttente(adresse: string | null) {
  try {
    if (adresse === null) sessionStorage.removeItem(CLE_ATTENTE);
    else sessionStorage.setItem(CLE_ATTENTE, adresse);
  } catch {
    // navigation privée : l'alerte sera à redemander après la connexion
  }
}
export function alerteEnAttente(): string | null {
  try {
    return sessionStorage.getItem(CLE_ATTENTE);
  } catch {
    return null;
  }
}
