// Étape 6, 1re partie : favoris (cœur, Mon Espace → Mes favoris) et messages (fiche, Mon Espace → Messages).
// Comptes, favoris et messages : imités par tests/faux-supabase.ts ; annonces d'exemple : tests/base/serveur.mjs
// (identifiant tiré de la référence : IMM-2026-01017 → 00000000-0000-4000-8000-000202601017).
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, estTelephone, expect, test } from "./outils";

const idExemple = (n: number) => `00000000-0000-4000-8000-0002026${String(n).padStart(5, "0")}`;
const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Awa K.)

const jean = (f: FauxSupabase) => f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });

/** Remplit le formulaire de connexion (on y est déjà) */
async function seConnecter(page: Page, email = "jean@exemple.ci") {
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("Favori sans compte : « Connectez-vous », puis l'annonce est ajoutée dès la connexion", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto("/annonces");
  const coeur = page.getByRole("button", { name: /^Ajouter aux favoris : Appartement 3 pièces meublé à louer — Riviera 2$/ });
  await appuyer(coeur);
  const fenetre = page.getByRole("dialog", { name: "Gardez vos coups de cœur" });
  await expect(fenetre).toBeVisible();
  await appuyer(fenetre.getByRole("link", { name: "Se connecter" }));
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fannonces$/);
  await seConnecter(page);
  await expect(page).toHaveURL(/\/annonces$/);
  await expect(page.getByRole("button", { name: /^Retirer des favoris : Appartement 3 pièces meublé à louer — Riviera 2$/ }))
    .toHaveAttribute("aria-pressed", "true");
  expect(f.favoris.map((x) => x.annonce_id)).toEqual([idExemple(1001)]);
});

test("Favoris : cœur de la fiche et des cartes ; Mon Espace → Mes favoris, annonce plus en ligne", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  f.favoris.push({ profil_id: moi, annonce_id: idExemple(1017), cree_le: "2026-09-01T10:00:00Z" }); // expirée depuis
  await page.goto(`/connexion?suite=${encodeURIComponent(FICHE_AWA)}`);
  await seConnecter(page);
  await expect(page).toHaveURL(/\/annonces\/appartement-2-pieces-a-louer-niangon-imm-2026-01006$/);
  const sauvegarder = page.getByRole("button", { name: /favoris : Appartement 2 pièces à louer — Niangon$/ }).first();
  await expect(sauvegarder).toHaveText("Sauvegarder");
  await appuyer(sauvegarder);
  await expect(sauvegarder).toHaveText("Sauvegardé");
  await expect(sauvegarder).toHaveAttribute("aria-pressed", "true");
  expect(f.favoris.map((x) => x.annonce_id)).toContain(idExemple(1006));

  await page.goto("/mon-espace?section=favoris");
  await expect(page.locator("h1")).toHaveText("Mes favoris");
  await expect(page.getByText("2 biens sauvegardés")).toBeVisible();
  const carte = page.getByRole("article").filter({ hasText: "Appartement 2 pièces à louer — Niangon" });
  await expect(carte).toBeVisible();
  const retiree = page.getByText("Plus en ligne").locator("..");
  await expect(retiree).toContainText("Appartement expiré à louer — Riviera 2");
  await appuyer(retiree.getByRole("button", { name: "Retirer des favoris" }));
  await expect(page.getByText("1 bien sauvegardé")).toBeVisible();
  // Le cœur de la carte retire aussi
  await appuyer(carte.getByRole("button", { name: /^Retirer des favoris/ }));
  await expect(page.getByText(/Aucun favori pour l'instant/)).toBeVisible();
  expect(f.favoris).toEqual([]);
});

test("Message depuis la fiche : sans compte, gardé pendant la connexion, puis envoyé ; la conversation dans Mon Espace", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto(FICHE_AWA);
  const contact = page.locator("#contact");
  await appuyer(contact.getByRole("button", { name: "Envoyer un message" }));
  const zone = contact.getByRole("textbox", { name: "Votre message à Awa K." });
  await expect(zone).toHaveValue(/^Bonjour, je suis intéressé\(e\) par votre annonce « Appartement 2 pièces à louer — Niangon » \(réf\. IMM-2026-01006\)/);
  await zone.fill("Bonjour, je voudrais visiter samedi matin. Est-ce possible ?");
  await appuyer(contact.getByRole("button", { name: "Envoyer" }));
  const fenetre = page.getByRole("dialog", { name: "Écrire à l'annonceur" });
  await appuyer(fenetre.getByRole("link", { name: "Se connecter" }));
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fannonces%2Fappartement-2-pieces-a-louer-niangon-imm-2026-01006%23contact$/);
  await seConnecter(page);
  // De retour sur la fiche : le message attend, prêt à partir
  await expect(page).toHaveURL(/imm-2026-01006#contact$/);
  await expect(contact.getByText("Votre message vous attend")).toBeVisible();
  await expect(zone).toHaveValue("Bonjour, je voudrais visiter samedi matin. Est-ce possible ?");
  await appuyer(contact.getByRole("button", { name: "Envoyer" }));
  await expect(contact.getByRole("status")).toContainText("Message envoyé à Awa K.");
  expect(f.messages.map((m) => m.contenu)).toEqual(["Bonjour, je voudrais visiter samedi matin. Est-ce possible ?"]);
  expect(f.conversations[0]).toMatchObject({ annonce_id: idExemple(1006) });

  await appuyer(contact.getByRole("link", { name: "Voir la conversation" }));
  await expect(page).toHaveURL(/\/mon-espace\?section=messages&conversation=/);
  const fil = page.getByRole("region", { name: "Conversation avec Awa K." });
  await expect(fil.getByText("Bonjour, je voudrais visiter samedi matin. Est-ce possible ?")).toBeVisible();
  await expect(fil.getByRole("link", { name: /Appartement 2 pièces à louer — Niangon/ })).toHaveAttribute("href", /imm-2026-01006$/);
  // Un message vide ne part pas
  await expect(fil.getByRole("button", { name: "Envoyer" })).toBeDisabled();
});

test("Messages côté annonceur : non lus (barre du haut, Mon Espace), lecture, réponse", async ({ page }) => {
  const f = await fauxSupabase(page);
  const client = jean(f);
  const awa = f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const annonce = f.annonce(awa, { titre: "Villa 4 pièces à louer — Angré", statut: "publiee", expire_le: new Date(Date.now() + 30 * 86_400_000).toISOString() });
  const c = f.conversation(String(annonce.id), client, awa);
  f.message(String(c.id), client, "Bonjour, la villa est-elle libre en novembre ?", { cree_le: "2026-10-04T09:00:00Z" });
  f.message(String(c.id), client, "Je peux passer cette semaine.", { cree_le: "2026-10-04T09:05:00Z" });

  await page.goto("/connexion?suite=%2Fmon-espace");
  await seConnecter(page, "awa@exemple.ci");
  await expect(page).toHaveURL(/\/mon-espace$/);
  // Pastille de la barre du haut (téléphone : dans le menu ☰ aussi) et du tableau de bord
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: /2 messages non lus$/ })).toBeVisible();
  const messages = page.getByRole("navigation", { name: "Mon espace" }).getByRole("button", { name: /^Messages/ });
  await expect(messages).toContainText("2");
  await appuyer(page.getByRole("button", { name: /2 messages non lus\.$/ }));

  const conversation = page.getByRole("list", { name: "Conversations" }).getByRole("button").first();
  await expect(conversation).toContainText("Jean K.");
  await expect(conversation).toContainText("Votre annonce : Villa 4 pièces à louer — Angré");
  await expect(conversation).toContainText("Je peux passer cette semaine.");
  await appuyer(conversation);
  const fil = page.getByRole("region", { name: "Conversation avec Jean K." });
  await expect(fil.getByText("Bonjour, la villa est-elle libre en novembre ?")).toBeVisible();
  // Lus : les pastilles disparaissent
  await expect.poll(() => f.messages.filter((m) => !m.lu_le).length).toBe(0);
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: /non lus$/ })).toHaveCount(0);
  await expect(messages).not.toContainText("2");

  // Réponse
  await fil.getByRole("textbox", { name: "Votre message à Jean K." }).fill("Oui, libre au 1er novembre. Jeudi 16 h ?");
  await appuyer(fil.getByRole("button", { name: "Envoyer" }));
  await expect(fil.getByText("Oui, libre au 1er novembre. Jeudi 16 h ?")).toBeVisible();
  expect(f.messages.at(-1)).toMatchObject({ auteur_id: awa, contenu: "Oui, libre au 1er novembre. Jeudi 16 h ?" });
  // Téléphone : la liste, ou le fil avec « retour »
  if (estTelephone()) {
    await expect(page.getByRole("list", { name: "Conversations" })).toBeHidden();
    await appuyer(fil.getByRole("button", { name: "Retour aux conversations" }));
    await expect(page.getByRole("list", { name: "Conversations" })).toBeVisible();
  }
  await expect(conversation).toContainText("Vous : Oui, libre au 1er novembre.");
});

test("Messages : aucune conversation ; Mon Espace sans compte mène à la connexion", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto("/connexion?suite=%2Fmon-espace%3Fsection%3Dmessages");
  await seConnecter(page);
  await expect(page.getByText(/Aucun message pour l'instant/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les annonces" })).toHaveAttribute("href", "/annonces");
});
