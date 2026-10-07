// Étape 7, 1re partie : espace Administration de l'équipe (/admin) et « Signaler cette annonce » (fiche).
// Comptes, annonces, décisions et signalements : imités par tests/faux-supabase.ts ; les règles de la base
// (réservé à l'équipe, motifs, dates d'une annonce revérifiée, e-mails) : tests/base.spec.ts.
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const FICHE_AWA = "/annonces/imm-2026-01006"; // Appartement 2 pièces à louer — Niangon (Yopougon)
const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

/** L'équipe (compte « admin ») et une annonceuse avec deux annonces à vérifier */
function donnees(f: FauxSupabase) {
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  const awa = f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const nouvelle = f.annonce(awa, {
    statut: "en_attente", titre: "Villa 4 pièces à louer — Angré", prix: 450000, pieces: 4, chambres: 3, surface: 180, meuble: true,
    description: "Belle villa avec jardin, proche des écoles.", contact_nom: "Awa Koné", contact_telephone: "+225 07 48 32 11 90",
    contact_email: "awa@exemple.ci", modifie_le: date(-2),
  });
  f.photos.push({ id: crypto.randomUUID(), annonce_id: nouvelle.id, chemin: `${nouvelle.id}/salon.webp`, ordre: 0 });
  const modifiee = f.annonce(awa, {
    statut: "en_attente", titre: "Studio meublé — Riviera", prix: 25000, loyer_par: "jour", publiee_le: date(-20), expire_le: date(70),
    contact_telephone: "+225 07 48 32 11 90", modifie_le: date(-1),
  });
  return { equipe, awa, nouvelle, modifiee };
}

test("Administration : réservée à l'équipe (sans compte : connexion ; autre compte : refusé)", async ({ page }) => {
  const f = await fauxSupabase(page);
  donnees(f);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion\?suite=(%2F|\/)admin$/);
  await seConnecter(page, "awa@exemple.ci", "/admin");
  await expect(page.getByRole("heading", { name: "Espace réservé à l'équipe 360-Immo.ci" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier" })).toHaveCount(0);
  // Pas de lien Administration dans son espace
  await page.goto("/mon-espace");
  await expect(page.getByRole("button", { name: "Mes annonces" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Administration/ })).toHaveCount(0);
});

test("À vérifier : tout pour décider, publier, refuser avec un motif, journal ; lien depuis Mon Espace", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { nouvelle, modifiee } = donnees(f);
  await seConnecter(page, "equipe@360-immo.ci", "/mon-espace");
  const lien = page.getByRole("link", { name: /Administration/ });
  await expect(lien).toContainText("2");
  await appuyer(lien);
  await expect(page.locator("h1")).toHaveText("Administration");
  await expect(page.getByRole("button", { name: /^À vérifier/ })).toContainText("2");

  // Les plus anciennes d'abord ; tout ce qu'il faut pour décider
  const cartes = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
  await expect(cartes.getByRole("heading", { level: 2 })).toHaveText(["Villa 4 pièces à louer — Angré", "Studio meublé — Riviera"]);
  const villa = cartes.first();
  await expect(villa).toContainText(/450\s000 FCFA \/ mois/);
  await expect(villa.getByRole("list", { name: "Caractéristiques" }).getByRole("listitem")).toHaveText(["4 pièces", "3 chambres", "180 m²", "Meublé", "Dans un immeuble", "Caution : 2 mois"]);
  await expect(villa).toContainText("Belle villa avec jardin, proche des écoles.");
  await expect(villa.getByRole("list", { name: "1 photo" }).getByRole("link")).toHaveAttribute("href", new RegExp(`${nouvelle.id}/salon\\.webp$`));
  await expect(villa.getByRole("region", { name: "Contact affiché sur l'annonce" })).toContainText("Awa Koné · Particulier");
  await expect(villa.getByRole("region", { name: "Compte de l'auteur" })).toContainText("awa@exemple.ci");
  await expect(villa.getByRole("region", { name: "Compte de l'auteur" })).toContainText("0 annonce en ligne");
  const studio = cartes.filter({ hasText: "Studio meublé — Riviera" });
  await expect(studio).toContainText("Revérification : en ligne depuis le");
  await expect(studio).toContainText("Aucune photo");

  // Publier
  await appuyer(villa.getByRole("button", { name: "Publier" }));
  await expect(page.getByRole("status")).toHaveText("« Villa 4 pièces à louer — Angré » est en ligne : l'annonceur est prévenu par e-mail.");
  expect(nouvelle).toMatchObject({ statut: "publiee", motif_refus: null });
  await expect(cartes).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^À vérifier/ })).toContainText("1");

  // Refuser : motif obligatoire, choix rapide
  await appuyer(studio.getByRole("button", { name: "Refuser…" }));
  await studio.getByRole("textbox", { name: /Motif du refus/ }).fill("");
  await appuyer(studio.getByRole("button", { name: "Refuser l'annonce" }));
  await expect(studio.getByRole("alert")).toHaveText("Écrivez le motif : l'annonceur le lira pour corriger son annonce.");
  await appuyer(studio.getByRole("group", { name: "Motifs courants" }).getByRole("button", { name: "Photos floues, trop sombres ou absentes" }));
  await expect(studio.getByRole("textbox", { name: /Motif du refus/ })).toHaveValue("Photos floues, trop sombres ou absentes : ajoutez des photos nettes de chaque pièce.");
  await appuyer(studio.getByRole("button", { name: "Refuser l'annonce" }));
  await expect(page.getByText("Rien à vérifier pour l'instant")).toBeVisible();
  expect(modifiee).toMatchObject({ statut: "refusee", motif_refus: "Photos floues, trop sombres ou absentes : ajoutez des photos nettes de chaque pièce." });

  // Journal
  await appuyer(page.getByRole("button", { name: "Journal" }));
  const journal = page.getByRole("list", { name: "Dernières décisions" }).getByRole("listitem");
  await expect(journal).toHaveCount(2);
  await expect(journal.first()).toContainText("Refusée");
  await expect(journal.first()).toContainText("Studio meublé — Riviera");
  await expect(journal.first()).toContainText("« Photos floues, trop sombres ou absentes");
  await expect(journal.nth(1)).toContainText("Publiée");
  await expect(journal.nth(1)).toContainText("Équipe 360");
});

test("Signalements : retirer une annonce avec un motif, classer ; tableau de bord", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { awa } = donnees(f);
  const arnaque = f.annonce(awa, { statut: "publiee", titre: "Appartement 3 pièces — Cocody", publiee_le: date(-5), expire_le: date(85), contact_telephone: "+225 07 48 32 11 90" });
  const loue = f.annonce(awa, { statut: "publiee", titre: "Bureau 60 m² — Plateau", publiee_le: date(-5), expire_le: date(85) });
  f.signalement(String(arnaque.id), { motif: "arnaque", message: "On m'a demandé une avance avant la visite." });
  f.signalement(String(arnaque.id), { motif: "photos", auteur_id: awa });
  f.signalement(String(loue.id), { motif: "indisponible" });
  await seConnecter(page, "equipe@360-immo.ci", "/admin");
  await expect(page.getByRole("button", { name: /^Signalements/ })).toContainText("2");
  await appuyer(page.getByRole("button", { name: /^Signalements/ }));

  const carte = (titre: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: titre }) });
  const a = carte("Appartement 3 pièces — Cocody");
  await expect(a).toContainText("2 signalements");
  await expect(a.getByRole("list", { name: "Signalements" }).getByRole("listitem")).toHaveText([
    /^Arnaque ou demande d'argent suspecte« On m'a demandé une avance avant la visite. ».*sans compte$/,
    /^Photos ou description trompeuses.*avec un compte$/,
  ]);
  await appuyer(a.getByRole("button", { name: "Retirer l'annonce…" }));
  await expect(a.getByRole("textbox", { name: /Motif du retrait/ })).toHaveValue("Annonce signalée : arnaque ou demande d'argent suspecte.");
  await a.getByRole("textbox", { name: /Motif du retrait/ }).fill("Arnaque confirmée : argent demandé avant la visite.");
  await appuyer(a.getByRole("button", { name: "Retirer l'annonce" }));
  await expect(page.getByRole("status")).toHaveText("« Appartement 3 pièces — Cocody » est retirée du site : l'annonceur est prévenu.");
  expect(arnaque).toMatchObject({ statut: "refusee", motif_refus: "Arnaque confirmée : argent demandé avant la visite." });

  const b = carte("Bureau 60 m² — Plateau");
  await appuyer(b.getByRole("button", { name: "Rien à reprocher : classer…" }));
  await b.getByRole("textbox", { name: /Note pour l'équipe/ }).fill("Toujours disponible, vérifié par téléphone.");
  await appuyer(b.getByRole("button", { name: "Classer les signalements" }));
  await expect(page.getByText("Aucun signalement en attente.")).toBeVisible();
  expect(loue.statut).toBe("publiee");
  expect(f.signalements.map((g) => g.statut)).toEqual(["retiree", "retiree", "classe"]);

  // Tableau de bord
  await appuyer(page.getByRole("button", { name: "Tableau de bord" }));
  const tuile = (titre: string) => page.getByRole("listitem").filter({ has: page.getByText(titre, { exact: true }) }).first();
  await expect(tuile("À vérifier")).toContainText("2");
  await expect(tuile("À vérifier")).toContainText("dont 1 déjà publiée, modifiée");
  await expect(tuile("Signalées")).toContainText("0");
  await expect(tuile("En ligne")).toContainText("1");
  await expect(tuile("Comptes")).toContainText("2");
  await appuyer(tuile("À vérifier").getByRole("button", { name: "Traiter" }));
  await expect(page.getByRole("heading", { name: "Villa 4 pièces à louer — Angré" })).toBeVisible();
});

test("Fiche : signaler une annonce sans compte (raison obligatoire, quelques mots pour « Autre »)", async ({ page }) => {
  const f = await fauxSupabase(page);
  await page.goto(FICHE_AWA);
  await appuyer(page.getByRole("button", { name: "Signaler cette annonce" }));
  const fenetre = page.getByRole("dialog", { name: "Signaler cette annonce" });
  await expect(fenetre).toContainText("Appartement 2 pièces à louer — Niangon");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer le signalement" }));
  await expect(fenetre.getByRole("alert")).toContainText("Choisissez la raison du signalement.");
  await fenetre.getByRole("radio", { name: /Autre raison/ }).check();
  await fenetre.getByRole("textbox", { name: /Précisions/ }).fill("Bof");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer le signalement" }));
  await expect(fenetre.getByRole("alert")).toContainText("Dites en quelques mots ce qui ne va pas.");
  await fenetre.getByRole("radio", { name: /Arnaque ou demande d'argent suspecte/ }).check();
  await fenetre.getByRole("textbox", { name: /Précisions/ }).fill("On m'a demandé de payer avant la visite.");
  await appuyer(fenetre.getByRole("button", { name: "Envoyer le signalement" }));
  await expect(fenetre.getByRole("status")).toContainText("L'équipe 360-Immo.ci va vérifier cette annonce");
  expect(f.demandes.filter((d) => d.chemin === "/rest/v1/rpc/signaler_annonce").map((d) => d.corps))
    .toEqual([{ annonce: expect.any(String), motif: "arnaque", message: "On m'a demandé de payer avant la visite." }]);
  await appuyer(fenetre.getByRole("button", { name: "Fermer", exact: true }).last());
  await expect(page.getByRole("button", { name: "Annonce signalée, merci" })).toBeDisabled();
});
