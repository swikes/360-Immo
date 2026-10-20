// Étape 8a : offres payantes des annonceurs — « Faire voir mon annonce » (Mes annonces), paiement Mobile Money simulé,
// Mon Espace → Paiements, page « Nos offres », Administration → Paiements.
// Comptes, annonces et paiements : imités par tests/faux-supabase.ts ; les règles de la base (24 heures, Premium au-dessus,
// jours gardés, droits, remboursements) : tests/base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

/** Jean et deux annonces en ligne */
function annonceur(f: FauxSupabase) {
  const jean = f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });
  const marcory = f.annonce(jean, { statut: "publiee", titre: "Appartement 3 pièces à Marcory", publiee_le: date(-10), expire_le: date(80), modifie_le: date(-10) });
  const cocody = f.annonce(jean, { statut: "publiee", titre: "Studio meublé à Cocody", publiee_le: date(-5), expire_le: date(85), modifie_le: date(-5) });
  return { jean, marcory, cocody };
}

const carteDe = (page: Page, titre: string) => page.getByRole("listitem").filter({ has: page.getByText(titre, { exact: true }) });
const fenetre = (page: Page) => page.getByRole("dialog", { name: "Faire voir mon annonce" });

async function ouvrir(page: Page, titre: string) {
  await appuyer(carteDe(page, titre).getByRole("button", { name: "Faire voir mon annonce" }));
  await expect(fenetre(page)).toBeVisible();
}

/** Sur la page de paiement (simulée), valider ou refuser ; retour à Mon Espace → Paiements */
async function payerSurLaPage(page: Page, montant: RegExp, accepter = true) {
  await expect(page).toHaveURL(/\/paiement\/simulation\?paiement=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payer par Mobile Money");
  await expect(page.getByText("Paiement simulé — mode essai")).toBeVisible();
  if (accepter) {
    await page.getByRole("radio", { name: "Orange Money" }).check();
    await appuyer(page.getByRole("button", { name: montant }));
  } else {
    await appuyer(page.getByRole("button", { name: "Simuler un refus (solde insuffisant)" }));
  }
  await expect(page).toHaveURL(/\/mon-espace\?section=paiements&paiement=/);
}

test("Remonter mon annonce : offre choisie, paiement Mobile Money (simulé), reçu ; 24 heures avant la suivante", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { marcory } = annonceur(f);
  await seConnecter(page, "jean@exemple.ci", "/mon-espace?section=annonces");
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  const boite = fenetre(page);
  await expect(boite.getByRole("radio", { name: /Remonter mon annonce/ })).toBeChecked();
  await expect(boite).toContainText("Orange Money, MTN MoMo, Moov Money ou Wave");
  await expect(boite).toContainText("Mode essai : paiement simulé, aucun argent n'est débité.");
  await appuyer(boite.getByRole("button", { name: /^Payer 1\s000 FCFA$/ }));

  await payerSurLaPage(page, /Valider le paiement de 1\s000 FCFA/);
  await expect(page.getByRole("status").filter({ hasText: "Paiement reçu" }))
    .toHaveText(/Paiement reçu : 1\s000 FCFA \(Remonter mon annonce\)\. Annonce remontée en tête de la liste\. Le reçu vous est envoyé par e-mail\./);
  await expect(page.getByRole("listitem").filter({ hasText: "Remonter mon annonce" })).toContainText("Payé");
  expect(f.paiements[0]).toMatchObject({ offre: "remontee", statut: "payee", moyen: "Orange Money", montant: 1000, annonce_id: marcory.id });
  expect(marcory.remontee_le).toBeTruthy();

  // Mes annonces : la remontée est notée ; une autre n'est possible que 24 heures plus tard
  await appuyer(page.getByRole("navigation", { name: "Mon espace" }).getByRole("button", { name: "Mes annonces" }));
  await expect(carteDe(page, "Appartement 3 pièces à Marcory")).toContainText("Remontée le");
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await expect(fenetre(page).getByRole("radio", { name: /Remonter mon annonce/ })).toBeDisabled();
  await expect(fenetre(page)).toContainText(/Déjà remontée il y a moins de 24 heures : prochaine remontée possible le .+ à \d\d h \d\d/);
  await expect(fenetre(page).getByRole("radio", { name: /Premium 30 jours/ })).toBeChecked();
});

test("Premium : paiement refusé sans effet, puis payé (badge, 30 photos) ; pack automatique ; ce qui est payé d'avance", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { jean, marcory, cocody } = annonceur(f);
  await seConnecter(page, "jean@exemple.ci", "/mon-espace?section=annonces");

  // Refusé (solde insuffisant) : rien n'est débité ni changé
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await fenetre(page).getByRole("radio", { name: /Premium 30 jours/ }).check();
  await appuyer(fenetre(page).getByRole("button", { name: /^Payer 5\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider/, false);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Le paiement n'a pas abouti (Paiement refusé (simulation)) : rien n'a été débité ni changé.");
  expect(marcory.premium).toBe(false);

  // Payé : Premium pendant 30 jours, 30 photos dans le formulaire
  await page.goto("/mon-espace?section=annonces");
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await fenetre(page).getByRole("radio", { name: /Premium 30 jours/ }).check();
  await appuyer(fenetre(page).getByRole("button", { name: /^Payer 5\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 5\s000 FCFA/);
  await expect(page.getByRole("status").filter({ hasText: "Paiement reçu" })).toContainText(/Annonce Premium jusqu'au \d\d\/\d\d\/\d{4}\./);
  await page.goto("/mon-espace?section=annonces");
  await expect(carteDe(page, "Appartement 3 pièces à Marcory")).toContainText(/Premium jusqu'au \d+ \S+ \d{4}/);
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await expect(fenetre(page).getByRole("radio", { name: /Prolonger le Premium de 30 jours/ })).toBeVisible();
  await fenetre(page).getByRole("button", { name: "Fermer" }).click();
  await page.goto(`/publier?annonce=${marcory.id}`);
  await expect(page.getByText(/30 photos au plus \(Premium\)/)).toBeVisible();

  // Pack de 3 sur le studio, les suivantes automatiques ; arrêter
  await page.goto("/mon-espace?section=annonces");
  await ouvrir(page, "Studio meublé à Cocody");
  await fenetre(page).getByRole("radio", { name: /Pack de 3 remontées/ }).check();
  await expect(fenetre(page).getByRole("checkbox", { name: "Faire les 2 suivantes automatiquement, tous les 3 jours" })).toBeChecked();
  await appuyer(fenetre(page).getByRole("button", { name: /^Payer 2\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 2\s000 FCFA/);
  await expect(page.getByRole("status").filter({ hasText: "Paiement reçu" }))
    .toContainText("Annonce remontée ; les 2 remontées suivantes se feront automatiquement tous les 3 jours.");
  await expect(page.getByRole("region", { name: "Payé d'avance" })).toContainText(/2 remontées à utiliser avant le/);
  await page.goto("/mon-espace?section=annonces");
  const studio = carteDe(page, "Studio meublé à Cocody");
  await expect(studio).toContainText(/Remontées automatiques tous les 3 jours : prochaine le/);
  await appuyer(studio.getByRole("button", { name: "Arrêter" }));
  await expect(page.getByRole("status").filter({ hasText: "Remontées automatiques arrêtées." })).toBeVisible();
  expect(f.programmees).toEqual([]);

  // Payé d'avance : une remontée sur Marcory (plus de 24 heures après), des jours Premium gardés sur le studio
  marcory.remontee_le = date(-2);
  f.joursPremium.push({ profil_id: jean, jours: 5 });
  await page.reload();
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await expect(fenetre(page)).toContainText("2 remontées d'avance");
  await appuyer(fenetre(page).getByRole("button", { name: "Remonter maintenant" }));
  await expect(page.getByRole("status").filter({ hasText: "Annonce remontée en tête de la liste." }))
    .toHaveText(/Annonce remontée en tête de la liste\. Il vous reste 1 remontée d'avance\./);
  await ouvrir(page, "Studio meublé à Cocody");
  await expect(fenetre(page)).toContainText("5 jours Premium gardés");
  await appuyer(fenetre(page).getByRole("button", { name: "Les utiliser ici" }));
  await expect(page.getByRole("status").filter({ hasText: "Annonce Premium jusqu'au" })).toBeVisible();
  expect(cocody.premium).toBe(true);
});

test("Nos offres : page publique avec les prix de la base ; Mon Espace → Paiements ; lien depuis Mes annonces et Publier", async ({ page }) => {
  await page.goto("/offres");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Faites voir vos annonces");
  const offres = page.getByRole("region", { name: "Les offres" });
  for (const [titre, prix] of [["Remonter mon annonce", /1\s000/], ["Pack de 3 remontées", /2\s000/], ["Premium 30 jours", /5\s000/]] as const) {
    await expect(offres.getByRole("article").filter({ has: page.getByRole("heading", { name: titre }) })).toContainText(prix);
  }
  await expect(page.getByRole("link", { name: "Faire voir mon annonce" })).toHaveAttribute("href", "/mon-espace?section=annonces");
  await expect(page).toHaveTitle(/Nos offres pour les annonceurs/);

  const f = await fauxSupabase(page);
  annonceur(f);
  await seConnecter(page, "jean@exemple.ci", "/mon-espace?section=paiements");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paiements");
  await expect(page.getByRole("region", { name: "Historique" })).toContainText("Aucun paiement.");
  await page.goto("/mon-espace?section=annonces");
  await expect(page.getByRole("link", { name: "Nos offres" })).toHaveAttribute("href", "/offres");
  await page.goto("/publier");
  await expect(page.getByText("Annonce Premium", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Bientôt", { exact: true })).toHaveCount(0);
});

test("Administration → Paiements : encaissé par offre, paiements, remboursement noté avec un motif", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { jean, marcory } = annonceur(f);
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.codeValide(equipe); // code du téléphone déjà donné (double authentification : tests/double-auth.spec.ts)
  const paye = (offre: string, montant: number, statut = "payee") => f.paiements.push({
    id: crypto.randomUUID(), reference: `PAY-2026-0000${f.paiements.length + 1}`, profil_id: jean, offre, annonce_id: marcory.id,
    annonce: { reference: marcory.reference, titre: marcory.titre }, montant, statut, moyen: "Wave", resultat: "Annonce remontée en tête de la liste.",
    erreur: statut === "echouee" ? "Solde insuffisant" : null, cree_le: date(-1), payee_le: statut === "payee" ? date(-1) : null,
  });
  paye("remontee", 1000);
  paye("premium_30", 5000);
  paye("premium_30", 5000, "echouee");
  await seConnecter(page, "equipe@360-immo.ci", "/admin?section=paiements");
  await expect(page.getByRole("button", { name: "Paiements" })).toHaveAttribute("aria-current", "page");
  const bref = page.getByRole("list", { name: "En bref" });
  await expect(bref.getByRole("listitem").filter({ hasText: "Encaissé" })).toContainText(/6\s000/);
  await expect(bref.getByRole("listitem").filter({ hasText: "Premium 30 jours" })).toContainText("1");
  await expect(bref.getByRole("listitem").filter({ hasText: "Échoués" })).toContainText("1");
  const premium = page.getByRole("listitem").filter({ hasText: "PAY-2026-00002" });
  await expect(premium).toContainText("Jean Kouassi");
  await expect(premium).toContainText("Wave");
  await appuyer(premium.getByRole("button", { name: "Noter un remboursement…" }));
  await premium.getByRole("button", { name: "Noter comme remboursé" }).click();
  await expect(premium.getByRole("alert")).toHaveText("Écrivez le motif du remboursement.");
  await premium.getByRole("textbox").fill("Annonce retirée par erreur, offre non utilisée.");
  await premium.getByRole("button", { name: "Noter comme remboursé" }).click();
  await expect(page.getByRole("status").filter({ hasText: "noté comme remboursé" })).toHaveText("Paiement PAY-2026-00002 noté comme remboursé.");
  expect(f.paiements[1]).toMatchObject({ statut: "remboursee", motif_remboursement: "Annonce retirée par erreur, offre non utilisée." });
  await expect(page.getByRole("listitem").filter({ hasText: "PAY-2026-00002" })).toContainText("Remboursé le");
});
