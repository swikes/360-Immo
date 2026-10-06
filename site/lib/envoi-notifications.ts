/*
 * Envoi des e-mails de la file (table notifications de la base) par Brevo. Appelé par app/api/notifications :
 *   - chaque matin (tâche programmée de Vercel) : prépare les alertes et les rappels de fin d'annonce, puis envoie ;
 *   - juste après un message ou une demande de visite (le site « relance » l'envoi) : envoie ce qui attend.
 * Réglages (Vercel → Settings → Environment Variables, jamais dans le code) : BREVO_API_KEY, EMAIL_EXPEDITEUR
 * (adresse validée dans Brevo), SUPABASE_SECRET_KEY (clé secrète de Supabase, pour lire la file).
 * Sans ces réglages, rien n'est envoyé : les e-mails attendent (3 jours au plus) dans la file.
 */
import { composerEmail, type EmailPret, type NotificationAEnvoyer } from "./emails";

export type Config = {
  brevoCle: string;
  expediteur: string;
  nomExpediteur: string;
  /** adresse publique du site, pour les liens des e-mails */
  site: string;
  /** adresse de l'API de Brevo (remplacée dans les tests) */
  brevoAdresse?: string;
};

/** Réglages lus dans l'environnement ; « manque » : ce qu'il reste à régler dans Vercel */
export function configEnvoi(env: Record<string, string | undefined>, site: string): { config: Config | null; manque: string[] } {
  const manque = ["BREVO_API_KEY", "EMAIL_EXPEDITEUR", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL"].filter((k) => !env[k]?.trim());
  if (manque.length) return { config: null, manque };
  return {
    config: {
      brevoCle: env.BREVO_API_KEY!.trim(),
      expediteur: env.EMAIL_EXPEDITEUR!.trim(),
      nomExpediteur: env.EMAIL_EXPEDITEUR_NOM?.trim() || "360-Immo.ci",
      site,
      brevoAdresse: env.BREVO_API_URL?.trim() || undefined,
    },
    manque,
  };
}

/** Erreur de Brevo qui touchera tous les e-mails (clé refusée, expéditeur non validé…) : on s'arrête là */
export class ErreurGlobale extends Error {}

/** Un e-mail, par l'API de Brevo (https://developers.brevo.com/reference/sendtransacemail) */
export async function envoyerParBrevo(config: Config, email: EmailPret, faire: typeof fetch = fetch): Promise<void> {
  const r = await faire(config.brevoAdresse ?? "https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": config.brevoCle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: config.nomExpediteur, email: config.expediteur },
      to: [email.nom ? { email: email.a, name: email.nom } : { email: email.a }],
      subject: email.sujet,
      htmlContent: email.html,
      textContent: email.texte,
      tags: [email.etiquette],
      ...(email.desabonnement ? { headers: { "List-Unsubscribe": `<${email.desabonnement}>` } } : {}),
    }),
  });
  if (r.ok) return;
  const detail = (await r.text().catch(() => "")).slice(0, 300);
  const message = `Brevo ${r.status}${detail ? ` : ${detail}` : ""}`;
  // 401, 403 : clé refusée ou compte bloqué ; 400 sur l'expéditeur : adresse non validée dans Brevo
  if (r.status === 401 || r.status === 403 || (r.status === 400 && /sender/i.test(detail))) throw new ErreurGlobale(message);
  throw new Error(message);
}

export type FileEnvoi = {
  /** prend des e-mails à envoyer (la base les réserve à cet envoi) */
  prendre: (nombre: number) => Promise<NotificationAEnvoyer[]>;
  /** envoyé (probleme null) ou erreur (nouvel essai plus tard) */
  marquer: (id: string, probleme: string | null) => Promise<void>;
};

export type Bilan = { envoyes: number; echecs: number; arret: string | null };

/**
 * Envoie ce qui attend dans la file, par lots, jusqu'à « maximum » e-mails (Brevo gratuit : 300 par jour).
 * Une erreur sur un e-mail n'empêche pas les autres ; une erreur globale (clé refusée…) arrête l'envoi.
 */
export async function viderFile(
  file: FileEnvoi,
  envoyer: (email: EmailPret) => Promise<void>,
  site: string,
  { maximum = 200, parLot = 25, enParallele = 4 } = {},
): Promise<Bilan> {
  const bilan: Bilan = { envoyes: 0, echecs: 0, arret: null };
  while (bilan.envoyes + bilan.echecs < maximum && !bilan.arret) {
    const lot = await file.prendre(Math.min(parLot, maximum - bilan.envoyes - bilan.echecs));
    if (!lot.length) break;
    let suivant = 0;
    const travailleur = async () => {
      while (suivant < lot.length) {
        const n = lot[suivant++];
        if (bilan.arret) {
          await file.marquer(n.id, `Non envoyé : ${bilan.arret}`);
          continue;
        }
        try {
          if (!n.email) throw new Error("Pas d'adresse e-mail");
          await envoyer(composerEmail(n, site));
          await file.marquer(n.id, null);
          bilan.envoyes++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (e instanceof ErreurGlobale) bilan.arret = message;
          await file.marquer(n.id, message);
          bilan.echecs++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(enParallele, lot.length) }, travailleur));
  }
  return bilan;
}
