/*
 * Adresse de contrôle du site (lib/surveillance.ts), appelée toutes les 5 minutes par le service de surveillance
 * (UptimeRobot, voir DEPANNAGE.md) : la base répond-elle, la tâche du matin est-elle passée, les e-mails partent-ils ?
 * 200 : tout va bien ; 503 : la liste des problèmes. Rien de personnel dans la réponse.
 */
import { createClient } from "@supabase/supabase-js";
import { configEnvoi } from "@/lib/envoi-notifications";
import { ADRESSE_SITE } from "@/lib/site";
import { bilanSante, type EtatBase } from "@/lib/surveillance";

export const dynamic = "force-dynamic";

const reponse = (corps: { ok: boolean; problemes: string[] } & Record<string, unknown>) =>
  Response.json(corps, { status: corps.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return reponse({ ok: false, problemes: ["Clé secrète de Supabase absente dans Vercel (SUPABASE_SECRET_KEY)."] });
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await sb.rpc("etat_surveillance");
  if (error || !data) {
    console.error("Surveillance :", error?.message);
    return reponse({ ok: false, problemes: ["La base de données ne répond pas ou refuse la clé secrète (Supabase en pause, en panne, ou SUPABASE_SECRET_KEY changée ?)."] });
  }
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url };
  const emailsRegles = configEnvoi(env, ADRESSE_SITE).config !== null;
  return reponse(bilanSante(data as EtatBase, emailsRegles));
}
