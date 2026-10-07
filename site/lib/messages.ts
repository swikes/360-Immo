"use client";

/*
 * Messages entre une personne intéressée et l'annonceur (fonctions de supabase/migrations/…_favoris_messages.sql).
 * Une conversation par annonce et par personne intéressée ; l'autre personne apparaît sous un nom discret.
 * Le nombre de messages non lus (pastille du menu) est relu toutes les minutes et quand on revient sur la page.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useCompte } from "./compte";
import { relancerEmails } from "./relance-emails";
import { supabase } from "./supabase";

export type Conversation = {
  id: string;
  /** client : on a écrit à l'annonceur ; annonceur : quelqu'un a écrit à propos d'une de ses annonces */
  role: "client" | "annonceur";
  annonce: { id: string; reference: string; titre: string; photo: string | null; en_ligne: boolean };
  /** l'autre personne : « Awa K. », ou le nom de l'agence */
  autre: string;
  dernier: { contenu: string; cree_le: string; de_moi: boolean } | null;
  non_lus: number;
};

export type Message = { id: string; auteur_id: string; contenu: string; lu_le: string | null; cree_le: string };

/** Longueur d'un message (comme la base) */
export const LONGUEUR_MAX = 2000;

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

/** Message à l'annonceur d'une annonce (la conversation s'ouvre au premier) ; renvoie la conversation */
export async function ecrireAnnonceur(annonce: string, contenu: string): Promise<string> {
  const { data, error } = await client().rpc("ecrire_annonceur", { annonce, contenu: contenu.trim() });
  if (error) throw error;
  rafraichirNonLus();
  relancerEmails();
  return data as string;
}

export async function mesConversations(): Promise<Conversation[]> {
  const { data, error } = await client().rpc("mes_conversations");
  if (error) throw error;
  return data as Conversation[];
}

export async function lireMessages(conversation: string): Promise<Message[]> {
  const { data, error } = await client()
    .from("messages")
    .select("id, auteur_id, contenu, lu_le, cree_le")
    .eq("conversation_id", conversation)
    .order("cree_le", { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function repondre(conversation: string, contenu: string) {
  const { error } = await client().from("messages").insert({ conversation_id: conversation, contenu: contenu.trim() });
  if (error) throw error;
  relancerEmails();
}

/** Les messages reçus de la conversation sont lus */
export async function marquerLus(conversation: string) {
  const { data, error } = await client().rpc("marquer_lus", { conversation });
  if (error) throw error;
  if ((data as number) > 0) rafraichirNonLus();
}

// ── Ce qui attend le compte (messages non lus, visites à traiter, rappels à faire), partagé par la barre du haut et Mon Espace ──
/** moderation : pour l'équipe 360-Immo.ci, annonces à vérifier et annonces signalées (0 pour les autres comptes) */
export type Compteurs = { messages: number; visites: number; rappels: number; moderation: number };
const ZERO: Compteurs = { messages: 0, visites: 0, rappels: 0, moderation: 0 };
let compteurs: Compteurs = ZERO;
let compteSuivi: string | null = null;
const abonnes = new Set<() => void>();

async function relire() {
  const sb = supabase();
  const compte = compteSuivi;
  if (!sb || !compte) return;
  const { data, error } = await sb.rpc("compteurs");
  if (error || compte !== compteSuivi) return;
  compteurs = { ...ZERO, ...(data as Partial<Compteurs>) };
  abonnes.forEach((f) => f());
}

/** À appeler après avoir lu ou envoyé des messages, ou répondu à une demande de visite */
export function rafraichirNonLus() {
  void relire();
}

const sAbonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

/** Messages non lus, visites à traiter, rappels à faire (relus par la barre du haut, présente sur toutes les pages) */
export function useCompteurs(): Compteurs {
  return useSyncExternalStore(sAbonner, () => compteurs, () => ZERO);
}

/** Nombre de messages non lus */
export const useNonLus = (): number => useCompteurs().messages;

/** Barre du haut : relit les compteurs à la connexion, toutes les minutes et au retour sur la page */
export function useSuiviCompteurs(): Compteurs {
  const { etat, utilisateur } = useCompte();
  const id = etat === "connecte" ? (utilisateur?.id ?? null) : null;
  useEffect(() => {
    compteSuivi = id;
    compteurs = ZERO;
    abonnes.forEach((f) => f());
    if (!id) return;
    void relire();
    const releve = () => document.visibilityState === "visible" && void relire();
    const minute = window.setInterval(releve, 60_000);
    document.addEventListener("visibilitychange", releve);
    return () => {
      window.clearInterval(minute);
      document.removeEventListener("visibilitychange", releve);
    };
  }, [id]);
  return useCompteurs();
}

/** Heure d'un message : « 14:32 » aujourd'hui, « Hier », « lundi » dans la semaine, sinon « 12 sept. » */
export function quand(d: string, maintenant = new Date()): string {
  const date = new Date(d);
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(date)) / 86_400_000);
  if (ecart <= 0) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (ecart === 1) return "Hier";
  if (ecart < 7) return date.toLocaleDateString("fr-FR", { weekday: "long" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Sur téléphone (écran tactile), Entrée passe à la ligne ; sur ordinateur, Entrée envoie (Maj + Entrée : à la ligne) */
export const entreeEnvoie = () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;
