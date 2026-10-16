// Pages du pied de page (à propos, aide, devenir partenaire, pages légales), formulaire Contact, et onglets
// « Pages du site » et « Contact » de l'Administration. La fausse base (tests/base/serveur.mjs) publie 3 des premières
// versions : Aide, Devenir partenaire, Cookies ; les autres affichent « Page bientôt disponible ».
// L'Administration et le formulaire Contact sont imités par tests/faux-supabase.ts ; les règles de la base : base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

test("Aide : rubriques, questions qui s'ouvrent au toucher, données « FAQ » pour Google, autres pages et contact", async ({ page }) => {
  await page.goto("/aide");
  await expect(page).toHaveTitle("Aide & questions fréquentes — 360-Immo.ci");
  await expect(page.locator("h1")).toHaveText("Aide & questions fréquentes");
  await expect(page.getByText(/Mise à jour le/)).toHaveCount(0);   // pas une page légale
  await expect(page.getByRole("heading", { level: 2, name: "Publier une annonce" })).toBeVisible();
  const question = page.locator("details", { hasText: "Combien coûte une annonce ?" });
  await expect(question.getByText("La publication d'une annonce est gratuite.")).toBeHidden();
  await appuyer(question.locator("summary"));
  await expect(question.getByText(/La publication d'une annonce est gratuite\./)).toBeVisible();
  // un lien du texte mène au formulaire, sujet choisi
  await expect(page.locator('article a[href="/contact?sujet=compte"]')).toHaveCount(1);
  const donnees = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}");
  expect(donnees["@type"]).toBe("FAQPage");
  expect(donnees.mainEntity.length).toBeGreaterThan(15);
  expect(donnees.mainEntity).toContainEqual(expect.objectContaining({
    name: "Combien coûte une annonce ?",
    acceptedAnswer: expect.objectContaining({ text: expect.stringContaining("La publication d'une annonce est gratuite.") }),
  }));
  // à côté : les autres pages (celle-ci en cours) et le contact
  const autres = page.getByRole("navigation", { name: "360-Immo.ci" });
  await expect(autres.getByRole("link", { name: "Aide & FAQ" })).toHaveAttribute("aria-current", "page");
  await expect(autres.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  await expect(page.getByRole("complementary", { name: "Autres pages" }).getByRole("link", { name: /Une question \?/ })).toHaveAttribute("href", "/contact");
});

test("Pages légales : date de mise à jour, sommaire ; brouillon = « Page bientôt disponible » ; pied de page, inscription, plan du site", async ({ page, request }) => {
  await page.goto("/cookies");
  await expect(page.locator("h1")).toHaveText("Cookies et stockage sur votre appareil");
  await expect(page.locator("article header").getByText("Informations légales", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Mise à jour le \d+ \w+ \d{4}$/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sommaire" }).getByRole("link")).toHaveCount(4);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /ni cookies publicitaires ni traceurs.*mesure d'audience anonyme, sans cookie/);
  // pages pas encore publiées (« [à compléter] » à remplir) : page introuvable
  for (const adresse of ["/a-propos", "/mentions-legales", "/cgu", "/confidentialite"]) {
    const reponse = await page.goto(adresse);
    expect(reponse?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Page bientôt disponible");
  }
  // pied de page
  await page.goto("/devenir-partenaire");
  const pied = page.getByRole("contentinfo");
  await expect(pied.getByRole("link", { name: "Devenir partenaire" })).toHaveAttribute("href", "/devenir-partenaire");
  await expect(pied.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/cookies");
  await expect(pied.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  // Devenir partenaire → formulaire, sujet « partenariat » choisi
  await appuyer(page.locator("article").getByRole("link", { name: "Parlons-en" }));
  await expect(page).toHaveURL(/\/contact\?sujet=partenariat$/);
  await expect(page.getByLabel("Sujet")).toHaveValue("partenariat");
  // Inscription : les conditions s'ouvrent dans un nouvel onglet
  await page.goto("/connexion?mode=inscription");
  const conditions = page.locator("label", { hasText: "J'accepte les" });
  await expect(conditions.getByRole("link", { name: "Conditions générales d'utilisation" })).toHaveAttribute("href", "/cgu");
  await expect(conditions.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
  await expect(conditions.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("target", "_blank");
  const plan = await (await request.get("/sitemap.xml")).text();
  for (const x of ["/aide", "/cookies", "/devenir-partenaire", "/contact"]) expect(plan).toContain(`${x}</loc>`);
  expect(plan).not.toContain("/cgu</loc>");
});

test("Contact sans compte : contrôles, e-mail ou téléphone, référence d'une annonce, envoi, merci", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto("/contact?annonce=IMM-2026-01006");
  await expect(page.locator("h1")).toHaveText("Écrire à l'équipe 360-Immo.ci");
  const formulaire = page.getByRole("form", { name: "Écrire à l'équipe" });
  await expect(formulaire.getByLabel("Sujet")).toHaveValue("annonce");
  await expect(formulaire.getByLabel("Référence de l'annonce (facultative)")).toHaveValue("IMM-2026-01006");
  await appuyer(formulaire.getByRole("button", { name: "Envoyer mon message" }));
  await expect(formulaire.getByText("Indiquez votre nom.")).toBeVisible();
  await expect(formulaire.getByText(/Indiquez une adresse e-mail ou un numéro de téléphone/)).toBeVisible();
  await expect(formulaire.getByText("Écrivez votre message (10 caractères au moins).")).toBeVisible();
  expect(f.contacts).toEqual([]);
  // arnaque : conseil de signaler l'annonce ; données personnelles : écrire depuis l'adresse du compte
  await formulaire.getByLabel("Sujet").selectOption("arnaque");
  await expect(formulaire.getByText(/le plus rapide est « Signaler cette annonce »/)).toBeVisible();
  await formulaire.getByLabel("Sujet").selectOption("donnees");
  await expect(formulaire.getByText(/écrivez depuis l'adresse e-mail de votre compte/)).toBeVisible();
  await expect(formulaire.getByLabel("Référence de l'annonce (facultative)")).toHaveCount(0);
  await formulaire.getByLabel("Sujet").selectOption("arnaque");
  await formulaire.getByLabel("Votre nom").fill("Aya Touré");
  await formulaire.getByLabel("E-mail").fill("aya@exemple");
  await formulaire.getByLabel("Votre message").fill("On m'a demandé 50 000 FCFA avant la visite.");
  await expect(formulaire.getByText("43 / 3 000")).toBeVisible();
  await appuyer(formulaire.getByRole("button", { name: "Envoyer mon message" }));
  await expect(formulaire.getByText("L'adresse e-mail n'est pas valide.")).toBeVisible();
  await formulaire.getByLabel("E-mail").fill("aya@exemple.ci");
  await appuyer(formulaire.getByRole("button", { name: "Envoyer mon message" }));
  await expect(page.getByRole("heading", { name: "Merci, votre message est bien envoyé" })).toBeVisible();
  await expect(page.getByText(/vous répond à aya@exemple\.ci/)).toBeVisible();
  expect(f.contacts).toHaveLength(1);
  expect(f.contacts[0]).toMatchObject({
    nom: "Aya Touré", email: "aya@exemple.ci", telephone: null, sujet: "arnaque", reference: "IMM-2026-01006",
    message: "On m'a demandé 50 000 FCFA avant la visite.", profil_id: null,
  });
  // un autre message, par téléphone seulement
  await appuyer(page.getByRole("button", { name: "Écrire un autre message" }));
  await formulaire.getByLabel("E-mail").fill("");
  await formulaire.getByLabel("Téléphone").fill("07 01 02 03 04");
  await formulaire.getByLabel("Sujet").selectOption("question");
  await formulaire.getByLabel("Votre message").fill("Comment publier une annonce pour un terrain ?");
  await appuyer(formulaire.getByRole("button", { name: "Envoyer mon message" }));
  await expect(page.getByText(/vous répond par téléphone/)).toBeVisible();
  expect(f.contacts[1]).toMatchObject({ email: null, telephone: "+225 07 01 02 03 04", sujet: "question", reference: null });
});

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("Contact avec un compte : prérempli (nom, e-mail, numéro), rattaché au compte", async ({ page }) => {
  const f = await fauxSupabase(page);
  const koffi = f.inscrit("koffi@exemple.ci", "Abidjan2026!", { prenom: "Koffi", nom: "Yao", telephone: "+225 07 48 32 11 90" });
  await seConnecter(page, "koffi@exemple.ci", "/contact?sujet=compte");
  const formulaire = page.getByRole("form", { name: "Écrire à l'équipe" });
  await expect(formulaire.getByLabel("Votre nom")).toHaveValue("Koffi Yao");
  await expect(formulaire.getByLabel("E-mail")).toHaveValue("koffi@exemple.ci");
  await expect(formulaire.getByLabel("Téléphone")).toHaveValue("07 48 32 11 90");
  await expect(formulaire.getByLabel("Sujet")).toHaveValue("compte");
  await formulaire.getByLabel("Votre message").fill("Mon numéro est déjà pris par un autre compte.");
  await appuyer(formulaire.getByRole("button", { name: "Envoyer mon message" }));
  await expect(page.getByRole("heading", { name: "Merci, votre message est bien envoyé" })).toBeVisible();
  expect(f.contacts[0]).toMatchObject({ profil_id: koffi, telephone: "+225 07 48 32 11 90", sujet: "compte" });

});

// ══ Administration ══

async function ouvrirAdmin(page: Page, f: FauxSupabase, adresse = "/admin") {
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Fanta", nom: "Bamba" });
  f.profils.get(equipe)!.role = "admin";
  await seConnecter(page, "equipe@360-immo.ci", adresse);
  await expect(page.locator("h1")).toHaveText("Administration");
  return equipe;
}

test("Administration → Pages du site : « [à compléter] » bloque la publication ; écrire, aperçu en questions, publier malgré les notes, retirer, journal", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.page("mentions-legales", { resume: "Qui édite le site.", contenu: "## Éditeur\n\nSociété : [à compléter : nom de la société]\n\nRCCM : [à compléter]", notes: "Faire relire" });
  f.page("aide", { resume: "Les réponses.", contenu: "## Chercher\n\n### Faut-il un compte ?\n\nNon, pas pour chercher.", notes: "Relire les réponses" });
  await ouvrirAdmin(page, f);
  await appuyer(page.getByRole("button", { name: "Pages du site" }));
  const carte = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Mentions légales" }) });
  await expect(carte).toContainText("Brouillon");
  await expect(carte).toContainText("Page légale");
  await expect(carte).toContainText("Passages à compléter");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(7);

  // Mentions légales : les passages à compléter sont listés, « Publier » attend qu'ils soient remplacés
  await appuyer(carte.getByRole("button", { name: "Modifier" }));
  const manques = page.getByRole("note", { name: "Passages à compléter" });
  await expect(manques).toContainText("2 passages à compléter");
  await expect(manques.getByRole("listitem")).toHaveText(["Société : [à compléter : nom de la société]", "RCCM : [à compléter]"]);
  await expect(page.getByRole("button", { name: "Publier", exact: true })).toBeDisabled();
  await page.getByLabel("Texte de la page").fill("## Éditeur\n\nSociété : 360-Immo SARL\n\nRCCM : CI-ABJ-2026-B-00000");
  await expect(manques).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publier", exact: true })).toBeEnabled();
  await appuyer(page.getByRole("button", { name: "Enregistrer", exact: true }));
  await expect(page.getByRole("status").filter({ hasText: "Page enregistrée." })).toBeVisible();
  expect(f.pages.find((p) => p.slug === "mentions-legales")).toMatchObject({ contenu: "## Éditeur\n\nSociété : 360-Immo SARL\n\nRCCM : CI-ABJ-2026-B-00000", statut: "brouillon" });
  await appuyer(page.getByRole("button", { name: "Toutes les pages" }));

  // Aide : aperçu en questions ; publier rappelle les notes
  await appuyer(page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Aide & questions fréquentes" }) })
    .getByRole("button", { name: "Modifier" }));
  await appuyer(page.getByRole("button", { name: "Aperçu" }));
  const apercu = page.getByRole("region", { name: "Aperçu de la page" });
  await expect(apercu.locator("details summary")).toHaveText("Faut-il un compte ?");
  await appuyer(page.getByRole("button", { name: "Écrire" }));
  await appuyer(page.getByRole("button", { name: "Publier", exact: true }));
  const rappel = page.getByRole("group", { name: "Publier malgré les notes" });
  await expect(rappel).toContainText("Relire les réponses");
  await appuyer(rappel.getByRole("button", { name: "Publier quand même" }));
  await expect(page.getByRole("status").filter({ hasText: "Page publiée : elle est visible de tous." })).toBeVisible();
  expect(f.pages.find((p) => p.slug === "aide")!.statut).toBe("publie");
  await expect(page.getByRole("link", { name: "Voir la page" })).toHaveAttribute("href", "/aide");
  // en ligne : « [à compléter] » refusé par la base
  await page.getByLabel("Texte de la page").fill("## Chercher\n\n### Qui sommes-nous ?\n\n[à compléter]");
  await appuyer(page.getByRole("button", { name: "Enregistrer", exact: true }));
  await expect(page.locator("main").getByRole("alert")).toContainText("elle ne peut pas contenir « [à compléter] »");
  await page.getByLabel("Texte de la page").fill("## Chercher\n\n### Faut-il un compte ?\n\nNon, pas pour chercher.");
  await appuyer(page.getByRole("button", { name: "Retirer du site" }));
  await expect(page.getByRole("status").filter({ hasText: /Page retirée du site/ })).toBeVisible();
  expect(f.pages.find((p) => p.slug === "aide")!.statut).toBe("brouillon");

  await appuyer(page.getByRole("button", { name: "Journal" }));
  const journal = page.getByRole("list", { name: "Dernières décisions" });
  await expect(journal.getByRole("listitem").nth(0)).toContainText("Page retirée du site");
  await expect(journal.getByRole("listitem").nth(1)).toContainText("Page publiée");
  await expect(journal.getByRole("listitem").nth(1)).toContainText("Aide & questions fréquentes");
});

test("Administration → Contact : nouvelles demandes (pastille, tableau de bord), répondre, marquer comme traitée ; lien des e-mails", async ({ page }) => {
  const f = await fauxSupabase(page);
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  f.contacts.push(
    { id: crypto.randomUUID(), profil_id: null, nom: "Aya Touré", email: "aya@exemple.ci", telephone: "+225 07 01 02 03 04", sujet: "arnaque",
      reference: "IMM-2026-01006", message: "On m'a demandé de l'argent avant la visite.", statut: "nouvelle", cree_le: hier, traitee_le: null, traitee_par: null },
    { id: crypto.randomUUID(), profil_id: null, nom: "Moussa Diarra", email: null, telephone: "+225 05 06 07 08 09", sujet: "partenariat",
      reference: null, message: "Je suis promoteur à Bingerville.", statut: "nouvelle", cree_le: new Date().toISOString(), traitee_le: null, traitee_par: null },
  );
  // lien des e-mails envoyés à l'équipe : l'onglet Contact s'ouvre directement
  await ouvrirAdmin(page, f, "/admin?section=contact");
  await expect(page.getByRole("button", { name: /^Contact/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /^Contact/ })).toContainText("2");
  const nouvelles = page.getByRole("region", { name: "Nouvelles demandes (2)" });
  await expect(nouvelles.getByRole("heading", { level: 3 })).toHaveText(["Moussa Diarra", "Aya Touré"]);   // les plus récentes d'abord
  const aya = nouvelles.getByRole("listitem").filter({ hasText: "Aya Touré" });
  await expect(aya).toContainText("Signaler une arnaque");
  await expect(aya).toContainText("On m'a demandé de l'argent avant la visite.");
  await expect(aya.getByRole("link", { name: "Répondre par e-mail" })).toHaveAttribute("href", /^mailto:aya@exemple\.ci\?subject=Re%20%3A%20Signaler%20une%20arnaque/);
  await expect(aya.getByRole("link", { name: "WhatsApp +225 07 01 02 03 04" })).toHaveAttribute("href", "https://wa.me/2250701020304");
  await expect(aya.getByRole("link", { name: "réf. IMM-2026-01006" })).toHaveAttribute("href", "/annonces/imm-2026-01006");
  await expect(nouvelles.getByRole("listitem").filter({ hasText: "Moussa Diarra" }).getByRole("link", { name: "Répondre par e-mail" })).toHaveCount(0);

  await appuyer(aya.getByRole("button", { name: "Marquer comme traitée" }));
  await expect(page.getByRole("status").filter({ hasText: "Demande de Aya Touré marquée comme traitée." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Nouvelles demandes (1)" })).toBeVisible();
  const traitees = page.getByRole("region", { name: "Traitées récemment (1)" });
  await expect(traitees).toContainText("Traitée le");
  await expect(traitees).toContainText("par Fanta Bamba");
  await expect(page.getByRole("button", { name: /^Contact/ })).toContainText("1");
  await appuyer(traitees.getByRole("button", { name: "Remettre parmi les nouvelles" }));
  await expect(page.getByRole("region", { name: "Nouvelles demandes (2)" })).toBeVisible();

  // Tableau de bord : tuile « Demandes de contact » → onglet Contact
  await appuyer(page.getByRole("button", { name: "Tableau de bord" }));
  const tuile = page.getByRole("listitem").filter({ hasText: "Demandes de contact" });
  await expect(tuile).toContainText("2");
  await appuyer(tuile.getByRole("button", { name: "Traiter" }));
  await expect(page.getByRole("region", { name: "Nouvelles demandes (2)" })).toBeVisible();
});
