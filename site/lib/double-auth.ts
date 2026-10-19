/*
 * Double authentification de l'équipe (supabase/migrations/…_double_authentification.sql) : en plus du mot de passe,
 * le code à 6 chiffres d'une application du téléphone (Google Authenticator, Microsoft Authenticator…). La base ne
 * donne les droits de l'équipe qu'à une connexion confirmée par ce code (niveau « aal2 »).
 * Écran : components/admin/DoubleAuthentification.tsx.
 */
import { supabase } from "./supabase";

export type EtatCode =
  /** connexion confirmée par le code */
  | { etat: "valide" }
  /** code déjà activé sur ce compte : à donner pour cette connexion */
  | { etat: "a_saisir"; facteur: string }
  /** pas encore de code sur ce compte */
  | { etat: "a_activer" };

/** Ce qu'il faut pour activer le code : QR code à scanner, ou clé à taper dans l'application */
export type Activation = { facteur: string; qr: string; cle: string };

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

export async function etatCode(): Promise<EtatCode> {
  const sb = client();
  const { data: niveau, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (niveau.currentLevel === "aal2") return { etat: "valide" };
  const { data: facteurs, error: e } = await sb.auth.mfa.listFactors();
  if (e) throw e;
  // (totp : les codes activés seulement)
  const code = facteurs.totp[0];
  return code ? { etat: "a_saisir", facteur: code.id } : { etat: "a_activer" };
}

/** Nouvelle activation ; une activation commencée puis abandonnée est d'abord effacée */
export async function commencerActivation(): Promise<Activation> {
  const sb = client();
  const { data: facteurs, error } = await sb.auth.mfa.listFactors();
  if (error) throw error;
  for (const f of facteurs.all.filter((x) => x.status === "unverified")) {
    const { error: e } = await sb.auth.mfa.unenroll({ factorId: f.id });
    if (e) throw e;
  }
  const { data, error: e } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "360-Immo.ci", issuer: "360-Immo.ci" });
  if (e) throw e;
  return { facteur: data.id, qr: imageQr(data.totp.qr_code), cle: data.totp.secret };
}

/**
 * Le QR code arrive comme image SVG collée telle quelle dans l'adresse (« data:image/svg+xml;utf-8,<svg… ») : un « # »
 * (couleur) y couperait l'image. On l'encode.
 */
function imageQr(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml;utf-8,/, "");
  return svg.startsWith("<") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : qr;
}

/** Le code à 6 chiffres : confirme cette connexion (et, la première fois, l'activation) */
export async function donnerCode(facteur: string, code: string) {
  const { error } = await client().auth.mfa.challengeAndVerify({ factorId: facteur, code });
  if (error) throw error;
}
