/*
 * Pages du pied de page (supabase/migrations/…_pages_contact.sql) : à propos, aide, devenir partenaire et pages
 * légales. Leur texte s'écrit dans l'Administration → Pages du site, avec la même mise en page que les articles du blog
 * (lib/blog.ts). Une page en brouillon affiche « Page bientôt disponible ». Utilisable partout.
 */

export type AdressePage = "a-propos" | "aide" | "devenir-partenaire" | "mentions-legales" | "cgu" | "confidentialite" | "cookies";

export const PAGES_SITE: Record<AdressePage, { nom: string; legale: boolean }> = {
  "a-propos": { nom: "À propos", legale: false },
  aide: { nom: "Aide & FAQ", legale: false },
  "devenir-partenaire": { nom: "Devenir partenaire", legale: false },
  "mentions-legales": { nom: "Mentions légales", legale: true },
  cgu: { nom: "Conditions générales d'utilisation", legale: true },
  confidentialite: { nom: "Politique de confidentialité", legale: true },
  cookies: { nom: "Cookies", legale: true },
};

export const LISTE_PAGES = Object.keys(PAGES_SITE) as AdressePage[];
export const estPage = (x: unknown): x is AdressePage => typeof x === "string" && x in PAGES_SITE;
export const lienPage = (slug: AdressePage) => `/${slug}`;

/** Une page publiée */
export type PagePublique = { slug: AdressePage; titre: string; resume: string; contenu: string; publie_le: string; modifie_le: string };

/** Une page telle que l'équipe la voit */
export type PageAdmin = Omit<PagePublique, "publie_le"> & {
  publie_le: string | null; notes: string | null; statut: "brouillon" | "publie"; a_completer: boolean; modifie_par: string | null;
};

/** Passage encore à remplir (« [à compléter : numéro RCCM] ») : la page ne peut pas être publiée (même règle que la base) */
export const resteACompleter = (t: string) => /\[\s*(à|a) compl[éeè]ter/i.test(t);
