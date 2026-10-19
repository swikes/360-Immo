/*
 * Formulaire Contact (lib/formulaire-contact.ts) : seul ce serveur peut enregistrer une demande
 * (supabase/migrations/…_contact_serveur.sql, clé secrète SUPABASE_SECRET_KEY). Il vérifie d'abord le jeton
 * anti-robot quand le contrôle est réglé (TURNSTILE_SECRET_KEY, lib/anti-robot-serveur.ts), puis le compte de la
 * personne connectée (son jeton de connexion, vérifié par Supabase) : la demande lui est rattachée.
 * La base garde ses propres règles (nom, e-mail ou téléphone, 5 demandes par jour au plus…).
 */
import { createClient } from "@supabase/supabase-js";
import { verifierJeton } from "@/lib/anti-robot-serveur";

export const dynamic = "force-dynamic";

const INDISPONIBLE = "Votre message ne peut pas être envoyé pour l'instant. Réessayez dans un moment.";

export async function POST(requete: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return Response.json({ message: INDISPONIBLE }, { status: 503 });
  const corps = (await requete.json().catch(() => null)) as { demande?: unknown; jeton?: unknown } | null;
  const demande = corps?.demande;
  if (!demande || typeof demande !== "object" || Array.isArray(demande)) {
    return Response.json({ message: "Demande incomplète." }, { status: 400 });
  }

  const adresse = requete.headers.get("x-real-ip")?.trim() || requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const verdict = await verifierJeton(process.env.TURNSTILE_SECRET_KEY, corps?.jeton, adresse);
  if (!verdict.ok) {
    return verdict.raison === "injoignable"
      ? Response.json({ message: INDISPONIBLE }, { status: 503 })
      : Response.json({ code: "captcha_failed", message: "La vérification anti-robot a échoué." }, { status: 403 });
  }

  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  // Personne connectée : son compte, d'après son jeton de connexion (un jeton faux ou expiré : demande sans compte)
  const connexion = requete.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const auteur = connexion ? ((await sb.auth.getUser(connexion)).data.user?.id ?? null) : null;

  const { data, error } = await sb.rpc("envoyer_contact", { demande, auteur });
  if (error) {
    // règle de la base (nom manquant, trop de demandes aujourd'hui…) : son message s'affiche tel quel
    if (error.code === "P0001") return Response.json({ code: error.code, message: error.message }, { status: 400 });
    console.error("Contact :", error.message);
    return Response.json({ message: INDISPONIBLE }, { status: 500 });
  }
  return Response.json({ id: data });
}
