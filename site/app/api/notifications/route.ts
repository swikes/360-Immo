/*
 * Envoi des e-mails (lib/envoi-notifications.ts) :
 *   GET par la tâche programmée de Vercel, chaque matin (vercel.json) : supprime les documents de vérification qui ont
 *     fait leur temps (lib/menage-documents.ts, même sans réglage des e-mails), prépare les alertes et les rappels de fin
 *     d'annonce, puis envoie la file ;
 *   POST par le site, juste après un message, une demande de visite ou une réponse : envoie ce qui attend.
 * N'importe qui peut déclencher un envoi : la base ne donne chaque e-mail qu'une fois, et seulement ceux qu'elle a
 * elle-même mis dans la file. La réponse dit seulement si l'envoi est réglé (et ce qu'il manque dans Vercel).
 */
import { createClient } from "@supabase/supabase-js";
import type { NotificationAEnvoyer } from "@/lib/emails";
import { configEnvoi, envoyerParBrevo, viderFile } from "@/lib/envoi-notifications";
import { menageDocuments, type DemandeASupprimer } from "@/lib/menage-documents";
import { ADRESSE_SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ménage du matin du dossier privé (clé secrète nécessaire) ; null s'il n'a pas pu se faire */
async function menage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return null;
  const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    return await menageDocuments({
      aSupprimer: async () => {
        const { data, error } = await sb.rpc("documents_a_supprimer", { nombre: 200 });
        if (error) throw new Error(error.message);
        return data as DemandeASupprimer[];
      },
      supprimer: async (dossier, chemins) => {
        const { error } = await sb.storage.from(dossier).remove(chemins);
        if (error) throw error;
      },
      noter: async (ids) => {
        const { data, error } = await sb.rpc("documents_supprimes", { ids });
        if (error) throw new Error(error.message);
        return data as number;
      },
    });
  } catch (e) {
    console.error("Documents :", e);
    return null;
  }
}

async function traiter(quotidien: boolean): Promise<Response> {
  const documents = quotidien ? await menage() : undefined;
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL };
  const { config, manque } = configEnvoi(env, ADRESSE_SITE);
  if (!config) return Response.json({ regle: false, manque, ...(documents !== undefined ? { documents } : {}) });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const appeler = async <T>(fonction: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await sb.rpc(fonction, args);
    if (error) throw new Error(`${fonction} : ${error.message}`);
    return data as T;
  };
  try {
    const alertes = quotidien ? await appeler<number>("preparer_alertes") : 0;
    const rappels = quotidien ? await appeler<number>("preparer_rappels") : 0;
    const bilan = await viderFile(
      {
        prendre: (nombre) => appeler<NotificationAEnvoyer[]>("notifications_a_envoyer", { nombre }),
        marquer: (notification, probleme) => appeler("notification_envoyee", { notification, probleme }),
      },
      (email) => envoyerParBrevo(config, email),
      config.site,
    );
    if (bilan.arret) console.error(`E-mails : envoi arrêté (${bilan.arret})`);
    return Response.json({
      regle: true, alertes, rappels, envoyes: bilan.envoyes, echecs: bilan.echecs, arret: !!bilan.arret,
      ...(documents !== undefined ? { documents } : {}),
    });
  } catch (e) {
    console.error("E-mails :", e);
    return Response.json({ regle: true, erreur: "La file des e-mails n'a pas pu être lue." }, { status: 500 });
  }
}

/** Tâche programmée de Vercel (avec CRON_SECRET réglé, Vercel l'envoie : les autres appels ne font que vider la file) */
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const tache = secret
    ? requete.headers.get("authorization") === `Bearer ${secret}`
    : (requete.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  return traiter(tache);
}

export async function POST() {
  return traiter(false);
}
