// Outils communs aux tests du nouveau site.
import { test as base, expect, type Locator } from "@playwright/test";

/** Les pages du site (celles pas encore reconstruites renvoient vers la maquette) */
export const PAGES = [
  "/", "/annonces", "/publier", "/carte-des-prix", "/blog", "/estimation", "/connexion", "/mon-espace", "/mot-de-passe",
];

// « page » : un test échoue si la page a produit une erreur JavaScript.
// Tout ce qui ne vient pas du site (maquette, WhatsApp…) est bloqué : les tests ne dépendent pas d'internet.
export const test = base.extend({
  page: async ({ page, baseURL }, utiliser) => {
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message.split("\n")[0]));
    await page.route("**/*", (r) => (r.request().url().startsWith(baseURL!) ? r.continue() : r.abort()));
    await utiliser(page);
    expect(erreurs, "erreurs JavaScript pendant le test").toEqual([]);
  },
});

export { expect };

export const estTelephone = () => test.info().project.name === "telephone";

/** Toucher sur téléphone, cliquer sur ordinateur (vérifie aussi que rien ne masque l'élément) */
export async function appuyer(element: Locator) {
  if (estTelephone()) await element.tap();
  else await element.click();
}
