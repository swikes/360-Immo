/*
 * Payer une offre (lib/offres.ts) : le navigateur a commencé le paiement dans la base (commencer_paiement) ; le
 * serveur le présente au fournisseur (lib/paiements-serveur.ts) et renvoie l'adresse où payer. Un paiement déjà
 * traité renvoie directement à Mon Espace → Paiements.
 */
import { createClient } from "@supabase/supabase-js";
import { adressePaiement, adresseRetour, fournisseurRegle, type PaiementAPayer } from "@/lib/paiements-serveur";

export const dynamic = "force-dynamic";

const INDISPONIBLE = "Le paiement ne peut pas commencer pour l'instant. Réessayez dans un moment.";

export async function POST(requete: Request) {
  const fournisseur = fournisseurRegle();
  if (!fournisseur.nom) return Response.json({ message: fournisseur.raison }, { status: 503 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return Response.json({ message: INDISPONIBLE }, { status: 503 });
  const corps = (await requete.json().catch(() => null)) as { paiement?: unknown } | null;
  const id = corps?.paiement;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Paiement inconnu." }, { status: 400 });

  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await sb.rpc("paiement_a_payer", { paiement: id, fournisseur: fournisseur.nom });
  if (error) {
    console.error("Paiement :", error.message);
    return Response.json({ message: INDISPONIBLE }, { status: 500 });
  }
  const p = data as PaiementAPayer | null;
  if (!p) return Response.json({ message: "Paiement inconnu." }, { status: 404 });
  if (p.statut !== "en_attente") return Response.json({ url: adresseRetour(p.id) });
  return Response.json({ url: adressePaiement(fournisseur.nom, p) });
}
