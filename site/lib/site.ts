/*
 * Adresse publique du site : liens partagés (WhatsApp, Facebook), aperçus des liens, plan du site pour Google.
 * Au lancement, le nom de domaine (360-immo.ci) la remplacera : réglage NEXT_PUBLIC_SITE_URL dans Vercel
 * (DEPANNAGE.md, « Le jour du nom de domaine »).
 */
export const ADRESSE_VERCEL = "https://360-immo.vercel.app";
export const ADRESSE_SITE = (process.env.NEXT_PUBLIC_SITE_URL || ADRESSE_VERCEL).replace(/\/$/, "");

/*
 * Une fois le nom de domaine réglé, l'ancienne adresse 360-immo.vercel.app renvoie chaque page vers la même page du
 * nom de domaine (redirection définitive, next.config.ts) : Google ne voit qu'un seul site, au lieu de deux copies
 * qui se partageraient le classement, et les liens déjà partagés continuent de marcher. Les adresses d'essai de
 * Vercel (une par modification) ne sont pas touchées. Sauf /api/… : la tâche quotidienne de Vercel
 * (/api/notifications) peut encore passer par l'ancienne adresse.
 */
export function redirectionsVersDomaine(adresse = ADRESSE_SITE) {
  const domaine = new URL(adresse).host;
  const ancienne = new URL(ADRESSE_VERCEL).host;
  if (domaine === ancienne) return [];
  const has = [{ type: "host" as const, value: ancienne.replace(/\./g, "\\.") }];
  return [
    { source: "/", has, destination: `${adresse}/`, permanent: true },
    { source: "/:chemin((?!api/).*)", has, destination: `${adresse}/:chemin`, permanent: true },
  ];
}
