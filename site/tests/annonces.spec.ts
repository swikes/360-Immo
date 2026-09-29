// Liste des annonces (/annonces) et fiche d'un bien (/annonces/…-imm-2026-00001).
// Le site lit les annonces d'exemple de la fausse base (tests/base/serveur.mjs, tests/base/annonces-exemple.json) :
// 16 en ligne, une expirée et un brouillon (jamais affichés).
import type { Page } from "@playwright/test";
import { appuyer, estTelephone, expect, test } from "./outils";

const nombre = (page: Page) => page.getByRole("status").filter({ hasText: "trouvée" });
const cartes = (page: Page) => page.getByRole("main").getByRole("article");

/** Les filtres : colonne de gauche sur ordinateur, panneau « Filtres » à ouvrir sur téléphone */
async function filtres(page: Page) {
  if (estTelephone()) await appuyer(page.getByRole("button", { name: /^Filtres/ }));
  const f = page.getByRole("complementary", { name: "Filtres" });
  await expect(f).toBeVisible();
  return f;
}
/** Téléphone : refermer le panneau pour voir la liste */
async function voirListe(page: Page) {
  if (estTelephone()) await appuyer(page.getByRole("button", { name: /^Voir (les|la)/ }));
}

test("Liste : toutes les annonces en ligne, onglets avec leurs nombres, pages", async ({ page }) => {
  await page.goto("/annonces");
  await expect(page.locator("h1")).toHaveText("Annonces immobilières");
  await expect(nombre(page)).toHaveText("16 annonces trouvées");
  const onglets = page.getByRole("tablist", { name: "Transaction" }).getByRole("tab");
  await expect(onglets).toHaveText([/Tous\s*16/, /À louer\s*9/, /À vendre\s*7/]);
  await expect(cartes(page)).toHaveCount(12);
  await expect(page.getByText("Appartement expiré à louer")).toHaveCount(0);
  await expect(page.getByText("Brouillon pas encore envoyé")).toHaveCount(0);
  // Page 2 : les 4 dernières
  const pages = page.getByRole("navigation", { name: "Pages" });
  await expect(pages.getByText("1", { exact: true })).toHaveAttribute("aria-current", "page");
  await appuyer(pages.getByRole("link", { name: "Suivante" }));
  await expect(page).toHaveURL(/\/annonces\?page=2$/);
  await expect(cartes(page)).toHaveCount(4);
  // Onglet « À vendre »
  await appuyer(page.getByRole("tab", { name: /À vendre/ }));
  await expect(page).toHaveURL(/\/annonces\?tx=achat$/);
  await expect(page.locator("h1")).toHaveText("Biens à vendre");
  await expect(nombre(page)).toHaveText("7 annonces trouvées");
});

test("Filtres : chaque choix affine la liste et s'écrit dans l'adresse ; « Tout effacer »", async ({ page }) => {
  await page.goto("/annonces");
  let f = await filtres(page);
  await f.getByRole("checkbox", { name: /Appartement/ }).check();
  await expect(page).toHaveURL(/\/annonces\?type=appartement$/);
  await expect(nombre(page)).toHaveText("6 annonces trouvées");
  await appuyer(f.getByRole("group", { name: "Transaction" }).getByRole("button", { name: "À louer" }));
  await expect(nombre(page)).toHaveText("5 annonces trouvées");
  await expect(page.locator("h1")).toHaveText("Appartements à louer");
  await appuyer(f.getByRole("button", { name: "Au mois" }));
  await expect(nombre(page)).toHaveText("3 annonces trouvées");
  // Budget : appliqué quand on s'arrête de taper
  await f.getByLabel("Maximum (FCFA)").fill("300000");
  await expect(f.getByLabel("Maximum (FCFA)")).toHaveValue(/^300\s000$/);
  await expect(page).toHaveURL(/max=300000/);
  await expect(nombre(page)).toHaveText("2 annonces trouvées");
  // Pièces : seulement celles qui ont un sens (studio pour un appartement)
  const pieces = f.getByRole("group", { name: "Nombre de pièces" });
  await expect(pieces.getByRole("button")).toHaveText(["Studio", "2", "3", "4", "5+"]);
  await appuyer(pieces.getByRole("button", { name: "3", exact: true }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois&type=appartement&max=300000&pieces=3$/);
  await expect(nombre(page)).toHaveText("1 annonce trouvée");
  if (estTelephone()) await expect(page.getByRole("button", { name: /^Voir la liste|^Voir les 1 annonce/ })).toBeVisible();
  await voirListe(page);
  await expect(cartes(page)).toHaveText([/Appartement 3 pièces à louer — Riviera 3/]);
  // Tout effacer : garde la transaction et la durée
  f = await filtres(page);
  await appuyer(f.getByRole("button", { name: "Tout effacer" }));
  await expect(page).toHaveURL(/\/annonces\?tx=location&duree=mois$/);
  await expect(nombre(page)).toHaveText("6 annonces trouvées");
  await expect(f.getByRole("checkbox", { name: /Appartement/ })).not.toBeChecked();
});

test("Filtres : un terrain n'a ni pièces ni chambres ; préférences et commodités", async ({ page }) => {
  await page.goto("/annonces?type=terrain");
  const f = await filtres(page);
  await expect(f.getByRole("group", { name: "Nombre de pièces" })).toHaveCount(0);
  await expect(f.getByRole("group", { name: "Chambres" })).toHaveCount(0);
  await expect(f.getByRole("group", { name: "Superficie (m²)" })).toBeVisible();
  await appuyer(f.getByRole("button", { name: "Titre foncier (ACD)" }));
  await expect(page).toHaveURL(/type=terrain&com=Titre\+foncier\+%28ACD%29$/);
  await expect(nombre(page)).toHaveText("1 annonce trouvée");
  await appuyer(f.getByRole("button", { name: "Biens vérifiés" }));
  await expect(nombre(page)).toHaveText("0 annonce trouvée");
  await voirListe(page);
  await expect(page.getByText("Aucune annonce ne correspond à cette recherche pour l'instant.")).toBeVisible();
});

test("Tri par prix ; lieu écrit dans la recherche (quartier hors liste compris)", async ({ page }) => {
  await page.goto("/annonces?tx=achat");
  const tri = page.getByLabel("Trier par");
  await tri.selectOption("prix_asc");
  await expect(page).toHaveURL(/\/annonces\?tx=achat&tri=prix_asc$/);
  await expect(cartes(page).first()).toContainText("Terrain 1 000 m² à vendre — Yamoussoukro");
  await tri.selectOption("prix_desc");
  await expect(cartes(page).first()).toContainText("Immeuble R+4 à vendre — Adjamé-Liberté");

  await page.goto("/annonces");
  const lieu = page.getByRole("combobox", { name: "Ville, commune ou quartier" });
  await lieu.fill("Air France 2");
  await appuyer(page.getByRole("search", { name: "Chercher un lieu" }).getByRole("button", { name: "Chercher" }));
  await expect(page).toHaveURL(/\/annonces\?q=Air\+France\+2$/);
  await expect(page.locator("h1")).toHaveText("Annonces immobilières à Air France 2");
  await expect(cartes(page)).toHaveText([/Maison 3 pièces à louer — Air France 2/]);
  // Lieu sans annonce
  await page.goto("/annonces?q=Korhogo");
  await expect(page.getByText("Aucune annonce ne correspond à cette recherche pour l'instant.")).toBeVisible();
  await appuyer(page.getByRole("link", { name: "Voir toutes les annonces" }));
  await expect(page).toHaveURL(/\/annonces$/);
  await expect(nombre(page)).toHaveText("16 annonces trouvées");
});

test("Fiche : prix, caractéristiques, quartier, numéro seulement après un clic, WhatsApp prérempli", async ({ page }) => {
  // Une adresse incomplète mène à la bonne (titre de l'annonce, pour Google et le partage)
  await page.goto("/annonces/imm-2026-01001");
  await expect(page).toHaveURL(/\/annonces\/appartement-3-pieces-meuble-a-louer-riviera-2-imm-2026-01001$/);
  const titre = "Appartement 3 pièces meublé à louer — Riviera 2";
  await expect(page.locator("h1")).toHaveText(titre);
  await expect(page).toHaveTitle(/^Appartement 3 pièces meublé à louer — Riviera 2 — 350\s000 FCFA \/ mois — 360-Immo\.ci$/);
  const principal = page.getByRole("main");
  await expect(principal.getByText(/^\+ 3 mois de caution \(1\s050\s000 FCFA\)$/)).toBeVisible();
  await expect(principal.getByRole("definition").filter({ hasText: "2e étage" })).toBeVisible();
  await expect(principal.getByRole("region", { name: "Commodités et équipements" }).getByRole("listitem"))
    .toHaveText(["Air conditionné", "Chauffe-eau", "Parking", "Gardien", "Fibre / Wifi"]);
  await expect(principal.getByText("Repère : Près de la pharmacie Les Oscars")).toBeVisible();
  await expect(principal.getByRole("link", { name: "Voir le quartier sur la carte" }))
    .toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Riviera%202%2C%20Cocody%2C%20Abidjan/);
  await expect(principal.getByText("Bien vérifié par 360-Immo.ci")).toBeVisible();

  // Le numéro n'est pas dans la page (ni visible, ni caché) avant le clic
  expect(await page.content()).not.toContain("07 48 32");
  const contact = page.locator("#contact");
  await expect(contact).toContainText("Kamika Immobilier");
  await expect(contact).toContainText("Agence immobilière");
  await appuyer(contact.getByRole("button", { name: "Afficher le numéro" }));
  await expect(contact.getByRole("link", { name: "+225 07 48 32 11 90" })).toHaveAttribute("href", "tel:+2250748321190");
  const whatsapp = contact.getByRole("link", { name: "WhatsApp" });
  await expect(whatsapp).toHaveCount(1); // le second numéro (fixe) n'est pas sur WhatsApp
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/2250748321190\?text=Bonjour.*r%C3%A9f\.%20IMM-2026-01001/);
  await expect(contact.getByRole("link", { name: /\+225 27 22 44 55 66/ })).toBeVisible();
  await expect(contact.getByRole("link", { name: "contact@kamika.ci" })).toHaveAttribute("href", /^mailto:contact@kamika\.ci\?subject=/);
  // Visite, rappel, message : étape 6
  await expect(contact.getByRole("button", { name: /Planifier une visite/ })).toBeDisabled();

  // Partage et biens similaires
  await expect(page.getByRole("link", { name: "WhatsApp" }).last()).toHaveAttribute(
    "href", /^https:\/\/wa\.me\/\?text=.*imm-2026-01001/);
  const similaires = page.getByRole("region", { name: "Biens similaires" }).getByRole("article");
  await expect(similaires).toHaveCount(3);
  await expect(similaires.first()).toContainText("Appartement");
});

test("Fiche : aperçu du lien (WhatsApp, Facebook) et adresse de référence pour Google", async ({ page }) => {
  await page.goto("/annonces/imm-2026-01002");
  const meta = (nom: string) => page.locator(`meta[property="${nom}"]`);
  await expect(meta("og:title")).toHaveAttribute("content", /^Villa 5 pièces avec piscine à vendre — Angré — 185\s000\s000 FCFA$/);
  await expect(meta("og:image")).toHaveAttribute("content", /\/storage\/v1\/object\/public\/photos-annonces\/.+\/1-paysage-villa\.webp$/);
  await expect(meta("og:description")).toHaveAttribute("content", /^185\s000\s000 FCFA · Angré, Cocody, Abidjan\. Villa basse/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/annonces\/villa-5-pieces-avec-piscine-a-vendre-angre-imm-2026-01002$/);
});

test("Fiche : photos en grand (flèches, clavier, glisser), une seule vue comptée par visite", async ({ page }) => {
  const vues: string[] = [];
  page.on("request", (r) => r.url().includes("/rest/v1/rpc/compter_vue") && vues.push(r.url()));
  await page.goto("/annonces/imm-2026-01002");
  if (estTelephone()) {
    await expect(page.getByText("1 / 8")).toBeVisible();
    await appuyer(page.getByRole("button", { name: "Agrandir la photo 1 sur 8" }).filter({ visible: true }));
  } else {
    await appuyer(page.getByRole("button", { name: "Voir les 8 photos" }));
  }
  const ecran = page.getByRole("dialog", { name: /Photos : Villa 5 pièces/ });
  await expect(ecran).toBeVisible();
  await expect(ecran.getByText("1 / 8")).toBeVisible();
  if (!estTelephone()) {
    await page.keyboard.press("ArrowRight");
    await expect(ecran.getByText("2 / 8")).toBeVisible();
    await appuyer(ecran.getByRole("button", { name: "Photo précédente" }));
    await expect(ecran.getByText("1 / 8")).toBeVisible();
    await appuyer(ecran.getByRole("button", { name: "Photo précédente" }));
    await expect(ecran.getByText("8 / 8")).toBeVisible();
  }
  await appuyer(ecran.getByRole("button", { name: "Fermer les photos" }));
  await expect(ecran).toBeHidden();
  // Vue comptée une fois, même en rechargeant la page
  await expect.poll(() => vues.length).toBe(1);
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(500);
  expect(vues).toHaveLength(1);
});

test("Annonce expirée, brouillon ou adresse inconnue : « Cette annonce n'est plus en ligne »", async ({ page }) => {
  for (const adresse of ["/annonces/imm-2026-01017", "/annonces/imm-2026-01018", "/annonces/rien-imm-2026-99999", "/annonces/pas-une-annonce"]) {
    const reponse = await page.goto(adresse);
    expect(reponse?.status(), adresse).toBe(404);
    await expect(page.locator("h1")).toHaveText("Cette annonce n'est plus en ligne");
  }
  await appuyer(page.getByRole("main").getByRole("link", { name: "Voir les annonces" }));
  await expect(page).toHaveURL(/\/annonces$/);
});

test("Plan du site pour Google : les annonces en ligne ; robots.txt", async ({ request }) => {
  const plan = await (await request.get("/sitemap.xml")).text();
  expect(plan).toContain("/annonces/appartement-3-pieces-meuble-a-louer-riviera-2-imm-2026-01001");
  expect(plan).not.toContain("imm-2026-01017");
  expect(plan).not.toContain("imm-2026-01018");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/mon-espace/);
  expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});
