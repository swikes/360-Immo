// Prix du marché : estimation d'un bien, carte des prix, pages « Prix de l'immobilier à Cocody », plan du site.
// La fausse base (tests/base/serveur.mjs) a des annonces terminées ces derniers mois en plus des annonces en ligne :
//   Cocody, appartement 3 pièces non meublé à louer : 7 (300 000 / mois) · Yopougon, 2 pièces : 5 (100 000)
//   Plateau, 3 pièces : 5 (500 000) · Marcory, 2 pièces : 4 · Songon, terrain : 5 (50 000 / m²) · Cocody, villa 5 pièces : 5
import type { Page } from "@playwright/test";
import { fauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

/** Les 3 étapes de l'estimation, jusqu'au résultat */
async function estimer(page: Page, o: { vendre?: boolean; type?: string; lieu: string; pieces?: string; surface?: string }) {
  await page.goto("/estimation");
  if (o.vendre) await appuyer(page.getByRole("button", { name: "Vendre" }));
  if (o.type) await appuyer(page.getByRole("button", { name: o.type, exact: true }));
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await page.getByLabel("Commune ou quartier").fill(o.lieu);
  await page.getByLabel("Commune ou quartier").press("Escape");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  if (o.pieces) await appuyer(page.getByRole("button", { name: o.pieces, exact: true }));
  if (o.surface) await page.getByLabel("Superficie (m²)").fill(o.surface);
  await appuyer(page.getByRole("button", { name: "Estimer mon bien" }));
}

test("Estimation : prix du milieu, fourchette, fiabilité, quartier élargi à la commune, annonces semblables, publier à ce prix", async ({ page }) => {
  await estimer(page, { lieu: "Riviera 2", pieces: "3" });
  const resultat = page.locator("main");
  await expect(resultat.getByText("Loyer habituel d'un bien comme le vôtre")).toBeVisible();
  await expect(resultat.getByText("300 000 FCFA / mois", { exact: true })).toBeVisible();
  await expect(resultat.getByText("Fourchette habituelle : 290 000 – 335 000 FCFA / mois")).toBeVisible();
  await expect(resultat.getByText("Fiabilité : Indicative")).toBeVisible();
  await expect(resultat.getByText("D'après 7 annonces semblables dans la commune de Cocody")).toBeVisible();
  await expect(resultat.getByText("Pas assez d'annonces dans le quartier Riviera 2 (2) : comparaison dans la commune de Cocody.")).toBeVisible();
  await expect(resultat.getByText("Un bien en bon état, sans atout particulier, se place autour du prix du milieu.")).toBeVisible();
  await expect(resultat.getByText(/Ce sont les loyers demandés dans les annonces des 6 derniers mois/)).toBeVisible();
  // l'annonce en ligne qui compte (Riviera 3, 280 000) ; jamais une annonce terminée
  const semblables = page.getByRole("region", { name: "Annonces en ligne semblables à votre bien" });
  await expect(semblables.getByRole("article")).toHaveCount(1);
  await expect(semblables).toContainText("Appartement 3 pièces à louer — Riviera 3");
  await expect(page.getByRole("link", { name: "Publier mon annonce à ce prix" })).toHaveAttribute("href",
    "/publier?type=appartement&tx=location&loyer=mois&ville=Abidjan&commune=Cocody&quartier=Riviera+2&pieces=3&prix=300000");
  await expect(page.getByRole("link", { name: "Voir les annonces semblables" })).toHaveAttribute("href",
    "/annonces?tx=location&duree=mois&type=appartement&q=Cocody&pieces=3");
  await expect(page.getByRole("link", { name: "Prix à Cocody" })).toHaveAttribute("href", "/prix/cocody");
  // nouvelle estimation : retour à l'étape 1
  await appuyer(page.getByRole("button", { name: "Nouvelle estimation" }));
  await expect(page.getByRole("heading", { name: "Quel bien souhaitez-vous estimer ?" })).toBeVisible();
});

test("Estimation : commune élargie à la ville, terrain au m² puis pour sa superficie, pas assez d'annonces", async ({ page }) => {
  // Marcory : 4 appartements 2 pièces seulement → toute la ville d'Abidjan (Yopougon, Marcory, Cocody)
  await estimer(page, { lieu: "Marcory", pieces: "2" });
  await expect(page.getByText("Pas assez d'annonces dans la commune de Marcory (4) : comparaison dans la ville d'Abidjan.")).toBeVisible();
  await expect(page.getByText(/D'après 10 annonces semblables dans la ville d'Abidjan/)).toBeVisible();

  // Terrain de 600 m² à Songon : 50 000 FCFA / m², soit 30 000 000 FCFA
  await estimer(page, { vendre: true, type: "Terrain", lieu: "Songon", surface: "600" });
  await expect(page.getByText("Prix habituel d'un bien comme le vôtre")).toBeVisible();
  // (le premier : l'estimation ; plus bas, l'annonce en ligne du même prix)
  await expect(page.getByText("30 000 000 FCFA", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Fourchette habituelle : 27 000 000 – 33 000 000 FCFA")).toBeVisible();
  await expect(page.getByText("Soit 50 000 FCFA / m² pour 600 m².")).toBeVisible();
  await expect(page.getByRole("link", { name: "Publier mon annonce à ce prix" })).toHaveAttribute("href",
    "/publier?type=terrain&tx=vente&ville=Abidjan&commune=Songon&surface=600&prix=30000000");

  // Une maison 3 pièces à louer à Bouaké : une seule annonce, pas de prix inventé
  await estimer(page, { type: "Maison", lieu: "Bouaké", pieces: "3" });
  await expect(page.getByRole("heading", { name: "Pas encore assez d'annonces semblables" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Bouaké : 1 annonce" })).toBeVisible();
  await expect(page.getByText(/FCFA/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Publier mon annonce" })).toHaveAttribute("href",
    "/publier?type=maison&tx=location&loyer=mois&ville=Bouak%C3%A9&commune=Bouak%C3%A9&pieces=3");
});

test("Estimation : le lieu et le nombre de pièces sont demandés ; une ville de plusieurs communes ne suffit pas", async ({ page }) => {
  await page.goto("/estimation");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await expect(page.locator("main").getByRole("alert")).toHaveText(/Choisissez la ville, la commune ou le quartier dans la liste/);
  await page.getByLabel("Commune ou quartier").fill("Abidjan");
  await page.getByLabel("Commune ou quartier").press("Escape");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await expect(page.locator("main").getByRole("alert")).toHaveText(/Précisez la commune : Abidjan en compte plusieurs/);
  await page.getByLabel("Commune ou quartier").fill("Yopougon");
  await page.getByLabel("Commune ou quartier").press("Escape");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await expect(page.getByRole("heading", { name: "Décrivez votre bien" })).toBeVisible();
  await appuyer(page.getByRole("button", { name: "Estimer mon bien" }));
  await expect(page.locator("main").getByRole("alert")).toHaveText(/Combien de pièces/);
  // retour : les choix restent
  await appuyer(page.getByRole("button", { name: "Retour" }));
  await expect(page.getByLabel("Commune ou quartier")).toHaveValue("Yopougon");
});

test("Publier à ce prix : le formulaire arrive prérempli (type, location au mois, lieu, pièces, loyer)", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const adresse = "/publier?type=appartement&tx=location&loyer=mois&ville=Abidjan&commune=Cocody&quartier=Riviera+2&pieces=3&prix=300000";
  await page.goto(adresse);
  // sans compte : la connexion ramène au formulaire prérempli
  await expect(page.getByRole("link", { name: "Créer un compte gratuitement" })).toHaveAttribute("href",
    `/connexion?mode=inscription&suite=${encodeURIComponent(adresse)}`);
  await page.goto(`/connexion?suite=${encodeURIComponent(adresse)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/publier\?type=appartement/);
  const choix = (groupe: string, option: string) =>
    page.getByRole("radiogroup", { name: groupe, exact: true }).getByRole("radio", { name: option, exact: true });
  await expect(choix("Catégorie", "Appartement")).toHaveAttribute("aria-checked", "true");
  await expect(choix("Transaction", "À louer")).toHaveAttribute("aria-checked", "true");
  await expect(choix("Nombre de pièces", "3")).toHaveAttribute("aria-checked", "true");
  await expect(choix("Loyer par", "Mois")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#pub-ville")).toHaveValue("Abidjan");
  await expect(page.locator("#pub-commune")).toHaveValue("Cocody");
  await expect(page.locator("#pub-quartier")).toHaveValue("Riviera 2");
  await expect(page.locator("#pub-prix")).toHaveValue(/^300\s000$/);
  await expect(page.locator("#pub-titre")).toHaveValue("Appartement 3 pièces à louer — Riviera 2");
  await expect(page.locator("#pub-nom")).toHaveText("Awa Koné");   // le contact vient toujours du profil

  // ce qui n'a pas de sens est ignoré : un terrain n'a pas de pièces, une commune d'une autre ville n'est pas gardée
  await page.goto("/publier?type=terrain&tx=vente&ville=Bouaké&commune=Cocody&pieces=4&prix=abc");
  await expect(choix("Catégorie", "Terrain")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Nombre de pièces" })).toHaveCount(0);
  await expect(page.locator("#pub-ville")).toHaveValue("Bouaké");
  await expect(page.locator("#pub-commune")).toHaveValue("");
  await expect(page.locator("#pub-prix")).toHaveValue("");
});

test("Carte des prix : commune par commune, du plus cher au moins cher ; choix dans l'adresse ; carte et légende", async ({ page }) => {
  await page.goto("/carte-des-prix");
  await expect(page.locator("h1")).toHaveText("Carte des prix");
  await expect(page.getByText("Appartements non meublés à louer", { exact: true })).toBeVisible();
  const abidjan = page.getByRole("region", { name: "Abidjan" });
  await expect(abidjan.getByRole("listitem")).toHaveText([
    /Plateau.*500\s000 FCFA \/ mois/, /Cocody.*300\s000 FCFA \/ mois/, /Yopougon.*100\s000 FCFA \/ mois/,
    /Marcory.*4 annonces.*Pas encore assez d'annonces/,
  ]);
  await expect(abidjan.getByRole("link", { name: "Cocody", exact: true })).toHaveAttribute("href", "/prix/cocody");
  await expect(abidjan.getByRole("link", { name: "Voir les annonces à Plateau" })).toHaveAttribute("href",
    "/annonces?tx=location&duree=mois&type=appartement&q=Plateau");
  // une pastille par commune (4), sur la carte de Leaflet
  await expect(page.getByRole("region", { name: /^Carte des prix : Appartements non meublés à louer/ })).toBeVisible();
  await expect(page.locator(".leaflet-interactive")).toHaveCount(4);

  // Choix : 3 pièces, puis acheter un terrain (au m²)
  const choix = page.getByRole("navigation", { name: "Choix des biens" });
  await appuyer(choix.getByRole("link", { name: "3 pièces", exact: true }));
  await expect(page).toHaveURL(/\/carte-des-prix\?tx=location&type=appartement&pieces=3$/);
  await expect(abidjan.getByRole("listitem")).toHaveText([/Plateau.*500\s000/, /Cocody.*300\s000/]);
  await appuyer(choix.getByRole("link", { name: "Acheter" }));
  await appuyer(choix.getByRole("link", { name: "Terrain", exact: true }));
  await expect(page).toHaveURL(/\/carte-des-prix\?tx=achat&type=terrain$/);
  await expect(choix.getByRole("link", { name: "3 pièces" })).toHaveCount(0);   // un terrain n'a pas de pièces
  await expect(abidjan.getByRole("listitem")).toHaveText([/Songon.*50\s000 FCFA \/ m².*45\s000 – 55\s000 FCFA \/ m²/]);
  await expect(page.getByRole("region", { name: "Autres villes" }).getByRole("listitem"))
    .toHaveText([/Yamoussoukro.*1 annonce.*Pas encore assez d'annonces/]);

  // Rien pour ce choix : on le dit, sans chiffre
  await page.goto("/carte-des-prix?tx=achat&type=commerce");
  await expect(page.getByText(/Pas encore d'annonces pour ce choix/)).toBeVisible();
});

test("Page « Prix de l'immobilier à Cocody » : loyers et prix de vente, adresse de référence ; sans prix, pas pour Google", async ({ page }) => {
  await page.goto("/prix/cocody");
  await expect(page).toHaveTitle("Prix de l'immobilier à Cocody (Abidjan) : loyers et prix de vente — 360-Immo.ci");
  await expect(page.locator("h1")).toHaveText("Prix de l'immobilier à Cocody");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/prix\/cocody$/);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content",
    /Appartement 3 pièces, non meublé : 300\s000 FCFA \/ mois/);
  await expect(page.getByRole("region", { name: "À louer" }).getByRole("listitem"))
    .toHaveText([/Appartement 3 pièces, non meublé.*7 annonces.*300\s000 FCFA \/ mois.*290\s000 – 335\s000 FCFA \/ mois/]);
  await expect(page.getByRole("region", { name: "À vendre" }).getByRole("listitem"))
    .toHaveText([/Villa 5 pièces et plus.*5 annonces.*185\s000\s000 FCFA.*160\s000\s000 – 200\s000\s000 FCFA/]);
  await expect(page.getByRole("region", { name: "Pas encore assez d'annonces pour un prix" })).toContainText("Appartement 3 pièces, meublé à louer · 1 annonce");
  await expect(page.getByRole("link", { name: /Estimer mon bien à Cocody/ })).toHaveAttribute("href", "/estimation?lieu=Cocody");
  await expect(page.getByRole("link", { name: /Voir les 4 annonces en ligne/ })).toHaveAttribute("href", "/annonces?q=Cocody");
  await appuyer(page.getByRole("navigation", { name: "Prix dans les autres communes d'Abidjan" }).getByRole("link", { name: "Plateau" }));
  await expect(page).toHaveURL(/\/prix\/plateau$/);
  await expect(page.locator("h1")).toHaveText("Prix de l'immobilier à Plateau");

  // Estimer depuis la page d'une commune : le lieu est déjà rempli
  await page.goto("/estimation?lieu=Cocody");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await expect(page.getByLabel("Commune ou quartier")).toHaveValue("Cocody");

  // Une commune sans prix : on le dit, et Google ne la garde pas ; une adresse inconnue : page introuvable
  await page.goto("/prix/koro");
  await expect(page.getByText(/Pas encore assez d'annonces à Koro pour donner des prix/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  expect((await page.goto("/prix/nulle-part"))?.status()).toBe(404);
});

test("Plan du site : estimation, carte des prix, et les communes qui ont un prix (pas les autres)", async ({ request }) => {
  const plan = await (await request.get("/sitemap.xml")).text();
  for (const chemin of ["/estimation", "/carte-des-prix", "/prix/cocody", "/prix/plateau", "/prix/yopougon", "/prix/songon"]) {
    expect(plan, chemin).toContain(`${chemin}</loc>`);
  }
  expect(plan).not.toContain("/prix/marcory<");
  expect(plan).not.toContain("/prix/koro<");
});

test("Pied de page : plus de chiffre inventé, l'estimation dit d'où viennent ses prix", async ({ page }) => {
  await page.goto("/");
  const pied = page.locator("footer");
  await expect(pied).toContainText("Estimation gratuite, d'après les prix des annonces semblables de votre quartier");
  await expect(pied).not.toContainText("3 842");
});
