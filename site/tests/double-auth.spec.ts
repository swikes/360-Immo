// Étape 9e : double authentification de l'équipe (components/admin/DoubleAuthentification.tsx). Un compte « admin »
// n'a les droits de l'équipe qu'avec le code de son application (la base : tests/base.spec.ts) ; le code est imité par
// tests/faux-supabase.ts (seul CODE_APPLICATION est accepté).
import type { Page } from "@playwright/test";
import { CODE_APPLICATION, fauxSupabase } from "./faux-supabase";
import { expect, test } from "./outils";

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const demandesEquipe = (chemins: string[]) => chemins.filter((c) => /\/rpc\/admin_/.test(c));

test("Première fois : activer le code (QR code et clé), un code faux est refusé, puis l'Administration s'ouvre", async ({ page }) => {
  const f = await fauxSupabase(page);
  const equipe = f.inscrit("equipe@360immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  await seConnecter(page, "equipe@360immo.ci", "/admin");

  await expect(page.locator("h1")).toHaveText("Activez la double authentification");
  await expect(page.getByText(/Google Authenticator ou Microsoft Authenticator/)).toBeVisible();
  // rien de l'équipe n'est demandé à la base avant le code
  expect(demandesEquipe(f.demandes.map((d) => d.chemin))).toEqual([]);

  await page.getByRole("button", { name: "Afficher le QR code" }).click();
  await expect(page.locator("h1")).toHaveText("Scannez ce QR code");
  const qr = page.getByRole("img", { name: "QR code à scanner avec l'application d'authentification" });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();
  await expect(page.getByText(/Notez cette clé et gardez-la en lieu sûr/)).toBeVisible();

  const code = page.getByLabel("Code à 6 chiffres");
  await expect(code).toBeFocused();
  await code.fill("12");
  await page.getByRole("button", { name: "Activer" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Le code a 6 chiffres.");
  await code.fill("000000");
  await page.getByRole("button", { name: "Activer" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Code incorrect");
  await expect(code).toHaveValue("");

  await code.fill(CODE_APPLICATION);
  await page.getByRole("button", { name: "Activer" }).click();
  await expect(page.locator("h1")).toHaveText("Administration");
  await expect(page.getByRole("button", { name: /^À vérifier/ })).toBeVisible();
  expect(f.comptes.find((c) => c.id === equipe)!.facteurs).toEqual([expect.objectContaining({ verifie: true })]);
});

test("Code déjà activé : demandé à chaque nouvelle connexion ; un compte qui n'est pas de l'équipe ne le voit jamais", async ({ page }) => {
  const f = await fauxSupabase(page);
  const equipe = f.inscrit("equipe@360immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.codeValide(equipe);
  f.comptes.find((c) => c.id === equipe)!.codeSaisi = false; // nouvel appareil : le code n'a pas encore été donné
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné" });

  await seConnecter(page, "equipe@360immo.ci", "/admin");
  await expect(page.locator("h1")).toHaveText("Code de votre application");
  await expect(page.getByRole("button", { name: "Afficher le QR code" })).toHaveCount(0);
  expect(demandesEquipe(f.demandes.map((d) => d.chemin))).toEqual([]);
  // sans le code, la base refuse ce qui est réservé à l'équipe (connexion « aal1 »)
  const refus = await page.evaluate(async () => {
    const cle = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"))!;
    const jeton = JSON.parse(localStorage.getItem(cle)!).access_token;
    const r = await fetch("http://127.0.0.1:54329/rest/v1/rpc/admin_tableau", {
      method: "POST", headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" }, body: "{}",
    });
    return r.status;
  });
  expect(refus).toBe(403);

  await page.getByLabel("Code à 6 chiffres").fill(CODE_APPLICATION);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.locator("h1")).toHaveText("Administration");
  expect(demandesEquipe(f.demandes.map((d) => d.chemin)).length).toBeGreaterThan(0);

  // Un compte ordinaire : « Espace réservé », jamais l'écran du code
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await seConnecter(page, "awa@exemple.ci", "/admin");
  await expect(page.locator("h1")).toHaveText("Espace réservé à l'équipe 360Immo.ci");
  await expect(page.getByText("Code de votre application")).toHaveCount(0);
});

test("Nouveau mot de passe (lien « mot de passe oublié ») d'un compte avec le code : le code est demandé, un code faux est refusé, puis le mot de passe change et il faut se connecter", async ({ page }) => {
  const f = await fauxSupabase(page);
  const equipe = f.inscrit("equipe@360immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.codeValide(equipe);
  f.comptes.find((c) => c.id === equipe)!.codeSaisi = false; // le lien reçu par e-mail ne donne pas le code
  await page.goto(`/mot-de-passe${f.lienRecuperation("equipe@360immo.ci")}`);

  const code = page.getByRole("textbox", { name: "Code à 6 chiffres" });
  await expect(code).toBeVisible();
  await expect(page.getByText(/Votre compte est protégé par la double authentification/)).toBeVisible();
  const mdp = page.locator("input[type=password]");
  await mdp.nth(0).fill("Nouveau2026!");
  await mdp.nth(1).fill("Nouveau2026!");
  // sans le code : demandé avant d'envoyer quoi que ce soit
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Le code a 6 chiffres.")).toBeVisible();
  // code faux : refusé, rien n'est changé
  await code.fill("000000");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Code incorrect");
  await expect(code).toHaveValue("");
  expect(f.comptes.find((c) => c.id === equipe)!.motDePasse).toBe("Abidjan2026!");
  // bon code : le mot de passe change
  await code.fill(CODE_APPLICATION);
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe est changé. Connectez-vous avec votre nouveau mot de passe.")).toBeVisible();
  expect(f.comptes.find((c) => c.id === equipe)!.motDePasse).toBe("Nouveau2026!");
  // le lien n'a pas connecté : déconnecté, il faut entrer avec le nouveau mot de passe, puis le code
  expect(f.demandes.some((d) => d.chemin === "/auth/v1/logout")).toBe(true);
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/connexion\?suite=/);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("equipe@360immo.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Nouveau2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(page.locator("h1")).toHaveText("Code de votre application");
});

test("Mon Espace : un compte avec le code le donne avant d'entrer ; un compte sans code entre directement", async ({ page }) => {
  const f = await fauxSupabase(page);
  const equipe = f.inscrit("equipe@360immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.codeValide(equipe);
  f.comptes.find((c) => c.id === equipe)!.codeSaisi = false; // nouvel appareil : le code n'a pas encore été donné
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné" });

  await seConnecter(page, "equipe@360immo.ci", "/mon-espace");
  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(page.locator("h1")).toHaveText("Code de votre application");
  await expect(page.getByText(/Bonjour/)).toHaveCount(0);
  await page.getByLabel("Code à 6 chiffres").fill("000000");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Code incorrect");
  await expect(page.getByText(/Bonjour/)).toHaveCount(0);
  await page.getByLabel("Code à 6 chiffres").fill(CODE_APPLICATION);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Équipe 👋");
  // code donné pour cette connexion : plus redemandé en revenant
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Équipe 👋");

  // Un compte sans code : Mon Espace s'ouvre tout de suite, sans proposer d'activer le code
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await seConnecter(page, "awa@exemple.ci", "/mon-espace");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa 👋");
  await expect(page.getByText("Code de votre application")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Afficher le QR code" })).toHaveCount(0);
});
