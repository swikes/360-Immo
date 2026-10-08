"use client";

/*
 * Compte de la personne qui visite le site : connectée ou non, son profil, les messages d'erreur en français.
 *   const { etat, utilisateur } = useCompte();   // etat : chargement | anonyme | connecte | indisponible
 * La connexion elle-même est gérée par Supabase (lib/supabase.ts) ; le profil est la ligne de la table « profils ».
 */
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { baseConfiguree, supabase } from "./supabase";

export type EtatCompte = {
  etat: "chargement" | "anonyme" | "connecte" | "indisponible";
  utilisateur: User | null;
};

export type Profil = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  telephone2: string | null;
  telephone_whatsapp: boolean;
  telephone2_whatsapp: boolean;
  telephone2_type: "mobile" | "fixe" | "bureau" | "autre";
  role: "particulier" | "agence" | "admin";
  agence_id: string | null;
  demande_agence: string | null;
  demande_agence_le: string | null;
  /** code de sa vitrine (/annonceur/…-k7p2qx) */
  code_vitrine: string;
  /** e-mails souhaités : nouveaux messages, demandes de visite et réponses, fin prochaine de ses annonces */
  emails_messages: boolean;
  emails_visites: boolean;
  emails_annonces: boolean;
  /** suspendu par l'équipe 360-Immo.ci (date et motif) : plus de publication ni de contact */
  suspendu_le: string | null;
  suspension_motif: string | null;
};

/** Ce que la personne peut modifier elle-même dans son profil */
export type ChampsProfil = Pick<
  Profil,
  "prenom" | "nom" | "telephone" | "telephone2" | "telephone_whatsapp" | "telephone2_whatsapp" | "telephone2_type" | "demande_agence"
  | "emails_messages" | "emails_visites" | "emails_annonces"
>;

// ── État de la connexion, partagé par toute la page (barre du haut, formulaires, Mon Espace) ──
const AU_DEPART: EtatCompte = { etat: baseConfiguree ? "chargement" : "indisponible", utilisateur: null };
let etat = AU_DEPART;
const abonnes = new Set<() => void>();
let demarre = false;

function demarrer() {
  if (demarre) return;
  demarre = true;
  // Supabase annonce la session déjà gardée (INITIAL_SESSION), puis chaque connexion ou déconnexion
  supabase()?.auth.onAuthStateChange((_evenement, session) => {
    etat = { etat: session ? "connecte" : "anonyme", utilisateur: session?.user ?? null };
    abonnes.forEach((f) => f());
  });
}

export function useCompte(): EtatCompte {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      demarrer();
      return () => abonnes.delete(f);
    },
    () => etat,
    () => AU_DEPART,
  );
}

/** Prénom affiché (profil, sinon ce qui a été saisi à l'inscription) */
export function prenomDe(u: User | null, profil?: Pick<Profil, "prenom"> | null): string {
  return profil?.prenom || (u?.user_metadata?.prenom as string | undefined) || "";
}

/** Initiales pour le rond de l'avatar (« AK ») */
export function initiales(prenom: string, nom: string): string {
  return ((prenom.trim()[0] ?? "") + (nom.trim()[0] ?? "")).toUpperCase() || "?";
}

export async function lireProfil(id: string): Promise<Profil> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  const { data, error } = await sb.from("profils").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Profil;
}

export async function enregistrerProfil(id: string, champs: Partial<ChampsProfil>): Promise<Profil> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  const { data, error } = await sb.from("profils").update(champs).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Profil;
}

export async function seDeconnecter() {
  await supabase()?.auth.signOut();
}

// ── Messages d'erreur ──
// Supabase répond en anglais, avec un code : on explique en français quoi faire.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  user_already_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous, ou utilisez « Mot de passe oublié ».",
  email_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous, ou utilisez « Mot de passe oublié ».",
  weak_password: "Mot de passe trop faible : choisissez-en un plus long (8 caractères au moins).",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  email_not_confirmed: "Votre e-mail n'est pas encore confirmé : ouvrez le lien reçu par e-mail.",
  email_address_invalid: "Cette adresse e-mail n'est pas acceptée. Vérifiez-la.",
  validation_failed: "Une information est invalide : vérifiez l'e-mail et le mot de passe.",
  over_email_send_rate_limit: "Trop d'e-mails envoyés pour le moment : réessayez dans une heure.",
  over_request_rate_limit: "Trop de tentatives : patientez quelques minutes avant de réessayer.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
  user_banned: "Ce compte est suspendu. Contactez l'équipe 360-Immo.ci.",
  session_not_found: "Votre session a expiré : reconnectez-vous.",
  otp_expired: "Ce lien a expiré ou a déjà servi : demandez-en un nouveau.",
};

// Formats refusés par la base (supabase/migrations) → explication
const CONTRAINTES: Record<string, string> = {
  contact_email_format: "E-mail de contact invalide.",
  messages_contenu_check: "Votre message est vide ou trop long (2 000 caractères au plus).",
  visites_nom_check: "Indiquez votre prénom et votre nom (80 caractères au plus).",
  visites_telephone_format: "Numéro de téléphone invalide : il doit être écrit avec l'indicatif du pays.",
  visites_email_format: "Cette adresse e-mail n'est pas valide.",
  visites_message_check: "Votre message fait 1 000 caractères au plus.",
  visites_reponse_longueur: "Votre réponse fait 500 caractères au plus.",
  rappels_nom_check: "Indiquez votre prénom et votre nom (80 caractères au plus).",
  rappels_telephone_format: "Numéro de téléphone invalide : il doit être écrit avec l'indicatif du pays.",
  rappels_message_longueur: "Votre message fait 500 caractères au plus.",
  contact_telephone_format: "Numéro de téléphone invalide : il doit être écrit avec l'indicatif du pays.",
  contact_telephone2_format: "Second numéro invalide : il doit être écrit avec l'indicatif du pays.",
  telephone_format: "Numéro de téléphone invalide : il doit être écrit avec l'indicatif du pays.",
  telephone2_format: "Second numéro invalide : il doit être écrit avec l'indicatif du pays.",
  annonces_titre_check: "Le titre fait de 10 à 120 caractères.",
  annonces_description_check: "La description fait 5 000 caractères au plus.",
  annonces_prix_check: "Le prix doit être supérieur à zéro.",
  chambres_selon_pieces: "Trop de chambres pour ce nombre de pièces : le séjour compte pour une pièce.",
  studio_une_piece: "Un studio compte une seule pièce.",
  etage_dans_immeuble: "Un étage n'a de sens que dans un immeuble.",
  loyer_selon_transaction: "Loyer par nuit, jour, mois ou année : seulement pour une location.",
  caution_en_location: "La caution ne concerne que les locations (24 mois au plus).",
  quartier_texte_longueur: "Nom de quartier trop court ou trop long.",
};

export function messageErreur(e: unknown): string {
  const err = e as { code?: string; message?: string; name?: string; status?: number };
  if (err?.message === "indisponible") return "Les comptes ne sont pas encore disponibles sur ce site.";
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  const m = err?.message ?? "";
  if (/invalid login credentials/i.test(m)) return MESSAGES.invalid_credentials;
  if (/already registered/i.test(m)) return MESSAGES.user_already_exists;
  if (/rate limit/i.test(m) || err?.status === 429) return MESSAGES.over_request_rate_limit;
  if (/password/i.test(m) && /(least|short|weak)/i.test(m)) return MESSAGES.weak_password;
  // Base de données : règles contrôlées par la base (messages déjà en français) ou formats refusés
  const contrainte = m.match(/violates check constraint "([^"]+)"/)?.[1];
  if (contrainte) return CONTRAINTES[contrainte] ?? "Une information est invalide : vérifiez le formulaire.";
  if (["23514", "42501", "P0001"].includes(err?.code ?? "") && !/row-level security|permission denied/i.test(m)) return m;
  if (/row-level security|permission denied/i.test(m)) return "Action non autorisée pour ce compte.";
  // Stockage des photos
  if (/exceeded the maximum allowed size|payload too large/i.test(m) || err?.status === 413) return "Photo trop lourde (5 Mo au plus).";
  if (/mime type/i.test(m)) return "Format de photo non accepté : JPG, PNG ou WebP.";
  if (err?.name === "AuthRetryableFetchError" || /failed to fetch|network|load failed/i.test(m)) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.";
  }
  return "Une erreur est survenue. Réessayez dans un instant." + (m ? ` (${m})` : "");
}
