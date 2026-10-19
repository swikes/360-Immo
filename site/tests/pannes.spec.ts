// Base de données momentanément injoignable (pannes simulées par tests/base/serveur.mjs) : jamais « introuvable »,
// un message clair en français et un statut d'erreur (Google ne retire pas la page) ; une vraie absence reste « introuvable ».
import { ATTENTE_404, appuyer, expect, test } from "./outils";

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

test("Article du blog et prix d'une commune pendant une panne : une erreur (500), jamais un message « pas disponible » gardé en cache", async ({ page }) => {
  // (gardée en cache, une page « pas disponible » ou « pas encore assez d'annonces » resterait servie 10 minutes ou une
  // heure après la panne, et Google la prendrait pour le vrai contenu)
  for (const adresse of ["/blog/article-en-panne", "/prix/grand-bassam"]) {
    const reponse = await page.goto(adresse);
    expect(reponse?.status(), adresse).toBe(500);
    await expect(page.getByText(/pas disponible pour le moment|Pas encore assez d'annonces|introuvable/i)).toHaveCount(0);
    // à la visite suivante, la page est demandée de nouveau à la base (rien n'a été gardé)
    expect((await page.goto(adresse))?.status(), adresse).toBe(500);
  }
});

test("Une annonce qui n'existe pas reste « plus en ligne » (404)", async ({ page }) => {
  const reponse = await page.goto("/annonces/appartement-imm-2026-99998");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Cette annonce n'est plus en ligne", ATTENTE_404);
});
