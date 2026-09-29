// Outils communs aux tests du nouveau site.
import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** Les pages du site (celles pas encore reconstruites renvoient vers la maquette) */
export const PAGES = [
  "/", "/annonces", "/publier", "/carte-des-prix", "/blog", "/estimation", "/connexion", "/mon-espace", "/mot-de-passe",
];

/** Fausse base Supabase des tests (tests/base/serveur.mjs) : annonces d'exemple en ligne */
export const BASE_TESTS = "http://127.0.0.1:54329";

// « page » : un test échoue si la page a produit une erreur JavaScript.
// Tout ce qui ne vient pas du site ni de la fausse base (maquette, WhatsApp…) est bloqué : les tests ne
// dépendent pas d'internet.
export const test = base.extend({
  page: async ({ page, baseURL }, utiliser) => {
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message.split("\n")[0]));
    await page.route("**/*", (r) => {
      const adresse = r.request().url();
      return adresse.startsWith(baseURL!) || adresse.startsWith(BASE_TESTS) ? r.continue() : r.abort();
    });
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

/** Défauts de la barre du haut à 7 largeurs (320 à 1366 px) : hauteur, éléments qui se touchent, dépassent… */
export async function defautsBarreDuHaut(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" }); // mesurer sans animation
  const defauts: string[] = [];
  // petit téléphone, téléphone, tablette, puis de part et d'autre des seuils (900 et 1100 px)
  for (const largeur of [320, 390, 768, 901, 1024, 1101, 1366]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    defauts.push(
      ...(await page.evaluate((largeur) => {
        const nav = document.querySelector('nav[aria-label="Menu principal"]')!;
        const n = nav.getBoundingClientRect();
        const out: string[] = [];
        const hauteur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"));
        if (Math.round(n.height) !== hauteur) out.push(`${largeur} px : barre de ${Math.round(n.height)} px au lieu de ${hauteur} px`);
        const visibles = (e: Element) => (e as HTMLElement).offsetParent !== null;
        const blocs = [...nav.children].filter(visibles).map((e) => e.getBoundingClientRect());
        if (blocs.some((b, i) => i && b.left < blocs[i - 1].right + 8)) out.push(`${largeur} px : des éléments de la barre se touchent`);
        const liens = nav.querySelector("ul");
        const bouton = nav.querySelector('button[aria-controls="menuSite"]');
        if (liens && !visibles(liens) && !(bouton && visibles(bouton))) out.push(`${largeur} px : menu masqué sans bouton ☰`);
        for (const e of nav.querySelectorAll("a, button")) {
          if (!visibles(e)) continue;
          const r = e.getBoundingClientRect();
          const nom = `${largeur} px : « ${(e as HTMLElement).innerText.trim().slice(0, 20)} »`;
          if (r.top < n.top - 1 || r.bottom > n.bottom + 1) out.push(`${nom} sort de la barre`);
          if (r.right > innerWidth + 1) out.push(`${nom} dépasse à droite`);
        }
        return out;
      }, largeur)),
    );
  }
  return defauts;
}
