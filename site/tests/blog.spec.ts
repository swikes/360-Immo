// Blog « Guide & Blog » : mise en page du texte (lib/blog.ts), premières versions des articles, pages publiques
// (/blog, /blog/<adresse>, plan du site) et onglet « Blog » de l'Administration (écrire, aperçu, couverture, publier,
// retirer, supprimer). La fausse base (tests/base/serveur.mjs) publie 4 des premières versions :
//   à la une : « Acheter un terrain… » (Guide acheteur) · « Caution, avance… » et « Arnaques… » (Guide locataire)
//   « Le contrat de bail… » (Juridique) ; les 8 autres restent des brouillons, invisibles.
// L'Administration est imitée par tests/faux-supabase.ts ; les règles de la base : tests/base.spec.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { lienSur, lireLigne, lireTexte, sommaire, texteSeul, type Bloc, type Morceau } from "../lib/blog";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, BASE_TESTS, expect, test } from "./outils";

const TERRAIN = "/blog/acheter-un-terrain-les-verifications-avant-de-payer";

test.describe("Mise en page du texte", () => {
  test.beforeEach(() => test.skip(test.info().project.name !== "ordinateur", "une seule fois"));

  test("Titres, paragraphes, listes, encadrés, gras et liens ; rien d'autre n'est interprété", () => {
    const blocs = lireTexte([
      "Premier paragraphe,", "sur deux lignes.", "",
      "## Le bail, c'est quoi ?", "### Détails", "## Le bail, c'est quoi ?", "# Un seul dièse",
      "- un", "", "- deux **gras**", "Texte juste après.",
      "3. troisième", "4) quatrième", "",
      "> **À retenir** : [estimez](/estimation)", "> - point", "!> Attention", "",
      "<script>alert(1)</script> [piège](javascript:alert(1)) [ailleurs](//pirate.ci) [web](https://exemple.ci/page)",
    ].join("\r\n"));
    expect(blocs.map((b) => b.type)).toEqual(["paragraphe", "titre", "titre", "titre", "titre", "liste", "paragraphe", "liste", "encadre", "encadre", "paragraphe"]);
    expect(blocs[0]).toEqual({ type: "paragraphe", lignes: [[{ type: "texte", texte: "Premier paragraphe," }], [{ type: "texte", texte: "sur deux lignes." }]] });
    // identifiants des titres pour le sommaire : sans accents, uniques ; « # » compte comme un titre de partie
    expect(blocs.slice(1, 5)).toEqual([
      { type: "titre", niveau: 2, texte: "Le bail, c'est quoi ?", id: "le-bail-c-est-quoi" },
      { type: "titre", niveau: 3, texte: "Détails", id: "details" },
      { type: "titre", niveau: 2, texte: "Le bail, c'est quoi ?", id: "le-bail-c-est-quoi-2" },
      { type: "titre", niveau: 2, texte: "Un seul dièse", id: "un-seul-diese" },
    ]);
    expect(sommaire(blocs).map((t) => t.id)).toEqual(["le-bail-c-est-quoi", "le-bail-c-est-quoi-2", "un-seul-diese"]);
    // une ligne vide entre deux éléments ne coupe pas la liste ; la numérotation reprend au numéro écrit
    expect(blocs[5]).toEqual({ type: "liste", numerotee: false, debut: 1, elements: [
      [{ type: "texte", texte: "un" }], [{ type: "texte", texte: "deux " }, { type: "gras", contenu: [{ type: "texte", texte: "gras" }] }],
    ] });
    expect(blocs[7]).toMatchObject({ type: "liste", numerotee: true, debut: 3 });
    const retenir = blocs[8] as Extract<Bloc, { type: "encadre" }>;
    expect(retenir.genre).toBe("retenir");
    expect(retenir.blocs.map((b) => b.type)).toEqual(["paragraphe", "liste"]);
    expect((retenir.blocs[0] as Extract<Bloc, { type: "paragraphe" }>).lignes[0]).toEqual([
      { type: "gras", contenu: [{ type: "texte", texte: "À retenir" }] }, { type: "texte", texte: " : " },
      { type: "lien", url: "/estimation", contenu: [{ type: "texte", texte: "estimez" }] },
    ]);
    expect(blocs[9]).toMatchObject({ type: "encadre", genre: "attention" });
    // pas de HTML, pas de lien dangereux : affichés comme du texte
    const derniere = (blocs[10] as Extract<Bloc, { type: "paragraphe" }>).lignes[0];
    expect(derniere.filter((m) => m.type === "lien")).toEqual([{ type: "lien", url: "https://exemple.ci/page", contenu: [{ type: "texte", texte: "web" }] }]);
    expect(derniere.filter((m): m is Extract<Morceau, { type: "texte" }> => m.type === "texte").map((m) => m.texte).join(""))
      .toBe("<script>alert(1)</script> [piège](javascript:alert(1)) [ailleurs](//pirate.ci) ");
    for (const refuse of ["javascript:alert(1)", "//pirate.ci", "/\\pirate.ci", "data:text/html,x", "https://", "mailto:x"]) expect(lienSur(refuse)).toBeNull();
    for (const accepte of ["/", "/annonces?tx=location", "https://www.exemple.ci", "mailto:contact@360-immo.ci"]) expect(lienSur(accepte)).toBe(accepte);
    expect(lireLigne("**gras non fermé")).toEqual([{ type: "texte", texte: "**gras non fermé" }]);
    expect(texteSeul("**Attention** aux [faux](/x)")).toBe("Attention aux faux");
  });

  test("Premières versions des articles : 12, bien formées, liens valables, points à vérifier", () => {
    const sql = readFileSync(path.join(__dirname, "../supabase/migrations/20261017100000_blog_premiers_articles.sql"), "utf8");
    const textes = [...sql.matchAll(/\$texte\$([\s\S]*?)\$texte\$/g)].map((m) => m[1]);
    const adresses = [...sql.matchAll(/^\(\n {2}'([a-z0-9-]+)',/gm)].map((m) => m[1]);
    expect(textes).toHaveLength(12);
    expect(adresses).toHaveLength(12);
    expect(sql.match(/Première version, à relire avant publication\./g)).toHaveLength(12);
    const pages = ["/annonces", "/estimation", "/carte-des-prix", "/publier", ...adresses.map((a) => `/blog/${a}`)];
    const morceaux = (m: Morceau[]): Morceau[] => m.flatMap((x) => (x.type === "texte" ? [x] : [x, ...morceaux(x.contenu)]));
    const tout = (blocs: Bloc[]): Morceau[] => blocs.flatMap((b) =>
      b.type === "paragraphe" ? b.lignes.flatMap(morceaux) : b.type === "liste" ? b.elements.flatMap(morceaux) : b.type === "encadre" ? tout(b.blocs) : []);
    for (const texte of textes) {
      const blocs = lireTexte(texte);
      expect(sommaire(blocs).length, texte.slice(0, 60)).toBeGreaterThanOrEqual(4);
      const m = tout(blocs);
      // chaque lien est reconnu et mène à une page qui existe ; aucun reste de mise en forme
      for (const lien of m.filter((x) => x.type === "lien")) expect(pages, texte.slice(0, 60)).toContain(lien.url.split("?")[0]);
      for (const t of m.filter((x) => x.type === "texte")) expect(t.texte, texte.slice(0, 60)).not.toMatch(/\*\*|\]\(/);
    }
  });
});

test("Guide & Blog : article à la une, derniers articles, catégories, outils, glossaire ; brouillons invisibles", async ({ page }) => {
  await page.goto("/blog");
  await expect(page).toHaveTitle(/Guide & Blog : conseils pour louer, acheter et vendre/);
  await expect(page.locator("h1")).toHaveText("Louer, acheter, vendre : nos guides");
  const une = page.getByRole("region", { name: "À la une" });
  await expect(une.getByRole("heading", { level: 2 })).toHaveText("Acheter un terrain : les vérifications à faire avant de payer");
  await expect(une).toContainText("À la une · Guide acheteur");
  await expect(une).toContainText("min de lecture");
  const derniers = page.getByRole("region", { name: "Derniers articles" });
  await expect(derniers.getByRole("article")).toHaveCount(3);
  // les plus récents d'abord
  await expect(derniers.getByRole("heading", { level: 3 })).toHaveText([
    "Caution, avance, frais d'agence : ce que vous payez en entrant dans une location",
    "Le contrat de bail : ce qu'il doit contenir",
    "Arnaques immobilières : les signes qui doivent alerter",
  ]);
  await expect(page.getByText("Visiter un logement : la liste de contrôle")).toHaveCount(0);   // brouillon
  // catégories qui ont des articles, avec leur nombre
  const categories = page.getByRole("navigation", { name: "Catégories du blog" });
  await expect(categories.getByRole("link")).toHaveText(["Tous les articles", "Guide acheteur 1", "Guide locataire 2", "Juridique & Administratif 1"]);
  await appuyer(categories.getByRole("link", { name: /Guide locataire/ }));
  await expect(page).toHaveURL(/\/blog\?categorie=locataire$/);
  await expect(page.locator("h1")).toHaveText("Guide locataire");
  await expect(categories.getByRole("link", { name: /Guide locataire/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "À la une" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "2 articles" }).getByRole("article")).toHaveCount(2);
  // outils et glossaire
  const cote = page.getByRole("complementary", { name: "Outils et glossaire" });
  await expect(cote.getByRole("link", { name: /Estimer un bien/ })).toHaveAttribute("href", "/estimation");
  await expect(cote.getByRole("link", { name: /Carte des prix/ })).toHaveAttribute("href", "/carte-des-prix");
  const acd = cote.locator("details", { hasText: "ACD (arrêté de concession définitive)" });
  await expect(acd.getByText(/accorde la propriété d'un terrain en ville/)).toBeHidden();
  await appuyer(acd.locator("summary"));
  await expect(acd.getByText(/accorde la propriété d'un terrain en ville/)).toBeVisible();
  // ouvrir un article depuis sa carte
  await page.goto("/blog");
  await appuyer(page.getByRole("link", { name: "Le contrat de bail : ce qu'il doit contenir" }));
  await expect(page).toHaveURL(/\/blog\/contrat-de-bail-ce-qu-il-doit-contenir$/);
  await expect(page.locator("h1")).toHaveText("Le contrat de bail : ce qu'il doit contenir");
});

test("Article : chemin, auteur, sommaire, encadrés, liens, partage, à lire aussi, données pour Google ; brouillon introuvable", async ({ page }) => {
  await page.goto(TERRAIN);
  await expect(page).toHaveTitle("Acheter un terrain : les vérifications à faire avant de payer — 360-Immo.ci");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Un terrain se paie souvent comptant/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/blog\/acheter-un-terrain-les-verifications-avant-de-payer$/);
  const chemin = page.getByRole("navigation", { name: "Fil d'Ariane" });
  await expect(chemin.getByRole("link")).toHaveText(["Accueil", "Guide & Blog", "Guide acheteur"]);
  await expect(chemin.getByRole("link", { name: "Guide acheteur" })).toHaveAttribute("href", "/blog?categorie=acheteur");
  await expect(page.getByText("Par L'équipe 360-Immo.ci")).toBeVisible();
  await expect(page.getByText(/^Publié le \d+ \w+ \d{4}$/)).toBeVisible();
  await expect(page.getByText(/^\d+ min de lecture$/)).toBeVisible();
  await expect(page.getByText(/Mis à jour le/)).toHaveCount(0);
  // sommaire : les titres de partie, avec des liens vers eux
  const plan = page.getByRole("navigation", { name: "Dans cet article" });
  await expect(plan.getByRole("link")).toHaveCount(6);
  await expect(plan.getByRole("link").first()).toHaveText("1. Demandez les documents du terrain, et lisez-les");
  await appuyer(plan.getByRole("link", { name: "5. Signez chez un notaire" }));
  await expect(page).toHaveURL(/#5-signez-chez-un-notaire$/);
  await expect(page.getByRole("heading", { level: 2, name: "5. Signez chez un notaire" })).toBeInViewport();
  // encadrés, gras, listes
  await expect(page.getByRole("complementary", { name: "À retenir" })).toContainText("beaucoup plus sûr");
  await expect(page.getByRole("complementary", { name: "Attention" })).toContainText("arrêtez-vous là");
  await expect(page.locator("strong", { hasText: "titre foncier" }).first()).toBeVisible();
  await expect(page.locator("article ol").last().locator("li")).toHaveCount(5);
  // liens du texte : pages du site (recherche, carte des prix), un autre article publié
  await expect(page.getByRole("link", { name: "terrains à vendre" })).toHaveAttribute("href", "/annonces?tx=achat&type=terrain");
  await expect(page.getByRole("link", { name: "carte des prix", exact: true })).toHaveAttribute("href", "/carte-des-prix?tx=achat&type=terrain");
  await expect(page.getByText(/Cet article donne des informations générales/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Partager cet article" })).toBeVisible();
  // à lire aussi : les autres articles publiés, jamais un brouillon
  const aussi = page.getByRole("region", { name: "À lire aussi" });
  await expect(aussi.getByRole("article")).toHaveCount(3);
  await expect(aussi).not.toContainText("Visiter un logement");
  // données pour Google (schema.org)
  const donnees = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}");
  expect(donnees).toMatchObject({
    "@type": "Article", headline: "Acheter un terrain : les vérifications à faire avant de payer", inLanguage: "fr-CI",
    author: { "@type": "Organization", name: "360-Immo.ci" }, publisher: { name: "360-Immo.ci" }, articleSection: "Guide acheteur",
  });
  // un brouillon, une adresse inconnue : page introuvable
  for (const adresse of ["/blog/visiter-un-logement-la-liste-de-controle", "/blog/n-existe-pas"]) {
    const reponse = await page.goto(adresse);
    expect(reponse?.status()).toBe(404);
  }
});

test("Lien vers un autre article, menu « Guide & Blog », plan du site", async ({ page, request }) => {
  await page.goto("/blog/arnaques-immobilieres-les-signes-qui-doivent-alerter");
  await appuyer(page.locator("article").getByRole("link", { name: "Acheter un terrain : les vérifications à faire avant de payer" }).first());
  await expect(page).toHaveURL(new RegExp(`${TERRAIN}$`));
  const plan = await (await request.get("/sitemap.xml")).text();
  expect(plan).toContain(`${TERRAIN}</loc>`);
  expect(plan).toContain("/blog</loc>");
  expect(plan).not.toContain("visiter-un-logement");
  // la fausse base répond bien aux visiteurs (fonctions publiques du blog)
  const r = await request.post(`${BASE_TESTS}/rest/v1/rpc/blog_articles`, { data: { categorie: "juridique" } });
  expect((await r.json()).map((a: { slug: string }) => a.slug)).toEqual(["contrat-de-bail-ce-qu-il-doit-contenir"]);
});

// ══ Administration → Blog ══

async function ouvrirBlog(page: Page, f: FauxSupabase) {
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Fanta", nom: "Bamba" });
  f.profils.get(equipe)!.role = "admin";
  await page.goto("/connexion?suite=%2Fadmin");
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("equipe@360-immo.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Administration");
  await appuyer(page.getByRole("button", { name: "Blog", exact: true }));
  return equipe;
}

// Photo de test (PNG 1 × 1) : le site la réduit et la convertit avant l'envoi
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

test("Administration → Blog : écrire un article avec les boutons, aperçu, enregistrer, publier malgré les notes, retirer, supprimer, journal", async ({ page }) => {
  const f = await fauxSupabase(page);
  f.article({ titre: "Un brouillon déjà là", categorie: "juridique", notes: "Faire relire par un juriste" });
  f.article({ titre: "Un article publié", statut: "publie", publie_le: new Date(Date.now() - 86_400_000).toISOString(), slug: "un-article-publie" });
  await ouvrirBlog(page, f);
  await expect(page.getByRole("region", { name: "Brouillons (1)" })).toContainText("Un brouillon déjà là");
  await expect(page.getByRole("region", { name: "Brouillons (1)" })).toContainText("Notes de l'équipe");
  const publies = page.getByRole("region", { name: "Publiés (1)" });
  await expect(publies.getByRole("link", { name: "Voir l'article" })).toHaveAttribute("href", "/blog/un-article-publie");

  // Nouvel article
  await appuyer(page.getByRole("button", { name: "Nouvel article" }));
  await expect(page.getByRole("heading", { name: "Nouvel article" })).toBeVisible();
  await expect(page.getByLabel("Auteur", { exact: true })).toHaveValue("L'équipe 360-Immo.ci");
  await page.getByLabel("Titre").fill("Louer à Abidjan : le guide complet");
  await page.getByLabel("Catégorie").selectOption({ label: "Guide locataire" });
  await page.getByLabel(/Résumé/).fill("Tout ce qu'il faut savoir avant de louer.");
  await expect(page.getByText("41 / 300")).toBeVisible();
  // boutons de mise en forme : sur la ligne en cours, autour de la sélection, lien demandé
  const texte = page.getByLabel("Texte de l'article");
  await texte.fill("Avant de commencer");
  const barre = page.getByRole("toolbar", { name: "Mise en forme du texte" });
  await appuyer(barre.getByRole("button", { name: "Titre de partie" }));
  await expect(texte).toHaveValue("## Avant de commencer");
  await texte.press("End");
  await texte.pressSequentially("\n\nUn mot important.\n");
  await texte.evaluate((z: HTMLTextAreaElement) => z.setSelectionRange(26, 39));   // « mot important »
  await appuyer(barre.getByRole("button", { name: "Gras" }));
  await expect(texte).toHaveValue("## Avant de commencer\n\nUn **mot important**.\n");
  await texte.press("Control+End");
  page.once("dialog", (d) => d.accept("/estimation"));
  await appuyer(barre.getByRole("button", { name: "Lien" }));
  await expect(texte).toHaveValue("## Avant de commencer\n\nUn **mot important**.\n[texte du lien](/estimation)");
  await texte.press("Control+End");
  await texte.pressSequentially("\n\n");
  await appuyer(barre.getByRole("button", { name: "Attention" }));
  await expect(texte).toHaveValue(/\n\n!> Le piège à éviter\.$/);
  page.once("dialog", (d) => d.accept("javascript:alert(1)"));
  await appuyer(barre.getByRole("button", { name: "Lien" }));
  await expect(page.locator("main").getByRole("alert")).toContainText("Ce lien n'est pas accepté");
  await expect(page.getByText("Modifications non enregistrées")).toBeVisible();

  // Aperçu : tel que les visiteurs le verront
  await appuyer(page.getByRole("button", { name: "Aperçu" }));
  const apercu = page.getByRole("region", { name: "Aperçu de l'article" });
  await expect(apercu.getByRole("heading", { level: 1 })).toHaveText("Louer à Abidjan : le guide complet");
  await expect(apercu.getByRole("heading", { level: 2 })).toHaveText("Avant de commencer");
  await expect(apercu.locator("strong", { hasText: "mot important" })).toBeVisible();
  await expect(apercu.getByRole("link", { name: "texte du lien" })).toHaveAttribute("href", "/estimation");
  await expect(apercu.getByRole("complementary", { name: "Attention" })).toContainText("Le piège à éviter.");
  await appuyer(page.getByRole("button", { name: "Écrire" }));

  // Enregistrer : brouillon, adresse tirée du titre (modifiable tant qu'il n'est pas publié)
  await page.getByLabel(/Notes de l'équipe/).fill("Vérifier le plafond de la caution");
  await appuyer(page.getByRole("button", { name: "Enregistrer", exact: true }));
  await expect(page.getByRole("status").filter({ hasText: "Article enregistré." })).toBeVisible();
  await expect(page.getByText("Modifications non enregistrées")).toHaveCount(0);
  await expect(page.getByLabel("Adresse de la page")).toHaveValue("louer-a-abidjan-le-guide-complet");
  await page.getByLabel("Adresse de la page").fill("Louer à Abidjan");
  await appuyer(page.getByRole("button", { name: "Enregistrer", exact: true }));
  await expect(page.getByLabel("Adresse de la page")).toHaveValue("louer-a-abidjan");
  const article = f.articles.find((a) => a.titre === "Louer à Abidjan : le guide complet")!;
  expect(article).toMatchObject({ statut: "brouillon", categorie: "locataire", notes: "Vérifier le plafond de la caution", auteur_nom: "L'équipe 360-Immo.ci" });

  // Publier : les notes de l'équipe sont rappelées avant
  await appuyer(page.getByRole("button", { name: "Publier", exact: true }));
  const rappel = page.getByRole("group", { name: "Publier malgré les notes" });
  await expect(rappel).toContainText("Vérifier le plafond de la caution");
  await appuyer(rappel.getByRole("button", { name: "Annuler" }));
  expect(article.statut).toBe("brouillon");
  await appuyer(page.getByRole("button", { name: "Publier", exact: true }));
  await appuyer(page.getByRole("button", { name: "Publier quand même" }));
  await expect(page.getByRole("status").filter({ hasText: "Article publié : il est visible de tous sur le blog." })).toBeVisible();
  expect(article.statut).toBe("publie");
  await expect(page.getByRole("link", { name: "Voir l'article" })).toHaveAttribute("href", "/blog/louer-a-abidjan");
  // publié : l'adresse ne change plus
  await expect(page.getByLabel("Adresse de la page")).toHaveCount(0);
  await expect(page.getByText(/fixe depuis la première publication/)).toBeVisible();

  // Retirer du blog, puis supprimer
  await appuyer(page.getByRole("button", { name: "Retirer du blog" }));
  await expect(page.getByRole("status").filter({ hasText: "Article retiré du blog : il redevient un brouillon." })).toBeVisible();
  expect(article.statut).toBe("brouillon");
  await appuyer(page.getByRole("button", { name: "Supprimer…" }));
  await appuyer(page.getByRole("group", { name: "Supprimer l'article" }).getByRole("button", { name: "Supprimer l'article" }));
  await expect(page.getByRole("status").filter({ hasText: "Article « Louer à Abidjan : le guide complet » supprimé." })).toBeVisible();
  expect(f.articles.some((a) => a.titre === "Louer à Abidjan : le guide complet")).toBe(false);
  await expect(page.getByRole("region", { name: "Brouillons (1)" })).toBeVisible();

  // Journal de l'équipe
  await appuyer(page.getByRole("button", { name: "Journal" }));
  const journal = page.getByRole("list", { name: "Dernières décisions" });
  await expect(journal.getByRole("listitem").nth(0)).toContainText("Article supprimé");
  await expect(journal.getByRole("listitem").nth(1)).toContainText("Article retiré du blog");
  await expect(journal.getByRole("listitem").nth(2)).toContainText("Article publié");
  await expect(journal.getByRole("listitem").nth(2)).toContainText("Fanta Bamba");
});

test("Administration → Blog : photo de couverture réduite et envoyée (nouvel article enregistré d'abord), retirée ; fermer sans enregistrer", async ({ page }) => {
  const f = await fauxSupabase(page);
  const publie = f.article({ titre: "Un article publié", statut: "publie", publie_le: new Date().toISOString(), slug: "un-article-publie" });
  await ouvrirBlog(page, f);
  await appuyer(page.getByRole("button", { name: "Nouvel article" }));
  // sans titre : l'article ne peut pas s'enregistrer, la photo attend
  await page.getByLabel("Photo de couverture").setInputFiles({ name: "salon.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("main").getByRole("alert")).toContainText("Donnez un titre à l'article");
  expect([...f.fichiers.keys()].filter((c) => c.startsWith("blog/"))).toEqual([]);
  await page.getByLabel("Titre").fill("Choisir son quartier");
  await page.getByLabel("Photo de couverture").setInputFiles({ name: "salon.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("status").filter({ hasText: "Photo de couverture enregistrée." })).toBeVisible();
  const article = f.articles.find((a) => a.titre === "Choisir son quartier")!;
  expect(String(article.couverture)).toMatch(new RegExp(`^${article.id}/[a-z0-9]+-[a-z0-9]+\\.(webp|jpg)$`));
  expect(f.fichiers.get(`blog/${article.couverture}`)?.type).toMatch(/^image\/(webp|jpeg)$/);
  await expect(page.locator(`img[src$="/storage/v1/object/public/blog/${article.couverture}"]`)).toBeVisible();
  // changer de photo : l'ancienne est supprimée
  const premiere = String(article.couverture);
  await page.getByLabel("Photo de couverture").setInputFiles({ name: "jardin.png", mimeType: "image/png", buffer: PNG });
  await expect.poll(() => article.couverture).not.toBe(premiere);
  await expect.poll(() => f.fichiers.has(`blog/${premiere}`)).toBe(false);
  await appuyer(page.getByRole("button", { name: "Retirer la photo" }));
  await expect(page.getByRole("status").filter({ hasText: "Photo de couverture retirée." })).toBeVisible();
  expect(article.couverture).toBeNull();
  expect([...f.fichiers.keys()].filter((c) => c.startsWith("blog/"))).toEqual([]);
  // Fermer avec des modifications : confirmation
  await page.getByLabel(/Résumé/).fill("Les bonnes questions.");
  await appuyer(page.getByRole("button", { name: "Tous les articles" }));
  const fermer = page.getByRole("group", { name: "Fermer sans enregistrer" });
  await appuyer(fermer.getByRole("button", { name: "Continuer l'écriture" }));
  await expect(page.getByLabel(/Résumé/)).toHaveValue("Les bonnes questions.");
  await appuyer(page.getByRole("button", { name: "Tous les articles" }));
  await appuyer(page.getByRole("button", { name: "Fermer sans enregistrer" }));
  await expect(page.getByRole("region", { name: "Brouillons (1)" })).toContainText("Choisir son quartier");
  expect(article.resume).toBe("");
  // Un article publié : il garde un résumé et un texte
  await appuyer(page.getByRole("region", { name: "Publiés (1)" }).getByRole("button", { name: "Modifier" }));
  await expect(page.getByLabel("Titre")).toHaveValue(String(publie.titre));
  await page.getByLabel("Texte de l'article").fill("");
  await appuyer(page.getByRole("button", { name: "Enregistrer", exact: true }));
  await expect(page.locator("main").getByRole("alert")).toContainText("Un article publié garde un résumé et un texte.");
});
