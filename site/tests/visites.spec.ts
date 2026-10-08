// Étape 6, 2e partie : demandes de visite (fiche → « Planifier une visite » ; Mon Espace → Visites).
// Comptes et visites : imités par tests/faux-supabase.ts ; annonces d'exemple : tests/base/serveur.mjs.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const idExemple = (n: number) => `00000000-0000-4000-8000-0002026${String(n).padStart(5, "0")}`;
const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Awa K., WhatsApp +225 07 48 32 11 90)

/** Les 7 jours proposés (à partir de demain), comme lib/visites.ts */
const prochainsJours = () => Array.from({ length: 7 }, (_, i) => new Date(Date.now() + (i + 1) * 86_400_000).toISOString().slice(0, 10));

const jean = (f: FauxSupabase) => f.inscrit("jean@exemple.ci", "Abidjan2026!", { prenom: "Jean", nom: "Kouassi", telephone: "+225 05 11 22 33 44" });

async function seConnecter(page: Page, email = "jean@exemple.ci") {
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

const menuPrincipal = (page: Page) => page.getByRole("navigation", { name: "Menu principal" });

test("Visite sans compte : créneau (déjà pris grisé), coordonnées vérifiées, demande envoyée, WhatsApp prérempli", async ({ page }) => {
  const f = await fauxSupabase(page);
  const jours = prochainsJours();
  f.visite(idExemple(1006), { statut: "confirmee", creneau: `${jours[1]}T11:00:00.000Z`, telephone: "+225 09 09 09 09 09" });
  await page.goto(FICHE_AWA);
  await appuyer(page.locator("#contact").getByRole("button", { name: "Planifier une visite" }));
  const fenetre = page.getByRole("dialog", { name: "Planifier une visite" });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByText("Appartement 2 pièces à louer — Niangon · Awa K.")).toBeVisible();

  // 1. Créneau : 7 jours (demain d'office), 5 heures ; le créneau confirmé pour un autre visiteur est grisé
  const continuer = fenetre.getByRole("button", { name: "Continuer" });
  await expect(continuer).toBeDisabled();
  const choixJours = fenetre.getByRole("group", { name: "Quel jour ?" }).getByRole("button");
  await expect(choixJours).toHaveCount(7);
  await expect(choixJours.first()).toHaveAttribute("aria-pressed", "true");
  await expect(fenetre.getByRole("group", { name: "À quelle heure ?" }).getByRole("button")).toHaveText(["09:00", "11:00", "14:00", "16:00", "18:00"]);
  await appuyer(choixJours.nth(1));
  await expect(fenetre.getByRole("button", { name: "11:00, déjà pris" })).toBeDisabled();
  await appuyer(fenetre.getByRole("button", { name: "14:00" }));
  await appuyer(continuer);

  // 2. Vos infos : nom et numéro obligatoires, e-mail vérifié s'il est donné
  await expect(fenetre.locator("p").filter({ hasText: / à 14:00Modifier$/ })).toBeVisible(); // rappel du créneau
  const envoyer = fenetre.getByRole("button", { name: "Envoyer la demande" });
  await appuyer(envoyer);
  await expect(fenetre.getByText("Indiquez votre prénom et votre nom.")).toBeVisible();
  await expect(fenetre.getByText("Indiquez un numéro de téléphone.")).toBeVisible();
  await fenetre.getByRole("textbox", { name: "Prénom et nom" }).fill("Koffi Yao");
  await fenetre.getByRole("textbox", { name: "Téléphone" }).fill("01 02 03 04 05");
  await fenetre.getByRole("textbox", { name: "E-mail (facultatif)" }).fill("koffi@");
  await appuyer(envoyer);
  await expect(fenetre.getByText("Cette adresse e-mail n'est pas valide.")).toBeVisible();
  expect(f.visites).toHaveLength(1);
  await fenetre.getByRole("textbox", { name: "E-mail (facultatif)" }).fill("koffi@exemple.ci");
  await fenetre.getByRole("textbox", { name: "Un mot pour l'annonceur (facultatif)" }).fill("Je viendrai avec ma sœur.");
  await appuyer(envoyer);

  // 3. Envoyée : rappel du créneau, l'annonceur rappellera ; WhatsApp prérempli avec la demande
  await expect(fenetre.getByText("Demande envoyée !")).toBeVisible();
  await expect(fenetre.getByText(/^Awa K\. va vous rappeler au \+225 01 02 03 04 05 pour confirmer le rendez-vous/)).toBeVisible();
  await expect(fenetre.getByRole("link", { name: "Suivre ma demande" })).toHaveCount(0);
  await expect(fenetre.getByRole("link", { name: "Prévenir sur WhatsApp" })).toHaveAttribute(
    "href", /^https:\/\/wa\.me\/2250748321190\?text=Bonjour%2C%20je%20viens%20de%20demander%20une%20visite%20sur%20360-Immo\.ci%20pour%20votre%20annonce%20.*r%C3%A9f\.%20IMM-2026-01006.*%C3%A0%2014%3A00.*Koffi%20Yao/,
  );
  expect(f.visites.at(-1)).toMatchObject({
    annonce_id: idExemple(1006), demandeur_id: null, nom: "Koffi Yao", telephone: "+225 01 02 03 04 05", email: "koffi@exemple.ci",
    message: "Je viendrai avec ma sœur.", creneau: `${jours[1]}T14:00:00.000Z`, statut: "demandee",
  });

  // Une seconde demande pour le même bien avec le même numéro : refusée tant que la première est en cours
  await appuyer(fenetre.getByRole("button", { name: "Fermer" }).last());
  await expect(fenetre).toBeHidden();
  await appuyer(page.locator("#contact").getByRole("button", { name: "Planifier une visite" }));
  await expect(fenetre.getByRole("button", { name: "Continuer" })).toBeDisabled(); // nouvelle demande : l'heure est à choisir
  await appuyer(fenetre.getByRole("button", { name: "16:00" }));
  await appuyer(fenetre.getByRole("button", { name: "Continuer" }));
  await expect(fenetre.getByRole("textbox", { name: "Prénom et nom" })).toHaveValue("Koffi Yao");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer la demande" }));
  await expect(fenetre.getByRole("alert")).toContainText("Vous avez déjà une demande de visite en cours pour ce bien.");
  expect(f.visites).toHaveLength(2);
});

test("Visite avec un compte : préremplie, suivie dans Mon Espace ; créneau proposé accepté, puis visite annulée", async ({ page }) => {
  const f = await fauxSupabase(page);
  const moi = jean(f);
  const jours = prochainsJours();
  await page.goto(`/connexion?suite=${encodeURIComponent(FICHE_AWA)}`);
  await seConnecter(page);
  await expect(page).toHaveURL(/imm-2026-01006$/);
  await appuyer(page.locator("#contact").getByRole("button", { name: "Planifier une visite" }));
  const fenetre = page.getByRole("dialog", { name: "Planifier une visite" });
  await appuyer(fenetre.getByRole("button", { name: "09:00" }));
  await appuyer(fenetre.getByRole("button", { name: "Continuer" }));
  await expect(fenetre.getByRole("textbox", { name: "Prénom et nom" })).toHaveValue("Jean Kouassi");
  await expect(fenetre.getByRole("textbox", { name: "Téléphone" })).toHaveValue("05 11 22 33 44");
  await expect(fenetre.getByRole("textbox", { name: "E-mail (facultatif)" })).toHaveValue("jean@exemple.ci");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer la demande" }));
  await expect(fenetre.getByText("Sa réponse arrivera dans votre espace.", { exact: false })).toBeVisible();
  const v = f.visites.at(-1)!;
  expect(v).toMatchObject({ demandeur_id: moi, nom: "Jean Kouassi", telephone: "+225 05 11 22 33 44", creneau: `${jours[0]}T09:00:00.000Z` });

  await appuyer(fenetre.getByRole("link", { name: "Suivre ma demande" }));
  await expect(page).toHaveURL(/\/mon-espace\?section=visites$/);
  await expect(page.locator("h1")).toHaveText("Visites");
  const mesDemandes = page.getByRole("region", { name: /^Mes demandes/ });
  const carte = mesDemandes.getByRole("listitem").filter({ hasText: "Appartement 2 pièces à louer — Niangon" });
  await expect(carte).toContainText("En attente de réponse");
  await expect(carte).toContainText("Annonceur : Awa K.");
  await expect(carte.getByRole("link", { name: "Appartement 2 pièces à louer — Niangon" })).toHaveAttribute("href", /imm-2026-01006$/);
  await expect(carte.getByRole("button", { name: "Accepter ce créneau" })).toHaveCount(0);

  // L'annonceur propose un autre créneau (imité dans la fausse base) : à traiter
  Object.assign(v, { creneau_propose: `${jours[2]}T16:00:00.000Z`, reponse: "Je ne suis pas là le matin." });
  await page.reload();
  await expect(menuPrincipal(page).getByRole("link", { name: /1 visite à traiter$/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mon espace" }).getByRole("button", { name: /^Visites/ })).toContainText("1");
  await expect(carte).toContainText("Nouveau créneau proposé");
  await expect(carte).toContainText(/L'annonceur propose : .* à 16:00/);
  await expect(carte).toContainText("Réponse de l'annonceur : Je ne suis pas là le matin.");
  await appuyer(carte.getByRole("button", { name: "Accepter ce créneau" }));
  await expect(carte).toContainText("Confirmée");
  expect(v).toMatchObject({ statut: "confirmee", creneau: `${jours[2]}T16:00:00.000Z`, creneau_propose: null });
  await expect(menuPrincipal(page).getByRole("link", { name: /à traiter$/ })).toHaveCount(0);

  // Annuler la visite confirmée, avec un mot d'explication
  await appuyer(carte.getByRole("button", { name: "Annuler la visite" }));
  await carte.getByRole("textbox", { name: "Raison (facultatif)" }).fill("Un empêchement, désolé.");
  await appuyer(carte.getByRole("button", { name: "Annuler la visite" }));
  await expect(page.getByText("Aucune visite à venir.")).toBeVisible();
  expect(v).toMatchObject({ statut: "annulee", annulee_par: "demandeur", reponse: "Un empêchement, désolé." });
  const anciennes = page.locator("details").filter({ hasText: "Passées et annulées (1)" });
  await appuyer(anciennes.locator("summary"));
  await expect(anciennes.getByRole("listitem")).toContainText("Annulée par vous");
  await expect(anciennes.getByRole("button")).toHaveCount(0);
});

test("Visites côté annonceur : à traiter (barre du haut, tableau de bord), confirmer, proposer, convenir par téléphone, refuser", async ({ page }) => {
  const f = await fauxSupabase(page);
  const client = jean(f);
  const awa = f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const annonce = String(f.annonce(awa, { titre: "Villa 4 pièces à louer — Angré", statut: "publiee", expire_le: new Date(Date.now() + 30 * 86_400_000).toISOString() }).id);
  const jours = prochainsJours();
  const koffi = f.visite(annonce, { nom: "Koffi Yao", telephone: "+225 01 02 03 04 05", email: "koffi@exemple.ci", message: "Je viendrai avec ma sœur.", creneau: `${jours[0]}T09:00:00.000Z` });
  const avecCompte = f.visite(annonce, { demandeur_id: client, nom: "Jean Kouassi", telephone: "+225 05 11 22 33 44", creneau: `${jours[1]}T11:00:00.000Z` });
  const ama = f.visite(annonce, { nom: "Ama Bamba", telephone: "+225 07 07 07 07 07", creneau: `${jours[2]}T14:00:00.000Z` });
  const marc = f.visite(annonce, { nom: "Marc Diallo", telephone: "+225 05 05 05 05 05", creneau: `${jours[3]}T18:00:00.000Z` });

  await page.goto("/connexion?suite=%2Fmon-espace");
  await seConnecter(page, "awa@exemple.ci");
  await expect(page).toHaveURL(/\/mon-espace$/);
  await expect(menuPrincipal(page).getByRole("link", { name: /4 visites à traiter$/ })).toBeVisible();
  await appuyer(page.getByRole("button", { name: /4 visites à traiter\.$/ }));
  await expect(page.getByRole("heading", { name: /^Demandes reçues/ })).toContainText("4");
  const carteDe = (nom: string) => page.getByRole("listitem").filter({ hasText: nom });

  // Visiteur sans compte : coordonnées pour le rappeler, puis confirmation
  const c1 = carteDe("Koffi Yao");
  await expect(c1).toContainText("À confirmer");
  await expect(c1).toContainText("sans compte");
  await expect(c1).toContainText("Son message : Je viendrai avec ma sœur.");
  await expect(c1).toContainText("Koffi Yao n'a pas de compte : votre réponse ne lui parvient que par téléphone ou WhatsApp.");
  await expect(c1.getByRole("link", { name: "+225 01 02 03 04 05" })).toHaveAttribute("href", "tel:+2250102030405");
  await expect(c1.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/2250102030405\?text=Bonjour%20Koffi%20Yao.*Villa%204%20pi%C3%A8ces/);
  await expect(c1.getByRole("link", { name: "koffi@exemple.ci" })).toHaveAttribute("href", /^mailto:koffi@exemple\.ci\?subject=/);
  await appuyer(c1.getByRole("button", { name: "Confirmer la visite" }));
  await expect(c1).toContainText("Confirmée");
  expect(koffi.statut).toBe("confirmee");

  // Visiteur avec un compte : autre créneau proposé, en attente de son accord
  const c2 = carteDe("Jean Kouassi");
  await expect(c2).not.toContainText("sans compte");
  await appuyer(c2.getByRole("button", { name: "Proposer un autre créneau" }));
  await appuyer(c2.getByRole("group", { name: "Autre jour" }).getByRole("button").nth(3));
  await appuyer(c2.getByRole("button", { name: "16:00" }));
  await c2.getByRole("textbox", { name: "Un mot pour le visiteur (facultatif)" }).fill("Plutôt l'après-midi.");
  await appuyer(c2.getByRole("button", { name: "Proposer ce créneau" }));
  await expect(c2).toContainText("Autre créneau proposé");
  await expect(c2).toContainText(/Vous avez proposé : .* à 16:00 — en attente de son accord\./);
  await expect(c2).toContainText("Votre réponse : Plutôt l'après-midi.");
  expect(avecCompte).toMatchObject({ statut: "demandee", creneau_propose: `${jours[3]}T16:00:00.000Z`, reponse: "Plutôt l'après-midi." });

  // Visiteur sans compte : le créneau convenu par téléphone est confirmé directement
  const c3 = carteDe("Ama Bamba");
  await appuyer(c3.getByRole("button", { name: "Proposer un autre créneau" }));
  await expect(c3).toContainText("Sans compte, Ama Bamba ne peut pas accepter sur le site");
  await appuyer(c3.getByRole("group", { name: "Autre jour" }).getByRole("button").nth(4));
  await appuyer(c3.getByRole("button", { name: "18:00" }));
  await appuyer(c3.getByRole("button", { name: "Confirmer ce créneau" }));
  await expect(c3).toContainText("Confirmée");
  expect(ama).toMatchObject({ statut: "confirmee", creneau: `${jours[4]}T18:00:00.000Z` });

  // Refus, avec la raison
  const c4 = carteDe("Marc Diallo");
  await appuyer(c4.getByRole("button", { name: "Refuser" }));
  await c4.getByRole("textbox", { name: "Raison (facultatif)" }).fill("Le bien vient d'être loué.");
  await appuyer(c4.getByRole("button", { name: "Refuser la demande" }));
  await expect(page.getByText("Passées et annulées (1)")).toBeVisible();
  expect(marc).toMatchObject({ statut: "annulee", annulee_par: "annonceur", reponse: "Le bien vient d'être loué." });

  // Plus rien à traiter : la pastille disparaît
  await expect(menuPrincipal(page).getByRole("link", { name: /à traiter$/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Demandes reçues/ })).toContainText("3");
});

test("Visites : aucune demande pour l'instant", async ({ page }) => {
  const f = await fauxSupabase(page);
  jean(f);
  await page.goto("/connexion?suite=%2Fmon-espace%3Fsection%3Dvisites");
  await seConnecter(page);
  await expect(page.getByText(/Aucune demande de visite pour l'instant/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les annonces" })).toHaveAttribute("href", "/annonces");
});
