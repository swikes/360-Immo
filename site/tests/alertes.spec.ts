// Étape 6, 3e partie : alertes de recherche (liste des annonces, fiche, Mon Espace → Alertes de recherche, lien
// « Arrêter cette alerte » des e-mails) et e-mails souhaités (Mon Espace → Paramètres).
// Comptes et alertes : imités par tests/faux-supabase.ts ; annonces d'exemple : tests/base/serveur.mjs.
// L'écriture et l'envoi des e-mails : tests/emails.spec.ts ; la file des e-mails : tests/base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const COCODY = "/annonces?tx=location&type=appartement&q=Cocody";
const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Yopougon)

const jean = (f: FauxSupabase) => f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });

async function seConnecter(page: Page, email = "jean@exemple.ci") {
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const message = (page: Page) => page.getByRole("status").filter({ hasText: /alerte/i });

test("Alerte sans compte : « Connectez-vous », puis l'alerte est créée au retour sur la liste", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  await page.goto(COCODY);
  await appuyer(page.getByRole("button", { name: "Créer une alerte" }));
  const fenetre = page.getByRole("dialog", { name: "Recevez les nouvelles annonces" });
  await expect(fenetre).toBeVisible();
  await appuyer(fenetre.getByRole("link", { name: "Se connecter" }));
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fannonces%3Ftx%3Dlocation%26type%3Dappartement%26q%3DCocody$/);
  await seConnecter(page);
  await expect(page).toHaveURL(/\/annonces\?tx=location&type=appartement&q=Cocody/);
  await expect(message(page)).toContainText("Alerte créée : les nouvelles annonces « Appartements à louer à Cocody » vous arriveront par e-mail, chaque matin.");
  await expect(message(page).getByRole("link", { name: "Gérer mes alertes" })).toHaveAttribute("href", "/mon-espace?section=alertes");
  await expect(page.getByRole("button", { name: "Alerte créée" })).toBeVisible();
  expect(f.alertes).toHaveLength(1);
  expect(f.alertes[0]).toMatchObject({
    profil_id: moi, nom: "Appartements à louer à Cocody", adresse: COCODY, frequence: "quotidienne", active: true,
    criteres: { tx: "location", types: ["appartement"], ville: "Abidjan", commune: "Cocody" },
  });
  // Une seconde fois : déjà là
  await appuyer(page.getByRole("button", { name: "Fermer le message" }));
  await appuyer(page.getByRole("button", { name: "Alerte créée" }));
  await expect(message(page)).toContainText("Vous avez déjà cette alerte : « Appartements à louer à Cocody ».");
  expect(f.alertes).toHaveLength(1);
});

test("Alerte : une recherche sans critère ne suffit pas ; depuis une fiche, les biens semblables", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto("/connexion?suite=%2Fannonces");
  await seConnecter(page);
  await expect(page).toHaveURL(/\/annonces$/);
  await appuyer(page.getByRole("button", { name: "Créer une alerte" }));
  await expect(page.getByRole("status").filter({ hasText: "Choisissez d'abord ce que vous cherchez" })).toBeVisible();
  expect(f.alertes).toEqual([]);

  await page.goto(FICHE_AWA);
  await expect(page.getByText("Recevez par e-mail les nouvelles annonces appartements à louer à Yopougon.")).toBeVisible();
  await appuyer(page.getByRole("button", { name: "Créer cette alerte" }));
  await expect(message(page)).toContainText("« Appartements à louer à Yopougon »");
  expect(f.alertes[0]).toMatchObject({ nom: "Appartements à louer à Yopougon", adresse: "/annonces?tx=location&type=appartement&q=Yopougon" });
  // Pas d'alerte sur une vitrine (ses annonces seulement)
  await page.goto("/annonceur/kamika-immobilier-kamika");
  await expect(page.getByRole("button", { name: "Partager cette recherche" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer une alerte" })).toHaveCount(0);
});

test("Mon Espace → Alertes de recherche : critères, fréquence, pause, voir les annonces, suppression", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  const cocody = f.alerte(moi, { adresse: "/annonces?tx=location&duree=mois&type=appartement&q=Cocody&max=300000&pieces=3&meuble=1" });
  f.alerte(moi, {
    nom: "Terrains à vendre à Bingerville", adresse: "/annonces?tx=achat&type=terrain&q=Bingerville", active: false,
    frequence: "hebdomadaire", dernier_envoi: "2026-10-01T07:00:00Z", cree_le: "2026-09-20T10:00:00Z",
  });
  await page.goto("/connexion?suite=%2Fmon-espace%3Fsection%3Dalertes");
  await seConnecter(page);
  await expect(page.locator("h1")).toHaveText("Alertes de recherche");
  await expect(page.getByText(/Les nouvelles annonces arrivent chaque matin à jean@exemple\.ci · 2 alertes sur 10/)).toBeVisible();

  const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Appartements à louer à Cocody" }) });
  await expect(carte.getByRole("list", { name: "Critères" }).getByRole("listitem")).toHaveText(["Location au mois", /^300\s000 FCFA max \/ mois$/, "3 pièces", "Meublé"]);
  await expect(carte).toContainText("Active");
  await expect(carte).toContainText("pas encore de nouvelle annonce");
  await expect(carte.getByRole("link", { name: "Voir les annonces" })).toHaveAttribute("href", cocody.adresse as string);
  // Chaque semaine, puis en pause et réactivée
  await appuyer(carte.getByRole("radio", { name: "Chaque semaine" }));
  await expect(carte.getByRole("radio", { name: "Chaque semaine" })).toHaveAttribute("aria-checked", "true");
  expect(cocody.frequence).toBe("hebdomadaire");
  await appuyer(carte.getByRole("button", { name: "Mettre en pause" }));
  await expect(carte).toContainText("En pause");
  expect(cocody.active).toBe(false);
  await appuyer(carte.getByRole("button", { name: "Réactiver" }));
  await expect(carte).toContainText("Active");
  expect(cocody.active).toBe(true);

  const terrain = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Terrains à vendre à Bingerville" }) });
  await expect(terrain).toContainText("En pause");
  await expect(terrain).toContainText("Créée le 20 septembre · dernier e-mail le 1 octobre");
  await expect(terrain.getByRole("radio", { name: "Chaque semaine" })).toHaveAttribute("aria-checked", "true");
  // Supprimer : on confirme
  await appuyer(terrain.getByRole("button", { name: "Supprimer" }));
  await expect(terrain).toContainText("Supprimer cette alerte ?");
  await appuyer(terrain.getByRole("button", { name: "Oui, supprimer" }));
  await expect(terrain).toHaveCount(0);
  expect(f.alertes.map((a) => a.nom)).toEqual(["Appartements à louer à Cocody"]);

  // Plus d'alerte : invitation à chercher
  await appuyer(carte.getByRole("button", { name: "Supprimer" }));
  await appuyer(carte.getByRole("button", { name: "Oui, supprimer" }));
  await expect(page.getByText(/Aucune alerte pour l'instant/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Chercher un bien" })).toHaveAttribute("href", "/annonces");
});

test("Paramètres → E-mails : choix enregistrés aussitôt et retrouvés", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  await page.goto("/connexion?suite=%2Fmon-espace%3Fsection%3Dparametres");
  await seConnecter(page);
  const emails = page.getByRole("region", { name: "E-mails" });
  await expect(emails).toContainText("Envoyés à jean@exemple.ci.");
  const messages = emails.getByRole("checkbox", { name: /Nouveaux messages/ });
  await expect(messages).toBeChecked();
  await expect(emails.getByRole("checkbox", { name: /Demandes de visite et réponses/ })).toBeChecked();
  await expect(emails.getByRole("checkbox", { name: /Fin prochaine de mes annonces/ })).toBeChecked();
  await appuyer(messages);
  await expect(emails.getByRole("status")).toHaveText("Choix enregistré.");
  expect(f.profils.get(moi)).toMatchObject({ emails_messages: false, emails_visites: true, emails_annonces: true });
  await page.reload();
  await expect(page.getByRole("region", { name: "E-mails" }).getByRole("checkbox", { name: /Nouveaux messages/ })).not.toBeChecked();
});

test("Lien « Arrêter cette alerte » des e-mails : sans connexion, on confirme ; lien plus valable", async ({ page }) => {
  const f = await fauxSupabase(page);
  const a = f.alerte(jean(f));
  await page.goto(`/alertes/arreter?jeton=${a.jeton}`);
  await expect(page.locator("h1")).toHaveText("Arrêter une alerte");
  await expect(page.getByText("Vous ne recevrez plus d'e-mails pour l'alerte « Appartements à louer à Cocody ».", { exact: false })).toBeVisible();
  expect(a.active).toBe(true);   // rien n'est arrêté sans confirmer
  await appuyer(page.getByRole("button", { name: "Arrêter cette alerte" }));
  await expect(page.getByRole("status")).toContainText("C'est fait : l'alerte « Appartements à louer à Cocody » est arrêtée.");
  expect(a.active).toBe(false);
  await expect(page.getByRole("link", { name: "Gérer mes alertes" })).toHaveAttribute("href", "/mon-espace?section=alertes");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("est déjà arrêtée");
  for (const jeton of ["00000000-0000-4000-8000-000000000999", "abc"]) {
    await page.goto(`/alertes/arreter?jeton=${jeton}`);
    await expect(page.getByText("Ce lien n'est plus valable")).toBeVisible();
  }
});

test("E-mails : le site en demande l'envoi juste après une demande de visite", async ({ page }) => {
  await fauxSupabase(page);
  let relances = 0;
  await page.route("**/api/notifications", (r) => {
    if (r.request().method() === "POST") relances++;
    return r.fulfill({ json: { regle: false } });
  });
  await page.goto(FICHE_AWA);
  await appuyer(page.locator("#contact").getByRole("button", { name: "Planifier une visite" }));
  const fenetre = page.getByRole("dialog", { name: "Planifier une visite" });
  await appuyer(fenetre.getByRole("button", { name: "16:00" }));
  await appuyer(fenetre.getByRole("button", { name: "Continuer" }));
  await fenetre.getByRole("textbox", { name: "Prénom et nom" }).fill("Koffi Yao");
  await fenetre.getByRole("textbox", { name: "Téléphone" }).fill("01 02 03 04 06");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer la demande" }));
  await expect(fenetre.getByText("Demande envoyée !")).toBeVisible();
  await expect.poll(() => relances).toBe(1);
});
