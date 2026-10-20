"use client";

/*
 * Offres payantes des annonceurs (étape 8a) : remonter une annonce, pack de 3 remontées, Premium 30 jours.
 * Règles et prix : supabase/migrations/…_offres.sql (document « Offre commerciale »).
 * Payer : la base enregistre le paiement « en attente » (commencer_paiement), puis le serveur du site renvoie la
 * page où payer (app/api/paiements/payer) ; l'offre s'applique quand l'agrégateur confirme le paiement.
 * Les offres ne s'affichent que si le paiement est réglé (NEXT_PUBLIC_PAIEMENTS, lib/paiements-serveur.ts).
 */
import type { Annonce } from "./annonces";
import { supabase } from "./supabase";

/** Le paiement est-il ouvert sur ce site ? (sinon : rien n'est proposé) */
export const PAIEMENTS_OUVERTS = Boolean(process.env.NEXT_PUBLIC_PAIEMENTS?.trim());
/** Paiement imité pour les essais (jamais sur le site en ligne) */
export const PAIEMENT_SIMULE = process.env.NEXT_PUBLIC_PAIEMENTS?.trim() === "simulation";

export type CleOffre = "remontee" | "remontees_3" | "premium_30";
export type Offre = { cle: CleOffre; nom: string; prix: number; remontees: number; jours_premium: number; ordre: number };
export type StatutPaiement = "en_attente" | "payee" | "echouee" | "remboursee";
export type Paiement = {
  id: string; reference: string; offre: CleOffre; nom: string; montant: number; statut: StatutPaiement;
  annonce: { reference?: string; titre?: string }; resultat: string | null; erreur: string | null; moyen?: string | null;
  cree_le: string; payee_le: string | null; remboursee_le?: string | null;
};
export type MesOffres = {
  tarifs: Offre[];
  /** remontées payées d'avance, et la date de fin de la plus proche */
  remontees: number; remontees_fin: string | null;
  /** jours Premium gardés (bien vendu, loué, retiré…) */
  jours_premium: number;
  programmees: { annonce: string; prochaine: string; tous_les: number }[];
  paiements: Paiement[];
};

/** Prix affichés tant que la base n'a pas répondu (les vrais sont dans la table « offres ») */
export { TARIFS } from "./offres-tarifs";

export const STATUTS_PAIEMENT: Record<StatutPaiement, string> = {
  en_attente: "En attente", payee: "Payé", echouee: "Échoué", remboursee: "Remboursé",
};

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

export async function mesOffres(): Promise<MesOffres> {
  const { data, error } = await client().rpc("mes_offres");
  if (error) throw error;
  return data as MesOffres;
}

/** Un de ses paiements (page de retour) */
export async function monPaiement(id: string): Promise<Paiement | null> {
  const { data, error } = await client().rpc("mon_paiement", { paiement: id });
  if (error) throw error;
  return (data as Paiement | null) ?? null;
}

/** Commence le paiement puis ouvre la page où payer (Mobile Money) */
export async function payer(offre: CleOffre, annonce: string | null, automatique = false): Promise<void> {
  const { data, error } = await client().rpc("commencer_paiement", { offre, annonce, automatique });
  if (error) throw error;
  const r = await fetch("/api/paiements/payer", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paiement: (data as { id: string }).id }),
  });
  const corps = (await r.json().catch(() => null)) as { url?: string; message?: string } | null;
  // (message du serveur, déjà en français : affiché tel quel par messageErreur)
  if (!r.ok || !corps?.url) {
    throw Object.assign(new Error(corps?.message || "Le paiement ne peut pas commencer pour l'instant. Réessayez dans un moment."), { code: "P0001" });
  }
  window.location.assign(corps.url);
}

/** Une remontée payée d'avance ; automatique : les suivantes tous les 3 jours. Renvoie le nombre restant. */
export async function utiliserRemontee(annonce: string, automatique = false): Promise<number> {
  const { data, error } = await client().rpc("utiliser_remontee", { annonce, automatique });
  if (error) throw error;
  return (data as { restantes: number }).restantes;
}

export async function programmerRemontees(annonce: string, actif: boolean) {
  const { error } = await client().rpc("programmer_remontees", { annonce, actif });
  if (error) throw error;
}

/** Tous ses jours Premium gardés sur cette annonce ; renvoie la nouvelle date de fin */
export async function utiliserJoursPremium(annonce: string): Promise<string> {
  const { data, error } = await client().rpc("utiliser_jours_premium", { annonce });
  if (error) throw error;
  return data as string;
}

/** Premium en cours sur cette annonce ? */
export const premiumActif = (a: Pick<Annonce, "premium" | "premium_jusquau">, maintenant = Date.now()) =>
  a.premium && (!a.premium_jusquau || new Date(a.premium_jusquau).getTime() > maintenant);

/** Prochaine remontée possible (une par annonce toutes les 24 heures) ; null : tout de suite */
export function prochaineRemontee(a: Pick<Annonce, "remontee_le">, maintenant = Date.now()): Date | null {
  if (!a.remontee_le) return null;
  const t = new Date(a.remontee_le).getTime() + 24 * 3_600_000;
  return t > maintenant ? new Date(t) : null;
}

// ── Administration → Paiements ──
export type PaiementEquipe = Paiement & {
  annonce_id: string | null; fournisseur: string | null; transaction: string | null; motif_remboursement: string | null;
  compte: { id: string; nom: string | null; telephone: string | null; email: string | null } | null;
};
export type TableauPaiements = {
  jours: number; encaisse: number; nombre: number; rembourse: number; echoues: number; en_attente: number;
  par_offre: Partial<Record<CleOffre, { nombre: number; montant: number }>>;
  paiements: PaiementEquipe[];
};

export async function tableauPaiements(jours = 30): Promise<TableauPaiements> {
  const { data, error } = await client().rpc("admin_paiements", { jours });
  if (error) throw error;
  return data as TableauPaiements;
}

export async function rembourser(paiement: string, motif: string) {
  const { error } = await client().rpc("rembourser_paiement", { paiement, motif });
  if (error) throw error;
}
