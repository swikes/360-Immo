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
};

/** Ce que la personne peut modifier elle-même dans son profil */
export type ChampsProfil = Pick<
  Profil,
  "prenom" | "nom" | "telephone" | "telephone2" | "telephone_whatsapp" | "telephone2_whatsapp" | "telephone2_type" | "demande_agence"
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

export function messageErreur(e: unknown): string {
  const err = e as { code?: string; message?: string; name?: string; status?: number };
  if (err?.message === "indisponible") return "Les comptes ne sont pas encore disponibles sur ce site.";
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  const m = err?.message ?? "";
  if (/invalid login credentials/i.test(m)) return MESSAGES.invalid_credentials;
  if (/already registered/i.test(m)) return MESSAGES.user_already_exists;
  if (/rate limit/i.test(m) || err?.status === 429) return MESSAGES.over_request_rate_limit;
  if (/password/i.test(m) && /(least|short|weak)/i.test(m)) return MESSAGES.weak_password;
  if (err?.name === "AuthRetryableFetchError" || /failed to fetch|network|load failed/i.test(m)) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.";
  }
  return "Une erreur est survenue. Réessayez dans un instant." + (m ? ` (${m})` : "");
}
