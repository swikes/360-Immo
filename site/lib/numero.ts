/*
 * « Afficher le numéro » (fiche d'un bien, demande de visite) : nom complet, numéros et e-mail de l'annonceur d'une
 * annonce en ligne. La base les compte, contre les robots qui récoltent les numéros
 * (supabase/migrations/…_limite_numeros.sql) : compte connecté → la base compte pour le compte ; visiteur sans
 * compte → par le serveur du site (app/api/numero), qui donne à la base l'adresse IP de la connexion.
 */
import { supabase } from "./supabase";

export type Coordonnees = {
  /** nom complet du contact */
  nom: string | null;
  telephone: string | null;
  whatsapp: boolean;
  telephone2: string | null;
  whatsapp2: boolean;
  email: string | null;
};

/** contact : null si l'annonce n'est plus en ligne ; erreur : message à afficher (limite atteinte, panne) */
export type ResultatNumero = { contact: Coordonnees | null } | { erreur: string };

export const NUMERO_INDISPONIBLE = "Le numéro ne peut pas être affiché pour l'instant. Réessayez dans un moment.";

export async function afficherNumero(annonce: string): Promise<ResultatNumero> {
  const sb = supabase();
  if (!sb) return { erreur: NUMERO_INDISPONIBLE };
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data, error } = await sb.rpc("afficher_numero", { annonce });
    if (error) return { erreur: error.code === "P0001" ? error.message : NUMERO_INDISPONIBLE };
    return { contact: (data as Coordonnees | null) ?? null };
  }
  try {
    const r = await fetch("/api/numero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ annonce }) });
    const corps = (await r.json().catch(() => null)) as { contact?: Coordonnees | null; message?: string } | null;
    if (!r.ok) return { erreur: r.status === 429 && corps?.message ? corps.message : NUMERO_INDISPONIBLE };
    return { contact: corps?.contact ?? null };
  } catch {
    return { erreur: NUMERO_INDISPONIBLE };
  }
}
