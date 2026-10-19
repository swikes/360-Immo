/*
 * « Afficher le numéro » pour un visiteur sans compte (lib/numero.ts) : la base compte les numéros affichés par
 * connexion internet, contre les robots qui récoltent les numéros (supabase/migrations/…_limite_numeros.sql).
 * L'adresse IP est celle que pose Vercel (x-real-ip, x-forwarded-for) : un visiteur ne peut pas la falsifier.
 * Seul ce serveur peut appeler la base sans compte pour un numéro (clé secrète, SUPABASE_SECRET_KEY).
 */
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(requete: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return Response.json({ message: "Le numéro ne peut pas être affiché pour l'instant." }, { status: 503 });
  const corps = await requete.json().catch(() => null) as { annonce?: unknown } | null;
  const annonce = corps?.annonce;
  if (typeof annonce !== "string" || !/^[0-9a-f-]{36}$/i.test(annonce)) {
    return Response.json({ message: "Annonce inconnue." }, { status: 400 });
  }
  const adresse = requete.headers.get("x-real-ip")?.trim() || requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await sb.rpc("afficher_numero", { annonce, adresse });
  if (error) {
    // limite atteinte : le message de la base s'affiche tel quel
    if (error.code === "P0001") return Response.json({ message: error.message }, { status: 429 });
    console.error("Numéro :", error.message);
    return Response.json({ message: "Le numéro ne peut pas être affiché pour l'instant." }, { status: 500 });
  }
  return Response.json({ contact: data ?? null });
}
