// Comptes : inscription, connexion, mot de passe oublié, Mon Espace, déconnexion.
// Le site parle à une fausse base Supabase (faux-supabase.ts) : on vérifie ce qu'il envoie et ce qu'il affiche.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, estTelephone, expect, test } from "./outils";

const champ = (page: Page, nom: string | RegExp, zone = "#panneau-inscription") =>
  page.locator(zone).getByRole("textbox", { name: nom, exact: typeof nom === "string" });

async function remplirInscription(page: Page, options: { agence?: string } = {}) {
  await page.goto("/connexion?mode=inscription");
  if (options.agence) {
    await page.getByText("Agence", { exact: true }).click();
    await champ(page, "Nom de l'agence").fill(options.agence);
  }
  await champ(page, "Prénom").fill("Awa");
  await champ(page, "Nom").fill("Koné");
  await champ(page, "E-mail").fill("awa@exemple.ci");
  await champ(page, "Numéro principal").fill("07 48 32 11 90");
  await page.locator("#panneau-inscription input[type=password]").nth(0).fill("Abidjan2026!");
  await page.locator("#panneau-inscription input[type=password]").nth(1).fill("Abidjan2026!");
  await page.getByRole("checkbox", { name: /J'accepte les Conditions/ }).check();
}

/** Un compte déjà inscrit, connecté, sur Mon Espace */
async function connecte(page: Page, f: FauxSupabase, metadonnees: Record<string, unknown> = {}) {
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90", ...metadonnees });
  await page.goto("/connexion?suite=/mon-espace");
  await champ(page, "E-mail", "#panneau-connexion").fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/mon-espace$/);
}

const inscription = (f: FauxSupabase) => f.demandes.find((d) => d.chemin === "/auth/v1/signup")?.corps;

test("Inscription d'un particulier : compte créé, profil complet, arrivée sur Mon Espace", async ({ page }) => {
  const f = await fauxSupabase(page);
  await remplirInscription(page);
  await expect(page.getByLabel("Aperçu pour les visiteurs")).toContainText("+225 07 48 32 11 90");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/mon-espace\?bienvenue=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa 👋");
  await expect(page.getByText("Votre compte est créé. Bienvenue sur 360-Immo.ci !")).toBeVisible();
  expect(inscription(f)).toMatchObject({
    email: "awa@exemple.ci",
    password: "Abidjan2026!",
    data: { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90", whatsapp: true },
  });
  expect(inscription(f)!.data).not.toHaveProperty("agence");
  expect(inscription(f)!.data).not.toHaveProperty("telephone2");
  // « Mon espace » de la barre du haut mène maintenant à Mon Espace (connecté)
  const barre = page.getByRole("navigation", { name: "Menu principal" });
  if (!estTelephone()) await expect(barre.getByRole("link", { name: /Mon espace/ })).toHaveAttribute("href", "/mon-espace");
});

test("Inscription d'une agence avec un second numéro étranger : demande d'agence en attente", async ({ page }) => {
  const f = await fauxSupabase(page);
  await remplirInscription(page, { agence: "Kamika Immobilier" });
  await page.getByRole("button", { name: /Ajouter un second numéro/ }).click();
  await page.getByRole("radio", { name: "Bureau" }).click();
  // Numéro collé avec son indicatif : la France est choisie toute seule
  await champ(page, "Second numéro").fill("+33 6 12 34 56 78");
  await champ(page, "Second numéro").blur();
  await expect(page.getByRole("button", { name: /Indicatif : France \+33/ })).toBeVisible();
  await expect(champ(page, "Second numéro")).toHaveValue("6 12 34 56 78");
  // Second numéro sur WhatsApp, principal non
  const wa1 = page.getByRole("button", { name: "Numéro principal sur WhatsApp" });
  const wa2 = page.getByRole("button", { name: "Second numéro sur WhatsApp" });
  await expect(wa1).toHaveAttribute("aria-pressed", "true");
  await expect(wa2).toHaveAttribute("aria-pressed", "false");
  await wa1.click();
  await wa2.click();
  await expect(wa1).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/mon-espace\?bienvenue=1$/);
  expect(inscription(f)!.data).toEqual({
    prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90", whatsapp: false,
    telephone2: "+33 6 12 34 56 78", whatsapp2: true, telephone2_type: "bureau", agence: "Kamika Immobilier",
  });
  await expect(page.getByText(/demande de compte agence pour « Kamika Immobilier » est en cours/)).toBeVisible();
  await expect(page.getByText("Agence en attente").first()).toBeVisible();
});

test("Inscription : chaque erreur est expliquée, rien n'est envoyé", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/connexion?mode=inscription");
  await page.getByText("Agence", { exact: true }).click();
  await champ(page, "E-mail").fill("awa@exemple");
  await champ(page, "Numéro principal").fill("07 48 32");
  await page.locator("#panneau-inscription input[type=password]").nth(0).fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  const zone = page.locator("#panneau-inscription");
  for (const texte of [
    "Indiquez votre prénom.", "Indiquez votre nom.", "Indiquez le nom de votre agence.", "E-mail invalide.",
    "Numéro invalide (Côte d'Ivoire, +225) : 10 chiffres, ex. 07 00 00 00 00.", "Au moins 8 caractères.",
    "Les mots de passe ne correspondent pas.", "Veuillez accepter les conditions d'utilisation pour continuer.",
  ]) {
    await expect(zone.getByText(texte, { exact: true })).toBeVisible();
  }
  await expect(champ(page, "Prénom")).toHaveAttribute("aria-invalid", "true");
  await expect(zone.getByText("Trop court")).toBeVisible(); // force du mot de passe
  expect(f.demandes).toEqual([]);
});

test("Inscription : e-mail déjà utilisé → message clair", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "autre-mot-de-passe");
  await remplirInscription(page);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.locator("#panneau-inscription").getByRole("alert")).toContainText("Un compte existe déjà avec cet e-mail");
  await expect(page).toHaveURL(/\/connexion/);
});

test("Connexion : mauvais mot de passe expliqué, puis Mon Espace ; Mon Espace demande d'abord la connexion", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  await page.goto("/mon-espace");
  await expect(page).toHaveURL(/\/connexion\?suite=\/mon-espace$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connectez-vous");

  await champ(page, "E-mail", "#panneau-connexion").fill("awa@exemple.ci");
  const mdp = page.locator("#panneau-connexion input[type=password]");
  await mdp.fill("mauvais");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator("#panneau-connexion").getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect.");

  // L'œil affiche le mot de passe tapé
  await page.locator("#panneau-connexion").getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(page.locator("#panneau-connexion").getByRole("textbox", { name: /Mot de passe/ })).toHaveValue("mauvais");
  await page.locator("#panneau-connexion").getByRole("textbox", { name: /Mot de passe/ }).fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa 👋");
  // Connexion gardée sur l'appareil (« Se souvenir de moi » coché par défaut)
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes("auth-token")))).toBe(true);
});

test("Après la connexion : retour à la page demandée, jamais vers un autre site", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa" });
  for (const [suite, attendu] of [["/publier", /\/publier$/], ["/\\autre-site.com", /\/mon-espace$/], ["//autre-site.com", /\/mon-espace$/]] as const) {
    await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
    await champ(page, "E-mail", "#panneau-connexion").fill("awa@exemple.ci");
    await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page, suite).toHaveURL(attendu);
    await page.evaluate(() => localStorage.clear());
  }
});

test("Se souvenir de moi décoché : la connexion n'est gardée que dans l'onglet", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa" });
  await page.goto("/connexion");
  await champ(page, "E-mail", "#panneau-connexion").fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("checkbox", { name: "Se souvenir de moi" }).uncheck();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/mon-espace$/);
  const [local, onglet] = await page.evaluate(() =>
    [localStorage, sessionStorage].map((st) => Object.keys(st).some((k) => k.includes("auth-token"))));
  expect({ local, onglet }).toEqual({ local: false, onglet: true });
});

test("Mot de passe oublié : lien demandé pour le bon e-mail, retour vers /mot-de-passe", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/connexion");
  await champ(page, "E-mail", "#panneau-connexion").fill("awa@exemple.ci");
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  const fenetre = page.getByRole("dialog", { name: "Mot de passe oublié ?" });
  await expect(fenetre.getByRole("textbox", { name: "E-mail" })).toHaveValue("awa@exemple.ci");
  await fenetre.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(fenetre).toContainText("un lien vient de lui être envoyé");
  const demande = f.demandes.find((d) => d.chemin === "/auth/v1/recover")!;
  expect(demande.corps).toMatchObject({ email: "awa@exemple.ci" });
  expect(new URL(demande.adresse).searchParams.get("redirect_to")).toMatch(/\/mot-de-passe$/);
  await fenetre.getByRole("button", { name: "Fermer" }).click();
  await expect(fenetre).toBeHidden();
});

test("Nouveau mot de passe : lien expiré expliqué ; une fois connecté, le mot de passe change", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/mot-de-passe#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid");
  await expect(page.getByText(/Ce lien a expiré ou a déjà servi/)).toBeVisible();
  await page.getByRole("link", { name: "Recevoir un nouveau lien" }).click();
  await expect(page.getByRole("dialog", { name: "Mot de passe oublié ?" })).toBeVisible();

  await connecte(page, f);
  await page.goto("/mot-de-passe");
  const mdp = page.locator("input[type=password]");
  await mdp.nth(0).fill("Nouveau2026!");
  await mdp.nth(1).fill("Nouveau2026!");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe est changé.", { exact: false })).toBeVisible();
  expect(f.comptes[0].motDePasse).toBe("Nouveau2026!");
});

test("Mon profil : numéros et nom modifiés, demande d'agence faite puis retirée", async ({ page }) => {
  const f = await fauxSupabase(page);
  await connecte(page, f);
  await page.getByRole("button", { name: "Mon profil" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon profil");
  await expect(page.getByRole("textbox", { name: "Numéro principal" })).toHaveValue("07 48 32 11 90");
  await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Koné-Traoré");
  await page.getByRole("textbox", { name: "Numéro principal" }).fill("05 11 22 33 44");
  await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
  await expect(page.getByText("Profil enregistré.")).toBeVisible();
  expect(f.profils.get(f.comptes[0].id)).toMatchObject({ nom: "Koné-Traoré", telephone: "+225 05 11 22 33 44", telephone2: null });

  await page.getByRole("textbox", { name: "Nom de l'agence" }).fill("Awa Immo");
  await page.getByRole("button", { name: "Demander un compte agence" }).click();
  await expect(page.getByText(/Demande envoyée pour « Awa Immo »/)).toBeVisible();
  await expect(page.getByText("Agence en attente")).toBeVisible();
  await page.getByRole("button", { name: "Retirer ma demande" }).click();
  await expect(page.getByRole("button", { name: "Demander un compte agence" })).toBeVisible();
  expect(f.profils.get(f.comptes[0].id)!.demande_agence).toBeNull();
});

test("Déconnexion : retour à l'accueil, « Mon espace » mène de nouveau à la connexion", async ({ page }) => {
  const f = await fauxSupabase(page);
  await connecte(page, f);
  await page.getByRole("button", { name: "Paramètres" }).first().click();
  await expect(page.getByText("E-mail du compte : awa@exemple.ci")).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).last().click();
  await expect(page).toHaveURL(/\/$/);
  expect(f.demandes.some((d) => d.chemin === "/auth/v1/logout")).toBe(true);
  if (estTelephone()) await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const lien = page.getByRole(estTelephone() ? "complementary" : "navigation", { name: estTelephone() ? "Menu du site" : "Menu principal" })
    .getByRole("link", { name: /Mon espace/ });
  await expect(lien).toHaveAttribute("href", "/connexion");
});

test("Google, Facebook, WhatsApp : annoncés « bientôt », sans rien envoyer", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/connexion");
  await appuyer(page.locator("#panneau-connexion").getByRole("button", { name: /Google/ }));
  await expect(page.locator("#panneau-connexion").getByRole("status")).toHaveText(/La connexion avec Google arrive bientôt/);
  expect(f.demandes).toEqual([]);
});

test("Indicatif : liste des pays, recherche, clavier", async ({ page }) => {
  await fauxSupabase(page);
  await page.goto("/connexion?mode=inscription");
  const pays = page.getByRole("button", { name: /Indicatif : Côte d'Ivoire \+225/ });
  await appuyer(pays);
  const recherche = page.getByRole("combobox", { name: "Rechercher un pays ou un indicatif" });
  await expect(recherche).toBeFocused();
  // Pays fréquents en tête, le pays choisi en évidence
  const options = page.getByRole("listbox", { name: "Pays" }).getByRole("option");
  await expect(options.first()).toContainText("Côte d'Ivoire");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await recherche.fill("sene");
  await expect(options).toHaveCount(1);
  await recherche.press("Enter");
  await expect(page.getByRole("button", { name: /Indicatif : Sénégal \+221/ })).toBeVisible();
  await expect(champ(page, "Numéro principal")).toBeFocused();
  await expect(champ(page, "Numéro principal")).toHaveAttribute("placeholder", "77 123 45 67");
  // Par indicatif, puis Échap : la liste se ferme sans rien changer
  await appuyer(page.getByRole("button", { name: /Indicatif : Sénégal/ }));
  await recherche.fill("+33");
  await expect(options.first()).toContainText("France");
  await recherche.press("Escape");
  await expect(recherche).toBeHidden();
  await expect(page.getByRole("button", { name: /Indicatif : Sénégal/ })).toBeFocused();
});
