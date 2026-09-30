// Vitrine de chaque annonceur (/annonceur/…) : toutes ses annonces en ligne, avec la recherche et les filtres,
// à partager. Les annonces d'exemple (tests/base/annonces-exemple.json) ont plusieurs annonceurs : l'agence
// Kamika Immobilier (vitrine « kamika », 2 annonces), Awa Koné (particulière, « awakon », 1 annonce)…
// « Ma vitrine » (Mes annonces, menu ☰, /ma-vitrine) : compte imité par tests/faux-supabase.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, estTelephone, expect, test } from "./outils";

const nombre = (page: Page) => page.getByRole("status").filter({ hasText: "trouvée" });
const cartes = (page: Page) => page.getByRole("main").getByRole("article");
const KAMIKA = "/annonceur/kamika-immobilier-kamika";
/** adresse d'un lien de partage WhatsApp, décodée (texte puis lien) */
const messageWhatsApp = async (lien: ReturnType<Page["getByRole"]>) =>
  decodeURIComponent((await lien.getAttribute("href"))!.replace(/^https:\/\/wa\.me\/\?text=/, ""));

test("Vitrine d'une agence : ses annonces seulement, onglets et filtres, adresse de référence", async ({ page }) => {
  // Une adresse incomplète (le code seul) ou un ancien nom mènent à la bonne, en gardant les critères
  await page.goto("/annonceur/kamika");
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}$`));
  await page.goto("/annonceur/ancien-nom-kamika?tx=location");
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}\\?tx=location$`));

  await page.goto(KAMIKA);
  await expect(page.locator("h1")).toHaveText("Kamika Immobilier");
  await expect(page).toHaveTitle("Kamika Immobilier — annonces immobilières — 360-Immo.ci");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${KAMIKA}$`));
  const principal = page.getByRole("main");
  await expect(principal.getByText("Agence immobilière", { exact: true })).toBeVisible();
  await expect(principal.getByText("Vérifiée par 360-Immo.ci")).toBeVisible();
  await expect(principal.getByText(/^2 annonces en ligne · Membre depuis /)).toBeVisible();
  await expect(principal.getByText("C'est votre vitrine.")).toHaveCount(0); // seulement pour l'annonceur connecté

  await expect(nombre(page)).toHaveText("2 annonces trouvées");
  await expect(page.getByRole("tablist", { name: "Transaction" }).getByRole("tab")).toHaveText([/Tous\s*2/, /À louer\s*1/, /À vendre\s*1/]);
  await expect(cartes(page)).toHaveText([/Appartement 3 pièces meublé à louer — Riviera 2/, /Immeuble R\+4 à vendre/]);

  // Les filtres restent sur la vitrine
  await appuyer(page.getByRole("tab", { name: /À vendre/ }));
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}\\?tx=achat$`));
  await expect(nombre(page)).toHaveText("1 annonce trouvée");
  await expect(page.locator("h1")).toHaveText("Kamika Immobilier");
  await appuyer(cartes(page).getByRole("link").first());
  await expect(page).toHaveURL(/\/annonces\/immeuble-r-4-a-vendre-.*-imm-2026-\d+$/);
});

test("Partager cette recherche : WhatsApp avec les critères et le lien, copier le lien", async ({ page }) => {
  await page.goto(`${KAMIKA}?tx=location`);
  await expect(nombre(page)).toHaveText("1 annonce trouvée");
  await appuyer(page.getByRole("button", { name: "Partager cette recherche" }));
  const menu = page.getByRole("menu", { name: "Partager cette recherche" });
  await expect(menu).toBeVisible();
  expect(await messageWhatsApp(menu.getByRole("menuitem", { name: "WhatsApp" }))).toBe(
    `Biens à louer — Kamika Immobilier : 1 annonce sur 360-Immo.ci ${new URL(page.url()).origin}${KAMIKA}?tx=location`);
  await appuyer(menu.getByRole("menuitem", { name: "Copier le lien" }));
  await expect(menu.getByRole("menuitem", { name: "Lien copié" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // La liste de toutes les annonces se partage de la même façon
  await page.goto("/annonces?type=appartement");
  await appuyer(page.getByRole("button", { name: "Partager cette recherche" }));
  expect(await messageWhatsApp(page.getByRole("menuitem", { name: "WhatsApp" }))).toMatch(
    /^Appartements : 6 annonces sur 360-Immo\.ci http:\/\/[^/]+\/annonces\?type=appartement$/);
});

test("Particulier : nom discret (« Awa K. ») ; vitrine inconnue", async ({ page }) => {
  await page.goto("/annonceur/awakon");
  await expect(page).toHaveURL(/\/annonceur\/awa-k-awakon$/);
  await expect(page.locator("h1")).toHaveText("Awa K.");
  await expect(page.getByRole("main").getByText("Particulier", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("main").getByText(/^1 annonce en ligne · /)).toBeVisible();
  await expect(nombre(page)).toHaveText("1 annonce trouvée");
  await expect(page.getByRole("tab", { name: /À vendre/ })).toHaveText(/À vendre\s*0/);

  const reponse = await page.goto("/annonceur/zzzzzz");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Cette vitrine n'existe pas");
  await expect(page.getByRole("link", { name: "Voir les annonces" })).toHaveAttribute("href", "/annonces");
});

test("Fiche : « Toutes les annonces de … » mène à la vitrine de l'annonceur", async ({ page }) => {
  await page.goto("/annonces/imm-2026-01001");
  const contact = page.locator("#contact");
  await expect(contact.getByText("Vérifiée", { exact: true })).toBeVisible();
  await appuyer(contact.getByRole("link", { name: "Toutes les annonces de Kamika Immobilier" }));
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}$`));
  await expect(page.locator("h1")).toHaveText("Kamika Immobilier");
});

// ── Ma vitrine (compte connecté) ──

const inscrire = (f: FauxSupabase) =>
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });

async function seConnecter(page: Page) {
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("Mes annonces : encadré « Ma vitrine » (adresse, nom affiché, WhatsApp) et partage de chaque annonce en ligne", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = inscrire(f);
  const enLigne = f.annonce(moi, {
    titre: "Appartement 2 pièces à louer — Niangon", statut: "publiee", prix: 120000,
    expire_le: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  f.annonce(moi, { titre: "Studio à louer — Marcory", statut: "brouillon" });
  await page.goto(`/connexion?suite=${encodeURIComponent("/mon-espace?section=annonces")}`);
  await seConnecter(page);

  const vitrine = page.getByRole("region", { name: "Ma vitrine" });
  await expect(vitrine).toContainText("1 annonce en ligne · vous y apparaissez sous le nom « Awa K. »");
  await expect(vitrine).toContainText(/127\.0\.0\.1:\d+\/annonceur\/awa-k-c00001/);
  await expect(vitrine.getByRole("link", { name: "Voir ma vitrine" })).toHaveAttribute("href", "/annonceur/awa-k-c00001");
  expect(await messageWhatsApp(vitrine.getByRole("link", { name: "WhatsApp" }))).toMatch(
    /^Découvrez mes annonces immobilières \(Awa K\.\) sur 360-Immo\.ci : http:\/\/[^/]+\/annonceur\/awa-k-c00001$/);

  // Chaque annonce en ligne se partage seule ; un brouillon, non
  const carte = (titre: string) => page.getByRole("listitem").filter({ hasText: titre });
  await expect(carte("Studio").getByRole("button", { name: "Partager l'annonce" })).toHaveCount(0);
  await appuyer(carte("Niangon").getByRole("button", { name: "Partager l'annonce" }));
  expect(await messageWhatsApp(carte("Niangon").getByRole("menuitem", { name: "WhatsApp" }))).toMatch(
    new RegExp(`^Appartement 2 pièces à louer — Niangon — 120\\s000 FCFA / mois http://[^/]+/annonces/appartement-2-pieces-a-louer-niangon-${String(enLigne.reference).toLowerCase()}$`));
});

test("Ma vitrine : menu ☰ et /ma-vitrine (connexion d'abord), bandeau « C'est votre vitrine »", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = inscrire(f);
  f.profils.get(moi)!.code_vitrine = "kamika"; // la vitrine d'exemple de Kamika Immobilier devient la sienne

  // Sans compte : la connexion, puis retour vers sa vitrine
  await page.goto("/ma-vitrine");
  await expect(page).toHaveURL(/\/connexion\?suite=\/ma-vitrine$/);
  await seConnecter(page);
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}$`));
  const bandeau = page.getByRole("note");
  await expect(bandeau).toContainText("C'est votre vitrine.");
  await appuyer(bandeau.getByRole("button", { name: "Partager ma vitrine" }));
  expect(await messageWhatsApp(bandeau.getByRole("menuitem", { name: "WhatsApp" }))).toMatch(
    new RegExp(`^Découvrez mes annonces immobilières \\(Kamika Immobilier\\) sur 360-Immo\\.ci : http://[^/]+${KAMIKA}$`));

  // Menu ☰ (téléphone) ou menu de Mon Espace (ordinateur) : « Ma vitrine »
  if (estTelephone()) {
    await page.goto("/");
    await appuyer(page.getByRole("button", { name: "Ouvrir le menu" }));
    await appuyer(page.getByRole("complementary", { name: "Menu du site" }).getByRole("link", { name: "Ma vitrine" }));
  } else {
    await page.goto("/mon-espace");
    await page.getByRole("navigation", { name: "Mon espace" }).getByRole("link", { name: "Ma vitrine" }).click();
  }
  await expect(page).toHaveURL(new RegExp(`${KAMIKA}$`));
});
