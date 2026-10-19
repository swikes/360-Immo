/** Montant en chiffres groupés par milliers : 85 000 000 */
export const formaterPrix = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Seulement les chiffres d'un texte : « 85 000 000 FCFA » → 85000000 */
export const chiffres = (texte = "") => texte.replace(/\D/g, "");

/** Nombre et mot accordé : « 1 vue », « 1 250 vues » */
export const quantite = (n: number, mot: string, mots = `${mot}s`) => `${formaterPrix(n)} ${n > 1 ? mots : mot}`;

/** Initiales d'un nom affiché pour le rond d'un avatar : « Kamika Immobilier » → KI ; sans lettre : vide (« ? ») */
export const initialesNom = (nom: string, vide = "?") =>
  nom.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || vide;

/** Date complète : « 12 octobre 2026 » */
export const dateComplete = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Jour et mois : « 12 octobre » */
export const jourMois = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Jour du calendrier (AAAA-MM-JJ) en court : « 12 oct. » */
export const jourCourt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
