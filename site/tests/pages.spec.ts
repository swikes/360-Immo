// Toutes les pages : chargement, barre du haut, menu ☰, pied de page, largeur sur téléphone.
import { devices } from "@playwright/test";
import { PAGES, appuyer, defautsBarreDuHaut, estTelephone, expect, test } from "./outils";

for (const chemin of PAGES) {
  test.describe(`Page ${chemin}`, () => {
    test("s'ouvre avec un titre, la barre du haut et le pied de page", async ({ page }) => {
      const reponse = await page.goto(chemin);
      expect(reponse?.status()).toBe(200);
      await expect(page).toHaveTitle(/360-Immo\.ci/);
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
    });

    test("barre du haut sur une ligne à toutes les largeurs", async ({ page }) => {
      await page.goto(chemin);
      expect(await defautsBarreDuHaut(page)).toEqual([]);
    });

    test("tient dans la largeur d'un téléphone (320 et 390 px)", async ({ browser, baseURL }) => {
      for (const largeur of [320, 390]) {
        const ctx = await browser.newContext({
          ...devices["iPhone 13"], baseURL, viewport: { width: largeur, height: 700 }, screen: { width: largeur, height: 700 },
        });
        const p = await ctx.newPage();
        await p.goto(chemin);
        const largeurPage = await p.evaluate(() => document.documentElement.scrollWidth);
        expect(largeurPage, `${largeur} px : la page fait ${largeurPage} px de large`).toBeLessThanOrEqual(largeur);
        await ctx.close();
      }
    });
  });
}

test("le lien de la page ouverte est mis en avant dans le menu", async ({ page }) => {
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  test.skip(estTelephone(), "sur téléphone, les liens sont dans le menu ☰ (test suivant)");
  await page.goto("/annonces?tx=location");
  await expect(menu.getByRole("link", { name: "Louer", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Acheter", exact: true })).not.toHaveAttribute("aria-current");
  await page.goto("/annonces?tx=achat");
  await expect(menu.getByRole("link", { name: "Acheter", exact: true })).toHaveAttribute("aria-current", "page");
  // Publier une annonce : le bouton vert (plus de lien « Vendre » dans le menu)
  await page.goto("/publier");
  await expect(menu.getByRole("link", { name: "Vendre" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: /Publier une annonce/ })).toHaveAttribute("aria-current", "page");
});

test("menu ☰ sur téléphone : s'ouvre, mène à la bonne page, se ferme", async ({ page }) => {
  test.skip(!estTelephone(), "le menu ☰ n'apparaît que sur téléphone et tablette");
  await page.goto("/");
  const panneau = page.getByRole("complementary", { name: "Menu du site" });
  await expect(panneau).toBeHidden();
  await appuyer(page.getByRole("button", { name: "Ouvrir le menu" }));
  await expect(panneau).toBeVisible();
  await expect(panneau.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
  await expect(panneau.getByRole("link")).toHaveText([
    "360-Immo.ci", "Accueil", "Acheter", "Louer", "Carte des prix", "Guide & Blog", "✦ Estimer",
    "Mon espace", "Publier une annonce",
  ]);
  await appuyer(panneau.getByRole("button", { name: "Fermer le menu" }));
  await expect(panneau).toBeHidden();
  await appuyer(page.getByRole("button", { name: "Ouvrir le menu" }));
  await appuyer(panneau.getByRole("link", { name: "Louer" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location$/);
  await expect(panneau).toBeHidden();
  await expect(page.locator("h1")).toHaveText("Biens à louer");
});

test("menu ☰ : la touche Échap le referme", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const panneau = page.getByRole("complementary", { name: "Menu du site" });
  await expect(panneau).toBeVisible();
  await expect(panneau.getByRole("button", { name: "Fermer le menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panneau).toBeHidden();
  await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeFocused();
});

test("page pas encore reconstruite : lien vers la même page de la maquette", async ({ page }) => {
  await page.goto("/estimation");
  await expect(page.getByRole("link", { name: "Voir sur la maquette" })).toHaveAttribute(
    "href",
    "https://swikes.github.io/360-Immo/360-immo-estimation.html",
  );
});

test("adresse inconnue : page « bientôt disponible » (erreur 404)", async ({ page }) => {
  const reponse = await page.goto("/mentions-legales");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page bientôt disponible");
  await appuyer(page.getByRole("link", { name: "Retour à l'accueil" }));
  await expect(page).toHaveURL(/\/$/);
});
