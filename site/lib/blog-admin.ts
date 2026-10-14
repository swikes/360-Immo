"use client";

/*
 * Onglet « Blog » de l'Administration : articles (supabase/migrations/…_blog.sql) et photos de couverture
 * (dossier public « blog »). La base vérifie elle-même que le compte est de l'équipe.
 */
import type { ArticleAdmin, Categorie } from "./blog";
import { reduirePhoto, taille } from "./photos";
import { supabase } from "./supabase";

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

async function rpc<T>(fonction: string, parametres?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fonction, parametres);
  if (error) throw error;
  return data as T;
}

/** Ce que l'éditeur envoie (sans id : nouvel article) */
export type ArticleAEnregistrer = {
  id?: string; titre: string; resume: string; categorie: Categorie; contenu: string; couverture: string | null;
  auteur_nom: string; auteur_fonction: string; a_la_une: boolean; notes: string; slug?: string;
};

export const articlesAdmin = () => rpc<ArticleAdmin[]>("admin_articles");
export const enregistrerArticle = (article: ArticleAEnregistrer) => rpc<ArticleAdmin>("enregistrer_article", { article });
export const publierArticle = (article: string, publier: boolean) => rpc<ArticleAdmin>("publier_article", { article, publier });
/** Supprime l'article, puis sa photo de couverture */
export async function supprimerArticle(article: string): Promise<void> {
  const couverture = await rpc<string | null>("supprimer_article", { article });
  if (couverture) await supprimerCouverture(couverture);
}

const COTE_COUVERTURE = 1600;
const TAILLE_MAX = 5 * 1024 * 1024;

/** Photo choisie → réduite (1600 pixels au plus) → envoyée dans le dossier « blog » (<article>/…) ; renvoie son chemin */
export async function envoyerCouverture(fichier: File, article: string): Promise<string> {
  const pret = await reduirePhoto(fichier, COTE_COUVERTURE);
  if (pret.blob.size > TAILLE_MAX) throw new Error(`« ${fichier.name} » est trop lourde (${taille(pret.blob.size)}) : 5 Mo au plus.`);
  const chemin = `${article}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${pret.extension}`;
  const { error } = await client().storage.from("blog").upload(chemin, pret.blob, { contentType: pret.type, cacheControl: "31536000" });
  if (error) throw error;
  return chemin;
}

/** Supprime une photo de couverture qui ne sert plus (sans erreur si elle n'existe déjà plus) */
export async function supprimerCouverture(chemin: string): Promise<void> {
  await client().storage.from("blog").remove([chemin]).catch(() => undefined);
}

/**
 * Demande au site de rafraîchir aussitôt la liste du blog et ces articles (sinon : 10 minutes au plus,
 * app/blog/[article]/page.tsx). Sans conséquence si le rafraîchissement échoue.
 */
export async function rafraichirBlog(slugs: string[]): Promise<void> {
  try {
    const { data } = await client().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/blog", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` }, body: JSON.stringify({ slugs }),
    });
  } catch {
    // les pages se mettront à jour d'elles-mêmes
  }
}
