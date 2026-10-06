"use client";

/*
 * Demandes de visite (fonctions de supabase/migrations/…_visites.sql). Possibles sans compte : nom, téléphone, créneau.
 * L'annonceur confirme, propose un autre créneau ou refuse (Mon Espace → Visites) ; un demandeur avec un compte y suit
 * ses demandes et accepte le créneau proposé.
 * Créneaux : les 7 jours qui suivent, à 9 h, 11 h, 14 h, 16 h et 18 h (heure d'Abidjan, qui est aussi l'heure UTC).
 */
import { relancerEmails } from "./relance-emails";
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

export { FUSEAU, HEURES, creneauDe, joursProposes, passe, texteCreneau, texteJour } from "./creneaux";

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
  relancerEmails();
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
  relancerEmails();
}
