// Page d'accueil : recherche, annonces, chiffres, liens.
import { appuyer, expect, test } from "./outils";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Rechercher : les critères arrivent sur la liste des annonces", async ({ page }) => {
  const recherche = page.getByRole("search", { name: "Rechercher un bien" });
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await expect(recherche.getByRole("button", { name: "Louer" })).toHaveAttribute("aria-pressed", "true");
  await recherche.getByLabel("Villes, communes, quartiers").fill("Cocody");
  await recherche.getByLabel("Type de bien").selectOption("Appartement");
  const budget = recherche.getByLabel("Loyer max (FCFA / mois)");
  await budget.fill("200000");
  await expect(budget).toHaveValue(/^200\s000$/); // chiffres groupés en tapant
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&type=appartement&q=Cocody&max=200000$/);
  await expect(page.locator("h1")).toHaveText("Biens à louer");
  await expect(page.getByLabel("Votre recherche").getByRole("listitem")).toHaveText([
    "Louer · au mois", "Appartement", "Cocody", /^Loyer max : 200\s000 FCFA \/ mois$/,
  ]);
  // La maquette reçoit la même recherche
  await expect(page.getByRole("link", { name: "Voir sur la maquette" })).toHaveAttribute(
    "href",
    "https://swikes.github.io/360-Immo/360-immo-resultats.html?tx=location&duree=mois&type=appartement&q=Cocody&max=200000",
  );
});

test("Louer : la location à la journée n'est proposée que pour un logement", async ({ page }) => {
  const recherche = page.getByRole("search", { name: "Rechercher un bien" });
  await expect(recherche.getByLabel("Prix max (FCFA)")).toBeVisible();
  await expect(recherche.getByRole("button", { name: "Journalière" })).toBeHidden(); // Acheter
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await appuyer(recherche.getByRole("button", { name: "Journalière" }));
  await expect(recherche.getByLabel("Loyer max (FCFA / jour)")).toBeVisible();
  // Un terrain ne se loue pas à la journée : on revient au mois
  await recherche.getByLabel("Type de bien").selectOption("Terrain");
  await expect(recherche.getByRole("button", { name: "Journalière" })).toBeHidden();
  await expect(recherche.getByRole("button", { name: "Mensuelle" })).toHaveAttribute("aria-pressed", "true");
  await expect(recherche.getByLabel("Loyer max (FCFA / mois)")).toBeVisible();
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&type=terrain$/);
});

test("Le haut de page ne peut pas glisser de côté (bulles décoratives coupées)", async ({ page }) => {
  // Les bulles décoratives dépassent du haut de page. Si le navigateur pouvait faire défiler ce bloc
  // (en touchant un bouton, en passant d'un champ à l'autre…), la recherche partirait de travers.
  const decalage = await page.getByRole("search").evaluate((recherche) => {
    const haut = recherche.closest("section")!;
    haut.scrollLeft = 120;
    haut.scrollTop = 80;
    recherche.querySelector("button")!.scrollIntoView({ block: "center", inline: "end" });
    return { gauche: haut.scrollLeft, haut: haut.scrollTop, x: recherche.getBoundingClientRect().x };
  });
  expect(decalage.gauche).toBe(0);
  expect(decalage.haut).toBe(0);
  expect(decalage.x).toBeGreaterThanOrEqual(0);
});

test("Vendre mène à « Publier une annonce »", async ({ page }) => {
  await appuyer(page.getByRole("search").getByRole("link", { name: "Vendre" }));
  await expect(page).toHaveURL(/\/publier$/);
  await expect(page.locator("h1")).toHaveText("Publier une annonce");
});

test("Lieux populaires : recherche du lieu, dans l'onglet choisi", async ({ page }) => {
  const recherche = page.getByRole("search");
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await appuyer(recherche.getByRole("link", { name: "Marcory" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&q=Marcory$/);
});

test("Le champ lieu propose les villes, communes et quartiers", async ({ page }) => {
  const options = page.locator("#listeLieux option");
  expect(await options.count()).toBeGreaterThan(300);
  for (const lieu of ["Abidjan", "Cocody", "Remblais", "Riviera 2", "Yamoussoukro"]) {
    await expect(page.locator(`#listeLieux option[value="${lieu}"]`)).toHaveCount(1);
  }
});

test("Annonces récentes : les boutons trient par type de bien", async ({ page }) => {
  const section = page.locator("#annonces");
  const cartes = section.getByRole("article");
  await expect(cartes).toHaveCount(6);
  await appuyer(section.getByRole("button", { name: "Terrains" }));
  await expect(cartes).toHaveCount(1);
  await expect(cartes).toContainText("Terrain 500 m² constructible, Bingerville");
  await appuyer(section.getByRole("button", { name: "Appartements" }));
  await expect(cartes).toHaveCount(2);
  await appuyer(section.getByRole("button", { name: "Tous" }));
  await expect(cartes).toHaveCount(6);
});

test("Annonces : prix de même style partout, favori, WhatsApp", async ({ page }) => {
  const prix = page.locator("#annonces article").locator("[class*='__prix']");
  await expect(prix).toHaveCount(6);
  const styles = await prix.evaluateAll((els) =>
    els.map((e) => {
      const c = getComputedStyle(e);
      return `${c.fontFamily} ${c.fontSize} ${c.fontWeight} ${c.color} ${c.fontVariantNumeric}`;
    }),
  );
  expect(new Set(styles).size, styles.join("\n")).toBe(1);
  await expect(prix.first()).toHaveText(/^150\s000 FCFA \/ mois$/);
  await expect(prix.nth(1)).toHaveText(/^85\s000\s000 FCFA$/);

  const favori = page.getByRole("button", { name: "Ajouter aux favoris : Villa 5 chambres avec piscine, Plateau" });
  await appuyer(favori);
  await expect(page.getByRole("button", { name: "Retirer des favoris : Villa 5 chambres avec piscine, Plateau" }))
    .toHaveAttribute("aria-pressed", "true");

  const whatsapp = page.getByRole("link", { name: "WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/2250748321190\?text=Bonjour/);
  await expect(whatsapp).toHaveAttribute("target", "_blank");
});

test("Chiffres : affichés en entier après défilement", async ({ page }) => {
  const chiffres = page.locator("[class*='__chiffreValeur']");
  await chiffres.first().scrollIntoViewIfNeeded();
  await expect(chiffres).toHaveText([/^3\s842\+$/, "48+", "32", /^12\s500\+$/], { timeout: 5000 });
});

test("Villes et appel à publier mènent au bon endroit", async ({ page }) => {
  await appuyer(page.getByRole("link", { name: "Bouaké 198 annonces" }));
  await expect(page).toHaveURL(/\/annonces\?q=Bouak%C3%A9$/);
  await expect(page.getByLabel("Votre recherche")).toContainText("Bouaké");
  await page.goto("/");
  await appuyer(page.getByRole("link", { name: "Publier une annonce gratuite" }));
  await expect(page).toHaveURL(/\/publier$/);
});
