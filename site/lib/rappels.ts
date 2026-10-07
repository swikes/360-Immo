"use client";

/*
 * « Être rappelé » (fonctions de supabase/migrations/…_rappels.sql) : sur la fiche d'un bien, avec ou sans compte,
 * on laisse son nom, son numéro et le moment où l'on préfère être appelé. L'annonceur retrouve la demande dans
 * Mon Espace → Rappels (et la reçoit par e-mail), appelle, puis la marque « rappelé ». Un demandeur avec un compte
 * suit sa demande et peut l'annuler.
 */
import { relancerEmails } from "./relance-emails";
import { supabase } from "./supabase";
import type { MomentRappel } from "./creneaux";

export { MOMENTS_RAPPEL, texteMoment, type MomentRappel } from "./creneaux";

export type Rappel = {
  id: string;
  /** annonceur : demande reçue ; demandeur : demande envoyée */
  role: "annonceur" | "demandeur";
  annonce: { id: string; reference: string; titre: string; en_ligne: boolean };
  nom: string;
  /** côté annonceur seulement */
  telephone: string | null;
  moment: MomentRappel;
  message: string | null;
  statut: "a_rappeler" | "rappele" | "annule";
  cree_le: string;
  traite_le: string | null;
  avec_compte: boolean;
  /** côté demandeur : l'annonceur, sous son nom discret */
  annonceur: string | null;
};

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

export type DemandeRappel = { nom: string; telephone: string; moment: MomentRappel; message: string };

export async function demanderRappel(annonce: string, d: DemandeRappel) {
  const { error } = await client().from("rappels").insert({
    annonce_id: annonce, nom: d.nom.trim(), telephone: d.telephone, moment: d.moment, message: d.message.trim() || null,
  });
  if (error) throw error;
  relancerEmails();
}

export async function mesRappels(): Promise<Rappel[]> {
  const { data, error } = await client().rpc("mes_rappels");
  if (error) throw error;
  return data as Rappel[];
}

/** fait : rappelé (annonceur) ; a_faire : de nouveau à rappeler (annonceur) ; annuler (demandeur) */
export async function traiterRappel(rappel: string, action: "fait" | "a_faire" | "annuler") {
  const { error } = await client().rpc("traiter_rappel", { rappel, action });
  if (error) throw error;
}
