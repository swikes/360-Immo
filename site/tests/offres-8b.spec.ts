// Étape 8b : abonnement agence (formules, remontées incluses à la main ou programmées, 500 FCFA au-delà, mois suivant),
// statistiques détaillées et suivi des contacts (agences abonnées), « Bien visité » (demande payée au bon prix,
// Administration → Biens visités : rendez-vous, photos de l'agent, badge), page « Nos offres », badge sur la carte et la fiche.
// Comptes, annonces et paiements : imités par tests/faux-supabase.ts ; les règles de la base : tests/base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const abidjan = (f: FauxSupabase) => Number(f.lieux.villes.find((v) => v.nom === "Abidjan")!.id);

/** Kader, compte rattaché à l'agence « Lagune Immobilier », avec deux annonces en ligne */
function agence(f: FauxSupabase) {
  const kader = f.inscrit("kader@exemple.ci", "Abidjan2026!", { prenom: "Kader", nom: "Ouattara", telephone: "+225 07 12 34 56 78" });
  const ag = crypto.randomUUID();
  f.agences.push({ id: ag, nom: "Lagune Immobilier", slug: "lagune-immobilier", telephone: null, email: null, verifiee: true, cree_le: date(-60) });
  Object.assign(f.profils.get(kader)!, { role: "agence", agence_id: ag });
  const riviera = f.annonce(kader, { statut: "publiee", titre: "Appartement 4 pièces à Riviera", publiee_le: date(-10), expire_le: date(80), type_vendeur: "agence" });
  const plateau = f.annonce(kader, { statut: "publiee", titre: "Bureau 80 m² au Plateau", type_bien: "bureau", publiee_le: date(-6), expire_le: date(84), type_vendeur: "agence" });
  return { kader, ag, riviera, plateau };
}

const carteDe = (page: Page, titre: string) => page.getByRole("listitem").filter({ has: page.getByText(titre, { exact: true }) });
const fenetre = (page: Page) => page.getByRole("dialog", { name: "Faire voir mon annonce" });
const menu = (page: Page) => page.getByRole("navigation", { name: "Mon espace" });

async function ouvrir(page: Page, titre: string) {
  await appuyer(carteDe(page, titre).getByRole("button", { name: "Faire voir mon annonce" }));
  await expect(fenetre(page)).toBeVisible();
}

async function payerSurLaPage(page: Page, montant: RegExp) {
  await expect(page).toHaveURL(/\/paiement\/simulation\?paiement=/);
  await page.getByRole("radio", { name: "Wave" }).check();
  await appuyer(page.getByRole("button", { name: montant }));
  await expect(page).toHaveURL(/\/mon-espace\?section=paiements&paiement=/);
}

const recu = (page: Page) => page.getByRole("status").filter({ hasText: "Paiement reçu" });

test("Abonnement agence : formule conseillée, paiement (simulé), remontées incluses à la main et programmées, 500 FCFA au-delà, mois suivant", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { riviera, plateau } = agence(f);
  await seConnecter(page, "kader@exemple.ci", "/mon-espace?section=abonnement");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Abonnement agence");
  await expect(menu(page).getByRole("button", { name: "Suivi des contacts" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Pas d'abonnement en cours");

  // Formule conseillée selon les annonces en ligne (2) ; s'abonner
  const formules = page.getByRole("group", { name: "Formule" });
  await expect(formules.getByRole("radio", { name: /Jusqu'à 20 annonces/ })).toBeChecked();
  await expect(formules).toContainText("Conseillée pour vos 2 annonces");
  await expect(formules.getByRole("radio", { name: /Jusqu'à 200 annonces/ })).toBeEnabled();
  await appuyer(page.getByRole("button", { name: /^M'abonner : 15\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 15\s000 FCFA/);
  await expect(recu(page)).toContainText(/Abonnement agence \(20 annonces\)\)\. Abonnement actif jusqu'au \d\d\/\d\d\/\d{4} : 20 remontées incluses ce mois-ci\./);
  expect(f.abonnements).toHaveLength(1);

  // Mes annonces : remontée incluse, puis programmation tous les 7 jours ; plus de remontée à l'unité
  await page.goto("/mon-espace?section=annonces");
  await ouvrir(page, "Appartement 4 pièces à Riviera");
  const abonnement = fenetre(page).getByRole("group", { name: "Abonnement agence" });
  await expect(abonnement).toContainText("20 remontées incluses");
  await expect(fenetre(page).getByRole("radio", { name: /Remonter mon annonce/ })).toHaveCount(0);
  await expect(fenetre(page).getByRole("radio", { name: /Pack de 3/ })).toHaveCount(0);
  await appuyer(abonnement.getByRole("button", { name: "Remonter maintenant" }));
  await expect(page.getByRole("status").filter({ hasText: "Annonce remontée" }))
    .toHaveText("Annonce remontée en tête de la liste. Il vous reste 19 remontées incluses ce mois-ci.");
  expect(riviera.remontee_le).toBeTruthy();
  await ouvrir(page, "Bureau 80 m² au Plateau");
  await fenetre(page).getByRole("group", { name: "Abonnement agence" }).getByRole("combobox").selectOption("7");
  await appuyer(fenetre(page).getByRole("button", { name: "Programmer" }));
  await expect(page.getByRole("status").filter({ hasText: "programmées" })).toContainText("tous les 7 jours");
  await expect(carteDe(page, "Bureau 80 m² au Plateau")).toContainText(/Remontées automatiques tous les 7 jours : prochaine le/);
  expect(f.programmees).toEqual([expect.objectContaining({ annonce: plateau.id, tous_les: 7 })]);

  // Remontées du mois toutes utilisées : la remontée supplémentaire à 500 FCFA
  f.abonnements[0].utilisees = 20;
  await page.reload();
  await ouvrir(page, "Bureau 80 m² au Plateau");
  await expect(fenetre(page).getByRole("group", { name: "Abonnement agence" }).getByRole("button", { name: "Remonter maintenant" })).toBeDisabled();
  await expect(fenetre(page).getByRole("radio", { name: /Remontée supplémentaire/ })).toBeChecked();
  await appuyer(fenetre(page).getByRole("button", { name: /^Payer 500 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 500 FCFA/);
  await expect(recu(page)).toContainText("Annonce remontée en tête de la liste.");
  expect(plateau.remontee_le).toBeTruthy();

  // Mon Espace → Abonnement : remontées utilisées ; payer le mois suivant (une seule fois)
  await appuyer(menu(page).getByRole("button", { name: "Abonnement agence" }));
  await expect(page.getByRole("main")).toContainText("20 utilisées sur 20");
  await expect(page.getByRole("main")).toContainText("Toutes utilisées : la remontée supplémentaire coûte 500 FCFA");
  await appuyer(page.getByRole("button", { name: /^Payer le mois suivant : 15\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 15\s000 FCFA/);
  await expect(recu(page)).toContainText(/Mois suivant payé : du \d\d\/\d\d\/\d{4} au \d\d\/\d\d\/\d{4}, 20 remontées incluses\./);
  await page.goto("/mon-espace?section=abonnement");
  await expect(page.getByRole("main")).toContainText(/Mois suivant payé : Abonnement agence \(20 annonces\), du/);
  await expect(page.getByRole("group", { name: "Formule" })).toHaveCount(0);
});

test("Suivi des contacts et statistiques détaillées : pour les agences abonnées (sinon, ce que l'abonnement apporte), filtre, export Excel", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { ag, riviera } = agence(f);
  f.statistiques = (jours: number) => ({
    jours, du: date(-jours + 1).slice(0, 10), au: date(0).slice(0, 10), par_jour: [],
    totaux: { vues: 40, numeros: 3, appels: 2, whatsapp: 1, emails: 0, partages: 0, messages: 1, visites: 1, rappels: 1, favoris: 2, alertes: 0 },
    avant: { vues: 20, numeros: 1, appels: 0, whatsapp: 0, emails: 0, partages: 0, messages: 0, visites: 0, rappels: 0, favoris: 1, alertes: 0 },
    annonces: [{ id: riviera.id, reference: riviera.reference, titre: riviera.titre, statut: "publiee", en_ligne: true, type_bien: "appartement",
      type_nom: "Appartement", transaction: "location", loyer_par: "mois", prix: 100000, surface: null, pieces: 4, commune: "Cocody",
      publiee_le: date(-10), expire_le: date(80), photos: 6, description: 300, vues_total: 120, favoris_total: 2, prix_compare: null,
      comparables: 0, mediane: null, vues: 40, numeros: 3, appels: 2, whatsapp: 1, emails: 0, partages: 0, messages: 1, visites: 1,
      rappels: 1, favoris: 2, alertes: 0 }],
  });
  await seConnecter(page, "kader@exemple.ci", "/mon-espace?section=contacts");

  // Pas encore abonnée : ce que l'abonnement apporterait, avec le chemin vers lui
  await expect(page.getByRole("heading", { level: 2, name: /Le suivi des contacts vient avec l'abonnement agence/ })).toBeVisible();
  await appuyer(page.getByRole("button", { name: "Voir l'abonnement agence" }));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Abonnement agence");
  await appuyer(menu(page).getByRole("button", { name: "Statistiques" }));
  await expect(page.getByRole("region", { name: "D'où viennent vos visiteurs ?" })).toContainText("Avec l'abonnement agence");

  // Abonnée : les contacts reçus, filtrés ; l'export
  f.abonnements.push({ agence_id: ag, offre: "agence_20", debut: date(-3), fin: date(27), annonces_max: 20, incluses: 20, utilisees: 0 });
  const annonce = { id: riviera.id, reference: riviera.reference, titre: riviera.titre };
  f.suiviContacts = {
    jours: 30,
    contacts: [
      { genre: "rappel", id: "r1", le: date(-0.1), annonce, nom: "Paul Kra", telephone: "+225 07 00 11 22 33", statut: "a_rappeler", moment: "matin" },
      { genre: "visite", id: "v1", le: date(-1), annonce, nom: "Awa Koné", telephone: "+225 05 44 55 66 77", statut: "confirmee", creneau: date(2) },
      { genre: "message", id: "c1", le: date(-2), annonce, nom: "Koffi Y.", telephone: null, statut: "repondu", dernier: date(-1.5) },
    ],
    gestes: [{ annonce, numeros: 3, appels: 2, whatsapp: 1, emails: 0 }],
  };
  f.sourcesVues = { jours: 30, du: date(-29).slice(0, 10), au: date(0).slice(0, 10), sources: [{ source: "google", vues: 12 }, { source: "liste", vues: 8 }],
    annonces: { [String(riviera.id)]: { google: 12, liste: 8 } } };
  await appuyer(menu(page).getByRole("button", { name: "Suivi des contacts" }));
  const liste = page.getByRole("region", { name: /3 contacts en 30 jours/ });
  await expect(liste).toContainText("1 attend une réponse");
  await expect(liste.getByRole("listitem")).toHaveCount(3);
  await expect(liste.getByRole("listitem").first()).toContainText("Paul Kra");
  await expect(liste.getByRole("link", { name: "+225 07 00 11 22 33" })).toHaveAttribute("href", "tel:+2250700112233");
  await liste.getByRole("combobox", { name: "Type" }).selectOption("visite");
  await expect(liste.getByRole("listitem")).toHaveCount(1);
  await expect(liste.getByRole("listitem")).toContainText("Confirmée");
  const [fichier] = await Promise.all([page.waitForEvent("download"), appuyer(page.getByRole("button", { name: "Exporter (Excel)" }))]);
  expect(fichier.suggestedFilename()).toBe("contacts-360-immo-30-jours.csv");
  await expect(page.getByRole("region", { name: "Appels et numéros affichés" })).toContainText("sans jamais savoir qui a appelé");

  // Statistiques : d'où viennent les visiteurs ; export
  await appuyer(menu(page).getByRole("button", { name: "Statistiques" }));
  const sources = page.getByRole("list", { name: "Vues par source" });
  await expect(sources.getByRole("listitem").first()).toContainText(/Google\s*12/);
  await expect(sources.getByRole("listitem").nth(1)).toContainText("Liste des annonces");
  const [csv] = await Promise.all([page.waitForEvent("download"), appuyer(page.getByRole("button", { name: "Exporter mes chiffres (Excel)" }))]);
  expect(csv.suggestedFilename()).toMatch(/^statistiques-360-immo-.+\.csv$/);
});

test("Bien visité : demande payée au prix du bien ; l'équipe fixe le rendez-vous, ajoute les photos de l'agent et pose le badge", async ({ page }) => {
  const f = await fauxSupabase(page);
  const jean = f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });
  const appart = f.annonce(jean, { statut: "publiee", titre: "Appartement 3 pièces à Marcory", ville_id: abidjan(f), publiee_le: date(-10), expire_le: date(80) });
  f.annonce(jean, { statut: "publiee", titre: "Terrain 400 m² à Bingerville", type_bien: "terrain", transaction: "vente", loyer_par: null,
    ville_id: abidjan(f), publiee_le: date(-4), expire_le: date(86) });
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  f.codeValide(equipe);

  // Le prix suit le bien : 10 000 FCFA pour l'appartement, 25 000 FCFA pour le terrain
  await seConnecter(page, "jean@exemple.ci", "/mon-espace?section=annonces");
  await ouvrir(page, "Terrain 400 m² à Bingerville");
  await expect(fenetre(page).getByRole("radio", { name: /Bien visité/ })).toBeVisible();
  await expect(fenetre(page).locator("label").filter({ hasText: "Bien visité" })).toContainText(/25\s000 FCFA/);
  await fenetre(page).getByRole("button", { name: "Fermer" }).click();
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await fenetre(page).getByRole("radio", { name: /Bien visité/ }).check();
  await appuyer(fenetre(page).getByRole("button", { name: /^Payer 10\s000 FCFA$/ }));
  await payerSurLaPage(page, /Valider le paiement de 10\s000 FCFA/);
  await expect(recu(page)).toContainText("Demande de visite reçue : l'équipe 360-Immo.ci vous appelle pour fixer le rendez-vous avec l'agent.");
  await page.goto("/mon-espace?section=annonces");
  await expect(carteDe(page, "Appartement 3 pièces à Marcory")).toContainText("Visite « Bien visité » demandée");
  await ouvrir(page, "Appartement 3 pièces à Marcory");
  await expect(fenetre(page).getByRole("radio", { name: /Bien visité/ })).toBeDisabled();
  await expect(fenetre(page)).toContainText("Visite déjà demandée");

  // L'équipe : rendez-vous, puis photos de l'agent et papiers vus en original ; badge
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await seConnecter(page, "equipe@360-immo.ci", "/admin?section=biens_visites");
  await expect(page.getByRole("button", { name: /Biens visités/ })).toHaveAttribute("aria-current", "page");
  const aPlanifier = page.getByRole("region", { name: "À planifier" });
  const carte = aPlanifier.getByRole("listitem").filter({ hasText: "Appartement 3 pièces à Marcory" });
  await expect(carte).toContainText("Jean Kouassi");
  await expect(carte.getByRole("link", { name: "+225 05 11 22 33 44" })).toBeVisible();
  await appuyer(carte.getByRole("button", { name: "Fixer le rendez-vous" }));
  await carte.getByLabel(/Date et heure du rendez-vous/).fill(date(2).slice(0, 11) + "10:00");
  await carte.getByLabel("Agent qui fera la visite").fill("Yves Agent");
  await appuyer(carte.getByRole("button", { name: "Enregistrer le rendez-vous" }));
  await expect(page.getByRole("status").filter({ hasText: "Rendez-vous fixé" })).toBeVisible();
  const prevue = page.getByRole("region", { name: "Rendez-vous fixés" }).getByRole("listitem").filter({ hasText: "Appartement 3 pièces à Marcory" });
  await expect(prevue).toContainText("agent Yves Agent");
  await appuyer(prevue.getByRole("button", { name: "Noter la visite" }));
  await appuyer(prevue.getByRole("button", { name: "Poser le badge « Bien visité »" }));
  await expect(prevue.getByRole("alert")).toHaveText("Cochez les papiers dont l'agent a vu l'original.");
  await prevue.getByRole("checkbox", { name: "ACD (arrêté de concession définitive)" }).check();
  await appuyer(prevue.getByRole("button", { name: "Poser le badge « Bien visité »" }));
  await expect(prevue.getByRole("alert")).toHaveText("Ajoutez d'abord les photos prises par l'agent.");
  await prevue.locator("input[type=file]").setInputFiles({ name: "agent.png", mimeType: "image/png", buffer: PIXEL });
  await expect(prevue).toContainText("1 ajoutée à l'annonce");
  expect(f.photos.filter((p) => p.annonce_id === appart.id && p.par_agent)).toHaveLength(1);
  await prevue.getByRole("textbox", { name: /Compte rendu/ }).fill("Appartement conforme, propriétaire présent.");
  await appuyer(prevue.getByRole("button", { name: "Poser le badge « Bien visité »" }));
  await expect(page.getByRole("status").filter({ hasText: "Badge « Bien visité » posé" })).toBeVisible();
  expect(appart.bien_visite_le).toBeTruthy();
  await expect(page.getByRole("region", { name: "Notées ces 90 derniers jours" })).toContainText("originaux vus : ACD");
  expect(appart.statut).toBe("publiee");   // une photo de l'équipe ne renvoie pas l'annonce en vérification
});

test("Badge « Bien visité » sur la carte et la fiche ; page « Nos offres » : abonnement agence et Bien visité", async ({ page }) => {
  await page.goto("/annonces?type=terrain");
  const carte = page.getByRole("article").filter({ hasText: "Terrain 600 m² à vendre — Songon-Agban" });
  await expect(carte).toContainText("Bien visité");
  await expect(page.getByRole("article").filter({ hasText: "Terrain 1 000 m² à vendre — Yamoussoukro" })).not.toContainText("Bien visité");
  await page.goto("/annonces/imm-2026-01004");
  await expect(page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }))
    .toContainText(/Bien visité par 360-Immo\.ci le \d+ \S+ \d{4}/);

  await page.goto("/offres");
  const agences = page.getByRole("region", { name: "Agences : l'abonnement mensuel" });
  const formules = agences.getByRole("list", { name: "Formules de l'abonnement agence" });
  for (const [n, prix] of [[20, /15\s000/], [60, /35\s000/], [200, /75\s000/]] as const) {
    await expect(formules.getByRole("listitem").filter({ hasText: `Jusqu'à ${n} annonces` })).toContainText(prix);
  }
  await expect(agences).toContainText(/500 FCFA la remontée/);
  await expect(agences.getByRole("link", { name: "Choisir ma formule" })).toHaveAttribute("href", "/mon-espace?section=abonnement");
  const visite = page.getByRole("region", { name: "Bien visité : un agent vient voir votre bien" });
  await expect(visite).toContainText(/10\s000 FCFA : appartement, maison, bureau, commerce… à Abidjan/);
  await expect(visite).toContainText(/25\s000 FCFA : terrain, villa, immeuble, ou bien hors d'Abidjan/);
  await expect(page.getByText("arrivent bientôt")).toHaveCount(0);
});
