"use client";

/*
 * Offres payantes des annonceurs : remonter une annonce, pack de 3 remontées, Premium 30 jours (étape 8a) ;
 * abonnement agence avec remontées incluses, « Bien visité » (étape 8b).
 * Règles et prix : supabase/migrations/…_offres.sql et …_abonnements_bien_visite.sql (document « Offre commerciale »).
 * Payer : la base enregistre le paiement « en attente » (commencer_paiement), puis le serveur du site renvoie la
 * page où payer (app/api/paiements/payer) ; l'offre s'applique quand l'agrégateur confirme le paiement.
 * Les offres ne s'affichent que si le paiement est réglé (NEXT_PUBLIC_PAIEMENTS, lib/paiements-serveur.ts).
 */
import type { Annonce } from "./annonces";
import type { SourceVue } from "./mesure";
import { supabase } from "./supabase";

/** Le paiement est-il ouvert sur ce site ? (sinon : rien n'est proposé) */
export const PAIEMENTS_OUVERTS = Boolean(process.env.NEXT_PUBLIC_PAIEMENTS?.trim());
/** Paiement imité pour les essais (jamais sur le site en ligne) */
export const PAIEMENT_SIMULE = process.env.NEXT_PUBLIC_PAIEMENTS?.trim() === "simulation";

export type CleOffre =
  | "remontee" | "remontees_3" | "premium_30" | "remontee_sup" | "agence_20" | "agence_60" | "agence_200"
  | "bien_visite" | "bien_visite_plus";
export type CleFormule = "agence_20" | "agence_60" | "agence_200";
export type Offre = {
  cle: CleOffre; nom: string; prix: number; remontees: number; jours_premium: number; ordre: number;
  /** abonnement agence : annonces en ligne au plus */
  annonces_max: number | null;
};
/** Formules de l'abonnement agence, de la plus petite à la plus grande */
export const FORMULES: CleFormule[] = ["agence_20", "agence_60", "agence_200"];
export const ANNONCES_FORMULE: Record<CleFormule, number> = { agence_20: 20, agence_60: 60, agence_200: 200 };

/** L'abonnement de l'agence du compte (null : compte qui n'est pas une agence) */
export type Abonnement = {
  agence: string;
  annonces_en_ligne: number;
  en_cours: { offre: CleFormule; nom: string; debut: string; fin: string; annonces_max: number; incluses: number; utilisees: number } | null;
  /** mois suivant payé d'avance */
  suivant: { offre: CleFormule; nom: string; debut: string; fin: string } | null;
  termine_le: string | null;
};
export type StatutVisiteAgent = "a_planifier" | "planifiee" | "visitee" | "impossible" | "annulee";
/** Une visite « Bien visité » demandée par l'annonceur */
export type VisiteAgent = {
  id: string; annonce_id: string | null; annonce: { reference?: string; titre?: string }; offre: CleOffre; montant: number;
  statut: StatutVisiteAgent; rendez_vous: string | null; agent: string | null; papiers: string[]; compte_rendu: string | null;
  visitee_le: string | null; badge_retire_le: string | null; badge_retire_raison: string | null; cree_le: string;
};
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
  abonnement: Abonnement | null;
  visites: VisiteAgent[];
  paiements: Paiement[];
};

/** Prix affichés tant que la base n'a pas répondu (les vrais sont dans la table « offres ») */
export { TARIFS } from "./offres-tarifs";

export const STATUTS_PAIEMENT: Record<StatutPaiement, string> = {
  en_attente: "En attente", payee: "Payé", echouee: "Échoué", remboursee: "Remboursé",
};

export const STATUTS_VISITE_AGENT: Record<StatutVisiteAgent, string> = {
  a_planifier: "Demandée", planifiee: "Rendez-vous fixé", visitee: "Bien visité", impossible: "Visite impossible", annulee: "Annulée",
};

/** Papiers dont l'agent peut voir l'original (Administration → Biens visités) */
export const PAPIERS = [
  "ACD (arrêté de concession définitive)", "Lettre d'attribution", "Attestation villageoise", "Titre foncier",
  "Permis de construire", "Pièce d'identité du propriétaire", "Mandat de l'agence",
];

/** Abonnement agence en cours ? */
export const abonne = (o: MesOffres | null) => Boolean(o?.abonnement?.en_cours);

/** Remontées incluses qui restent ce mois-ci (null : pas d'abonnement en cours) */
export const incluses = (o: MesOffres | null) =>
  o?.abonnement?.en_cours ? o.abonnement.en_cours.incluses - o.abonnement.en_cours.utilisees : null;

/** La formule qui convient à ce nombre d'annonces en ligne (la plus grande au-delà de 200) */
export const formuleConseillee = (annonces: number): CleFormule =>
  FORMULES.find((f) => ANNONCES_FORMULE[f] >= annonces) ?? "agence_200";

/** Prix de la visite pour ce bien (choisi aussi par la base) : 25 000 FCFA pour un terrain, une villa, un immeuble
 *  ou un bien hors d'Abidjan ; 10 000 FCFA sinon */
export const offreBienVisite = (a: Pick<Annonce, "type_bien" | "villes">): "bien_visite" | "bien_visite_plus" =>
  ["terrain", "villa", "immeuble"].includes(a.type_bien) || a.villes?.nom !== "Abidjan" ? "bien_visite_plus" : "bien_visite";

/** La visite en cours (demandée ou au rendez-vous fixé) d'une annonce */
export const visiteEnCours = (o: MesOffres | null, annonce: string) =>
  o?.visites.find((v) => v.annonce_id === annonce && (v.statut === "a_planifier" || v.statut === "planifiee")) ?? null;

/** D'où viennent les visiteurs d'une annonce (statistiques détaillées) */
export type { SourceVue };
export const SOURCES_VUES: Record<SourceVue, string> = {
  liste: "Liste des annonces", accueil: "Page d'accueil", vitrine: "Votre vitrine", fiche: "Une autre annonce (biens semblables)",
  mon_espace: "Favoris et messages", site: "Autres pages du site", direct: "Lien direct ou enregistré", google: "Google",
  autres_moteurs: "Autres moteurs de recherche", facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp",
  tiktok: "TikTok", youtube: "YouTube", x: "X (Twitter)", linkedin: "LinkedIn", email: "E-mail", sms: "SMS", autre_site: "Autre site",
};
export type StatistiquesDetaillees = {
  jours: number; du: string; au: string;
  sources: { source: SourceVue; vues: number }[];
  /** par annonce : vues par source */
  annonces: Record<string, Partial<Record<SourceVue, number>>>;
};
export type ContactSuivi = {
  genre: "message" | "visite" | "rappel"; id: string; le: string;
  annonce: { id: string; reference: string; titre: string };
  nom: string; telephone: string | null; statut: string; creneau?: string; moment?: string; dernier?: string | null;
};
export type SuiviContacts = {
  jours: number;
  contacts: ContactSuivi[];
  /** numéros affichés, appels, WhatsApp, e-mails : comptés sans savoir qui */
  gestes: { annonce: { id: string; reference: string; titre: string }; numeros: number; appels: number; whatsapp: number; emails: number }[];
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

/**
 * Une remontée : celles de l'abonnement d'abord, puis celles payées d'avance ; automatique : les suivantes tous les
 * « tousLes » jours (au choix pour une agence abonnée, tous les 3 jours avec un pack). Renvoie ce qui reste.
 */
export async function utiliserRemontee(annonce: string, automatique = false, tousLes = 3): Promise<{ restantes: number; incluses: number | null }> {
  const { data, error } = await client().rpc("utiliser_remontee", { annonce, automatique, tous_les: tousLes });
  if (error) throw error;
  return data as { restantes: number; incluses: number | null };
}

export async function programmerRemontees(annonce: string, actif: boolean, tousLes = 3) {
  const { error } = await client().rpc("programmer_remontees", { annonce, actif, tous_les: tousLes });
  if (error) throw error;
}

/** Agences abonnées : d'où viennent les visiteurs de chaque annonce */
export async function statistiquesDetaillees(jours: number): Promise<StatistiquesDetaillees> {
  const { data, error } = await client().rpc("statistiques_detaillees", { jours });
  if (error) throw error;
  return data as StatistiquesDetaillees;
}

/** Agences abonnées : messages, demandes de visite et de rappel reçus, pour quelle annonce */
export async function suiviContacts(jours: number): Promise<SuiviContacts> {
  const { data, error } = await client().rpc("suivi_contacts", { jours });
  if (error) throw error;
  return data as SuiviContacts;
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

// ── Administration → Biens visités ──
export type VisiteEquipe = {
  id: string; statut: StatutVisiteAgent; offre: CleOffre; nom: string; montant: number;
  rendez_vous: string | null; agent: string | null; papiers: string[]; compte_rendu: string | null;
  visitee_le: string | null; badge_retire_le: string | null; badge_retire_raison: string | null; cree_le: string; modifie_le: string;
  paiement: { id: string; reference: string; statut: StatutPaiement } | null;
  annonce: {
    id?: string; reference?: string; titre?: string; type_nom?: string; transaction?: string; ville?: string; commune?: string;
    quartier?: string | null; adresse?: string | null; surface?: number | null; statut?: string; en_ligne?: boolean;
    bien_visite_le?: string | null; photo?: string | null; photos?: number; photos_agent?: number;
  };
  compte: { id: string; nom: string | null; telephone: string | null; email: string | null } | null;
};
export type TableauBiensVisites = { a_planifier: number; planifiees: number; badges: number; visites: VisiteEquipe[] };

export async function biensVisites(): Promise<TableauBiensVisites> {
  const { data, error } = await client().rpc("admin_biens_visites");
  if (error) throw error;
  return data as TableauBiensVisites;
}

/** Rendez-vous fixé avec l'annonceur (date et heure ISO) et l'agent qui fera la visite */
export async function planifierVisite(visite: string, rendezVous: string, agent: string) {
  const { error } = await client().rpc("planifier_visite_agent", { visite, rendez_vous: rendezVous, agent });
  if (error) throw error;
}

/** Résultat de la visite : badge « Bien visité » (papiers vus en original, photos de l'agent ajoutées) ou visite impossible */
export async function noterVisite(visite: string, resultat: "visitee" | "impossible", papiers: string[], compteRendu: string) {
  const { error } = await client().rpc("noter_visite_agent", { visite, resultat, papiers, compte_rendu: compteRendu });
  if (error) throw error;
}
