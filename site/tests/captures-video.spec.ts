// Captures d'écran pour les vidéos (dossier video/ à la racine du dépôt). Données : la fausse base des tests (annonces
// d'exemple) et tests/faux-supabase.ts (compte connecté, statistiques d'exemple).
//   téléphone : les écrans des vidéos courtes, avec la position de l'élément à mettre en avant dans chaque scène
//   ordinateur : les écrans de la publicité 16:9 (video/src/pub), sans les affirmations invérifiables de l'accueil
// Ne tourne pas avec les autres tests : CAPTURES_VIDEO=1 npx playwright test captures-video
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { devices, type Locator, type Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

test.skip(!process.env.CAPTURES_VIDEO, "seulement pour fabriquer les vidéos (CAPTURES_VIDEO=1)");
const seulement = (projet: string) => test.skip(test.info().project.name !== projet, `écrans ${projet}`);
// Les deux séries dans le même processus : ecrans.json reçoit toutes les positions d'un coup
test.describe.configure({ mode: "serial" });

const DOSSIER = path.join(__dirname, "../../video/public/ecrans");
const POSITIONS = path.join(__dirname, "../../video/src/ecrans.json");
type Boite = { x: number; y: number; w: number; h: number };
const ecrans: Record<string, { fichier: string; largeur: number; hauteur: number; cible: Boite }> = {};

test.afterAll(() => {
  if (!Object.keys(ecrans).length) return;
  writeFileSync(POSITIONS, JSON.stringify(ecrans, null, 2) + "\n");
});

/** Place la cible vers le tiers haut de l'écran, puis capture l'écran (sans la page entière) et la position de la cible */
async function capturer(page: Page, nom: string, cibles: Locator[], { haut = 0.3, defiler = true } = {}) {
  mkdirSync(DOSSIER, { recursive: true });
  const vue = page.viewportSize()!;
  if (defiler) {
    await cibles[0].scrollIntoViewIfNeeded();
    const avant = (await cibles[0].boundingBox())!;
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "instant" }), avant.y - vue.height * haut);
  }
  await page.waitForTimeout(600);
  const boites = (await Promise.all(cibles.map((c) => c.boundingBox()))).filter((b): b is NonNullable<typeof b> => !!b);
  const x = Math.min(...boites.map((b) => b.x)), y = Math.min(...boites.map((b) => b.y));
  const cible = {
    x: Math.max(0, x), y: Math.max(0, y),
    w: Math.min(vue.width, Math.max(...boites.map((b) => b.x + b.width))) - Math.max(0, x),
    h: Math.min(vue.height, Math.max(...boites.map((b) => b.y + b.height))) - Math.max(0, y),
  };
  await page.screenshot({ path: path.join(DOSSIER, `${nom}.png`) });
  ecrans[nom] = { fichier: `ecrans/${nom}.png`, largeur: vue.width, hauteur: vue.height, cible };
}

const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();

function jean(f: FauxSupabase) {
  return f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });
}

async function seConnecter(page: Page, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("jean@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const chiffres = (c: Partial<Record<string, number>>) => ({
  vues: 0, numeros: 0, appels: 0, whatsapp: 0, emails: 0, partages: 0, messages: 0, visites: 0, rappels: 0, favoris: 0, alertes: 0, ...c,
});

test("Écrans publics : accueil, liste, fiche (agence vérifiée, contacts), alerte, carte des prix, estimation", async ({ page }) => {
  seulement("telephone");
  await page.goto("/");
  await capturer(page, "accueil", [page.locator("main form").first()], { defiler: false });

  await page.goto("/annonces?tx=location");
  await capturer(page, "liste", [page.getByRole("article").first()], { haut: 0.22 });

  await page.goto("/annonces/imm-2026-01001");
  const badge = page.getByText("Agence vérifiée", { exact: true }).first();
  const agence = page.locator("div").filter({ has: badge }).filter({ hasText: "Kamika Immobilier" }).last();
  await capturer(page, "fiche-agence", [agence], { haut: 0.4 });
  await capturer(page, "fiche-contact", [
    page.getByRole("button", { name: "Afficher le numéro" }).first(),
    page.getByRole("button", { name: "Planifier une visite" }).first(),
  ], { haut: 0.3 });

  await page.goto("/annonces?tx=location&type=appartement&q=Cocody");
  await appuyer(page.getByRole("button", { name: "Créer une alerte" }));
  const fenetre = page.getByRole("dialog", { name: "Créer une alerte" });
  await expect(fenetre.getByText("Ne ratez aucune nouvelle annonce")).toBeVisible();
  await page.waitForTimeout(500);
  mkdirSync(DOSSIER, { recursive: true });
  const boite = (await fenetre.getByText("Ne ratez aucune nouvelle annonce").boundingBox())!;
  await page.screenshot({ path: path.join(DOSSIER, "alerte.png") });
  const vue = page.viewportSize()!;
  ecrans.alerte = { fichier: "ecrans/alerte.png", largeur: vue.width, hauteur: vue.height,
    cible: { x: 0, y: Math.max(0, boite.y - 20), w: vue.width, h: Math.min(260, vue.height - boite.y) } };

  await page.goto("/carte-des-prix?tx=location&type=appartement");
  await capturer(page, "carte-des-prix", [page.getByRole("region", { name: "Abidjan" })], { haut: 0.25 });

  await page.goto("/estimation");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await page.getByLabel("Commune ou quartier").fill("Riviera 2");
  await page.getByLabel("Commune ou quartier").press("Escape");
  await appuyer(page.getByRole("button", { name: "Continuer" }));
  await appuyer(page.getByRole("button", { name: "3", exact: true }));
  await appuyer(page.getByRole("button", { name: "Estimer mon bien" }));
  const resultat = page.getByText("Loyer habituel d'un bien comme le vôtre");
  await expect(resultat).toBeVisible();
  await capturer(page, "estimation", [page.getByText(/^Votre estimation$/i), resultat, page.getByText(/Fourchette habituelle/),
    page.getByText(/^Fiabilité/)], { haut: 0.3 });
});

test("Écrans d'un annonceur connecté : publier une annonce, statistiques", async ({ page }) => {
  seulement("telephone");
  const f = await fauxSupabase(page);
  const moi = jean(f);
  const appart = f.annonce(moi, { titre: "Appartement 3 pièces à Marcory", statut: "publiee", publiee_le: date(-20), expire_le: date(40) });
  f.statistiques = (jours: number) => {
    const par_jour = Array.from({ length: jours }, (_, i) => ({
      jour: date(i - jours + 1).slice(0, 10), vues: 3 + Math.round(4 * (1 + Math.sin(i / 3)) + i / 4), contacts: i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
    }));
    return {
      jours, du: par_jour[0].jour, au: par_jour[jours - 1].jour, par_jour,
      totaux: chiffres({ vues: 260, numeros: 14, appels: 6, whatsapp: 9, partages: 4, messages: 3, visites: 2, rappels: 1, favoris: 11, alertes: 18 }),
      avant: chiffres({ vues: 190, numeros: 9, messages: 2, favoris: 7 }),
      annonces: [{
        ...chiffres({ vues: 260, numeros: 14, appels: 6, whatsapp: 9, partages: 4, messages: 3, visites: 2, rappels: 1, favoris: 11, alertes: 18 }),
        id: String(appart.id), reference: "IMM-2026-02001", titre: "Appartement 3 pièces à Marcory", statut: "publiee", en_ligne: true,
        type_bien: "appartement", type_nom: "Appartement", transaction: "location", loyer_par: "mois", prix: 180000, surface: 85, pieces: 3,
        commune: "Marcory", publiee_le: date(-20), expire_le: date(40), photos: 8, description: 400, vues_total: 260, favoris_total: 11,
        prix_compare: 180000, comparables: 6, mediane: 175000,
      }],
    };
  };
  await seConnecter(page, "/mon-espace?section=statistiques");
  await expect(page.locator("h1")).toHaveText("Statistiques");
  const graphique = page.getByRole("group", { name: /^Vues par jour/ });
  await expect(graphique).toBeVisible();
  await capturer(page, "statistiques", [page.getByText("Vues par jour", { exact: true }), graphique], { haut: 0.3 });

  await page.goto("/publier");
  const photos = page.getByRole("heading", { name: /Photos/ }).first();
  await expect(photos).toBeVisible();
  await capturer(page, "publier", [photos, page.getByText("Ajoutez vos photos"), page.getByText("Choisir des photos", { exact: true })],
    { haut: 0.25 });
});

// ── Publicité 16:9 ──
const PUB = path.join(__dirname, "../../video/public/ecrans-pub");

/**
 * Dans une publicité, « N°1 de l'immobilier en Côte d'Ivoire » et « Des milliers d'appartements… » devraient pouvoir être
 * prouvés : ces deux lignes de l'accueil sont retirées des captures (le site lui-même n'est pas modifié)
 */
/** Attend la fin des animations d'arrivée en cours (ni les boucles sans fin, ni celles en pause : 3 s au plus) */
const animationsFinies = (page: Page) => page.evaluate(() => Promise.race([
  Promise.all(document.getAnimations()
    .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => null))),
  new Promise((fin) => setTimeout(fin, 3000)),
]));

async function sansAffirmations(page: Page) {
  await page.evaluate(() => {
    for (const motif of [/N°1 de l.immobilier/i, /^Des milliers d/i]) {
      const touches = [...document.querySelectorAll("main *")].filter((e) => motif.test(e.textContent?.trim() ?? "") && (e.textContent ?? "").length < 200);
      let cible = touches.sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length)[0] as HTMLElement | undefined;
      // en remontant tant que le parent ne contient rien d'autre (le titre reste)
      while (cible?.parentElement && cible.parentElement.textContent?.trim() === cible.textContent?.trim()) cible = cible.parentElement;
      if (cible) cible.style.display = "none";
    }
  });
}

test("Écrans de la publicité : accueil, liste et fiche sur ordinateur (1920 × 1080), accueil sur téléphone", async ({ page, browser }) => {
  seulement("ordinateur");
  mkdirSync(PUB, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.locator("main form").first()).toBeVisible();
  await sansAffirmations(page);
  await animationsFinies(page);
  await page.screenshot({ path: path.join(PUB, "accueil-ordinateur.png") });

  await page.goto("/annonces?tx=location");
  await expect(page.locator("main article").first()).toBeVisible();
  await animationsFinies(page);
  await page.screenshot({ path: path.join(PUB, "liste-ordinateur.png") });
  // position des cartes d'annonces, pour les découper dans la capture
  const cartes = await page.locator("main article").evaluateAll((l) =>
    l.slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  writeFileSync(path.join(__dirname, "../../video/src/pub/cartes.json"), JSON.stringify(cartes, null, 2) + "\n");

  await page.goto("/annonces/imm-2026-01001");
  await expect(page.getByText("Agence vérifiée").first()).toBeVisible();
  await animationsFinies(page);
  await page.screenshot({ path: path.join(PUB, "fiche-ordinateur.png") });

  const telephone = await browser.newPage({ ...devices["iPhone 13"], baseURL: test.info().project.use.baseURL });
  await telephone.goto("/");
  await expect(telephone.locator("main form").first()).toBeVisible();
  await sansAffirmations(telephone);
  await animationsFinies(telephone);
  await telephone.screenshot({ path: path.join(PUB, "accueil-telephone.png") });
  await telephone.close();
});
