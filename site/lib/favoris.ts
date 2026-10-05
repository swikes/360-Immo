"use client";

/*
 * Favoris du compte connecté. La liste (annonces mises de côté, la plus récente d'abord) est lue une fois, puis
 * partagée par tous les cœurs de la page (cartes, fiche) et par Mon Espace → Mes favoris.
 * Sans compte, le cœur propose de se connecter : l'annonce est retenue le temps de la connexion, puis ajoutée.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { CarteAnnonce } from "./annonces-en-ligne";
import { useCompte } from "./compte";
import { supabase } from "./supabase";

type Etat = { compte: string | null; ids: readonly string[]; pret: boolean };
const VIDE: Etat = { compte: null, ids: [], pret: false };
let etat: Etat = VIDE;
const abonnes = new Set<() => void>();
const changer = (e: Partial<Etat>) => {
  etat = { ...etat, ...e };
  abonnes.forEach((f) => f());
};

const EN_ATTENTE = "360-immo-favori-en-attente";

/** Sans compte : l'annonce à ajouter aux favoris après la connexion */
export function retenirFavori(annonce: string) {
  try {
    sessionStorage.setItem(EN_ATTENTE, annonce);
  } catch {
    // navigation privée : tant pis, il faudra retoucher le cœur
  }
}

function enAttente(): string | null {
  try {
    const id = sessionStorage.getItem(EN_ATTENTE);
    sessionStorage.removeItem(EN_ATTENTE);
    return id;
  } catch {
    return null;
  }
}

async function charger(compte: string) {
  const sb = supabase();
  if (!sb) return;
  const { data, error } = await sb.from("favoris").select("annonce_id").order("cree_le", { ascending: false });
  if (etat.compte !== compte) return; // déconnecté ou autre compte entre-temps
  let ids = error ? [] : (data as { annonce_id: string }[]).map((f) => f.annonce_id);
  const attente = enAttente();
  if (attente && !ids.includes(attente)) {
    const r = await sb.from("favoris").insert({ annonce_id: attente });
    if (!r.error || r.error.code === "23505") ids = [attente, ...ids];
  }
  if (etat.compte === compte) changer({ ids, pret: true });
}

function suivre(compte: string | null) {
  if (compte === etat.compte) return;
  changer({ ...VIDE, compte });
  if (compte) void charger(compte);
}

/** Ajoute ou retire une annonce des favoris (tout de suite à l'écran ; revient en arrière si la base refuse) */
async function basculer(annonce: string) {
  const sb = supabase();
  if (!sb || !etat.compte) return;
  const avant = etat.ids;
  const ajout = !avant.includes(annonce);
  changer({ ids: ajout ? [annonce, ...avant] : avant.filter((x) => x !== annonce) });
  const r = ajout
    ? await sb.from("favoris").insert({ annonce_id: annonce })
    : await sb.from("favoris").delete().eq("annonce_id", annonce);
  if (r.error && r.error.code !== "23505") changer({ ids: avant });
}

export function useFavoris() {
  const { etat: compte, utilisateur } = useCompte();
  const id = compte === "connecte" ? (utilisateur?.id ?? null) : null;
  useEffect(() => {
    if (compte !== "chargement") suivre(id);
  }, [compte, id]);
  const e = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
    () => VIDE,
  );
  const actuel = e.compte === id ? e : VIDE;
  return {
    /** état de la connexion : « connecte », « anonyme », « chargement », « indisponible » */
    compte,
    ids: actuel.ids,
    pret: actuel.pret,
    est: (annonce: string) => actuel.ids.includes(annonce),
    basculer,
  };
}

/** Annonce mise de côté, telle que la base la renvoie : carte si elle est en ligne, sinon son titre seulement */
export type Favori =
  | (CarteAnnonce & { en_ligne: true })
  | { id: string; reference: string; titre: string; en_ligne: false };

/** Cartes des annonces demandées, dans l'ordre (fonction cartes_annonces de la base) */
export async function cartesFavoris(ids: readonly string[]): Promise<Favori[]> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  if (!ids.length) return [];
  const { data, error } = await sb.rpc("cartes_annonces", { ids });
  if (error) throw error;
  return data as Favori[];
}
