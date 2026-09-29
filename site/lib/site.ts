/*
 * Adresse publique du site : liens partagés (WhatsApp, Facebook), aperçus des liens, plan du site pour Google.
 * Au lancement, le nom de domaine (360-immo.ci) la remplacera : réglage NEXT_PUBLIC_SITE_URL dans Vercel.
 */
export const ADRESSE_SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://360-immo.vercel.app").replace(/\/$/, "");
