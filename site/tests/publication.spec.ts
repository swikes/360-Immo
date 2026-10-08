// Publier une annonce (/publier) et Mon Espace → Mes annonces.
// Le site parle à une fausse base Supabase (faux-supabase.ts) : on vérifie ce qu'il enregistre et ce qu'il affiche.
import type { Page } from "@playwright/test";
import { empreintesProches, fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { expect, test } from "./outils";

const JOUR = 86_400_000;
const dansJours = (n: number) => new Date(Date.now() + n * JOUR).toISOString();

// Photo de test (PNG 1 × 1) : le site la réduit et la convertit avant l'envoi
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const photo = (nom: string) => ({ name: nom, mimeType: "image/png", buffer: PNG });

/** Compte déjà inscrit (Awa Koné) ; renvoie son identifiant */
const inscrire = (f: FauxSupabase) =>
  f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });

/** Se connecter depuis la page de connexion, puis arriver sur « suite » */
async function seConnecter(page: Page, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${suite.replace(/[?]/g, "\\?")}$`));
}

const choix = (page: Page, groupe: string, option: string) =>
  page.getByRole("radiogroup", { name: groupe, exact: true }).getByRole("radio", { name: option, exact: true });
const idLieu = (liste: Record<string, unknown>[], nom: string) => liste.find((l) => l.nom === nom)!.id;
const envoiAnnonce = (f: FauxSupabase) => f.demandes.filter((d) => d.chemin === "/rest/v1/annonces" && d.methode !== "GET");

// Annonce complète d'Awa, prête à être modifiée
const APPARTEMENT = (f: FauxSupabase) => ({
  type_bien: "appartement", transaction: "location", titre: "Appartement 3 pièces à louer — Riviera 2", prix: 100000,
  loyer_par: "mois", ville_id: idLieu(f.lieux.villes, "Abidjan"), commune_id: idLieu(f.lieux.communes, "Cocody"),
  quartier_id: idLieu(f.lieux.quartiers, "Riviera 2"), pieces: 3, chambres: 2, sanitaires: 1, surface: 80,
  dans_immeuble: true, etage: 1, description: "Bel appartement lumineux, cuisine équipée, proche du marché et des écoles.",
  contact_nom: "Awa Koné", contact_telephone: "+225 07 48 32 11 90",
});

test("Sans compte : on explique, puis la connexion ramène au formulaire", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await page.goto("/publier");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publier une annonce");
  await expect(page.getByText(/connectez-vous ou créez votre compte gratuitement/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer un compte gratuitement" })).toHaveAttribute("href", "/connexion?mode=inscription&suite=%2Fpublier");
  await page.getByRole("main").getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fpublier$/);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill("awa@exemple.ci");
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/publier$/);
  await expect(page.getByRole("heading", { name: "Type de bien" })).toBeVisible();
  // Contact repris du profil
  await expect(page.locator("#pub-nom")).toHaveValue("Awa Koné");
  await expect(page.getByRole("textbox", { name: "Numéro principal" })).toHaveValue("07 48 32 11 90");
});

test("Le formulaire ne propose que ce qui a du sens pour le type de bien", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/publier");
  await expect(page.getByText("Choisissez d'abord le type de bien : seuls les champs utiles s'affichent.")).toBeVisible();

  // Terrain : ni pièces, ni meublé, ni étage ; superficie
  await choix(page, "Catégorie", "Terrain").click();
  await expect(page.getByRole("radiogroup", { name: "Nombre de pièces" })).toHaveCount(0);
  await expect(page.getByText("Déjà meublé")).toHaveCount(0);
  await expect(page.getByLabel("Superficie (m²)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Titre foncier (ACD)" })).toBeVisible();
  // plusieurs lots identiques (lotissement) : une seule annonce ; 1 d'office
  await expect(page.getByLabel("Lots identiques disponibles", { exact: true })).toHaveText("1");
  // superficie obligatoire pour un terrain (elle figure sur ses papiers)
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.getByText("Indiquez la superficie en m².")).toBeVisible();

  // Chambre d'hôtel : location à la nuit uniquement
  await choix(page, "Transaction", "À vendre").click();
  await choix(page, "Catégorie", "Chambre d'hôtel").click();
  await expect(page.getByRole("radiogroup", { name: "Transaction" }).getByRole("radio")).toHaveText(["À louer"]);
  await expect(choix(page, "Transaction", "À louer")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Une chambre d'hôtel se loue uniquement, à la nuit.")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Loyer par" }).getByRole("radio")).toHaveText(["Nuit"]);

  // Immeuble : vendu ou loué entier, pas de « biens identiques »
  await choix(page, "Catégorie", "Immeuble").click();
  await expect(page.getByText(/identiques disponibles/)).toHaveCount(0);

  // Appartement : studio possible, étage, chambres limitées par le nombre de pièces, titre proposé
  await choix(page, "Catégorie", "Appartement").click();
  await expect(page.getByRole("radiogroup", { name: "Étage" })).toBeVisible();
  await expect(choix(page, "Nombre de pièces", "Studio")).toBeVisible();
  await choix(page, "Nombre de pièces", "3").click();
  await page.getByRole("button", { name: "Chambres : plus" }).click();
  await expect(page.getByLabel("Chambres", { exact: true })).toHaveText("2");
  await expect(page.getByRole("button", { name: "Chambres : plus" })).toBeDisabled();
  await page.locator("#pub-commune").selectOption("Cocody");
  await page.locator("#pub-quartier").fill("Riviera 2");
  await expect(page.locator("#pub-titre")).toHaveValue("Appartement 3 pièces à louer — Riviera 2");
  // surface facultative pour un logement (peu d'annonceurs la connaissent) ; vérifiée si elle est donnée
  await expect(page.getByLabel("Surface (m², facultatif)")).toBeVisible();
  await expect(page.getByText("Indiquez la superficie en m².")).toHaveCount(0); // l'erreur du terrain ne reste pas
  await expect(page.getByText("Laissez vide si vous ne la connaissez pas.")).toBeVisible();
  await expect(page.getByText("Indiquez la surface en m².")).toHaveCount(0);
  await page.locator("#pub-surface").fill("0");
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.getByText("La surface doit être supérieure à 0 m².")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Loyer par" }).getByRole("radio")).toHaveText(["Jour", "Mois", "Année"]);
  await expect(choix(page, "Loyer par", "Mois")).toHaveAttribute("aria-checked", "true");
});

test("Formulaire vide : les champs à compléter sont signalés et rien n'est envoyé", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/publier");
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Certains champs" })).toHaveText(/Certains champs sont à compléter ou à corriger/);
  for (const texte of ["Choisissez le type de bien.", "À louer ou à vendre ?", "Choisissez la commune.", "Indiquez le loyer.", "Décrivez le bien en quelques phrases"]) {
    await expect(page.getByText(texte)).toBeVisible();
  }
  // Le brouillon demande moins (pas de description) mais le type et le prix
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByText("Choisissez le type de bien.")).toBeVisible();
  await expect(page.getByText("Décrivez le bien en quelques phrases")).toHaveCount(0);
  expect(envoiAnnonce(f)).toEqual([]);
});

test("Publication complète avec 2 photos : envoyée pour vérification, visible dans Mes annonces", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/publier");
  await choix(page, "Catégorie", "Appartement").click();
  await choix(page, "Transaction", "À louer").click();
  await page.getByText("Déjà meublé").click();
  await choix(page, "Étage", "2e").click();
  await page.locator("#pub-commune").selectOption("Cocody");
  await page.locator("#pub-quartier").fill("Riviera 2");
  await choix(page, "Nombre de pièces", "3").click();
  await page.getByRole("button", { name: "Chambres : plus" }).click();
  await page.locator("#pub-surface").fill("85");
  // 3 appartements identiques dans la résidence : une seule annonce
  const plusUn = page.getByRole("button", { name: "Appartements identiques disponibles : plus" });
  await plusUn.click();
  await plusUn.click();
  await expect(page.getByLabel("Appartements identiques disponibles", { exact: true })).toHaveText("3");
  await page.locator("#pub-prix").fill("150000");
  await expect(page.locator("#pub-prix")).toHaveValue(/^150\s000$/);
  await page.getByRole("button", { name: "Piscine" }).click();
  await page.locator("#pub-description").fill("Appartement lumineux au 2e étage, cuisine équipée, gardien et piscine dans la résidence.");
  await page.getByLabel("Choisir des photos").setInputFiles([photo("salon.png"), photo("cuisine.png")]);
  const vignettes = page.getByRole("list", { name: "Photos de l'annonce" }).getByRole("listitem");
  await expect(vignettes).toHaveCount(2);
  await expect(vignettes.first()).toContainText("Principale");
  await expect(page.getByText("2 / 20 photos")).toBeVisible();
  // Aperçu à droite
  await expect(page.getByText("150 000 FCFA / mois").first()).toBeVisible();
  await expect(page.locator("form aside")).toContainText("3 disponibles");

  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Annonce envoyée !");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport(); // pas resté en bas de page
  await expect(page.getByText("Réf. IMM-2026-00001")).toBeVisible();

  expect(f.annonces).toHaveLength(1);
  const a = f.annonces[0];
  expect(a).toMatchObject({
    statut: "en_attente", type_bien: "appartement", transaction: "location", prix: 150000, loyer_par: "mois", caution_mois: 2,
    ville_id: idLieu(f.lieux.villes, "Abidjan"), commune_id: idLieu(f.lieux.communes, "Cocody"),
    quartier_id: idLieu(f.lieux.quartiers, "Riviera 2"), quartier_texte: null,
    pieces: 3, chambres: 2, surface: 85, disponibles: 3, meuble: true, dans_immeuble: true, etage: 2, commodites: ["Piscine"],
    titre: "Appartement 3 pièces meublé à louer — Riviera 2", type_vendeur: "particulier", contact_nom: "Awa Koné",
    contact_telephone: "+225 07 48 32 11 90", contact_whatsapp: true, contact_telephone2: null, contact_email: "awa@exemple.ci",
  });
  // Photos réduites (WebP), rangées sous le dossier de l'annonce, dans l'ordre choisi
  const photos = f.photos.filter((p) => p.annonce_id === a.id).sort((x, y) => Number(x.ordre) - Number(y.ordre));
  expect(photos.map((p) => p.ordre)).toEqual([0, 1]);
  for (const p of photos) expect(p.chemin).toMatch(new RegExp(`^${a.id}/[0-9a-f-]+\\.webp$`));
  expect([...f.fichiers.keys()].sort()).toEqual(photos.map((p) => p.chemin).sort());
  expect([...f.fichiers.values()].map((x) => x.type)).toEqual(["image/webp", "image/webp"]);

  await page.getByRole("link", { name: "Voir mes annonces" }).click();
  await expect(page).toHaveURL(/\/mon-espace\?section=annonces$/);
  const carte = page.getByRole("listitem").filter({ hasText: "Appartement 3 pièces meublé à louer" });
  await expect(carte).toContainText("En vérification");
  await expect(carte).toContainText("150 000 FCFA / mois");
  await expect(carte).toContainText("Riviera 2, Cocody · réf. IMM-2026-00001");
  await expect(carte.getByRole("link", { name: "Modifier" })).toHaveAttribute("href", `/publier?annonce=${a.id}`);
});

test("Un bien = une seule annonce : avertie d'une annonce semblable (caractéristiques, photos), puis « C'est un autre bien »", async ({ page }) => {
  const f = await fauxSupabase(page);
  const awa = inscrire(f);
  // Son annonce déjà en ligne : même appartement (Riviera 2, 3 pièces, 85 m², 2e étage, 150 000 FCFA / mois)
  const existante = f.annonce(awa, { ...APPARTEMENT(f), prix: 150000, surface: 85, etage: 2, statut: "publiee",
    publiee_le: dansJours(-10), expire_le: dansJours(80) });
  await seConnecter(page, "/publier");
  await choix(page, "Catégorie", "Appartement").click();
  await choix(page, "Transaction", "À louer").click();
  await choix(page, "Étage", "2e").click();
  await page.locator("#pub-commune").selectOption("Cocody");
  await page.locator("#pub-quartier").fill("Riviera 2");
  await choix(page, "Nombre de pièces", "3").click();
  await page.locator("#pub-surface").fill("88");
  await page.locator("#pub-prix").fill("155000");
  await page.locator("#pub-description").fill("Appartement lumineux au 2e étage, cuisine équipée, gardien dans la résidence.");
  // La même photo, en grand (appareil photo) et en petit (envoyée par WhatsApp) : bandes et disque, comme une vraie photo
  const [grande, petite] = await page.evaluate(() => {
    const dessiner = (l: number, h: number, type: string) => {
      const t = document.createElement("canvas");
      t.width = l;
      t.height = h;
      const x = t.getContext("2d")!;
      [200, 60, 180, 90, 220, 40, 160, 120, 30].forEach((v, i) => {
        x.fillStyle = `rgb(${v}, ${Math.round(v * 0.8)}, ${Math.round(v * 0.6)})`;
        x.fillRect((i * l) / 9, 0, l / 9 + 1, h);
      });
      x.fillStyle = "#1B7A4A";
      x.beginPath();
      x.arc(l * 0.62, h * 0.4, h * 0.18, 0, 7);
      x.fill();
      return t.toDataURL(type, 0.85).split(",")[1];
    };
    return [dessiner(2000, 1500, "image/jpeg"), dessiner(480, 360, "image/png")];
  });
  await page.getByLabel("Choisir des photos").setInputFiles([
    { name: "IMG_3001.jpg", mimeType: "image/jpeg", buffer: Buffer.from(grande, "base64") },
    { name: "whatsapp.png", mimeType: "image/png", buffer: Buffer.from(petite, "base64") },
  ]);
  await expect(page.getByRole("list", { name: "Photos de l'annonce" }).getByRole("listitem")).toHaveCount(2);

  // Envoyer : la fenêtre prévient avant d'enregistrer quoi que ce soit
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  const fenetre = page.getByRole("dialog", { name: "Vous avez déjà une annonce qui ressemble à celle-ci" });
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toContainText("Un bien = une seule annonce");
  const semblable = fenetre.getByRole("listitem").filter({ hasText: "Appartement 3 pièces à louer — Riviera 2" });
  await expect(semblable).toContainText("150 000 FCFA / mois · réf. IMM-2026-00001 · En ligne");
  await expect(semblable).toContainText("Mêmes type, lieu, prix et nombre de pièces");
  await expect(semblable.getByRole("link", { name: "Modifier cette annonce" })).toHaveAttribute("href", `/publier?annonce=${existante.id}`);
  await expect(fenetre).toContainText("Plusieurs logements identiques");
  expect(f.annonces).toHaveLength(1);
  // Ce que le site a demandé : les caractéristiques et l'empreinte de chaque photo ; la même photo en grand et en petit
  // donne des empreintes presque identiques
  const demande = f.demandes.filter((d) => d.chemin === "/rest/v1/rpc/annonces_semblables").at(-1)!.corps!;
  expect(demande).toMatchObject({
    bien: { type_bien: "appartement", transaction: "location", commune_id: idLieu(f.lieux.communes, "Cocody"),
      quartier_id: idLieu(f.lieux.quartiers, "Riviera 2"), prix: 155000, loyer_par: "mois", pieces: 3, surface: 88, etage: 2 },
    sauf: null,
  });
  const empreintes = demande.empreintes as string[];
  expect(empreintes).toHaveLength(2);
  for (const e of empreintes) expect(e).toMatch(/^[0-9a-f]{16}$/);
  expect(empreintesProches(empreintes[0], empreintes[1])).toBe(true);

  // « Annuler l'envoi » : retour au formulaire, rien n'est envoyé
  await fenetre.getByRole("button", { name: "Annuler l'envoi" }).click();
  await expect(fenetre).toHaveCount(0);
  expect(f.annonces).toHaveLength(1);

  // Sa photo est aussi dans l'annonce en ligne : les photos identiques sont signalées
  f.photos.push({ id: crypto.randomUUID(), annonce_id: existante.id, chemin: `${existante.id}/salon.webp`, ordre: 0, empreinte: empreintes[0] });
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(fenetre.getByRole("listitem")).toContainText("2 photos identiques, mêmes caractéristiques");

  // « C'est un autre bien » : envoyée quand même (l'équipe verra « Doublon possible »), photos avec leur empreinte
  await fenetre.getByRole("button", { name: "C'est un autre bien : envoyer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Annonce envoyée !");
  expect(f.annonces).toHaveLength(2);
  const nouvelle = f.annonces[1];
  expect(nouvelle).toMatchObject({ statut: "en_attente", prix: 155000, surface: 88 });
  expect(f.photos.filter((p) => p.annonce_id === nouvelle.id).sort((x, y) => Number(x.ordre) - Number(y.ordre)).map((p) => p.empreinte)).toEqual(empreintes);
});

test("Photo de téléphone prise en hauteur : montrée en entière, sans agrandir l'aperçu", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/publier");
  await choix(page, "Catégorie", "Villa").click();
  // Photo 3 × 4, comme un téléphone tenu en hauteur
  const jpeg = await page.evaluate(() => {
    const t = document.createElement("canvas");
    t.width = 1512;
    t.height = 2016;
    const x = t.getContext("2d")!;
    x.fillStyle = "#1B7A4A";
    x.fillRect(0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  await page.getByLabel("Choisir des photos").setInputFiles({ name: "IMG_2041.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") });
  await expect(page.getByRole("list", { name: "Photos de l'annonce" }).getByRole("listitem")).toHaveCount(1);
  // Vignette et aperçu : cadre 4 × 3 qui ne s'allonge pas, photo réduite (1600 px) restée en hauteur, montrée en entier
  const images = page.locator("img[alt='Photo 1'], form aside img:not([aria-hidden])");
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await expect(image).toHaveJSProperty("naturalWidth", 1200);
    await expect(image).toHaveJSProperty("naturalHeight", 1600);
    await expect(image).toHaveCSS("object-fit", "contain");
    const cadre = (await image.boundingBox())!;
    expect(cadre.width / cadre.height).toBeCloseTo(4 / 3, 1);
  }
});

test("Brouillon hors d'Abidjan (quartier libre), repris plus tard depuis Mes annonces puis envoyé", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/publier");
  await choix(page, "Catégorie", "Maison").click();
  await choix(page, "Transaction", "À vendre").click();
  await page.locator("#pub-ville").selectOption("Bouaké");
  await expect(page.locator("#pub-commune")).toHaveValue("Bouaké"); // une seule commune : choisie d'office
  await page.locator("#pub-quartier").fill("Air France 2");
  await page.locator("#pub-prix").fill("45000000");
  await expect(page.getByRole("radiogroup", { name: "Loyer par" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Brouillon enregistré" })).toContainText("réf. IMM-2026-00001");
  const a = f.annonces[0];
  await expect(page).toHaveURL(new RegExp(`/publier\\?annonce=${a.id}$`));
  expect(a).toMatchObject({
    statut: "brouillon", transaction: "vente", type_bien: "maison", prix: 45000000, loyer_par: null, caution_mois: null,
    ville_id: idLieu(f.lieux.villes, "Bouaké"), quartier_id: null, quartier_texte: "Air France 2",
    titre: "Maison à vendre — Air France 2",
  });

  // Plus tard : Mon Espace → Mes annonces → Continuer
  await page.goto("/mon-espace?section=annonces");
  const carte = page.getByRole("listitem").filter({ hasText: "Maison à vendre — Air France 2" });
  await expect(carte).toContainText("Brouillon");
  await expect(carte).toContainText("Air France 2, Bouaké");
  await carte.getByRole("link", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modifier l'annonce");
  await expect(page.locator("#pub-ville")).toHaveValue("Bouaké");
  await expect(page.locator("#pub-quartier")).toHaveValue("Air France 2");
  await expect(page.locator("#pub-prix")).toHaveValue(/^45\s000\s000$/);
  await choix(page, "Nombre de pièces", "4").click();
  await page.locator("#pub-description").fill("Maison familiale avec cour, 3 chambres, proche du lycée et du marché.");
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Annonce envoyée !");
  expect(f.annonces).toHaveLength(1); // la même annonce, mise à jour
  expect(f.annonces[0]).toMatchObject({ statut: "en_attente", pieces: 4, surface: null }); // surface inconnue : laissée vide
});

test("Annonce en ligne retouchée : un gros changement de prix la renvoie en vérification", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = inscrire(f);
  const a = f.annonce(moi, { ...APPARTEMENT(f), statut: "publiee", publiee_le: dansJours(-10), expire_le: dansJours(80) });
  await seConnecter(page, `/publier?annonce=${a.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Modifier l'annonce");
  await expect(page.getByRole("button", { name: "Enregistrer le brouillon" })).toHaveCount(0);
  const enregistrer = page.getByRole("button", { name: "Enregistrer les modifications" });

  // Petit changement (+10 %) : reste en ligne
  await page.locator("#pub-prix").fill("110000");
  await enregistrer.click();
  await expect(page.getByRole("status").filter({ hasText: "Modifications enregistrées" })).toHaveText("Modifications enregistrées.");
  expect(a).toMatchObject({ statut: "publiee", prix: 110000 });
  expect(envoiAnnonce(f).at(-1)!.corps).not.toHaveProperty("statut"); // le site ne change pas lui-même le statut

  // Gros changement (+50 %) : nouvelle vérification, expliquée
  await page.locator("#pub-prix").fill("165000");
  await enregistrer.click();
  await expect(page.getByRole("status").filter({ hasText: "Modifications enregistrées" })).toContainText("l'équipe 360-Immo.ci la vérifie");
  expect(a).toMatchObject({ statut: "en_attente", prix: 165000 });
});

test("L'annonce d'un autre compte ne s'ouvre pas en modification", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  const autre = f.inscrit("kouassi@exemple.ci", "Yamoussoukro2026!", { prenom: "Jean", nom: "Kouassi" });
  const a = f.annonce(autre, { ...APPARTEMENT(f), statut: "publiee", expire_le: dansJours(30) });
  await seConnecter(page, `/publier?annonce=${a.id}`);
  await expect(page.getByRole("alert").filter({ hasText: "pas à vous" })).toHaveText(/Cette annonce n'est pas à vous\./);
  await expect(page.locator("form")).toHaveCount(0);
});

test("Mes annonces : renouveler, vendu, remettre en ligne, motif de refus, supprimer", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = inscrire(f);
  const base = APPARTEMENT(f);
  const bientot = f.annonce(moi, { ...base, titre: "Villa 5 pièces à louer — Angré", statut: "publiee", expire_le: dansJours(5), modifie_le: dansJours(-1) });
  const vente = f.annonce(moi, { ...base, titre: "Terrain de 500 m² à vendre — Songon", transaction: "vente", loyer_par: null, statut: "publiee", expire_le: dansJours(60), modifie_le: dansJours(-2) });
  f.annonce(moi, { ...base, titre: "Studio meublé à louer — Marcory", statut: "refusee", motif_refus: "Les photos sont floues.", modifie_le: dansJours(-3) });
  const brouillon = f.annonce(moi, { ...base, titre: "Bureau à louer — Plateau", statut: "brouillon", modifie_le: dansJours(-4) });
  f.annonce(moi, { ...base, titre: "Maison 4 pièces à louer — Yopougon", statut: "publiee", expire_le: dansJours(-2), modifie_le: dansJours(-5) });
  page.on("dialog", (d) => d.accept());
  await seConnecter(page, "/mon-espace?section=annonces");
  await expect(page.getByText("5 annonces")).toBeVisible();
  const carte = (titre: string) => page.getByRole("listitem").filter({ hasText: titre });
  const message = page.getByRole("status").filter({ hasText: /Annonce/ });

  // Dans ses 15 derniers jours : renouvelable ; loin de l'échéance : non
  await expect(carte("Villa").getByRole("button", { name: "Supprimer" })).toHaveCount(0);
  await expect(carte("Terrain de 500 m²").getByRole("button", { name: "Renouveler" })).toHaveCount(0);
  await carte("Villa").getByRole("button", { name: "Renouveler" }).click();
  await expect(message).toHaveText(/Annonce renouvelée pour 90 jours\./);
  expect(new Date(bientot.expire_le as string).getTime()).toBeGreaterThan(Date.now() + 89 * JOUR);
  await expect(carte("Villa").getByRole("button", { name: "Renouveler" })).toHaveCount(0);

  // En ligne : lien vers sa fiche ; expirée : plus de lien
  await expect(carte("Villa").getByRole("link", { name: "Voir l'annonce" }))
    .toHaveAttribute("href", /^\/annonces\/villa-5-pieces-a-louer-angre-imm-2026-00001$/);
  await expect(carte("Yopougon").getByRole("link", { name: "Voir l'annonce" })).toHaveCount(0);

  // Expirée : signalée, renouvelable
  await expect(carte("Yopougon")).toContainText("Expirée");
  await expect(carte("Yopougon")).toContainText("plus visible. Renouvelez-la pour 90 jours.");
  await expect(carte("Yopougon").getByRole("button", { name: "Renouveler" })).toBeVisible();

  // Vendu : retirée du site, puis remise en ligne (nouvelle vérification)
  await carte("Terrain de 500 m²").getByRole("button", { name: "Vendu" }).click();
  await expect(message).toHaveText(/Annonce retirée du site\./);
  expect(vente.statut).toBe("archivee");
  await expect(carte("Terrain de 500 m²")).toContainText("Retirée");
  await carte("Terrain de 500 m²").getByRole("button", { name: "Remettre en ligne" }).click();
  await expect(message).toHaveText(/Annonce renvoyée pour vérification\./);
  expect(vente.statut).toBe("en_attente");

  // Refusée : motif et correction
  await expect(carte("Studio")).toContainText("Motif du refus : Les photos sont floues.");
  await expect(carte("Studio").getByRole("link", { name: "Corriger" })).toBeVisible();

  // Brouillon supprimé
  await carte("Bureau à louer").getByRole("button", { name: "Supprimer" }).click();
  await expect(message).toHaveText(/Annonce supprimée\./);
  await expect(carte("Bureau à louer")).toHaveCount(0);
  await expect(page.getByText("4 annonces")).toBeVisible();
  expect(f.annonces.some((x) => x.id === brouillon.id)).toBe(false);
});

test("Mes annonces vide : invitation à publier", async ({ page }) => {
  const f = await fauxSupabase(page);
  inscrire(f);
  await seConnecter(page, "/mon-espace?section=annonces");
  await expect(page.getByText("Vous n'avez pas encore d'annonce.")).toBeVisible();
  await page.getByRole("link", { name: "Publier ma première annonce" }).click();
  await expect(page).toHaveURL(/\/publier$/);
  await expect(page.getByRole("heading", { name: "Type de bien" })).toBeVisible();
});
