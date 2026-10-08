/*
 * Lecture des annonces en ligne dans la base, côté serveur : recherche (liste des annonces), fiche d'un bien,
 * biens similaires, nombres de l'accueil, plan du site (fonctions de supabase/migrations/…_recherche.sql).
 * Les pages arrivent ainsi déjà remplies : rapide en 3G, et lisible par Google.
 * Les numéros de l'annonceur n'y sont pas : ils se demandent un par un (bouton « Afficher le numéro »).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { CarteAnnonce, FicheAnnonce, Resultats, Vitrine } from "./annonces-en-ligne";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;
function base(): SupabaseClient | null {
  if (client === undefined) {
    client = URL_BASE && CLE
      ? createClient(URL_BASE, CLE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      : null;
  }
  return client;
}

/** Appelle une fonction de la base ; erreur si la base ne répond pas */
async function appeler<T>(fonction: string, args: Record<string, unknown> = {}): Promise<T> {
  const sb = base();
  if (!sb) throw new Error("Base non configurée");
  const { data, error } = await sb.rpc(fonction, args);
  if (error) throw new Error(`${fonction} : ${error.message}`);
  return data as T;
}

/** Une page d'annonces pour ces critères (voir lib/recherche.ts : criteresBase) */
export async function rechercher(criteres: Record<string, unknown>): Promise<Resultats> {
  return appeler<Resultats>("rechercher_annonces", { criteres });
}

/** La fiche d'un bien (null s'il n'est pas, ou plus, en ligne) ; lue une fois par page (titre et contenu) */
export const lireFiche = cache(async (reference: string): Promise<FicheAnnonce | null> =>
  appeler<FicheAnnonce | null>("annonce_publique", { numero: reference }));

export async function similaires(annonce: string, nombre = 3): Promise<CarteAnnonce[]> {
  return appeler<CarteAnnonce[]>("annonces_similaires", { annonce, nombre });
}

export async function chiffres(): Promise<{ total: number; par_ville: Record<string, number> }> {
  return appeler("chiffres_annonces");
}

/** Accueil : agences vérifiées qui ont des annonces en ligne (supabase/migrations/…_comptes_agences.sql) */
export async function agencesPartenaires(): Promise<{ nom: string; annonces: number; logo?: string | null; vitrine: { code: string; nom: string } | null }[]> {
  return appeler("agences_partenaires", { nombre: 10 });
}

/** Fiche : logo de l'agence vérifiée qui publie l'annonce (chemin dans le dossier « logos »), ou null */
export async function logoAnnonceur(annonce: string): Promise<string | null> {
  return appeler<string | null>("logo_annonceur", { annonce });
}

export async function planDuSite(): Promise<{ reference: string; titre: string; publiee_le: string }[]> {
  return appeler("plan_du_site");
}

/** En-tête d'une vitrine (null si le code n'existe pas) ; lu une fois par page */
export const lireVitrine = cache(async (code: string): Promise<Vitrine | null> => appeler<Vitrine | null>("vitrine", { code }));
