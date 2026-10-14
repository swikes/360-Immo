/*
 * Rafraîchit aussitôt les pages publiques après une modification dans l'Administration (sinon : 10 minutes au plus) :
 * articles du blog (Blog) et pages du pied de page (Pages du site). Réservé à l'équipe : la base vérifie le compte
 * (compte_admin) avec la connexion de la personne. Corps : { articles: [adresses], pages: [adresses] }.
 */
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { estPage } from "@/lib/pages-site";

export const dynamic = "force-dynamic";

const adresses = (x: unknown): string[] =>
  (Array.isArray(x) ? x : []).filter((a): a is string => typeof a === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(a) && a.length <= 80).slice(0, 10);

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
  const articles = adresses(corps?.articles);
  const pages = adresses(corps?.pages).filter(estPage);
  if (articles.length) revalidatePath("/blog");
  for (const slug of articles) revalidatePath(`/blog/${slug}`);
  for (const slug of pages) revalidatePath(`/${slug}`);
  revalidatePath("/sitemap.xml");
  return Response.json({ ok: true });
}
