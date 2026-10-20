/*
 * Paiement simulé (essais seulement : lib/paiements-serveur.ts) : la page /paiement/simulation imite celle de
 * l'agrégateur ; ce serveur joue sa réponse (« payé » ou « refusé ») et la donne à la base, comme le fera la
 * notification de l'agrégateur. Refusé sur Vercel : un paiement simulé n'y donne jamais d'offre.
 */
import { createClient } from "@supabase/supabase-js";
import { fournisseurRegle } from "@/lib/paiements-serveur";

export const dynamic = "force-dynamic";

const MOYENS = ["Orange Money", "MTN MoMo", "Moov Money", "Wave"];

export async function POST(requete: Request) {
  const fournisseur = fournisseurRegle();
  if (fournisseur.nom !== "simulation") {
    return Response.json({ message: fournisseur.nom ? "Ce site n'utilise pas le paiement simulé." : fournisseur.raison }, { status: 403 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return Response.json({ message: "Clé secrète de Supabase absente." }, { status: 503 });
  const corps = (await requete.json().catch(() => null)) as { paiement?: unknown; issue?: unknown; moyen?: unknown } | null;
  const id = corps?.paiement;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !["payee", "echouee"].includes(String(corps?.issue))) {
    return Response.json({ message: "Demande incomplète." }, { status: 400 });
  }
  const moyen = MOYENS.includes(String(corps?.moyen)) ? String(corps?.moyen) : null;

  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = corps!.issue === "payee"
    ? await sb.rpc("confirmer_paiement", { paiement: id, transaction: `SIMULATION-${crypto.randomUUID().slice(0, 8)}`, moyen })
    : await sb.rpc("echec_paiement", { paiement: id, erreur: "Paiement refusé (simulation)" });
  if (error) {
    if (error.code === "P0001") return Response.json({ message: error.message }, { status: 400 });
    console.error("Paiement simulé :", error.message);
    return Response.json({ message: "Le paiement n'a pas pu être enregistré." }, { status: 500 });
  }
  return Response.json(data);
}
