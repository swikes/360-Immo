"use client";

/*
 * Demandes de visite (fonctions de supabase/migrations/…_visites.sql). Possibles sans compte : nom, téléphone, créneau.
 * L'annonceur confirme, propose un autre créneau ou refuse (Mon Espace → Visites) ; un demandeur avec un compte y suit
 * ses demandes et accepte le créneau proposé.
 * Créneaux : les 7 jours qui suivent, à 9 h, 11 h, 14 h, 16 h et 18 h (heure d'Abidjan, qui est aussi l'heure UTC).
 */
import { supabase } from "./supabase";

export type Visite = {
  id: string;
  /** annonceur : demande reçue sur une de ses annonces ; demandeur : demande envoyée */
  role: "annonceur" | "demandeur";
  annonce: { id: string; reference: string; titre: string; photo: string | null; en_ligne: boolean };
  creneau: string;
  /** autre créneau proposé par l'annonceur, en attente de l'accord du demandeur */
  creneau_propose: string | null;
  statut: "demandee" | "confirmee" | "annulee" | "effectuee";
  annulee_par: "annonceur" | "demandeur" | null;
  message: string | null;
  reponse: string | null;
  cree_le: string;
  /** côté annonceur : les coordonnées laissées pour être rappelé */
  nom: string | null;
  telephone: string | null;
  email: string | null;
  avec_compte: boolean;
  /** côté demandeur : l'annonceur, sous son nom discret */
  annonceur: string | null;
};

export type Action = "confirmer" | "proposer" | "refuser" | "accepter" | "annuler";

export const HEURES = [9, 11, 14, 16, 18];
export const FUSEAU = "Africa/Abidjan";

/** Les 7 jours qui suivent (à partir de demain), en « AAAA-MM-JJ » */
export function joursProposes(nombre = 7, maintenant = Date.now()): string[] {
  return Array.from({ length: nombre }, (_, i) => new Date(maintenant + (i + 1) * 86_400_000).toISOString().slice(0, 10));
}

/** « 2026-10-11 » + 9 → « 2026-10-11T09:00:00.000Z » (heure d'Abidjan = heure UTC) */
export const creneauDe = (jour: string, heure: number) => `${jour}T${String(heure).padStart(2, "0")}:00:00.000Z`;

/** « samedi 11 octobre à 09:00 » */
export function texteCreneau(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });
  return `${jour} à ${heure}`;
}

/** « sam. 11 oct. » (choix du jour) */
export const texteJour = (jour: string) =>
  new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: FUSEAU });

/** Le créneau est-il passé ? */
export const passe = (iso: string, maintenant = Date.now()) => new Date(iso).getTime() < maintenant;

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

/** Créneaux déjà confirmés pour ce bien (grisés) */
export async function creneauxPris(annonce: string): Promise<string[]> {
  const { data, error } = await client().rpc("creneaux_pris", { annonce });
  if (error) throw error;
  return (data as string[]).map((c) => new Date(c).toISOString());
}

export type Demande = { nom: string; telephone: string; email: string; message: string; creneau: string };

/** Envoie une demande de visite (avec ou sans compte) */
export async function demanderVisite(annonce: string, d: Demande) {
  const { error } = await client().from("visites").insert({
    annonce_id: annonce, nom: d.nom.trim(), telephone: d.telephone, email: d.email.trim() || null,
    message: d.message.trim() || null, creneau: d.creneau,
  });
  if (error) throw error;
}

export async function mesVisites(): Promise<Visite[]> {
  const { data, error } = await client().rpc("mes_visites");
  if (error) throw error;
  return data as Visite[];
}

export async function repondreVisite(visite: string, action: Action, creneau: string | null = null, reponse = "") {
  const { error } = await client().rpc("repondre_visite", {
    visite, action, le_creneau: creneau, la_reponse: reponse.trim() || null,
  });
  if (error) throw error;
}
