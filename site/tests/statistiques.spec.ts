// Étape 6, dernière partie : statistiques de l'annonceur (Mon Espace → Statistiques) et gestes notés sur la fiche.
// Les chiffres eux-mêmes (relevés par jour, contacts, période d'avant, prix des annonces semblables) : tests/base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Yopougon)
const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();
const espaces = (t: string | null) => (t ?? "").replace(/[  ]/g, " ");

const jean = (f: FauxSupabase) => f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });

async function seConnecter(page: Page, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("jean@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const chiffres = (c: Partial<Record<string, number>>) => ({
  vues: 0, numeros: 0, appels: 0, whatsapp: 0, emails: 0, partages: 0, messages: 0, visites: 0, rappels: 0, favoris: 0, alertes: 0, ...c,
});

/** Réponse de la base : 3 annonces (une à améliorer, un terrain au prix du marché, une retirée) */
function statistiques(idAppartement: string) {
  return (jours: number) => {
    const par_jour = Array.from({ length: jours }, (_, i) => ({
      jour: date(i - jours + 1).slice(0, 10), vues: i === jours - 1 ? 12 : i % 3, contacts: i === jours - 1 ? 3 : 0,
    }));
    return {
      jours, du: par_jour[0].jour, au: par_jour[jours - 1].jour, par_jour,
      totaux: chiffres({ vues: 120, numeros: 6, appels: 3, whatsapp: 4, partages: 2, messages: 2, visites: 1, rappels: 1, favoris: 5, alertes: 9 }),
      avant: chiffres({ vues: 100, numeros: 4, messages: 1, favoris: 5 }),
      annonces: [
        {
          ...chiffres({ vues: 90, numeros: 6, appels: 3, whatsapp: 4, partages: 2, messages: 2, visites: 1, rappels: 1, favoris: 4, alertes: 7 }),
          id: idAppartement, reference: "IMM-2026-02001", titre: "Appartement 3 pièces à Marcory", statut: "publiee", en_ligne: true,
          type_bien: "appartement", type_nom: "Appartement", transaction: "location", loyer_par: "mois", prix: 200000, surface: 85, pieces: 3,
          commune: "Marcory", publiee_le: date(-20), expire_le: date(4.5), photos: 2, description: 60, vues_total: 340, favoris_total: 6,
          prix_compare: 200000, comparables: 4, mediane: 150000,
        },
        {
          ...chiffres({ vues: 30, numeros: 2, favoris: 1, alertes: 2 }),
          id: "00000000-0000-4000-8000-000000000002", reference: "IMM-2026-02002", titre: "Terrain 500 m² à Bingerville", statut: "publiee",
          en_ligne: true, type_bien: "terrain", type_nom: "Terrain", transaction: "vente", loyer_par: null, prix: 30000000, surface: 500,
          pieces: null, commune: "Bingerville", publiee_le: date(-40), expire_le: date(50), photos: 6, description: 400, vues_total: 95,
          favoris_total: 2, prix_compare: 60000, comparables: 5, mediane: 58000,
        },
        {
          ...chiffres({}), id: "00000000-0000-4000-8000-000000000003", reference: "IMM-2026-02003", titre: "Villa 5 pièces à Cocody", statut: "archivee",
          en_ligne: false, type_bien: "villa", type_nom: "Villa", transaction: "location", loyer_par: "mois", prix: 900000, surface: null, pieces: 5,
          commune: "Cocody", publiee_le: date(-80), expire_le: date(10), photos: 8, description: 300, vues_total: 410, favoris_total: 0,
          prix_compare: null, comparables: 0, mediane: null,
        },
      ],
    };
  };
}

test("Mon Espace → Statistiques : en bref, vues par jour, gestes des visiteurs, annonce par annonce avec prix et conseils", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  const appart = f.annonce(moi, { titre: "Appartement 3 pièces à Marcory", statut: "publiee", publiee_le: date(-20), expire_le: date(4.5) });
  f.statistiques = statistiques(String(appart.id));
  await seConnecter(page, "/mon-espace?section=statistiques");
  await expect(page.locator("h1")).toHaveText("Statistiques");
  const demandes = () => f.demandes.filter((d) => d.chemin === "/rest/v1/rpc/statistiques_annonceur").map((d) => d.corps);
  await expect.poll(demandes).toEqual([{ jours: 30 }]);

  // En bref : valeurs et écarts avec les 30 jours d'avant
  const tuiles = page.getByRole("list", { name: "En bref" }).getByRole("listitem");
  await expect(tuiles).toHaveCount(4);
  const tuile = (titre: string) => tuiles.filter({ hasText: new RegExp(`^\\s*${titre}`) });
  await expect(tuile("Vues des fiches")).toContainText("120");
  await expect(tuile("Vues des fiches")).toContainText("▲ +20 % par rapport aux 30 jours d'avant");
  await expect(tuile("Contacts")).toContainText("10");   // 6 numéros affichés, 2 messages, 1 visite, 1 rappel
  await expect(tuile("Contacts")).toContainText("▲ +100 %");
  await expect(tuile("Contacts")).toContainText("soit 8,3 % des vues");
  await expect(tuile("Mises en favori")).toContainText("= 0 %");
  await expect(tuile("Envois par les alertes")).toContainText("▲ rien les 30 jours d'avant");

  // Vues par jour : survol (ou flèches du clavier) → vues et contacts du jour ; chiffres jour par jour
  const graphique = page.getByRole("group", { name: /^Vues par jour : 40 vues en 30 jours, 12 au plus en un jour/ });
  await expect(graphique).toBeVisible();
  await page.mouse.move(0, 0);   // le pointeur hors du graphique : seul le clavier choisit le jour
  await graphique.focus();
  await page.keyboard.press("ArrowLeft");
  const bulle = graphique.getByRole("status");
  await expect(bulle).toContainText("12 vues");
  await expect(bulle).toContainText("3 contacts");
  await page.keyboard.press("ArrowLeft");
  await expect(bulle).toContainText("1 vue");
  await expect(bulle).toContainText("0 contact");
  await page.getByText("Voir les chiffres jour par jour").click();
  await expect(page.getByRole("table").getByRole("row").nth(1).getByRole("cell")).toHaveText(["12", "3"]);

  // Gestes des visiteurs
  const gestes = page.getByRole("list", { name: "Gestes des visiteurs" }).getByRole("listitem");
  await expect(gestes.filter({ hasText: "Numéros affichés" })).toContainText("6");
  await expect(gestes.filter({ hasText: "WhatsApp ouverts" })).toContainText("4");
  await expect(gestes.filter({ hasText: "Demandes de visite" })).toContainText("1");

  // Par annonce : l'appartement à améliorer (expire bientôt, peu de photos, prix élevé, description courte)
  const carte = (titre: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: titre }) });
  const appartement = carte("Appartement 3 pièces à Marcory");
  await expect(appartement).toContainText("Appartement · Marcory · réf. IMM-2026-02001 · 340 vues depuis la publication");
  await expect(appartement).toContainText("En ligne");
  await expect(appartement).toContainText("6 numéros affichés · 2 messages · 1 visite · 1 rappel");
  expect(espaces(await appartement.textContent())).toContain(
    "Votre prix : 200 000 FCFA / mois · annonces semblables à Marcory : 150 000 FCFA / mois (prix du milieu de 4)33 % au-dessus");
  await expect(appartement.getByRole("list", { name: "Conseils" }).getByRole("listitem")).toHaveText([
    /^Elle expire dans 5 jours/, /^Seulement 2 photos/, /^Prix 33 % au-dessus des annonces semblables/, /^Description courte/,
  ]);
  await expect(appartement.getByRole("link", { name: "Appartement 3 pièces à Marcory" })).toHaveAttribute("href", /imm-2026-02001$/);
  // Le terrain : prix au m², dans la moyenne
  const terrain = carte("Terrain 500 m² à Bingerville");
  expect(espaces(await terrain.textContent())).toContain("Votre prix : 60 000 FCFA / m² · annonces semblables à Bingerville : 58 000 FCFA / m²");
  await expect(terrain).toContainText("dans la moyenne");
  await expect(terrain.getByRole("list", { name: "Conseils" })).toHaveText("Rien à redire : annonce complète, au prix du marché.");
  // Retirée : ni prix ni conseils
  const villa = carte("Villa 5 pièces à Cocody");
  await expect(villa).toContainText("Retirée (vendu ou loué)");
  await expect(villa.getByRole("list", { name: "Conseils" })).toHaveCount(0);
  await expect(villa.getByRole("link")).toHaveCount(0);

  // 7 jours : nouvelle demande, mêmes repères
  await appuyer(page.getByRole("radio", { name: "7 jours" }));
  await expect(page.getByRole("radio", { name: "7 jours" })).toHaveAttribute("aria-checked", "true");
  await expect(tuile("Vues des fiches")).toContainText("par rapport aux 7 jours d'avant");
  expect(demandes()).toEqual([{ jours: 30 }, { jours: 7 }]);

  // Depuis Mes annonces : « Statistiques » ouvre la section sur cette annonce
  await appuyer(page.getByRole("button", { name: "Mes annonces" }));
  await appuyer(page.getByRole("listitem").filter({ hasText: "Appartement 3 pièces à Marcory" }).getByRole("button", { name: "Statistiques" }));
  await expect(page.locator("h1")).toHaveText("Statistiques");
  await expect(appartement).toHaveClass(/annonceChoisie/);
  await expect(appartement).toBeInViewport();
});

test("Statistiques : sans annonce publiée, une invitation à publier ; menu et vue d'ensemble", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await seConnecter(page, "/mon-espace");
  await appuyer(page.getByRole("button", { name: /^Statistiques Vues, contacts et conseils/ }));
  await expect(page.locator("h1")).toHaveText("Statistiques");
  await expect(page.getByText(/Vos statistiques apparaîtront ici dès votre première annonce en ligne/)).toBeVisible();
  await expect(page.getByText(/Vos statistiques apparaîtront/).locator("xpath=..").getByRole("link")).toHaveAttribute("href", "/publier");
});

test("Fiche : numéro affiché, WhatsApp et partage sont notés pour l'annonceur (une fois par visite)", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.context().route(/https:\/\/(wa\.me|www\.facebook\.com)\//, (r) => r.fulfill({ body: "ok" }));
  await page.goto(FICHE_AWA);
  const gestes = () => f.demandes.filter((d) => d.chemin === "/rest/v1/rpc/noter_action").map((d) => d.corps?.action);
  const contact = page.locator("#contact");
  await appuyer(contact.getByRole("button", { name: "Afficher le numéro" }));
  await expect(contact.getByRole("link", { name: /WhatsApp/ }).first()).toBeVisible();
  await expect.poll(gestes).toEqual(["numero"]);
  const [onglet] = await Promise.all([page.waitForEvent("popup"), contact.getByRole("link", { name: /WhatsApp/ }).first().click()]);
  await onglet.close();
  await expect.poll(gestes).toEqual(["numero", "whatsapp"]);
  const partager = page.getByText("Partager cette annonce").locator("xpath=..");
  const [facebook] = await Promise.all([page.waitForEvent("popup"), partager.getByRole("link", { name: "Facebook" }).click()]);
  await facebook.close();
  await expect.poll(gestes).toEqual(["numero", "whatsapp", "partage"]);
  // Une seule fois par visite : un second partage n'est pas compté
  await partager.getByRole("button", { name: "Copier le lien" }).click();
  await page.waitForTimeout(300);
  expect(gestes()).toEqual(["numero", "whatsapp", "partage"]);
  // et la vue de la fiche, comme avant
  expect(f.demandes.filter((d) => d.chemin === "/rest/v1/rpc/compter_vue")).toHaveLength(1);
});
