// Étape 7, 3e partie : vérification par l'équipe (Mon Espace → Vérification, Administration → Documents), badges et logos.
// Comptes, demandes et dossiers « documents » (privé) et « logos » : imités par tests/faux-supabase.ts ; les règles de la
// base (dossier de chacun, pièces obligatoires, une demande à la fois, badges, e-mails) : tests/base.spec.ts.
// Logo et badges sur le site public : la fausse base des annonces (Kamika Immobilier, agence vérifiée avec son logo).
import type { Page } from "@playwright/test";
import { fauxSupabase, type FauxSupabase } from "./faux-supabase";
import { appuyer, expect, test } from "./outils";

const JOUR = 86_400_000;
const date = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();
// Photo de test (PNG 1 × 1) : le site la réduit avant l'envoi ; PDF : envoyé tel quel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const photo = (nom: string) => ({ name: nom, mimeType: "image/png", buffer: PNG });
const pdf = (nom: string) => ({ name: nom, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%Titre foncier\n%%EOF\n") });

async function seConnecter(page: Page, email: string, suite: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
  await page.locator("#panneau-connexion").getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator("#panneau-connexion input[type=password]").fill("Abidjan2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

/** L'équipe, Awa (particulière, une annonce en ligne et un brouillon) et Mamadou (agence « Soleil Immobilier ») */
function donnees(f: FauxSupabase) {
  const equipe = f.inscrit("equipe@360-immo.ci", "Abidjan2026!", { prenom: "Équipe", nom: "360" });
  f.profils.get(equipe)!.role = "admin";
  const awa = f.inscrit("awa@exemple.ci", "Abidjan2026!", { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  const villa = f.annonce(awa, { statut: "publiee", titre: "Villa 4 pièces à louer — Angré", prix: 450000, publiee_le: date(-3), expire_le: date(87) });
  f.annonce(awa, { titre: "Studio — brouillon" });
  const mamadou = f.inscrit("mamadou@exemple.ci", "Abidjan2026!", { prenom: "Mamadou", nom: "Cissé" });
  const agence = { id: crypto.randomUUID(), nom: "Soleil Immobilier", slug: "soleil-immobilier", telephone: null, email: null, verifiee: false, cree_le: date(-10) };
  f.agences.push(agence);
  Object.assign(f.profils.get(mamadou)!, { role: "agence", agence_id: agence.id });
  return { equipe, awa, villa, mamadou, agence };
}

/** Une demande déjà envoyée (fichiers dans le dossier imité) */
function demande(f: FauxSupabase, profil: string, type: string, fichiers: [string, string, string][], champs: Record<string, unknown> = {}) {
  const liste = fichiers.map(([piece, nom, typeFichier]) => {
    const dossier = piece === "logo" ? "logos" : "documents";
    const chemin = `${profil}/${crypto.randomUUID()}-${piece}.${typeFichier === "application/pdf" ? "pdf" : "png"}`;
    f.documents.set(`${dossier}/${chemin}`, { type: typeFichier, contenu: typeFichier === "application/pdf" ? Buffer.from("%PDF-1.4") : PNG });
    return { piece, dossier, chemin, nom, type: typeFichier, taille: 250_000 };
  });
  const v = { id: crypto.randomUUID(), profil_id: profil, type, annonce_id: null, agence_id: null, fichiers: liste, note: null,
    statut: "soumise", motif: null, cree_le: date(-1), traitee_le: null, ...champs };
  f.verifications.push(v);
  return v;
}

test("Mon Espace → Vérification : identité (documents manquants, formats), bien (PDF), demandes en cours ; dossier privé", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { awa, villa } = donnees(f);
  await seConnecter(page, "awa@exemple.ci", "/mon-espace");
  // Depuis la vue d'ensemble, puis par le menu
  await appuyer(page.getByRole("button", { name: /^Vérification\s*Badge « vérifié »/ }));
  await expect(page.locator("h1")).toHaveText("Vérification");
  await expect(page.getByRole("navigation", { name: "Mon espace" }).getByRole("button", { name: "Vérification" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Vos documents restent privés")).toBeVisible();

  const identite = page.getByRole("region", { name: /Mon identité/ });
  await expect(identite).toContainText("Non vérifié");
  await expect(page.getByRole("region", { name: /Mon agence/ })).toHaveCount(0);   // pas un compte agence
  // Ses annonces en ligne ou en vérification (pas le brouillon)
  const biens = page.getByRole("list", { name: "Mes biens" }).getByRole("listitem");
  await expect(biens).toHaveCount(1);
  await expect(biens.first()).toContainText(/Villa 4 pièces à louer — Angré\s*réf\. IMM-2026-\d+ · en ligne/);

  // Identité (CNI) : le verso, puis la photo où l'on tient la pièce manquent ; un fichier qui n'est ni photo ni PDF est refusé
  await expect(identite.getByRole("radio", { name: /Carte nationale d'identité/ })).toBeChecked();
  await identite.getByLabel("CNI : recto").setInputFiles(photo("cni-recto.png"));
  await expect(identite.getByText("cni-recto.png")).toBeVisible();
  await appuyer(identite.getByRole("button", { name: "Envoyer pour vérification" }));
  await expect(identite.getByRole("alert")).toHaveText(/Ajoutez ce document : « CNI : verso »\./);
  await identite.getByLabel("CNI : verso").setInputFiles(photo("cni-verso.png"));
  await appuyer(identite.getByRole("button", { name: "Envoyer pour vérification" }));
  await expect(identite.getByRole("alert")).toHaveText(/Ajoutez ce document : « Photo de vous tenant la pièce »\./);
  await identite.getByLabel("Photo de vous tenant la pièce").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(identite.getByRole("alert")).toHaveText(/« notes\.txt » n'est ni une photo ni un PDF\./);
  await identite.getByLabel("Photo de vous tenant la pièce").setInputFiles(photo("moi.png"));
  await identite.getByLabel(/Un mot pour l'équipe/).fill("Carte nationale d'identité");
  expect(f.documents.size).toBe(0);
  await appuyer(identite.getByRole("button", { name: "Envoyer pour vérification" }));
  await expect(page.getByRole("status").filter({ hasText: "Documents envoyés" })).toBeVisible();
  await expect(identite).toContainText("En cours de vérification");
  await expect(identite).toContainText(/Documents envoyés le .* : l'équipe 360-Immo\.ci les vérifie et vous répond par e-mail\./);
  await expect(identite.getByRole("button", { name: "Envoyer pour vérification" })).toHaveCount(0);

  // La demande : trois photos réduites, dans son propre dossier privé
  expect(f.verifications).toHaveLength(1);
  const v = f.verifications[0] as { type: string; note: string; fichiers: { piece: string; dossier: string; chemin: string; nom: string; type: string }[] };
  expect(v).toMatchObject({ type: "identite", type_piece: "cni", note: "Carte nationale d'identité" });
  expect(v.fichiers.map((x) => [x.piece, x.dossier, x.nom])).toEqual([
    ["piece_recto", "documents", "cni-recto.png"], ["piece_verso", "documents", "cni-verso.png"], ["selfie", "documents", "moi.png"]]);
  for (const x of v.fichiers) {
    expect(x.chemin.startsWith(`${awa}/`)).toBe(true);
    expect(x.type).toMatch(/^image\/(webp|jpeg)$/);
    expect(f.documents.get(`documents/${x.chemin}`)?.type).toBe(x.type);
  }

  // Un bien : titre de propriété en PDF
  await appuyer(biens.first().getByRole("button", { name: "Faire vérifier ce bien" }));
  await biens.first().getByLabel("Titre de propriété ou mandat").setInputFiles(pdf("ACD-Angre.pdf"));
  await expect(biens.first().getByText("ACD-Angre.pdf")).toBeVisible();
  await appuyer(biens.first().getByRole("button", { name: "Envoyer pour vérification" }));
  await expect(biens.first()).toContainText("En cours de vérification");
  expect(f.verifications[1]).toMatchObject({ type: "bien", annonce_id: villa.id });
  expect((f.verifications[1].fichiers as { type: string; nom: string }[])).toEqual([expect.objectContaining({ type: "application/pdf", nom: "ACD-Angre.pdf" })]);
  expect(f.documents.size).toBe(4);
});

test("Administration → Documents : ouvrir les documents, refuser avec un motif, valider (badge, logo) ; documents supprimés ; journal", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { awa, mamadou, agence } = donnees(f);
  const identite = demande(f, awa, "identite", [["piece_recto", "recto.jpg", "image/png"], ["selfie", "selfie.jpg", "image/png"]]);
  const pourAgence = demande(f, mamadou, "agence", [["rccm", "RCCM-Soleil.pdf", "application/pdf"], ["logo", "logo-soleil.png", "image/png"]],
    { agence_id: agence.id, note: "Agence créée en 2019", cree_le: date(-0.5) });
  await seConnecter(page, "equipe@360-immo.ci", "/admin");
  const onglet = page.getByRole("button", { name: /^Documents/ });
  await expect(onglet).toContainText("2");
  await appuyer(onglet);
  const cartes = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(cartes).toHaveCount(2);

  // Identité : la personne, ses documents (photos ouvertes par un lien temporaire)
  const carteIdentite = cartes.filter({ hasText: "recto.jpg" });
  await expect(carteIdentite.getByRole("heading")).toHaveText("Awa Koné");
  await expect(carteIdentite).toContainText("awa@exemple.ci");
  const recto = carteIdentite.getByRole("link", { name: "Ouvrir : CNI : recto" });
  await expect(recto).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/documents\/.+-piece_recto\.png\?token=/);
  await expect.poll(() => recto.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(1);
  // Agence : RCCM en PDF, logo, message de la personne
  const carteAgence = cartes.filter({ hasText: "RCCM-Soleil.pdf" });
  await expect(carteAgence.getByRole("heading")).toHaveText("Agence « Soleil Immobilier »");
  await expect(carteAgence).toContainText("« Agence créée en 2019 »");
  await expect(carteAgence.getByRole("link", { name: "Ouvrir le PDF" })).toHaveAttribute("href", /sign\/documents\/.+-rccm\.pdf\?token=/);
  await expect(carteAgence.getByRole("link", { name: "Ouvrir : Logo de l'agence" })).toHaveAttribute("href", /\/storage\/v1\/object\/public\/logos\//);

  // Refuser l'identité : motif obligatoire, motif courant en un clic
  await appuyer(carteIdentite.getByRole("button", { name: "Refuser…" }));
  await appuyer(carteIdentite.getByRole("button", { name: "Refuser la vérification" }));
  await expect(carteIdentite.getByRole("alert")).toHaveText("Écrivez le motif : la personne le recevra par e-mail.");
  await appuyer(carteIdentite.getByRole("group", { name: "Motifs courants" }).getByRole("button", { name: "Photo floue ou coupée" }));
  await expect(carteIdentite.getByLabel(/Motif du refus/)).toHaveValue(/^Photo floue ou coupée : on doit pouvoir lire toute la pièce/);
  await appuyer(carteIdentite.getByRole("button", { name: "Refuser la vérification" }));
  await expect(page.getByRole("status").filter({ hasText: "vérification refusée" })).toContainText("Identité Awa Koné : vérification refusée.");
  expect(identite).toMatchObject({ statut: "refusee", motif: expect.stringMatching(/^Photo floue/) });
  await expect.poll(() => [...f.documents.keys()].filter((k) => k.includes(awa))).toEqual([]);   // documents supprimés
  await expect(cartes).toHaveCount(1);
  await expect(onglet).toContainText("1");

  // Valider l'agence : badge et logo ; le RCCM est supprimé, le logo reste (il s'affiche sur le site)
  await appuyer(carteAgence.getByRole("button", { name: "Valider…" }));
  await expect(carteAgence).toContainText("Donner le badge « Agence vérifiée » à « Soleil Immobilier » et afficher son logo ?");
  await appuyer(carteAgence.getByRole("button", { name: "Oui, valider" }));
  await expect(page.getByRole("status").filter({ hasText: "validée" })).toContainText("Agence « Soleil Immobilier » : vérification validée, badge donné.");
  const logo = (pourAgence.fichiers as { piece: string; chemin: string }[]).find((x) => x.piece === "logo")!.chemin;
  expect(agence).toMatchObject({ verifiee: true, logo });
  await expect.poll(() => [...f.documents.keys()].filter((k) => k.includes(mamadou))).toEqual([`logos/${logo}`]);
  await expect(page.getByText("Aucun document à vérifier.")).toBeVisible();
  await expect(onglet).not.toContainText(/\d/);

  // Journal et tableau de bord
  await appuyer(page.getByRole("button", { name: /^Journal/ }));
  const journal = page.getByRole("list", { name: "Dernières décisions" }).getByRole("listitem");
  await expect(journal.nth(0)).toContainText(/Vérification validée\s*Mamadou Cissé\s*« Votre agence « Soleil Immobilier » »/);
  await expect(journal.nth(1)).toContainText(/Vérification refusée\s*Awa Koné\s*« Votre identité : Photo floue/);
  await appuyer(page.getByRole("button", { name: /^Tableau de bord/ }));
  await expect(page.getByRole("listitem").filter({ hasText: "Documents à vérifier" })).toContainText(/Documents à vérifier\s*0/);
});

test("Après la décision : refus (motif, nouvel envoi), identité vérifiée, agence vérifiée avec son logo", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { awa, mamadou, agence } = donnees(f);
  demande(f, awa, "identite", [["piece_recto", "recto.jpg", "image/png"]],
    { statut: "refusee", motif: "Pièce d'identité expirée : envoyez une pièce en cours de validité.", traitee_le: date(-0.2) });
  f.documents.clear();
  await seConnecter(page, "awa@exemple.ci", "/mon-espace?section=verification");
  const identite = page.getByRole("region", { name: /Mon identité/ });
  await expect(identite).toContainText("Refusé");
  await expect(identite).toContainText(/Demande refusée le .* : Pièce d'identité expirée : envoyez une pièce en cours de validité\. Renvoyez/);
  await expect(identite.getByLabel("CNI : recto")).toBeAttached();   // nouvel envoi possible

  // Mamadou : identité vérifiée ; agence vérifiée, avec son logo
  Object.assign(f.profils.get(mamadou)!, { identite_verifiee_le: date(-5), identite_expire_le: date(800).slice(0, 10) });
  Object.assign(agence, { verifiee: true, logo: `${mamadou}/logo.png` });
  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await seConnecter(page, "mamadou@exemple.ci", "/mon-espace?section=verification");
  await expect(page.getByRole("region", { name: /Mon identité/ })).toContainText(/Vérifié\s*.*Identité vérifiée le .*, jusqu'au .* \(fin de validité de votre pièce\)/);
  const carteAgence = page.getByRole("region", { name: /Mon agence : Soleil Immobilier/ });
  await expect(carteAgence).toContainText("Vérifié");
  await expect(carteAgence).toContainText("Agence vérifiée : le badge et votre logo s'affichent sur vos annonces");
  await expect(carteAgence.getByRole("img", { name: "Logo de Soleil Immobilier" })).toHaveAttribute("src", new RegExp(`/storage/v1/object/public/logos/${mamadou}/logo\\.png$`));
});

test("Site public : logo et badge « Agence vérifiée » (vitrine, fiche, accueil)", async ({ page }) => {
  // Vitrine de Kamika Immobilier (agence vérifiée, avec son logo dans la fausse base des annonces)
  await page.goto("/annonceur/kamika-immobilier-kamika");
  const principal = page.getByRole("main");
  await expect(principal.getByText("Agence vérifiée par 360-Immo.ci")).toBeVisible();
  const logo = principal.getByRole("img", { name: "Logo de Kamika Immobilier" }).first();
  await expect(logo).toHaveAttribute("src", /\/storage\/v1\/object\/public\/logos\/kamika\/logo\.png$/);
  await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  // Fiche d'une de ses annonces : logo et badge dans le contact
  await page.goto("/annonces/imm-2026-01001");
  const contact = page.locator("#contact");
  await expect(contact.getByRole("img", { name: "Logo de Kamika Immobilier" })).toHaveAttribute("src", /\/logos\/kamika\/logo\.png$/);
  await expect(contact).toContainText("Agence vérifiée");
  await expect(contact).not.toContainText("Annonceur non vérifié");
  // Particulier sans identité vérifiée : ni logo ni badge, mais « Annonceur non vérifié » et un conseil de prudence
  await page.goto("/annonces/imm-2026-01006");
  await expect(page.locator("#contact").getByRole("img")).toHaveCount(0);
  await expect(page.locator("#contact")).not.toContainText("vérifiée");
  await expect(page.locator("#contact")).toContainText("Annonceur non vérifié");
  await expect(page.locator("#contact")).toContainText("Son identité n'a pas été contrôlée par 360-Immo.ci : soyez prudent");
  await page.goto("/annonceur/awakon");
  await expect(page.getByRole("main").getByText("Annonceur non vérifié", { exact: true })).toBeVisible();
  // Accueil : le logo à la place des initiales
  await page.goto("/");
  const kamika = page.locator("#agences").getByRole("link", { name: /Kamika Immobilier/ });
  await expect(kamika.locator("img")).toHaveAttribute("src", /\/logos\/kamika\/logo\.png$/);
});

test("Identité : passeport, validation avec numéro et date de fin, pièce conservée ; plainte : la retrouver et l'ouvrir avec un motif", async ({ page }) => {
  const f = await fauxSupabase(page);
  const { awa } = donnees(f);
  await seConnecter(page, "awa@exemple.ci", "/mon-espace?section=verification");
  const identite = page.getByRole("region", { name: /Mon identité/ });
  // Passeport : seulement la page photo (et la photo de soi tenant la pièce)
  await identite.getByLabel("CNI : recto").setInputFiles(photo("cni.png"));
  await appuyer(identite.getByRole("radio", { name: /Passeport/ }));
  await expect(identite.getByLabel("CNI : recto")).toHaveCount(0);
  await identite.getByLabel("Passeport : page photo").setInputFiles(photo("passeport.png"));
  await identite.getByLabel("Photo de vous tenant la pièce").setInputFiles(photo("moi.png"));
  await appuyer(identite.getByRole("button", { name: "Envoyer pour vérification" }));
  await expect(identite).toContainText("En cours de vérification");
  expect(f.verifications[0]).toMatchObject({ type: "identite", type_piece: "passeport" });
  expect((f.verifications[0].fichiers as { piece: string }[]).map((x) => x.piece)).toEqual(["passeport", "selfie"]);

  // L'équipe : numéro et date de fin obligatoires ; la pièce est conservée
  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await seConnecter(page, "equipe@360-immo.ci", "/admin");
  await appuyer(page.getByRole("button", { name: /^Documents/ }));
  const carte = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Awa Koné", level: 3 }) });
  await expect(carte.getByText("Passeport", { exact: true })).toBeVisible();
  await appuyer(carte.getByRole("button", { name: "Valider…" }));
  await appuyer(carte.getByRole("button", { name: "Valider l'identité" }));
  await expect(carte.getByRole("alert")).toHaveText(/Notez le numéro et la date de fin de validité/);
  await carte.getByLabel("Numéro du passeport").fill("AB 123 456");
  await carte.getByLabel("Valable jusqu'au").fill("2031-05-01");
  await appuyer(carte.getByRole("button", { name: "Valider l'identité" }));
  await expect(page.getByRole("status").filter({ hasText: "vérifiée jusqu'au" }))
    .toContainText("Identité de Awa Koné vérifiée jusqu'au 1 mai 2031 : badge donné, e-mail envoyé ; la pièce est conservée (plainte).");
  expect(f.profils.get(awa)).toMatchObject({ identite_expire_le: "2031-05-01" });
  expect([...f.documents.keys()].filter((k) => k.includes(awa))).toHaveLength(2);   // gardée

  // Plainte : chercher la pièce, l'ouvrir avec un motif (au journal)
  const pieces = page.getByRole("list", { name: "Pièces conservées" });
  await page.getByRole("searchbox", { name: "Nom, e-mail, téléphone ou numéro de la pièce" }).fill("AB123");
  await appuyer(page.getByRole("button", { name: "Chercher" }).last());
  await expect(pieces.getByRole("listitem").first()).toContainText(/Passeport n° AB123456 · valable jusqu'au 1 mai 2031/);
  await expect(pieces.getByText("Badge affiché")).toBeVisible();
  await appuyer(pieces.getByRole("button", { name: "Ouvrir pour une plainte…" }));
  await appuyer(pieces.getByRole("button", { name: "Ouvrir la pièce" }));
  await expect(pieces.getByRole("alert")).toHaveText(/Écrivez le motif/);
  await pieces.getByLabel(/Motif/).fill("Plainte de M. Traoré du 12 octobre : avance demandée, bien inexistant.");
  await appuyer(pieces.getByRole("button", { name: "Ouvrir la pièce" }));
  await expect(pieces.getByRole("link", { name: "Ouvrir : Passeport : page photo" })).toHaveAttribute("href", /sign\/documents\/.+-passeport\./);
  await appuyer(page.getByRole("button", { name: /^Journal/ }));
  await expect(page.getByRole("list", { name: "Dernières décisions" }).getByRole("listitem").first())
    .toContainText(/Pièce d'identité ouverte \(plainte\)\s*Awa Koné\s*« Plainte de M\. Traoré/);

  // Awa : badge jusqu'à la fin de sa pièce ; le profil prévient qu'un changement de nom le retire
  await page.goto("/mon-espace");
  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await seConnecter(page, "awa@exemple.ci", "/mon-espace?section=verification");
  await expect(page.getByRole("region", { name: /Mon identité/ })).toContainText("jusqu'au 1 mai 2031 (fin de validité de votre pièce)");
  await page.goto("/mon-espace?section=profil");
  await expect(page.getByText(/Votre identité est vérifiée : changer de prénom ou de nom retire le badge/)).toBeVisible();
});

test("Un compte par e-mail et par numéro : inscription refusée clairement ; l'équipe voit les numéros partagés et libère un numéro", async ({ page }) => {
  const f = await fauxSupabase(page);
  donnees(f);
  // Inscription : numéro déjà pris, adresse jetable, Gmail écrit autrement
  f.inscrit("kone.awa@gmail.com", "Abidjan2026!", { prenom: "Awa", nom: "Koné bis", telephone: "+225 05 31 31 31 31" });
  const panneau = page.locator("#panneau-inscription");
  const remplir = async (email: string, numero: string) => {
    await page.goto("/connexion?mode=inscription");
    await panneau.getByRole("textbox", { name: "Prénom", exact: true }).fill("Aya");
    await panneau.getByRole("textbox", { name: "Nom", exact: true }).fill("Kouamé");
    await panneau.getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
    await panneau.getByRole("textbox", { name: /Numéro principal/ }).fill(numero);
    await panneau.locator("input[type=password]").nth(0).fill("Abidjan2026!");
    await panneau.locator("input[type=password]").nth(1).fill("Abidjan2026!");
    await panneau.getByRole("checkbox", { name: /J'accepte les Conditions/ }).check();
    await appuyer(panneau.getByRole("button", { name: "Créer mon compte" }));
  };
  await remplir("aya@exemple.ci", "05 31 31 31 31");
  await expect(panneau.getByText("Ce numéro est déjà utilisé par un autre compte. S'il est à vous, contactez l'équipe 360-Immo.ci : elle peut le libérer.")).toBeVisible();
  await remplir("aya@yopmail.com", "05 77 77 77 77");
  await expect(panneau.getByText("Adresse e-mail jetable : utilisez votre adresse habituelle.")).toBeVisible();
  await remplir("k.o.n.e.awa+immo@gmail.com", "05 77 77 77 77");
  await expect(panneau.getByRole("alert")).toContainText("Un compte existe déjà avec cet e-mail");
  expect(f.comptes.map((c) => c.email)).not.toContain("aya@exemple.ci");
  await remplir("aya@exemple.ci", "05 77 77 77 77");
  await expect(page).toHaveURL(/\/(\?bienvenue=inscription)?$/);   // tout est libre : compte créé

  // L'équipe : deux comptes d'avant la règle partagent un numéro ; elle libère celui qui n'est pas le bon
  const doublon = f.inscrit("double@exemple.ci", "Abidjan2026!", { prenom: "Koffi", nom: "Double", telephone: "+225 05 31 31 31 31" });
  await page.goto("/mon-espace");
  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await seConnecter(page, "equipe@360-immo.ci", "/admin");
  await appuyer(page.getByRole("button", { name: /^Comptes/ }));
  const partages = page.getByRole("list", { name: "Numéros partagés" });
  await expect(page.getByRole("heading", { name: "Numéros partagés par plusieurs comptes (1)" })).toBeVisible();
  const carte = partages.getByRole("listitem", { name: "Koffi Double" });
  await expect(carte).toContainText("Même numéro que 1 autre compte");
  await appuyer(carte.getByRole("button", { name: "Libérer le numéro…" }));
  await carte.getByLabel(/Pourquoi retirer le numéro/).fill("Ce numéro appartient à Awa Koné, qui l'a réclamé.");
  await appuyer(carte.getByRole("button", { name: "Retirer le numéro" }));
  await expect(page.getByRole("status").filter({ hasText: "est retiré" })).toContainText("Le numéro +225 05 31 31 31 31 est retiré du compte de Koffi Double");
  expect(f.profils.get(doublon)!.telephone).toBeNull();
  await expect(page.getByRole("heading", { name: /Numéros partagés/ })).toHaveCount(0);
});
