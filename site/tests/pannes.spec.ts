// Base de données momentanément injoignable (pannes simulées par tests/base/serveur.mjs) : jamais « introuvable »,
// un message clair en français et un statut d'erreur (Google ne retire pas la page) ; une vraie absence reste « introuvable ».
import { appuyer, expect, test } from "./outils";

test("Fiche d'un bien pendant une panne de la base : une erreur (500), jamais « plus en ligne » (404)", async ({ page }) => {
  // (fiche jamais encore mise en cache : Next.js répond par son texte d'erreur ; une fiche déjà en cache reste servie)
  const reponse = await page.goto("/annonces/appartement-imm-2026-77777");
  expect(reponse?.status()).toBe(500);
  await expect(page.getByText(/n'est plus en ligne|vendu ou loué/)).toHaveCount(0);
});

test("Vitrine pendant une panne de la base : « momentanément indisponible », en français, avec « Réessayer »", async ({ page }) => {
  const reponse = await page.goto("/annonceur/agence-panne1");
  expect(reponse?.status()).toBe(500);
  await expect(page.locator("h1")).toHaveText("Cette page ne peut pas s'afficher pour l'instant");
  await expect(page.getByText("Service momentanément indisponible")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
  await appuyer(page.getByRole("button", { name: "Réessayer" }));
  await expect(page.locator("h1")).toHaveText("Cette page ne peut pas s'afficher pour l'instant");
});

test("Une annonce qui n'existe pas reste « plus en ligne » (404)", async ({ page }) => {
  const reponse = await page.goto("/annonces/appartement-imm-2026-99998");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Cette annonce n'est plus en ligne");
});
