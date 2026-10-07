// E-mails (lib/emails.ts) et leur envoi par Brevo (lib/envoi-notifications.ts, app/api/notifications), sans internet :
// Brevo et la file de la base sont imités ici. Les règles de la file elle-même : tests/base.spec.ts.
import { expect, test } from "@playwright/test";
import { composerEmail, type NotificationAEnvoyer } from "../lib/emails";
import { ErreurGlobale, configEnvoi, envoyerParBrevo, viderFile, type Config } from "../lib/envoi-notifications";

test.beforeEach(() => test.skip(test.info().project.name !== "ordinateur", "une seule fois"));

const SITE = "https://360-immo.vercel.app";
const annonce = { titre: "Appartement 2 pièces à louer — Niangon", reference: "IMM-2026-01006" };
const notif = (modele: NotificationAEnvoyer["modele"], donnees: Record<string, unknown>, autres: Partial<NotificationAEnvoyer> = {}): NotificationAEnvoyer =>
  ({ id: "n1", modele, email: "awa@exemple.ci", prenom: "Awa", donnees, ...autres });
const visite = (evenement: string, pour: string, autres: Record<string, unknown> = {}) => notif("visite", {
  visite: "v1", evenement, pour, annonce, creneau: "2026-10-10T09:00:00+00:00", creneau_propose: null, reponse: null,
  avec_compte: true, ...autres,
});

test("Nouveau message : expéditeur, extrait (protégé), lien vers la conversation, version texte", () => {
  const e = composerEmail(notif("message", {
    conversation: "c1", de: "Jean K.", pour: "annonceur", annonce, extrait: "Bonjour <script>alert(1)</script>, est-ce libre ?",
  }), SITE);
  expect(e).toMatchObject({ a: "awa@exemple.ci", nom: "Awa", etiquette: "message", desabonnement: null });
  expect(e.sujet).toBe("Nouveau message de Jean K. — Appartement 2 pièces à louer — Niangon");
  expect(e.html).toContain("Bonjour Awa,");
  expect(e.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(e.html).not.toContain("<script>");
  expect(e.html).toContain(`href="${SITE}/mon-espace?section=messages&amp;conversation=c1"`);
  expect(e.texte).toContain("Jean K. vous a écrit à propos de votre annonce « Appartement 2 pièces à louer — Niangon » (réf. IMM-2026-01006) :");
  expect(e.texte).toContain("> Bonjour <script>alert(1)</script>, est-ce libre ?");
  expect(e.texte).toContain(`Lire et répondre : ${SITE}/mon-espace?section=messages&conversation=c1`);
  expect(e.texte).toContain(`Choisir les e-mails que je reçois : ${SITE}/mon-espace?section=parametres`);
  // Réponse de l'annonceur à la personne intéressée
  expect(composerEmail(notif("message", { conversation: "c1", de: "Awa K.", pour: "client", annonce, extrait: "Oui !" }), SITE).texte)
    .toContain("Awa K. vous a répondu à propos de l'annonce");
});

test("Visites : demande reçue (sans compte : appeler), confirmée, autre créneau, refusée, annulée", () => {
  const demande = composerEmail(visite("demandee", "annonceur", { nom: "Paul Kra", telephone: "+225 02 02 02 02 02", message: "Après 17 h", avec_compte: false }), SITE);
  expect(demande.sujet).toBe("Demande de visite le samedi 10 octobre à 09:00 — Appartement 2 pièces à louer — Niangon");
  expect(demande.texte).toContain("Paul Kra souhaite visiter votre bien");
  expect(demande.texte).toContain("Téléphone : +225 02 02 02 02 02");
  expect(demande.texte).toContain("Message : Après 17 h");
  expect(demande.texte).toContain("Paul Kra n'a pas de compte : appelez ou écrivez sur WhatsApp au +225 02 02 02 02 02");
  expect(demande.texte).toContain(`Répondre à la demande : ${SITE}/mon-espace?section=visites`);

  // Visiteur sans compte (adresse laissée) : lien vers l'annonce, pied de page adapté
  const confirmee = composerEmail({
    ...visite("confirmee", "demandeur", { annonceur: "Awa K.", reponse: "À demain !", avec_compte: false, nom: "Paul Kra" }),
    email: "paul@exemple.ci", prenom: null,
  }, SITE);
  expect(confirmee).toMatchObject({ a: "paul@exemple.ci", nom: null });
  expect(confirmee.texte).toMatch(/^Bonjour,/);
  expect(confirmee.sujet).toBe("Visite confirmée le samedi 10 octobre à 09:00 — Appartement 2 pièces à louer — Niangon");
  expect(confirmee.texte).toContain("Awa K. a confirmé votre visite");
  expect(confirmee.texte).toContain("> À demain !");
  expect(confirmee.texte).toContain(`Revoir l'annonce : ${SITE}/annonces/appartement-2-pieces-a-louer-niangon-imm-2026-01006`);
  expect(confirmee.texte).toContain("vous avez demandé une visite sur 360-Immo.ci en laissant cette adresse");

  const proposee = composerEmail(visite("proposee", "demandeur", { annonceur: "Awa K.", creneau_propose: "2026-10-11T16:00:00+00:00" }), SITE);
  expect(proposee.texte).toContain("vous propose de visiter le bien « Appartement 2 pièces à louer — Niangon » (réf. IMM-2026-01006) le dimanche 11 octobre à 16:00");
  expect(proposee.texte).toContain(`Accepter ou annuler : ${SITE}/mon-espace?section=visites`);
  expect(composerEmail(visite("refusee", "demandeur", { annonceur: "Awa K.", reponse: "Déjà loué" }), SITE).sujet)
    .toBe("Demande de visite refusée — Appartement 2 pièces à louer — Niangon");
  expect(composerEmail(visite("annulee", "annonceur", { nom: "Jean Kouassi", reponse: "Un empêchement" }), SITE).texte)
    .toContain("Jean Kouassi a annulé sa visite du samedi 10 octobre à 09:00");
  expect(composerEmail(visite("acceptee", "annonceur", { nom: "Jean Kouassi", telephone: "+225 05 11 22 33 44" }), SITE).texte)
    .toContain("Jean Kouassi a accepté le créneau que vous avez proposé");
});

test("Alerte : nombre d'annonces, cartes (photo, prix, lieu), toutes les annonces, « Arrêter cette alerte »", () => {
  const carte = (n: number) => ({
    id: `a${n}`, reference: `IMM-2026-0100${n}`, titre: `Appartement ${n} pièces à louer — Riviera`, transaction: "location", prix: 150000 * n,
    loyer_par: "mois", quartier: "Riviera 2", commune: "Cocody", pieces: n, studio: false, surface: 80, photo: n === 1 ? "a1/salon.webp" : null,
  });
  const e = composerEmail(notif("alerte", {
    alerte: { id: "al1", nom: "Appartements à louer à Cocody", adresse: "/annonces?tx=location&type=appartement&q=Cocody", jeton: "j1", frequence: "quotidienne" },
    total: 8, annonces: [1, 2, 3].map(carte),
  }, { prenom: "Ama" }), SITE);
  expect(e.sujet).toBe("8 nouvelles annonces : Appartements à louer à Cocody");
  expect(e.desabonnement).toBe(`${SITE}/alertes/arreter?jeton=j1`);
  expect(e.html).toContain("photos-annonces/a1/salon.webp");
  expect(e.texte.replace(/[\u202f\u00a0]/g, " ")).toContain("- Appartement 2 pièces à louer — Riviera\n  300 000 FCFA / mois · Riviera 2, Cocody · 2 pièces · 80 m²");
  expect(e.texte).toContain("… et 5 autres.");
  expect(e.texte).toContain(`Voir toutes les annonces : ${SITE}/annonces?tx=location&type=appartement&q=Cocody`);
  expect(e.texte).toContain("Vous recevez cet e-mail chaque jour, quand il y a de nouvelles annonces");
  expect(e.texte).toContain(`Arrêter cette alerte : ${SITE}/alertes/arreter?jeton=j1`);
  const une = composerEmail(notif("alerte", { alerte: { nom: "Terrains à Bingerville", adresse: "/annonces?q=Bingerville", jeton: "j2", frequence: "hebdomadaire" }, total: 1, annonces: [carte(1)] }), SITE);
  expect(une.sujet).toBe("Nouvelle annonce : Terrains à Bingerville");
  expect(une.texte).toContain("chaque semaine");
  expect(e.texte).not.toContain("souhaits");

  // Alerte réglée dans la fenêtre : souhaits présents (✓) et absents (✗), les mieux pourvues en premier
  const souhaits = composerEmail(notif("alerte", {
    alerte: { id: "al3", nom: "Appartements à louer à Cocody", adresse: "/annonces?tx=location&q=Cocody&pmin=3", jeton: "j3", frequence: "quotidienne" },
    total: 2, annonces: [
      { ...carte(3), souhaits: { ok: ["Meublé", "Parking"], manque: [] } },
      { ...carte(4), souhaits: { ok: ["Parking"], manque: ["Meublé"] } },
    ],
  }), SITE);
  expect(souhaits.texte).toContain("Elles ont tout l'essentiel ; celles qui ont le plus de vos souhaits sont en premier.");
  expect(souhaits.texte.replace(/[\u202f\u00a0]/g, " ")).toContain("- Appartement 4 pièces à louer — Riviera\n  600 000 FCFA / mois · Riviera 2, Cocody · 4 pièces · 80 m²\n  ✓ Parking · ✗ Meublé\n");
  expect(souhaits.html).toContain("✓ Meublé</span>");
  expect(souhaits.html).toContain("text-decoration:line-through;\">✗ Meublé</span>");
});

test("Modération : annonce en ligne (ou de nouveau en ligne), refusée ou retirée avec le motif, lien pour corriger", () => {
  const a = { ...annonce, id: "a1" };
  const enLigne = composerEmail(notif("moderation", { decision: "publiee", motif: null, reverification: false, annonce: a }), SITE);
  expect(enLigne).toMatchObject({ sujet: "Votre annonce est en ligne : Appartement 2 pièces à louer — Niangon", etiquette: "moderation" });
  expect(enLigne.texte).toContain("Bonne nouvelle : votre annonce « Appartement 2 pièces à louer — Niangon » (réf. IMM-2026-01006) a été vérifiée");
  expect(enLigne.texte).toContain(`Voir mon annonce : ${SITE}/annonces/`);
  expect(enLigne.texte).toContain("Choisir les e-mails que je reçois");
  const revue = composerEmail(notif("moderation", { decision: "publiee", motif: null, reverification: true, annonce: a }), SITE);
  expect(revue.texte).toContain("Vos changements sur l'annonce « Appartement 2 pièces à louer — Niangon » (réf. IMM-2026-01006) ont été vérifiés");
  const refusee = composerEmail(notif("moderation", { decision: "refusee", motif: "Photos floues <b>", reverification: false, annonce: a }), SITE);
  expect(refusee.sujet).toBe("Votre annonce n'a pas été publiée : Appartement 2 pièces à louer — Niangon");
  expect(refusee.texte).toContain("> Photos floues <b>");
  expect(refusee.html).toContain("Photos floues &lt;b&gt;");
  expect(refusee.texte).toContain(`Corriger mon annonce : ${SITE}/publier?annonce=a1`);
  const retiree = composerEmail(notif("moderation", { decision: "retiree", motif: "Arnaque signalée", reverification: false, annonce: a }), SITE);
  expect(retiree.sujet).toBe("Votre annonce a été retirée : Appartement 2 pièces à louer — Niangon");
  expect(retiree.texte).toContain("l'équipe 360-Immo.ci a retiré votre annonce");
});

test("Être rappelé : nom, numéro, moment, message, lien vers Mon Espace → Rappels", () => {
  const e = composerEmail(notif("rappel", {
    rappel: "r1", annonce, nom: "Paul Kra", telephone: "+225 02 02 02 02 02", moment: "soir", message: "Je travaille en journée.", avec_compte: false,
  }), SITE);
  expect(e.sujet).toBe("À rappeler : Paul Kra — Appartement 2 pièces à louer — Niangon");
  expect(e.texte).toContain("Paul Kra attend votre appel au sujet de votre bien « Appartement 2 pièces à louer — Niangon » (réf. IMM-2026-01006) :");
  expect(e.texte).toContain("Téléphone : +225 02 02 02 02 02");
  expect(e.texte).toContain("Quand : En fin de journée (17 h – 20 h)");
  expect(e.texte).toContain("Message : Je travaille en journée.");
  expect(e.texte).toContain(`Voir la demande : ${SITE}/mon-espace?section=rappels`);
});

test("Fin d'annonce : date de fin et lien pour renouveler", () => {
  const e = composerEmail(notif("fin_annonce", { annonce, expire_le: "2026-10-12T10:00:00+00:00" }), SITE);
  expect(e.sujet).toBe("Votre annonce expire le lundi 12 octobre : renouvelez-la");
  expect(e.texte).toContain(`Renouveler mon annonce : ${SITE}/mon-espace?section=annonces`);
});

test("Brevo : expéditeur, destinataire, « List-Unsubscribe » ; clé refusée = erreur globale", async () => {
  const config: Config = { brevoCle: "cle-test", expediteur: "contact@exemple.ci", nomExpediteur: "360-Immo.ci", site: SITE };
  const appels: { url: string; init: RequestInit }[] = [];
  const faux = (statut: number, corps = "") => (async (url: string, init: RequestInit) => {
    appels.push({ url, init });
    return new Response(corps, { status: statut });
  }) as unknown as typeof fetch;
  const email = composerEmail(notif("alerte", { alerte: { nom: "X", adresse: "/annonces", jeton: "j", frequence: "quotidienne" }, total: 1, annonces: [] }), SITE);
  await envoyerParBrevo(config, email, faux(201, '{"messageId":"1"}'));
  expect(appels[0].url).toBe("https://api.brevo.com/v3/smtp/email");
  expect((appels[0].init.headers as Record<string, string>)["api-key"]).toBe("cle-test");
  expect(JSON.parse(String(appels[0].init.body))).toMatchObject({
    sender: { name: "360-Immo.ci", email: "contact@exemple.ci" }, to: [{ email: "awa@exemple.ci", name: "Awa" }],
    subject: "Nouvelle annonce : X", tags: ["alerte"], headers: { "List-Unsubscribe": `<${SITE}/alertes/arreter?jeton=j>` },
  });
  await expect(envoyerParBrevo(config, email, faux(401, '{"code":"unauthorized"}'))).rejects.toBeInstanceOf(ErreurGlobale);
  await expect(envoyerParBrevo(config, email, faux(400, '{"message":"sender is not valid"}'))).rejects.toBeInstanceOf(ErreurGlobale);
  const ordinaire = envoyerParBrevo(config, email, faux(400, '{"message":"email is not valid"}'));
  await expect(ordinaire).rejects.toThrow(/Brevo 400/);
  await expect(ordinaire).rejects.not.toBeInstanceOf(ErreurGlobale);
});

test("File : envoi par lots ; une erreur n'arrête pas les autres ; clé refusée : tout s'arrête", async () => {
  const file = (n: number) => {
    const restants = Array.from({ length: n }, (_, i) => notif("fin_annonce", { annonce, expire_le: "2026-10-12T10:00:00Z" }, { id: `n${i}` }));
    const marques: [string, string | null][] = [];
    return {
      marques,
      prendre: async (nombre: number) => restants.splice(0, nombre),
      marquer: async (id: string, probleme: string | null) => void marques.push([id, probleme]),
    };
  };
  const f1 = file(7);
  const bilan = await viderFile(f1, async (e) => {
    if (e.a === "awa@exemple.ci" && f1.marques.length === 2) throw new Error("Brevo 400 : email is not valid");
  }, SITE, { parLot: 3, enParallele: 1 });
  expect(bilan).toEqual({ envoyes: 6, echecs: 1, arret: null });
  expect(f1.marques.filter(([, p]) => p)).toEqual([["n2", "Brevo 400 : email is not valid"]]);

  const f2 = file(5);
  const arret = await viderFile(f2, async () => {
    throw new ErreurGlobale("Brevo 401 : unauthorized");
  }, SITE, { parLot: 5, enParallele: 1 });
  expect(arret).toMatchObject({ envoyes: 0, arret: "Brevo 401 : unauthorized" });
  expect(f2.marques.map(([, p]) => p)).toEqual(["Brevo 401 : unauthorized", ...Array(4).fill("Non envoyé : Brevo 401 : unauthorized")]);
  // Sans adresse (compte supprimé entre-temps) : marqué en erreur, sans rien envoyer
  const f3 = file(1);
  const sansAdresse = { ...f3, prendre: async (n: number) => (await f3.prendre(n)).map((x) => ({ ...x, email: null })) };
  expect(await viderFile(sansAdresse, async () => { throw new Error("ne doit pas partir"); }, SITE)).toEqual({ envoyes: 0, echecs: 1, arret: null });
  expect(f3.marques).toEqual([["n0", "Pas d'adresse e-mail"]]);
});

test("Réglages : ce qui manque dans Vercel ; le site répond sans rien envoyer tant que ce n'est pas réglé", async ({ request }) => {
  expect(configEnvoi({}, SITE).manque).toEqual(["BREVO_API_KEY", "EMAIL_EXPEDITEUR", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  const { config } = configEnvoi({ BREVO_API_KEY: " k ", EMAIL_EXPEDITEUR: "a@b.ci", SUPABASE_SECRET_KEY: "s", NEXT_PUBLIC_SUPABASE_URL: "u" }, SITE);
  expect(config).toMatchObject({ brevoCle: "k", expediteur: "a@b.ci", nomExpediteur: "360-Immo.ci", site: SITE });
  // Le site des tests n'a pas ces réglages : la relance répond « pas réglé »
  const r = await request.post("/api/notifications");
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ regle: false, manque: expect.arrayContaining(["BREVO_API_KEY", "SUPABASE_SECRET_KEY"]) });
});
