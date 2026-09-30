// Page d'accueil : recherche, annonces, chiffres, liens.
import { appuyer, estTelephone, expect, test } from "./outils";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("Rechercher : les critères arrivent sur la liste des annonces", async ({ page }) => {
  const recherche = page.getByRole("search", { name: "Rechercher un bien" });
  // « Louer » vient en premier et est choisi d'office
  await expect(recherche.getByRole("button").first()).toHaveText("Louer");
  await expect(recherche.getByRole("button", { name: "Louer" })).toHaveAttribute("aria-pressed", "true");
  await expect(recherche.getByRole("button", { name: "Acheter" })).toHaveAttribute("aria-pressed", "false");
  await recherche.getByLabel("Villes, communes, quartiers").fill("Cocody");
  await recherche.getByLabel("Type de bien").selectOption("Appartement");
  const budget = recherche.getByLabel("Loyer max (FCFA / mois)");
  await budget.fill("300000");
  await expect(budget).toHaveValue(/^300\s000$/); // chiffres groupés en tapant
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&type=appartement&q=Cocody&max=300000$/);
  // La liste des annonces reprend la recherche (annonces d'exemple : tests/base/annonces-exemple.json)
  await expect(page.locator("h1")).toHaveText("Appartements à louer à Cocody");
  await expect(page.getByRole("combobox", { name: "Ville, commune ou quartier" })).toHaveValue("Cocody");
  await expect(page.getByRole("tab", { name: /À louer/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#filtres").getByLabel("Maximum (FCFA)")).toHaveValue(/^300\s000$/);
  await expect(page.getByRole("status").filter({ hasText: "trouvée" })).toHaveText("1 annonce trouvée");
  await expect(page.getByRole("article")).toHaveText(/Appartement 3 pièces à louer — Riviera 3/);
});

test("Louer : la location à la journée n'est proposée que pour un logement", async ({ page }) => {
  const recherche = page.getByRole("search", { name: "Rechercher un bien" });
  await appuyer(recherche.getByRole("button", { name: "Acheter" }));
  await expect(recherche.getByLabel("Prix max (FCFA)")).toBeVisible();
  await expect(recherche.getByRole("button", { name: "Journalière" })).toBeHidden();
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
  await expect(options).toHaveText(["Tous les biens", ...TOUS, "Chambre d'hôtel", "Autres"]); // Louer
  await appuyer(recherche.getByRole("button", { name: "Acheter" }));
  await expect(options).toHaveText(["Tous les biens", ...TOUS, "Autres"]); // une chambre d'hôtel ne s'achète pas
  await appuyer(recherche.getByRole("button", { name: "Louer" }));
  await recherche.getByLabel("Type de bien").selectOption("Chambre d'hôtel");
  await expect(recherche.getByRole("button", { name: "Mensuelle" })).toBeHidden();
  await expect(recherche.getByRole("button", { name: "Journalière" })).toHaveAttribute("aria-pressed", "true");
  await expect(recherche.getByLabel("Loyer max (FCFA / nuit)")).toBeVisible();
  await appuyer(recherche.getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=jour&type=hotel$/);
  await expect(page.locator("h1")).toHaveText("Chambres d'hôtel à louer");
  await expect(page.getByRole("article")).toHaveText(/Chambre d'hôtel à louer — Centre des affaires/);
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
  // Les critères sont repris dans les filtres de la liste (aucune annonce d'exemple n'y répond)
  const filtres = page.locator("#filtres");
  const choisi = (groupe: string, nom: string) =>
    expect(filtres.getByRole("group", { name: groupe, exact: true, includeHidden: true }).getByRole("button", { name: nom, exact: true, includeHidden: true }))
      .toHaveAttribute("aria-pressed", "true");
  await choisi("Nombre de pièces", "3");
  await choisi("Chambres", "2");
  await choisi("Préférences", "Déjà meublé");
  await choisi("Étage", "1er");
  await choisi("Commodités", "Piscine");
  await expect(filtres.getByLabel("Surface minimum (m²)")).toHaveValue("50");
  await expect(page.getByText("Aucune annonce ne correspond à cette recherche pour l'instant.")).toBeVisible();
});

test("Plus de critères : un terrain n'a ni pièces ni « meublé », les choix devenus sans objet disparaissent", async ({ page }) => {
  const recherche = page.getByRole("search");
  const groupe = (nom: string) => recherche.getByRole("group", { name: nom, exact: true });
  await appuyer(recherche.getByRole("button", { name: "Acheter" }));
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
  await appuyer(recherche.getByRole("link", { name: "Marcory" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&q=Marcory$/); // Louer, choisi d'office
  await page.goBack();
  await appuyer(recherche.getByRole("button", { name: "Acheter" }));
  await appuyer(recherche.getByRole("link", { name: "Marcory" }));
  await expect(page).toHaveURL(/\/annonces\?tx=achat&q=Marcory$/);
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
  await expect(page.locator("h1")).toHaveText("Biens à louer à Riviera 2, Cocody");
  await expect(page.getByRole("article")).toHaveText(/Appartement 3 pièces meublé à louer — Riviera 2/);
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

test("Annonces récentes : les vraies annonces en ligne ; les boutons trient par type de bien", async ({ page }) => {
  // Les 12 annonces d'exemple les plus récentes (tests/base/annonces-exemple.json), 6 affichées
  const section = page.locator("#annonces");
  const cartes = section.getByRole("article");
  await expect(cartes).toHaveCount(6);
  // Dans l'ordre de la publication, seulement les types présents parmi les annonces
  await expect(section.getByRole("group", { name: "Type de bien" }).getByRole("button"))
    .toHaveText(["Tous", "Appartements", "Maisons", "Villas", "Terrains", "Commerces / Magasins", "Chambres d'hôtel"]);
  await appuyer(section.getByRole("button", { name: "Terrains" }));
  await expect(cartes).toHaveCount(1);
  await expect(cartes).toContainText("Terrain 600 m² à vendre — Songon-Agban");
  await appuyer(section.getByRole("button", { name: "Villas" }));
  await expect(cartes).toHaveCount(2);
  await appuyer(section.getByRole("button", { name: "Tous" }));
  await expect(cartes).toHaveCount(6);
  // Premium en tête
  await expect(cartes.first()).toContainText("Premium");
});

test("Annonces : prix de même style partout, favori, carte qui mène à la fiche, pas de numéro", async ({ page }) => {
  const prix = page.locator("#annonces article").locator("[class*='__prix']");
  await expect(prix).toHaveCount(6);
  const styles = await prix.evaluateAll((els) =>
    els.map((e) => {
      const c = getComputedStyle(e);
      return `${c.fontFamily} ${c.fontSize} ${c.fontWeight} ${c.color} ${c.fontVariantNumeric}`;
    }),
  );
  expect(new Set(styles).size, styles.join("\n")).toBe(1);
  await expect(prix.first()).toHaveText(/^185\s000\s000 FCFA$/);
  await expect(prix.nth(1)).toHaveText(/^25\s000 FCFA \/ jour$/);

  const titre = "Villa 5 pièces avec piscine à vendre — Angré";
  await appuyer(page.getByRole("button", { name: `Ajouter aux favoris : ${titre}` }));
  await expect(page.getByRole("button", { name: `Retirer des favoris : ${titre}` })).toHaveAttribute("aria-pressed", "true");

  // Les numéros ne sont que sur la fiche, après un clic
  await expect(page.locator("#annonces").getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  await appuyer(page.locator("#annonces").getByRole("link", { name: titre }));
  await expect(page).toHaveURL(/\/annonces\/villa-5-pieces-avec-piscine-a-vendre-angre-imm-2026-01002$/);
  await expect(page.locator("h1")).toHaveText(titre);
});

test("Chiffres : affichés en entier après défilement", async ({ page }) => {
  const chiffres = page.locator("[class*='__chiffreValeur']");
  await chiffres.first().scrollIntoViewIfNeeded();
  await expect(chiffres).toHaveText([/^3\s842\+$/, "48+", "32", /^12\s500\+$/], { timeout: 5000 });
});

test("Villes et appel à publier mènent au bon endroit", async ({ page }) => {
  // Nombre réel d'annonces en ligne par ville
  await expect(page.getByRole("link", { name: "Daloa Bientôt des annonces" })).toBeVisible();
  await appuyer(page.getByRole("link", { name: "Bouaké 1 annonce" }));
  await expect(page).toHaveURL(/\/annonces\?q=Bouak%C3%A9$/);
  await expect(page.locator("h1")).toHaveText("Annonces immobilières à Bouaké");
  await expect(page.getByRole("article")).toHaveText(/Maison 3 pièces à louer — Air France 2/);
  await page.goto("/");
  await appuyer(page.getByRole("link", { name: "Publier une annonce gratuite" }));
  await expect(page).toHaveURL(/\/publier$/);
});
