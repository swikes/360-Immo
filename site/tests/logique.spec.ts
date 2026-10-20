// Logique sans affichage : règles des biens, adresse de recherche, menu, téléphones (lib/).
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { cheminVignette, fichiersPhoto } from "../lib/annonces-en-ligne";
import { verifierJeton } from "../lib/anti-robot-serveur";
import { bilanSante } from "../lib/surveillance";
import { fournisseurRegle } from "../lib/paiements-serveur";
import { chiffres, dateComplete, initialesNom, jourCourt, jourMois, quantite } from "../lib/format";
import { chercher, trouver } from "../lib/choix-lieu";
import { appareilDe, sourceDe, typePage } from "../lib/mesure";
import { estActif } from "../lib/menu";
import { adresseAnnonces, adresseDeReference, lireAdresse } from "../lib/recherche";
import { TYPES_BIEN, chambresMax, cleType, regles, reglesPour, typeDeCle, typesProposes } from "../lib/regles-biens";
import * as Tel from "../lib/telephone";

// Ces tests n'ouvrent pas de navigateur : un seul passage suffit
test.beforeEach(() => test.skip(test.info().project.name !== "ordinateur", "une seule fois"));

test("Terrain : ni meublé, ni pièces, ni chambres, ni location à la journée", () => {
  const r = reglesPour(["Terrain"], "location");
  expect(r).toMatchObject({ meuble: false, pieces: false, chambres: false, sanitaires: false, etage: false });
  expect(r.loyerPar).toEqual(["Mois", "Année"]);
  expect(r.surface).toBe("Superficie");
  expect(r.commodites).toContain("Titre foncier (ACD)");
  expect(r.commodites).not.toContain("Piscine");
});

test("Surface obligatoire seulement pour un terrain (elle figure sur ses papiers)", () => {
  expect(TYPES_BIEN.filter((t) => regles(t).surfaceObligatoire)).toEqual(["Terrain"]);
});

test("Vente : aucun loyer, pas de caution", () => {
  const r = reglesPour(["Appartement"], "vente");
  expect(r.loyerPar).toEqual([]);
  expect(r.caution).toBe(false);
  expect(r.location).toBe(false);
});

test("Appartement : studio, étage toujours demandé ; bureau : étage en option", () => {
  expect(reglesPour(["Appartement"], "location")).toMatchObject({ studio: true, unePiece: false, etage: "toujours" });
  expect(reglesPour(["Bureau"], "location")).toMatchObject({ etage: "option", chambres: false, sanitaires: "Toilettes" });
  expect(reglesPour(["Maison / Villa"], "location").loyerPar).toEqual(["Jour", "Mois", "Année"]);
});

test("Tous les biens : pas de commodités de terrain, « Salles de bain »", () => {
  const r = reglesPour([], null);
  expect(r.commodites).not.toContain("Terrain clôturé");
  expect(r.sanitaires).toBe("Salles de bain");
  expect(r.unePiece).toBe(false);
});

test("Chambres possibles selon les pièces (le séjour compte pour une pièce)", () => {
  expect(chambresMax("Studio")).toBe(0);
  expect(chambresMax("1")).toBe(0);
  expect(chambresMax("3")).toBe(2);
  expect(chambresMax("5+")).toBe(Infinity);
});

test("Adresse de recherche", () => {
  expect(adresseAnnonces({ location: false })).toBe("/annonces?tx=achat");
  expect(adresseAnnonces({ location: true, journaliere: true, types: ["Maison / Villa"], lieu: " Riviera 2 ", max: "75 000" }))
    .toBe("/annonces?tx=location&duree=jour&type=maison&q=Riviera+2&max=75000");
  expect(adresseAnnonces({ location: false, types: ["Commerce / Magasin"], min: "abc" })).toBe("/annonces?tx=achat&type=commerce");
});

test("Lien actif du menu", () => {
  expect(estActif("/annonces?tx=location", "/annonces", "location")).toBe(true);
  expect(estActif("/annonces?tx=location", "/annonces", "achat")).toBe(false);
  expect(estActif("/publier", "/publier", null)).toBe(true);
  expect(estActif("/blog", "/", null)).toBe(false);
});

test("Types de bien : les mêmes que sur la maquette (publication, recherche, filtres)", () => {
  // js/regles-biens.js de la maquette, lu tel quel
  const fenetre: { ReglesBiens?: { TYPES: string[]; cle: (t: string) => string } } = {};
  new Function("window", readFileSync(path.join(__dirname, "../../js/regles-biens.js"), "utf8"))(fenetre);
  expect(TYPES_BIEN).toEqual(fenetre.ReglesBiens!.TYPES);
  expect(TYPES_BIEN.map(cleType)).toEqual(TYPES_BIEN.map(fenetre.ReglesBiens!.cle));
  expect(TYPES_BIEN).toEqual([
    "Appartement", "Maison", "Villa", "Terrain", "Bureau", "Commerce / Magasin", "Immeuble", "Chambre d'hôtel", "Autres",
  ]);
});

test("Types proposés : une chambre d'hôtel ne s'achète pas ; clés d'adresse dans les deux sens", () => {
  expect(typesProposes("vente")).not.toContain("Chambre d'hôtel");
  expect(typesProposes("location")).toEqual(TYPES_BIEN);
  for (const t of TYPES_BIEN) expect(typeDeCle(cleType(t)!)).toBe(t);
  expect(cleType("Maison / Villa")).toBe("maison");
  expect(adresseAnnonces({ location: true, journaliere: true, types: ["Chambre d'hôtel"] }))
    .toBe("/annonces?tx=location&duree=jour&type=hotel");
});

test("Lieux : quartiers en tapant, lieu reconnu au bon niveau", () => {
  expect(chercher("rivi", { quartiers: true }).slice(0, 2).map((e) => `${e.libelle} | ${e.detail}`))
    .toEqual(["Riviera 1 | Quartier · Cocody", "Riviera 2 | Quartier · Cocody"]);
  expect(chercher("rivi")).toHaveLength(0);
  expect(chercher("abidjan")).toHaveLength(14); // la ville et ses 13 communes
  expect(chercher("port bouet")[0].libelle).toBe("Port-Bouët");
  expect(trouver("divo")).toMatchObject({ type: "ville", ville: "Divo" }); // la ville, pas le quartier de Koumassi
  expect(trouver("riviera 2, cocody")).toMatchObject({ type: "quartier", commune: "Cocody", texte: "Riviera 2, Cocody" });
  expect(trouver("Remblais")).toMatchObject({ type: "quartier", commune: null }); // Koumassi ou Marcory
  expect(trouver("Chez Tantie Awa")).toBeNull();
});

test("Lieux : mêmes suggestions que la maquette", () => {
  // js/villes-communes.js et js/choix-lieu.js de la maquette, lus tels quels
  const fenetre: Record<string, unknown> = { matchMedia: () => ({ matches: false }) };
  for (const f of ["villes-communes.js", "choix-lieu.js"]) {
    new Function("window", readFileSync(path.join(__dirname, "../../js", f), "utf8"))(fenetre);
  }
  type Proto = { chercher: (q: string, o?: { quartiers: boolean }) => { libelle: string; detail: string }[] };
  const maquette = fenetre.ChoixLieu as Proto;
  for (const q of ["", "rivi", "coco", "bouake", "port bouet", "remblais", "marcory", "yop", "mbah", "zzz"]) {
    const texte = (l: { libelle: string; detail: string }[]) => l.map((e) => `${e.libelle} | ${e.detail}`);
    expect(texte(chercher(q, { quartiers: true })), `« ${q} »`).toEqual(texte(maquette.chercher(q, { quartiers: true })));
  }
});

test("Téléphones : vérification selon le pays, numéro écrit en entier, indicatif reconnu", () => {
  expect(Tel.valide("07 48 32 11 90", "CI")).toBe(true);
  expect(Tel.valide("07 48 32", "CI")).toBe(false);
  expect(Tel.message("07 48 32", "CI")).toBe("Numéro invalide (Côte d'Ivoire, +225) : 10 chiffres, ex. 07 00 00 00 00.");
  expect(Tel.message("", "CI")).toBe("Indiquez un numéro de téléphone.");
  expect(Tel.complet("0748321190", "CI")).toBe("+225 07 48 32 11 90");
  expect(Tel.complet("06 12 34 56 78", "FR")).toBe("+33 6 12 34 56 78"); // le 0 du début ne compte pas en France
  expect(Tel.chiffres("07 48 32 11 90", "CI")).toBe("2250748321190");
  expect(Tel.normaliser("0033 6 12 34 56 78", "CI")).toEqual({ iso: "FR", valeur: "6 12 34 56 78" });
  expect(Tel.normaliser("07 48 32 11 90", "CI")).toBeNull();
  expect(Tel.decomposer("+225 07 48 32 11 90")).toEqual({ iso: "CI", valeur: "07 48 32 11 90" });
  expect(Tel.decomposer(null)).toEqual({ iso: "CI", valeur: "" });
  // Recherche : fréquents en tête sans rien taper ; par nom sans accents ; par indicatif
  expect(Tel.rechercherPays("").frequents[0].nom).toBe("Côte d'Ivoire");
  expect(Tel.rechercherPays("sene").tous.map((p) => p.nom)).toEqual(["Sénégal"]);
  expect(Tel.rechercherPays("+22").tous.slice(0, 3).map((p) => p.iso)).toEqual(["CI", "BF", "ML"]);
  // Numéro enregistré en base : le format que la base accepte (supabase/migrations : telephone_format)
  expect(Tel.complet("6 12 34 56 78", "FR")).toMatch(/^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$/);
});

test("Téléphones : mêmes règles que la maquette (js/telephone.js)", () => {
  // js/telephone.js de la maquette, lu tel quel (sans page : pas de champ à équiper)
  const fenetre: Record<string, unknown> = {};
  const documentVide = { addEventListener: () => {} };
  new Function("window", "document", readFileSync(path.join(__dirname, "../../js/telephone.js"), "utf8"))(fenetre, documentVide);
  type Champ = { value: string; dataset: { pays: string } };
  const m = fenetre.Telephone as Record<"valide" | "message" | "complet" | "chiffres", (c: Champ) => unknown>;
  const cas: [string, string][] = [
    ["07 48 32 11 90", "CI"], ["0748321190", "CI"], ["07 48 32", "CI"], ["", "CI"], ["+33 6 12 34 56 78", "CI"],
    ["06 12 34 56 78", "FR"], ["0033612345678", "CI"], ["70 12 34 56", "BF"], ["77 123 45 67", "SN"],
    ["201 555 0123", "US"], ["+1 514 555 0123", "CA"], ["024 123 4567", "GH"], ["12345", "DE"], ["abc", "CI"],
    ["+999 12 34", "CI"], ["0802 123 4567", "NG"], ["612 34 56", "AG"], ["123456789012", "VN"],
  ];
  for (const [valeur, iso] of cas) {
    const c = { value: valeur, dataset: { pays: iso } };
    expect([Tel.valide(valeur, iso), Tel.message(valeur, iso), Tel.complet(valeur, iso), Tel.chiffres(valeur, iso)], `${valeur} (${iso})`)
      .toEqual([m.valide(c), m.message(c), m.complet(c), m.chiffres(c)]);
  }
});

test("Mesure d'audience : genre de page, origine de la visite, appareil ; jamais l'Administration", () => {
  expect(["/", "/annonces", "/annonces/imm-2026-01006-appartement", "/annonceur/kamika", "/carte-des-prix", "/prix/cocody", "/blog",
    "/blog/louer-a-abidjan", "/publier", "/connexion", "/mon-espace", "/contact", "/cgu", "/plan-du-site"].map(typePage)).toEqual(
    ["accueil", "liste", "fiche", "vitrine", "carte_prix", "prix_commune", "blog", "article", "publier", "compte", "mon_espace", "contact",
      "informations", "autre"]);
  expect(typePage("/admin")).toBeNull();
  expect(typePage("/admin/")).toBeNull();
  const site = "https://360-immo.ci";
  expect(sourceDe("https://www.google.ci/", null, site)).toBe("google");
  expect(sourceDe("https://www.bing.com/search?q=x", null, site)).toBe("autres_moteurs");
  expect(sourceDe("https://l.facebook.com/l.php?u=x", null, site)).toBe("facebook");
  expect(sourceDe("android-app://com.facebook.katana/", null, site)).toBe("facebook");
  expect(sourceDe("https://web.whatsapp.com/", null, site)).toBe("whatsapp");
  expect(sourceDe("https://t.co/abc", null, site)).toBe("x");
  expect(sourceDe("https://www.jumia.ci/", null, site)).toBe("autre_site");
  expect(sourceDe("", null, site)).toBe("direct");
  expect(sourceDe(`${site}/annonces`, null, site)).toBe("direct");   // depuis le site lui-même
  // un lien de campagne l'emporte sur le site d'où l'on vient (WhatsApp ne dit pas d'où vient la visite)
  expect(sourceDe("", "WhatsApp", site)).toBe("whatsapp");
  expect(sourceDe("https://www.google.ci/", "newsletter", site)).toBe("email");
  expect(sourceDe("", "affiche", site)).toBe("autre_site");
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const android = "Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
  const tablette = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
  const ordinateur = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
  expect([appareilDe(iphone, 390), appareilDe(android, 412), appareilDe(tablette, 800), appareilDe(ordinateur, 1366)])
    .toEqual(["telephone", "telephone", "tablette", "ordinateur"]);
});

test("Adresse de référence d'une liste pour Google : louer/acheter, types, lieu, page ; sans budget, critères ni tri", () => {
  const ref = (q: string) => adresseDeReference(lireAdresse(new URLSearchParams(q)));
  expect(ref("tx=location&type=appartement&q=Cocody&min=50000&max=300000&pieces=3&meuble=1&tri=prix_asc"))
    .toBe("/annonces?tx=location&type=appartement&q=Cocody");
  expect(ref("tx=location&duree=jour&page=2&verifiees=1")).toBe("/annonces?tx=location&duree=jour&page=2");
  expect(ref("")).toBe("/annonces");
});

test("Vignettes des photos : « g/ » a sa vignette dans « v/ » ; une photo plus ancienne est sa propre vignette", () => {
  const id = "0b6c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d";
  expect(cheminVignette(`${id}/g/photo.webp`)).toBe(`${id}/v/photo.webp`);
  expect(fichiersPhoto(`${id}/g/photo.webp`)).toEqual([`${id}/g/photo.webp`, `${id}/v/photo.webp`]);
  expect(cheminVignette(`${id}/photo.webp`)).toBe(`${id}/photo.webp`);
  expect(fichiersPhoto(`${id}/photo.jpg`)).toEqual([`${id}/photo.jpg`]);
  // « g » ailleurs dans le nom ne compte pas
  expect(cheminVignette(`${id}/g.webp`)).toBe(`${id}/g.webp`);
});

test("Petits outils d'affichage (lib/format.ts) : une seule version pour tout le site", () => {
  expect(initialesNom("Kamika Immobilier")).toBe("KI");
  expect(initialesNom("awa k.")).toBe("AK");
  expect(initialesNom("  ")).toBe("?");
  expect(initialesNom("", "A")).toBe("A");
  expect(quantite(1, "vue")).toBe("1 vue");
  expect(quantite(1250, "vue")).toMatch(/^1\s250 vues$/);
  expect(quantite(2, "travail", "travaux")).toBe("2 travaux");
  expect(chiffres("85 000 000 FCFA")).toBe("85000000");
  expect(chiffres()).toBe("");
  expect(jourCourt("2026-10-12")).toBe("12 oct.");
  expect(dateComplete("2026-10-12T10:00:00Z")).toBe("12 octobre 2026");
  expect(jourMois("2026-10-12T10:00:00Z")).toBe("12 octobre");
});

test("Contrôle anti-robot vérifié par le serveur (lib/anti-robot-serveur.ts) : jeton demandé, refusé, Cloudflare injoignable", async () => {
  const appels: { adresse: string; corps: string }[] = [];
  const cloudflare = (reponse: unknown, panne = false) => (async (adresse: string | URL | Request, init?: RequestInit) => {
    appels.push({ adresse: String(adresse), corps: String(init?.body) });
    if (panne) throw new TypeError("fetch failed");
    return new Response(JSON.stringify(reponse));
  }) as typeof fetch;
  // Pas de clé secrète réglée : rien n'est vérifié (le site marche comme avant le réglage)
  expect(await verifierJeton(undefined, undefined, null, cloudflare({ success: false }))).toEqual({ ok: true });
  expect(await verifierJeton("  ", undefined, null, cloudflare({ success: false }))).toEqual({ ok: true });
  expect(appels).toEqual([]);
  // Clé réglée : un jeton est exigé, Cloudflare le juge
  expect(await verifierJeton("secret", undefined, null, cloudflare({ success: true }))).toEqual({ ok: false, raison: "jeton_absent" });
  expect(await verifierJeton("secret", "", null, cloudflare({ success: true }))).toEqual({ ok: false, raison: "jeton_absent" });
  expect(appels).toEqual([]);
  expect(await verifierJeton("secret", "jeton-1", "203.0.113.7", cloudflare({ success: true }))).toEqual({ ok: true });
  expect(appels[0].adresse).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  expect(Object.fromEntries(new URLSearchParams(appels[0].corps))).toEqual({ secret: "secret", response: "jeton-1", remoteip: "203.0.113.7" });
  expect(await verifierJeton("secret", "jeton-1", null, cloudflare({ success: false, "error-codes": ["timeout-or-duplicate"] })))
    .toEqual({ ok: false, raison: "refuse" });
  expect(await verifierJeton("secret", "jeton-2", null, cloudflare(null, true))).toEqual({ ok: false, raison: "injoignable" });
});

test("Adresse de contrôle (lib/surveillance.ts) : tâche du matin de moins de 26 heures, e-mails qui partent", () => {
  const maintenant = Date.parse("2026-10-19T12:00:00Z");
  const ok = bilanSante({ tache_du_matin: "2026-10-19T07:00:02Z", emails_en_retard: 0 }, true, maintenant);
  expect(ok).toEqual({ ok: true, problemes: [], tache_du_matin: "2026-10-19T07:00:02Z", emails: "réglés" });
  // 26 heures tout juste : encore bon ; au-delà, ou jamais passée : problème
  expect(bilanSante({ tache_du_matin: "2026-10-18T10:00:00Z", emails_en_retard: 0 }, true, maintenant).ok).toBe(true);
  for (const tache of ["2026-10-18T09:59:00Z", null, "pas une date"]) {
    const b = bilanSante({ tache_du_matin: tache, emails_en_retard: 0 }, true, maintenant);
    expect(b.ok, String(tache)).toBe(false);
    expect(b.problemes).toEqual(["La tâche du matin n'est pas passée depuis plus de 26 heures (Vercel → Settings → Cron Jobs)."]);
  }
  // E-mails bloqués : un problème seulement si Brevo est réglé (sinon ils attendent exprès)
  expect(bilanSante({ tache_du_matin: "2026-10-19T07:00:02Z", emails_en_retard: 3 }, true, maintenant).problemes)
    .toEqual(["3 e-mail(s) en attente depuis plus de 26 heures : l'envoi par Brevo est en panne."]);
  expect(bilanSante({ tache_du_matin: "2026-10-19T07:00:02Z", emails_en_retard: 3 }, false, maintenant))
    .toMatchObject({ ok: true, emails: "pas encore réglés" });
});

test("Paiement des offres (lib/paiements-serveur.ts) : fermé sans réglage ; simulation jamais sur Vercel", () => {
  expect(fournisseurRegle({})).toEqual({ nom: null, raison: "Les offres payantes ne sont pas encore ouvertes." });
  expect(fournisseurRegle({ NEXT_PUBLIC_PAIEMENTS: "simulation" })).toEqual({ nom: "simulation" });
  // Vercel (production et aperçus) : un paiement simulé donnerait une offre gratuite sur la vraie base
  expect(fournisseurRegle({ NEXT_PUBLIC_PAIEMENTS: "simulation", VERCEL: "1" }).nom).toBeNull();
  expect(fournisseurRegle({ NEXT_PUBLIC_PAIEMENTS: "cinetpay" })).toEqual({ nom: null, raison: "Agrégateur de paiement « cinetpay » pas encore branché." });
});
