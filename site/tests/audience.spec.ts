// Audience : mesure dans le site (pages vues, visites, recherches de la liste, pages introuvables) et onglet
// « Audience » de l'Administration. Les chiffres eux-mêmes (compteurs, classements, recherches, délais) :
// tests/base.spec.ts ; genre de page, origine de la visite et appareil : tests/logique.spec.ts.
import type { Page } from "@playwright/test";
import { exemple } from "./audience-exemple";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, estTelephone, expect, test } from "./outils";

/** La mesure ne compte pas les navigateurs pilotés (robots, comme celui des tests) : ici, on se fait passer pour un visiteur */
const commeUnVisiteur = (page: Page) =>
  page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
const appels = (f: FauxSupabase, fonction: string) => f.demandes.filter((d) => d.chemin === `/rest/v1/rpc/${fonction}`).map((d) => d.corps);

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("Mesure : page vue et visite (origine, appareil, campagne), recherche de la liste, page introuvable ; rien si le navigateur refuse le suivi", async ({ page }) => {
  const f = await fauxSupabase(page);
  await commeUnVisiteur(page);
  const appareil = estTelephone() ? "telephone" : "ordinateur";

  // Arrivée depuis Google : une visite, puis une recherche (même visite, même origine)
  await page.goto("/", { referer: "https://www.google.ci/" });
  await expect.poll(() => appels(f, "noter_page")).toEqual([
    { page: "accueil", source: "google", appareil, visite: true, campagne: null, campagne_source: null }]);
  await appuyer(page.getByRole("search").getByRole("button", { name: "Rechercher" }));
  await expect(page).toHaveURL(/\/annonces\?/);
  await expect.poll(() => appels(f, "noter_page").length).toBe(2);
  expect(appels(f, "noter_page")[1]).toMatchObject({ page: "liste", source: "google", visite: false });
  await expect.poll(() => appels(f, "noter_recherche").length).toBe(1);
  const [recherche] = appels(f, "noter_recherche");
  expect(recherche).toMatchObject({ criteres: { tx: "location" } });
  expect(recherche!.criteres).not.toHaveProperty("page");
  expect(typeof recherche!.resultats).toBe("number");
  // la page suivante de la même recherche n'est pas une nouvelle recherche
  const suivante = page.getByRole("navigation", { name: /pages/i }).getByRole("link", { name: "2", exact: true });
  if (await suivante.count()) {
    await appuyer(suivante);
    await page.waitForTimeout(800);
    expect(appels(f, "noter_recherche")).toHaveLength(1);
  }

  // Lien de campagne (partagé sur WhatsApp, qui ne dit pas d'où vient la visite)
  await page.goto("/publier?utm_source=whatsapp&utm_campaign=Pub%20octobre");
  await expect.poll(() => appels(f, "noter_page").at(-1)).toEqual(
    { page: "publier", source: "whatsapp", appareil, visite: true, campagne: "Pub octobre", campagne_source: "whatsapp" });

  // Page introuvable : comptée comme telle, avec son adresse (sans ce qui suit « ? »)
  await page.goto("/une-page-qui-n-existe-pas?x=1");
  await expect.poll(() => appels(f, "noter_introuvable")).toEqual([{ chemin: "/une-page-qui-n-existe-pas" }]);
  expect(appels(f, "noter_page").at(-1)).toMatchObject({ page: "introuvable", source: "direct", visite: true });

  // « Ne pas me suivre » : rien n'est envoyé
  const avant = f.demandes.length;
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "doNotTrack", { get: () => "1" }));
  await page.goto("/annonces?tx=achat");
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(800);
  expect(f.demandes.slice(avant).filter((d) => d.chemin.startsWith("/rest/v1/rpc/noter_"))).toEqual([]);
});

test("Mesure : rien pour un robot (navigateur piloté)", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(800);
  expect(appels(f, "noter_page")).toEqual([]);
});

// ══ Onglet Audience de l'Administration ══

test("Administration → Audience : fréquentation, origine, gestes, classements, recherches, demande et offre, fonctionnement", async ({ page }) => {
  const f = await fauxSupabase(page);
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.audience = exemple;
  await seConnecter(page, "equipe@360-immo.ci", "/admin?section=audience");

  await expect(page.getByRole("heading", { name: "Fréquentation", level: 2 })).toBeVisible();
  await expect(page.getByText("Chiffres anonymes : ni cookie, ni adresse IP, rien relié à une personne")).toBeVisible();
  const visites = page.locator("li").filter({ has: page.getByText("Visites", { exact: true }) }).first();
  await expect(visites).toContainText(/▲ \+33 % par rapport aux 30 jours d'avant/);
  // Colonnes : le détail au survol (ou au toucher), et les chiffres en tableau
  const heures = page.getByRole("group", { name: /^Visites selon l'heure/ });
  await expect(heures).toHaveAttribute("aria-label", /le plus : De 19 h à 20 h \(210\)/);
  await heures.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(heures.getByRole("status")).toContainText("De 23 h à 24 h");
  await page.getByText("Voir les chiffres").first().click();
  await expect(page.getByRole("table").first()).toBeVisible();

  // Origine, appareils, campagnes ; fabrique de lien de campagne
  await expect(page.getByRole("list", { name: "Visites selon leur origine" })).toContainText(/Facebook\s*610\s*42 %/);
  await expect(page.getByRole("list", { name: "Visites selon l'appareil" })).toContainText(/Téléphone\s*1\s?190\s*82 %/);
  await expect(page.getByRole("rowheader", { name: "pub-octobre" })).toBeVisible();
  await page.getByLabel("Nom de la campagne").fill("Pub Décembre !");
  await page.getByLabel("Partagé sur").selectOption("facebook");
  await page.getByLabel("Page d'arrivée").selectOption("/publier");
  await expect(page.locator("code").filter({ hasText: "utm_campaign" })).toHaveText(/\/publier\?utm_source=facebook&utm_campaign=pub-decembre$/);

  // Gestes, classements, recherches
  await expect(page.getByRole("list", { name: "Gestes des visiteurs" })).toContainText(/Contacts vers les annonceurs/);
  await expect(page.getByRole("link", { name: "Appartement 3 pièces meublé — Riviera 2" })).toBeVisible();
  await expect(page.getByText("+12 sur 30 jours")).toBeVisible();
  await expect(page.getByRole("row", { name: /Kamika Immobilier/ })).toContainText("Agence");
  await expect(page.getByRole("list", { name: "Recherches selon le lieu" })).toContainText(/Bingerville \(Abidjan\)\s*dont 30 sans résultat/);
  await expect(page.getByRole("row", { name: /Achat · Terrain · Bingerville \(Abidjan\) · budget 25 à 50 millions/ })).toBeVisible();
  // Demande et offre : une commune où il manque des annonces
  await expect(page.getByRole("row", { name: /Bingerville/ }).getByText("Annonces à trouver")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Cocody/ }).getByText("Annonces à trouver")).toHaveCount(0);
  await expect(page.getByRole("listitem", { name: /100 000 à 200 000 \/ mois : 50 % des budgets recherchés, 42 % des annonces en ligne/ })).toBeVisible();

  // Fonctionnement
  await expect(page.locator("li").filter({ hasText: "Délai de vérification" })).toContainText("5,5 h");
  await expect(page.locator("li").filter({ hasText: "Messages répondus" })).toContainText("70 %");
  await expect(page.getByRole("link", { name: "Bureau 60 m² — Plateau" })).toBeVisible();
  await expect(page.getByText("/annonces/imm-2026-00042")).toBeVisible();

  // Autre période : nouvelle demande, mêmes repères
  await appuyer(page.getByRole("button", { name: "7 jours" }));
  await expect(page.getByRole("button", { name: "7 jours" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => appels(f, "admin_audience").at(-1)).toEqual({ jours: 7 });
  await expect(visites).toContainText(/par rapport aux 7 jours d'avant/);
});

test("Audience : réservée à l'équipe", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné" });
  f.audience = exemple;
  await seConnecter(page, "awa@exemple.ci", "/admin?section=audience");
  await expect(page.getByRole("heading", { name: "Espace réservé à l'équipe 360-Immo.ci" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fréquentation" })).toHaveCount(0);
});
