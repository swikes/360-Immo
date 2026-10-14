/*
 * Lecture des annonces en ligne dans la base, côté serveur : recherche (liste des annonces), fiche d'un bien,
 * biens similaires, nombres de l'accueil, plan du site (fonctions de supabase/migrations/…_recherche.sql) ;
 * prix du marché : carte des prix, page d'une commune (…_prix_marche.sql) ; articles publiés du blog (…_blog.sql) ;
 * pages du pied de page (…_pages_contact.sql).
 * Les pages arrivent ainsi déjà remplies : rapide en 3G, et lisible par Google.
 * Les numéros de l'annonceur n'y sont pas : ils se demandent un par un (bouton « Afficher le numéro »).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { CarteAnnonce, FicheAnnonce, Resultats, Vitrine } from "./annonces-en-ligne";
import type { Article, ResumeArticle } from "./blog";
import type { AdressePage, PagePublique } from "./pages-site";
import type { PageCommune, PrixCommune } from "./prix-marche";

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

// ── Prix du marché (supabase/migrations/…_prix_marche.sql, lib/prix-marche.ts) ──

/** Carte des prix : un type de bien, commune par commune */
export async function prixCommunes(choix: { transaction: "vente" | "location"; type_bien: string; unite: string; pieces?: number | null; meuble?: boolean | null }): Promise<PrixCommune[]> {
  return appeler<PrixCommune[]>("prix_communes", { choix });
}

/** Page d'une commune : tous les types de bien (null si la commune est inconnue) */
export const prixCommune = cache(async (ville: string, commune: string): Promise<PageCommune | null> =>
  appeler<PageCommune | null>("prix_commune", { ville, commune }));

/** Communes qui ont au moins un prix (plan du site) */
export async function communesAvecPrix(): Promise<{ ville: string; commune: string }[]> {
  return appeler("communes_avec_prix");
}

// ── Blog (supabase/migrations/…_blog.sql, lib/blog.ts) ──

/** Articles publiés, les plus récents d'abord (sans leur texte) */
export async function articlesBlog(): Promise<ResumeArticle[]> {
  return appeler<ResumeArticle[]>("blog_articles", { categorie: null, nombre: 200 });
}

/** Un article publié, avec son texte et « À lire aussi » (null s'il n'existe pas ou n'est pas publié) ; lu une fois par page */
export const lireArticle = cache(async (slug: string): Promise<Article | null> => appeler<Article | null>("blog_article", { adresse: slug }));

// ── Pages du pied de page (supabase/migrations/…_pages_contact.sql, lib/pages-site.ts) ──

/** Une page publiée (null : en brouillon) ; lue une fois par page (titre et contenu) */
export const lirePage = cache(async (slug: AdressePage): Promise<PagePublique | null> => appeler<PagePublique | null>("page_site", { adresse: slug }));

/** Pages publiées (plan du site) */
export async function pagesPubliees(): Promise<{ slug: AdressePage; modifie_le: string }[]> {
  return appeler("pages_publiees");
}
