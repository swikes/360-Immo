/*
 * Menu du site : pour ajouter, retirer ou renommer un lien sur TOUTES les pages, c'est ici.
 *   Acheter → annonces « À vendre » ; Louer → annonces « À louer » ; Vendre → publier son annonce
 */

export type LienMenu = {
  texte: string;
  lien: string;
  /** lien mis en avant en doré (« ✦ Estimer ») */
  dore?: boolean;
};

export const MENU_SITE: LienMenu[] = [
  { texte: "Acheter", lien: "/annonces?tx=achat" },
  { texte: "Louer", lien: "/annonces?tx=location" },
  { texte: "Vendre", lien: "/publier" },
  { texte: "Carte des prix", lien: "/carte-des-prix" },
  { texte: "Guide & Blog", lien: "/blog" },
  { texte: "✦ Estimer", lien: "/estimation", dore: true },
];

/** Le lien de la page où l'on se trouve (même page et, pour les annonces, même choix Acheter / Louer) */
export function estActif(lien: string, chemin: string, tx: string | null): boolean {
  const cible = new URL(lien, "https://360-immo.ci");
  if (cible.pathname !== chemin) return false;
  const txLien = cible.searchParams.get("tx");
  return !txLien || txLien === tx;
}
