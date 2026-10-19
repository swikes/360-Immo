/*
 * Adresse de contrôle du site (app/api/sante), pour un service de surveillance (UptimeRobot, voir DEPANNAGE.md) :
 * « tout va bien » (200) ou la liste des problèmes (503, le service prévient alors par e-mail).
 */

/** Ce que la base renvoie (etat_surveillance, supabase/migrations/…_surveillance.sql) */
export type EtatBase = { tache_du_matin: string | null; emails_en_retard: number };

/** La tâche du matin passe chaque jour à 7 h : au-delà de 26 heures sans passage, elle est en panne */
export const DELAI_TACHE_DU_MATIN = 26 * 3_600_000;

export type Bilan = { ok: boolean; problemes: string[]; tache_du_matin: string | null; emails: "réglés" | "pas encore réglés" };

/** Bilan à partir de l'état de la base ; emailsRegles : réglages de Brevo présents dans Vercel */
export function bilanSante(etat: EtatBase, emailsRegles: boolean, maintenant = Date.now()): Bilan {
  const problemes: string[] = [];
  const passee = etat.tache_du_matin ? Date.parse(etat.tache_du_matin) : NaN;
  if (!(maintenant - passee <= DELAI_TACHE_DU_MATIN)) {
    problemes.push("La tâche du matin n'est pas passée depuis plus de 26 heures (Vercel → Settings → Cron Jobs).");
  }
  // Sans les réglages de Brevo, les e-mails attendent exprès : ce n'est pas une panne
  if (emailsRegles && etat.emails_en_retard > 0) {
    problemes.push(`${etat.emails_en_retard} e-mail(s) en attente depuis plus de 26 heures : l'envoi par Brevo est en panne.`);
  }
  return { ok: problemes.length === 0, problemes, tache_du_matin: etat.tache_du_matin, emails: emailsRegles ? "réglés" : "pas encore réglés" };
}
