// Sécurité vue de l'extérieur : en-têtes de sécurité (next.config.ts), limite de « Afficher le numéro »
// pour un visiteur sans compte (app/api/numero, supabase/migrations/…_limite_numeros.sql), formulaire Contact par le
// serveur du site seulement (app/api/contact) et contrôle anti-robot (lib/anti-robot.ts).
import { BASE_TESTS, appuyer, expect, test } from "./outils";

test("En-têtes de sécurité sur toutes les pages : sources permises, jamais dans le cadre d'un autre site", async ({ request }) => {
  test.skip(test.info().project.name !== "ordinateur", "une seule fois");
  for (const chemin of ["/", "/annonces", "/connexion", "/blog"]) {
    const h = (await request.get(chemin)).headers();
    expect(h["content-security-policy"], chemin).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain(`connect-src 'self' ${BASE_TESTS}`);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    // contrôle anti-robot réglé (clé d'essai de Cloudflare dans les tests) : son script et sa case, rien d'autre
    expect(h["content-security-policy"]).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;");
    expect(h["content-security-policy"]).toContain("frame-src 'self' https://challenges.cloudflare.com;");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  }
});

test("« Afficher le numéro » sans compte : par le serveur du site seulement, 20 en 10 minutes par connexion", async ({ request }) => {
  test.skip(test.info().project.name !== "ordinateur", "une seule fois");
  const { annonces } = await (await request.post(`${BASE_TESTS}/rest/v1/rpc/rechercher_annonces`, { data: { criteres: {} } })).json();
  const annonce = annonces[0].id as string;
  // Directement à la base, comme un robot : refusé
  const direct = await request.post(`${BASE_TESTS}/rest/v1/rpc/contact_annonce`, { data: { annonce } });
  expect(direct.status()).toBe(400);
  expect((await direct.json()).message).toMatch(/permission denied/);
  // Par le site : 20 numéros, puis le message de la base
  const connexion = { "x-forwarded-for": `essai-${crypto.randomUUID()}` };
  for (let i = 0; i < 20; i++) {
    const r = await request.post("/api/numero", { data: { annonce }, headers: connexion });
    expect(r.status()).toBe(200);
    expect((await r.json()).contact.telephone).toMatch(/^\+225 /);
  }
  const trop = await request.post("/api/numero", { data: { annonce }, headers: connexion });
  expect(trop.status()).toBe(429);
  expect((await trop.json()).message).toMatch(/connectez-vous pour continuer/);
  expect((await request.post("/api/numero", { data: { annonce: "pas-une-annonce" } })).status()).toBe(400);
});

test("Fiche : le message de la limite s'affiche à la place du numéro", async ({ page }) => {
  await page.route("**/api/numero", (r) => r.fulfill({ status: 429, json: { message: "Vous avez affiché beaucoup de numéros en peu de temps : réessayez dans quelques minutes, ou connectez-vous pour continuer." } }));
  await page.goto("/annonces/imm-2026-01001");
  const contact = page.locator("#contact");
  await appuyer(contact.getByRole("button", { name: "Afficher le numéro" }));
  await expect(contact.getByRole("alert")).toHaveText(/beaucoup de numéros en peu de temps/);
  await expect(contact.getByRole("link", { name: /^\+225/ })).toHaveCount(0);
});

test("Formulaire Contact : par le serveur du site seulement ; les règles de la base s'affichent telles quelles", async ({ request }) => {
  test.skip(test.info().project.name !== "ordinateur", "une seule fois");
  const message = "Bonjour, je voudrais savoir comment publier une annonce pour un terrain.";
  const demande = { nom: "Aya Touré", email: `aya-${crypto.randomUUID().slice(0, 8)}@exemple.ci`, sujet: "question", message };
  // Directement à la base, comme un robot qui passerait à côté du contrôle anti-robot : refusé
  const direct = await request.post(`${BASE_TESTS}/rest/v1/rpc/envoyer_contact`, { data: { demande, auteur: null } });
  expect(direct.status()).toBe(400);
  expect((await direct.json()).message).toMatch(/permission denied/);
  // Par le site (sans clé secrète de Cloudflare dans les tests : jeton non vérifié ici, voir logique.spec.ts)
  const r = await request.post("/api/contact", { data: { demande, jeton: "jeton-anti-robot-essai" } });
  expect(r.status()).toBe(200);
  expect((await r.json()).id).toMatch(/^[0-9a-f-]{36}$/);
  const refus = await request.post("/api/contact", { data: { demande: { ...demande, nom: "A" } } });
  expect(refus.status()).toBe(400);
  expect(await refus.json()).toEqual({ code: "P0001", message: "Indiquez votre nom." });
  // Jeton de connexion faux : la demande part sans compte (jamais au nom d'un autre)
  const fauxCompte = await request.post("/api/contact", { data: { demande }, headers: { authorization: "Bearer faux-jeton" } });
  expect(fauxCompte.status()).toBe(200);
  expect((await request.post("/api/contact", { data: { demande: "texte" } })).status()).toBe(400);
});
