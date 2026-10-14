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
  await expect(panneau.getByRole("link", { name: "360-Immo.ci" }).getByRole("img")).toBeVisible(); // le logo, une image
  await expect(panneau.getByRole("link")).toHaveText([
    "", "Accueil", "Louer", "Acheter", "Carte des prix", "Guide & Blog", "✦ Estimer",
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

test("adresse inconnue : page « bientôt disponible » (erreur 404)", async ({ page }) => {
  const reponse = await page.goto("/mentions-legales");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page bientôt disponible");
  await appuyer(page.getByRole("link", { name: "Retour à l'accueil" }));
  await expect(page).toHaveURL(/\/$/);
});

test("logo : barre du haut, menu ☰ et pied de page (version claire sur le fond foncé), images bien chargées", async ({ page }) => {
  await page.goto("/");
  const barre = page.getByRole("navigation", { name: "Menu principal" });
  const logo = barre.getByRole("link", { name: "360-Immo.ci" });
  await expect(logo).toHaveAttribute("href", "/");
  await expect(logo.getByRole("img", { name: "360-Immo.ci" })).toHaveAttribute("src", "/logo/360-immo-logo.svg");
  const pied = page.locator("footer").getByRole("link", { name: "360-Immo.ci" });
  await expect(pied.getByRole("img")).toHaveAttribute("src", "/logo/360-immo-logo-fond-sombre.svg");
  await pied.scrollIntoViewIfNeeded();
  for (const image of [logo.getByRole("img"), pied.getByRole("img")]) {
    await expect.poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  if (estTelephone()) {
    await appuyer(page.getByRole("button", { name: "Ouvrir le menu" }));
    await expect(page.getByRole("complementary", { name: "Menu du site" }).getByRole("img", { name: "360-Immo.ci" })).toBeVisible();
  }
});

test("icônes (onglet, écran d'accueil) et aperçu d'un lien partagé, tirés du logo", async ({ page, request }) => {
  await page.goto("/");
  const tete = page.locator("head");
  await expect(tete.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", /^\/icon\.svg/);
  await expect(tete.locator('link[rel="icon"][type="image/x-icon"]')).toHaveAttribute("href", /^\/favicon\.ico/);
  await expect(tete.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
  await expect(tete.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  // page sans photo à elle : l'image du logo (une page d'annonce montre sa première photo : annonces.spec.ts)
  await expect(tete.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image\.png/);
  await expect(tete.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(tete.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /^360-Immo\.ci/);
  const manifeste = await (await request.get("/manifest.webmanifest")).json();
  expect(manifeste).toMatchObject({ short_name: "360-Immo", start_url: "/", lang: "fr" });
  for (const icone of manifeste.icons) {
    const r = await request.get(icone.src);
    expect(r.status(), icone.src).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
  }
  expect(manifeste.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
});
