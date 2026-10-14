/*
 * Rafraîchit aussitôt les pages du blog après une modification dans l'Administration → Blog (sinon : 10 minutes au
 * plus). Réservé à l'équipe : la base vérifie le compte (compte_admin) avec la connexion de la personne.
 */
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(requete: Request) {
  const jeton = requete.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!jeton || !url || !cle) return Response.json({ ok: false }, { status: 401 });
  const sb = createClient(url, cle, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await sb.rpc("compte_admin");
  if (error || data !== true) return Response.json({ ok: false }, { status: 403 });

  const corps = await requete.json().catch(() => ({}));
  const slugs: string[] = (Array.isArray(corps?.slugs) ? corps.slugs : [])
    .filter((x: unknown): x is string => typeof x === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(x) && x.length <= 80)
    .slice(0, 5);
  revalidatePath("/blog");
  for (const slug of slugs) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
  return Response.json({ ok: true });
}
