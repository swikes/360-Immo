// « Être rappelé » : fiche d'un bien (avec ou sans compte) et Mon Espace → Rappels (annonceur et demandeur).
// Comptes et demandes : imités par tests/faux-supabase.ts ; annonces d'exemple : tests/base/serveur.mjs.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const idExemple = (n: number) => `00000000-0000-4000-8000-0002026${String(n).padStart(5, "0")}`;
const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Awa K.)

const jean = (f: FauxSupabase) => f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });

async function seConnecter(page: Page, email = "jean@exemple.ci") {
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("Être rappelé sans compte : nom et numéro vérifiés, moment choisi, demande envoyée ; pas deux fois pour le même bien", async ({ page }) => {
  const f = await fauxSupabase(page);
  let relances = 0;
  await page.route("**/api/notifications", (r) => {
    relances++;
    return r.fulfill({ json: { regle: false } });
  });
  await page.goto(FICHE_AWA);
  await appuyer(page.locator("#contact").getByRole("button", { name: "Être rappelé" }));
  const fenetre = page.getByRole("dialog", { name: "Être rappelé" });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByText("Appartement 2 pièces à louer — Niangon · Awa K.")).toBeVisible();
  const envoyer = fenetre.getByRole("button", { name: "Demander à être rappelé" });
  await appuyer(envoyer);
  await expect(fenetre.getByText("Indiquez votre prénom et votre nom.")).toBeVisible();
  await expect(fenetre.getByText("Indiquez un numéro de téléphone.")).toBeVisible();

  await fenetre.getByRole("textbox", { name: "Prénom et nom" }).fill("Paul Kra");
  await fenetre.getByRole("textbox", { name: "Téléphone" }).fill("01 02 03 04 07");
  const moments = fenetre.getByRole("group", { name: "Quand vous rappeler ?" }).getByRole("button");
  await expect(moments).toHaveText(["Dès que possible", "Le matin8 h – 12 h", "L'après-midi12 h – 17 h", "En fin de journée17 h – 20 h"]);
  await expect(moments.first()).toHaveAttribute("aria-pressed", "true");
  await appuyer(moments.nth(2));
  await fenetre.getByRole("textbox", { name: "Un mot pour l'annonceur (facultatif)" }).fill("Je cherche à emménager en novembre.");
  await appuyer(envoyer);

  await expect(fenetre.getByText("Demande envoyée !")).toBeVisible();
  await expect(fenetre.getByText(/^Awa K\. va vous rappeler au \+225 01 02 03 04 07 l'après-midi \(12 h – 17 h\)\.$/)).toBeVisible();
  await expect(fenetre.getByRole("link", { name: "Suivre ma demande" })).toHaveCount(0);
  expect(f.rappels).toHaveLength(1);
  expect(f.rappels[0]).toMatchObject({
    annonce_id: idExemple(1006), demandeur_id: null, nom: "Paul Kra", telephone: "+225 01 02 03 04 07", moment: "apres_midi",
    message: "Je cherche à emménager en novembre.", statut: "a_rappeler",
  });
  await expect.poll(() => relances).toBe(1);   // l'e-mail à l'annonceur part tout de suite

  // Une seconde demande pour le même bien avec le même numéro : refusée tant que la première attend
  await appuyer(fenetre.getByRole("button", { name: "Fermer" }).last());
  await appuyer(page.locator("#contact").getByRole("button", { name: "Être rappelé" }));
  await expect(fenetre.getByRole("textbox", { name: "Prénom et nom" })).toHaveValue("Paul Kra");
  await appuyer(envoyer);
  await expect(fenetre.getByRole("alert")).toContainText("Vous avez déjà demandé à être rappelé pour ce bien");
  expect(f.rappels).toHaveLength(1);
});

test("Être rappelé avec un compte : prérempli, suivi dans Mon Espace → Rappels, annulé", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  await page.goto(`/connexion?suite=${encodeURIComponent(FICHE_AWA)}`);
  await seConnecter(page);
  await expect(page).toHaveURL(/imm-2026-01006$/);
  await appuyer(page.locator("#contact").getByRole("button", { name: "Être rappelé" }));
  const fenetre = page.getByRole("dialog", { name: "Être rappelé" });
  await expect(fenetre.getByRole("textbox", { name: "Prénom et nom" })).toHaveValue("Jean Kouassi");
  await expect(fenetre.getByRole("textbox", { name: "Téléphone" })).toHaveValue("05 11 22 33 44");
  await appuyer(fenetre.getByRole("button", { name: "Demander à être rappelé" }));
  await expect(fenetre.getByText(/va vous rappeler au \+225 05 11 22 33 44 dès que possible\.$/)).toBeVisible();
  expect(f.rappels[0]).toMatchObject({ demandeur_id: moi, moment: "vite", message: null });

  await appuyer(fenetre.getByRole("link", { name: "Suivre ma demande" }));
  await expect(page).toHaveURL(/\/mon-espace\?section=rappels$/);
  await expect(page.locator("h1")).toHaveText("Rappels");
  const mesDemandes = page.getByRole("region", { name: /^Mes demandes/ });
  const carte = mesDemandes.getByRole("listitem").filter({ hasText: "Appartement 2 pièces à louer — Niangon" });
  await expect(carte).toContainText("En attente de l'appel");
  await expect(carte).toContainText("Annonceur : Awa K.");
  await expect(carte).toContainText("Quand : Dès que possible");
  await expect(carte.getByRole("link", { name: /^\+225/ })).toHaveCount(0);   // pas de numéro côté demandeur
  await appuyer(carte.getByRole("button", { name: "Annuler ma demande" }));
  await expect(page.getByText("Aucun rappel en attente.")).toBeVisible();
  expect(f.rappels[0].statut).toBe("annule");
  const traitees = page.locator("details").filter({ hasText: "Déjà traitées (1)" });
  await appuyer(traitees.locator("summary"));
  await expect(traitees.getByRole("listitem")).toContainText("Annulée");
});

test("Rappels côté annonceur : à faire (barre du haut, tableau de bord), appeler, WhatsApp, marquer comme rappelé", async ({ page }) => {
  const f = await fauxSupabase(page);
  const client = jean(f);
  const awa = f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const annonce = String(f.annonce(awa, { titre: "Villa 4 pièces à louer — Angré", statut: "publiee", expire_le: new Date(Date.now() + 30 * 86_400_000).toISOString() }).id);
  const paul = f.rappel(annonce, { nom: "Paul Kra", telephone: "+225 02 02 02 02 02", moment: "soir", message: "Je travaille en journée.", cree_le: "2026-10-07T10:15:00Z" });
  f.rappel(annonce, { nom: "Jean Kouassi", demandeur_id: client, telephone: "+225 05 11 22 33 44", moment: "matin", cree_le: "2026-10-06T09:00:00Z" });

  await page.goto("/connexion?suite=%2Fmon-espace");
  await seConnecter(page, "awa@exemple.ci");
  await expect(page).toHaveURL(/\/mon-espace$/);
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: /2 rappels à faire$/ })).toBeVisible();
  await appuyer(page.getByRole("button", { name: /2 personnes à rappeler\.$/ }));
  await expect(page.locator("h1")).toHaveText("Rappels");
  await expect(page.getByRole("heading", { name: /^À rappeler/ })).toContainText("2");

  const c1 = page.getByRole("listitem").filter({ hasText: "Paul Kra" });
  await expect(c1).toContainText("À rappeler");
  await expect(c1).toContainText("sans compte");
  await expect(c1).toContainText("Quand : En fin de journée (17 h – 20 h)");
  await expect(c1).toContainText("Son message : Je travaille en journée.");
  await expect(c1.getByRole("link", { name: "+225 02 02 02 02 02" })).toHaveAttribute("href", "tel:+2250202020202");
  await expect(c1.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/2250202020202\?text=Bonjour%20Paul%20Kra.*Villa%204%20pi%C3%A8ces/);
  await expect(page.getByRole("listitem").filter({ hasText: "Jean Kouassi" })).not.toContainText("sans compte");

  await appuyer(c1.getByRole("button", { name: "Marquer comme rappelé" }));
  await expect(page.getByRole("heading", { name: /^À rappeler/ })).toContainText("1");
  expect(paul.statut).toBe("rappele");
  await expect(menu.getByRole("link", { name: /1 rappel à faire$/ })).toBeVisible();
  // Déjà traitées : on peut le remettre à rappeler
  const traitees = page.locator("details").filter({ hasText: "Déjà traitées (1)" });
  await appuyer(traitees.locator("summary"));
  await expect(traitees.getByRole("listitem")).toContainText("Rappelé");
  await appuyer(traitees.getByRole("button", { name: "Remettre à rappeler" }));
  await expect(page.getByRole("heading", { name: /^À rappeler/ })).toContainText("2");
  expect(paul.statut).toBe("a_rappeler");
});

test("Rappels : aucune demande pour l'instant", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto("/connexion?suite=%2Fmon-espace%3Fsection%3Drappels");
  await seConnecter(page);
  await expect(page.getByText(/Aucune demande de rappel pour l'instant/)).toBeVisible();
});
