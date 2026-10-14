/*
 * Formulaire Contact (/contact ; supabase/migrations/…_pages_contact.sql) : les sujets proposés et une demande telle
 * que l'équipe la voit (Administration → Contact). Utilisable partout (formulaire, e-mail à l'équipe, Administration).
 */

export type SujetContact = "question" | "annonce" | "arnaque" | "compte" | "partenariat" | "donnees" | "presse" | "autre";

export const SUJETS_CONTACT: Record<SujetContact, string> = {
  question: "Une question sur le site",
  annonce: "Une annonce (la mienne ou celle d'un autre)",
  arnaque: "Signaler une arnaque",
  compte: "Mon compte (connexion, numéro, vérification)",
  partenariat: "Agence, promoteur ou partenariat",
  donnees: "Mes données personnelles (accès, correction, suppression)",
  presse: "Presse",
  autre: "Autre",
};

export const LISTE_SUJETS = Object.keys(SUJETS_CONTACT) as SujetContact[];
export const estSujet = (x: unknown): x is SujetContact => typeof x === "string" && x in SUJETS_CONTACT;

/** Les sujets qui concernent une annonce : on demande sa référence */
export const SUJETS_ANNONCE: SujetContact[] = ["annonce", "arnaque"];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 3000;

export type DemandeContact = {
  id: string; nom: string; email: string | null; telephone: string | null; sujet: SujetContact; reference: string | null;
  message: string; statut: "nouvelle" | "traitee"; cree_le: string; traitee_le: string | null; traitee_par: string | null;
  avec_compte: boolean;
};
