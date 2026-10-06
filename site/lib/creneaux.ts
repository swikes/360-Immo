/*
 * Créneaux de visite et dates en clair, à l'heure d'Abidjan (qui est aussi l'heure UTC) : utilisés par le site
 * (lib/visites.ts) et par les e-mails (lib/emails.ts).
 */

export const HEURES = [9, 11, 14, 16, 18];
export const FUSEAU = "Africa/Abidjan";

/** Les 7 jours qui suivent (à partir de demain), en « AAAA-MM-JJ » */
export function joursProposes(nombre = 7, maintenant = Date.now()): string[] {
  return Array.from({ length: nombre }, (_, i) => new Date(maintenant + (i + 1) * 86_400_000).toISOString().slice(0, 10));
}

/** « 2026-10-11 » + 9 → « 2026-10-11T09:00:00.000Z » (heure d'Abidjan = heure UTC) */
export const creneauDe = (jour: string, heure: number) => `${jour}T${String(heure).padStart(2, "0")}:00:00.000Z`;

/** « samedi 11 octobre à 09:00 » */
export function texteCreneau(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });
  return `${jour} à ${heure}`;
}

/** « sam. 11 oct. » (choix du jour) */
export const texteJour = (jour: string) =>
  new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: FUSEAU });

/** Le créneau est-il passé ? */
export const passe = (iso: string, maintenant = Date.now()) => new Date(iso).getTime() < maintenant;

/** « lundi 12 octobre » */
export const texteDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
