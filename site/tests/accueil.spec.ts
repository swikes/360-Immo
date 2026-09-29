// Page d'accueil : recherche, annonces, chiffres, liens.
import { appuyer, estTelephone, expect, test } from "./outils";

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

test("Types de bien : ceux de la publication ; une chambre d'hôtel se loue à la nuit", async ({ page }) => {
  const recherche = page.getByRole("search");
  const options = recherche.getByLabel("Type de bien").locator("option");
  const TOUS = ["Appartement", "Maison", "Villa", "Terrain", "Bureau", "Commerce / Magasin", "Immeuble"];
  await expect(options).toHaveText(["Tous les biens", ...TOUS, "Autres"]); // Acheter : pas de chambre d'hôtel
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await expect(options).toHaveText(["Tous les biens", ...TOUS, "Chambre d'hôtel", "Autres"]);
  await recherche.getByLabel("Type de bien").selectOption("Chambre d'hôtel");
  await expect(recherche.getByRole("button", { name: "Mensuelle" })).toBeHidden();
  await expect(recherche.getByRole("button", { name: "Journalière" })).toHaveAttribute("aria-pressed", "true");
  await expect(recherche.getByLabel("Loyer max (FCFA / nuit)")).toBeVisible();
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=jour&type=hotel$/);
  await expect(page.getByLabel("Votre recherche")).toContainText("Chambre d'hôtel");
});

test("iPhone : les montants ne deviennent pas des numéros de téléphone (bleus, soulignés)", async ({ page }) => {
  await expect(page.locator('meta[name="format-detection"]')).toHaveAttribute("content", /telephone=no/);
});

test("Plus de critères : ceux du type de bien, transmis à la liste des annonces", async ({ page }) => {
  const recherche = page.getByRole("search");
  const groupe = (nom: string) => recherche.getByRole("group", { name: nom, exact: true });
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await recherche.getByLabel("Type de bien").selectOption("Appartement");
  await appuyer(recherche.getByRole("button", { name: "Plus de critères" }));
  // Appartement à louer au mois : studio (pas « 1 »), étage toujours demandé, caution
  await expect(groupe("Nombre de pièces").getByRole("button")).toHaveText(["Studio", "2", "3", "4", "5+"]);
  for (const nom of ["Nombre de chambres", "Salles de bain", "Mois de caution max", "Étage souhaité", "Commodités"]) {
    await expect(groupe(nom)).toBeVisible();
  }
  await expect(groupe("Loyer (FCFA / mois)")).toBeVisible();
  await appuyer(groupe("Nombre de pièces").getByRole("button", { name: "3" }));
  // 3 pièces : 2 chambres au plus (le séjour compte pour une pièce)
  for (const n of ["3", "4", "5+"]) await expect(groupe("Nombre de chambres").getByRole("button", { name: n })).toBeDisabled();
  await appuyer(groupe("Nombre de chambres").getByRole("button", { name: "2" }));
  await groupe("Surface (m²)").getByLabel("Surface minimum (m²)").fill("50");
  await appuyer(groupe("Préférences").getByRole("button", { name: "Déjà meublé" }));
  await appuyer(groupe("Étage souhaité").getByRole("button", { name: "1er" }));
  await appuyer(groupe("Commodités").getByRole("button", { name: "Piscine" }));
  await expect(recherche.getByRole("button", { name: /Moins de critères/ })).toContainText("6");
  if (estTelephone()) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }).last());
  await expect(page).toHaveURL(
    /\/annonces\?tx=location&duree=mois&type=appartement&pieces=3&chambres=2&smin=50&meuble=1&com=Piscine&etage=1er$/,
  );
  await expect(page.getByLabel("Votre recherche").getByRole("listitem")).toHaveText([
    "Louer · au mois", "Appartement", "3 pièces", "2 chambres", "50 m² min", "Déjà meublé", "Étage : 1er", "Piscine",
  ]);
});

test("Plus de critères : un terrain n'a ni pièces ni « meublé », les choix devenus sans objet disparaissent", async ({ page }) => {
  const recherche = page.getByRole("search");
  const groupe = (nom: string) => recherche.getByRole("group", { name: nom, exact: true });
  await appuyer(recherche.getByRole("button", { name: "Plus de critères" }));
  await appuyer(groupe("Nombre de pièces").getByRole("button", { name: "3" }));
  await appuyer(groupe("Préférences").getByRole("button", { name: "Avec photos" }));
  await recherche.getByLabel("Type de bien").selectOption("Terrain");
  for (const nom of ["Nombre de pièces", "Nombre de chambres", "Salles de bain", "Étage souhaité"]) await expect(groupe(nom)).toBeHidden();
  await expect(groupe("Préférences").getByRole("button", { name: "Déjà meublé" })).toBeHidden();
  await expect(groupe("Superficie (m²)")).toBeVisible();
  await expect(groupe("Commodités").getByRole("button", { name: "Titre foncier (ACD)" })).toBeVisible();
  await expect(groupe("Commodités").getByRole("button", { name: "Piscine" })).toBeHidden();
  // Bureau : « Dans un immeuble » fait apparaître l'étage
  await recherche.getByLabel("Type de bien").selectOption("Bureau");
  await expect(groupe("Étage souhaité")).toBeHidden();
  await appuyer(groupe("Préférences").getByRole("button", { name: "Dans un immeuble" }));
  await expect(groupe("Étage souhaité")).toBeVisible();
  await recherche.getByLabel("Type de bien").selectOption("Terrain");
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }).first());
  await expect(page).toHaveURL(/\/annonces\?tx=achat&type=terrain&photos=1$/); // ni pièces, ni immeuble
});

test("L'onglet « Publier » mène à « Publier une annonce »", async ({ page }) => {
  await appuyer(page.getByRole("search").getByRole("link", { name: "Publier", exact: true }));
  await expect(page).toHaveURL(/\/publier$/);
  await expect(page.locator("h1")).toHaveText("Publier une annonce");
});

test("Lieux populaires : recherche du lieu, dans l'onglet choisi", async ({ page }) => {
  const recherche = page.getByRole("search");
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await appuyer(recherche.getByRole("link", { name: "Marcory" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&q=Marcory$/);
});

test("Lieu : villes, communes et quartiers proposés en tapant, liste sous le champ", async ({ page }) => {
  const recherche = page.getByRole("search");
  const champ = recherche.getByRole("combobox", { name: "Villes, communes, quartiers" });
  await appuyer(champ);
  const liste = page.getByRole("listbox", { name: "Lieux proposés" });
  await expect(liste.getByRole("option").first()).toContainText("Abengourou"); // rien de tapé : villes et communes
  await champ.pressSequentially("rivi");
  await expect(liste.getByRole("option").nth(1)).toHaveText("Riviera 2Quartier · Cocody");
  const [c, l] = [await champ.boundingBox(), await liste.boundingBox()];
  expect(l!.y).toBeGreaterThanOrEqual(c!.y + c!.height); // jamais par-dessus le champ
  await appuyer(liste.getByRole("option").nth(1));
  await expect(champ).toHaveValue("Riviera 2, Cocody");
  await expect(liste).toBeHidden();
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&q=Riviera\+2%2C\+Cocody$/);
  await expect(page.getByLabel("Votre recherche")).toContainText("Riviera 2, Cocody");
});

test("Lieu : clavier (flèches, Entrée) et nom exact écrit en quittant le champ", async ({ page }) => {
  test.skip(estTelephone(), "clavier d'ordinateur");
  const champ = page.getByRole("combobox", { name: "Villes, communes, quartiers" });
  await champ.click();
  await champ.pressSequentially("bietr");
  await page.keyboard.press("Enter");
  await expect(champ).toHaveValue("Biétry, Marcory");
  await champ.fill("");
  await champ.pressSequentially("bouake");
  await page.keyboard.press("Escape");
  await page.getByRole("search").getByLabel("Type de bien").focus(); // quitter le champ
  await expect(champ).toHaveValue("Bouaké");
  await champ.click();
  await champ.fill("Remblais"); // dans deux communes : pas deviné
  await page.getByRole("search").getByLabel("Type de bien").focus();
  await expect(champ).toHaveValue("Remblais");
});

test("Téléphone : clavier ouvert, le champ remonte et la liste tient entre le champ et le clavier", async ({ page }) => {
  test.skip(!estTelephone(), "téléphone seulement");
  // Clavier ouvert simulé : la partie visible de l'écran ne fait plus que 364 px de haut
  await page.addInitScript(() => {
    const vv = { offsetTop: 0, offsetLeft: 0, width: innerWidth, height: 364, scale: 1, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, "visualViewport", { get: () => vv });
  });
  await page.goto("/");
  await appuyer(page.getByRole("search").getByRole("button", { name: "Louer" }));
  const champ = page.getByRole("combobox", { name: "Villes, communes, quartiers" });
  await champ.evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 330));
  await appuyer(champ);
  await page.waitForTimeout(300);
  const [c, l] = [await champ.boundingBox(), await page.getByRole("listbox", { name: "Lieux proposés" }).boundingBox()];
  expect(c!.y).toBeGreaterThanOrEqual(68); // sous la barre du haut
  expect(l!.y).toBeGreaterThanOrEqual(c!.y + c!.height);
  expect(l!.y + l!.height).toBeLessThanOrEqual(364);
  expect(l!.height).toBeGreaterThan(90);
});

test("Annonces récentes : les boutons trient par type de bien", async ({ page }) => {
  const section = page.locator("#annonces");
  const cartes = section.getByRole("article");
  await expect(cartes).toHaveCount(6);
  // Dans l'ordre de la publication, seulement les types présents parmi les annonces
  await expect(section.getByRole("group", { name: "Type de bien" }).getByRole("button"))
    .toHaveText(["Tous", "Appartements", "Maisons", "Villas", "Terrains", "Bureaux"]);
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
