// Fausse base Supabase des tests du site : la vraie base (PGlite, toutes les migrations de supabase/migrations)
// remplie avec les annonces d'exemple (annonces-exemple.json), publiées comme le fait l'équipe 360-Immo.ci.
//
// Le site construit (next start) l'interroge côté serveur : liste des annonces, fiche d'un bien, accueil.
// Le navigateur aussi, pour ce que tests/faux-supabase.ts ne simule pas (numéro sur demande, vues).
// Elle répond comme Supabase, en visiteur sans compte, ou comme au serveur du site avec la clé secrète des tests
// (sb_secret_tests, app/api/numero) :
//   POST /rest/v1/rpc/<fonction>                        → la fonction de la base (rechercher_annonces…)
//   GET  /storage/v1/object/public/photos-annonces/…    → une « photo » dessinée (en largeur ou en hauteur)
//   GET  /storage/v1/object/public/logos/…              → un logo dessiné (Kamika Immobilier a le sien)
// Blog et pages du site : quelques premières versions publiées pour les tests des pages publiques.
//
// Lancée par Playwright (playwright.config.ts) ; à la main : node tests/base/serveur.mjs
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ICI = import.meta.dirname;
const PORT = Number(process.env.PORT_BASE ?? 54329);
const ANNONCES = JSON.parse(readFileSync(path.join(ICI, "annonces-exemple.json"), "utf8"));
const CLE_SECRETE = "sb_secret_tests";   // celle du site des tests (playwright.config.ts)

// ── La base : ce que Supabase fournit, puis les migrations ──
const db = new PGlite();
await db.exec(readFileSync(path.join(ICI, "supabase-simule.sql"), "utf8"));
const MIGRATIONS = path.join(ICI, "../../supabase/migrations");
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
}

// ── Les annonceurs : un compte par nom de contact ; les agences rattachées à leur agence (vérifiée) ──
// Code de vitrine fixe, pour les tests : les 6 premières lettres du nom (« Kamika Immobilier » → kamika)
const codeVitrine = (nom) => nom.normalize("NFD").replace(/[^a-zA-Z]/g, "").toLowerCase().padEnd(6, "x").slice(0, 6);
const auteurs = new Map();
const numerosPris = new Set();   // un numéro par compte : un numéro déjà pris reste seulement sur l'annonce
async function auteurDe(a) {
  if (auteurs.has(a.contact_nom)) return auteurs.get(a.contact_nom);
  const [prenom, ...reste] = a.contact_nom.split(" ");
  const telephone = numerosPris.has(a.contact_telephone) ? undefined : a.contact_telephone;
  numerosPris.add(a.contact_telephone);
  const { rows: [{ id }] } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`${codeVitrine(a.contact_nom)}@exemple.ci`, { prenom, nom: reste.join(" "), telephone }],
  );
  await db.query("update public.profils set code_vitrine = $2 where id = $1", [id, codeVitrine(a.contact_nom)]);
  if (a.type_vendeur === "agence") {
    const slug = a.contact_nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // Kamika Immobilier a envoyé son logo (vérification de l'agence) ; les autres agences : leurs initiales
    const logo = slug === "kamika-immobilier" ? "kamika/logo.png" : null;
    const { rows: [ag] } = await db.query("insert into public.agences (nom, slug, verifiee, logo) values ($1, $2, true, $3) returning id",
      [a.contact_nom, slug, logo]);
    await db.query("update public.profils set role = 'agence', agence_id = $2 where id = $1", [id, ag.id]);
  }
  auteurs.set(a.contact_nom, id);
  return id;
}

// ── Les annonces d'exemple ──
for (const a of ANNONCES) {
  const auteur = await auteurDe(a);
  const { rows: [lieu] } = await db.query(
    `select v.id as ville_id, c.id as commune_id, q.id as quartier_id
       from public.villes v join public.communes c on c.ville_id = v.id
       left join public.quartiers q on q.commune_id = c.id and q.nom = $3
      where v.nom = $1 and c.nom = $2`,
    [a.ville, a.commune, a.quartier ?? null],
  );
  if (!lieu || (a.quartier && !lieu.quartier_id)) throw new Error(`Lieu inconnu : ${a.ville}, ${a.commune}, ${a.quartier}`);
  const champs = {
    // identifiant tiré de la référence (IMM-2026-01017 → …-000000001017), connu des tests
    id: `00000000-0000-4000-8000-${a.reference.replace(/\D/g, "").slice(-12).padStart(12, "0")}`,
    reference: a.reference, auteur_id: auteur, statut: a.etat === "brouillon" ? "brouillon" : "publiee",
    transaction: a.transaction, type_bien: a.type_bien, titre: a.titre, description: a.description, prix: a.prix,
    loyer_par: a.loyer_par ?? null, caution_mois: a.caution_mois ?? null, ...lieu, quartier_texte: a.quartier_texte ?? null,
    adresse: a.adresse ?? null, surface: a.surface ?? null, pieces: a.pieces ?? null, studio: a.studio ?? false,
    chambres: a.chambres ?? null, sanitaires: a.sanitaires ?? null, meuble: a.meuble ?? false,
    dans_immeuble: a.dans_immeuble ?? false, etage: a.etage ?? null, commodites: a.commodites ?? [], disponibles: a.disponibles ?? 1,
    type_vendeur: a.type_vendeur, contact_nom: a.contact_nom, contact_telephone: a.contact_telephone,
    contact_whatsapp: a.contact_whatsapp ?? true, contact_telephone2: a.contact_telephone2 ?? null,
    contact_email: a.contact_email ?? null, premium: a.premium ?? false, verifiee: a.verifiee ?? false, vues: a.vues ?? 0,
  };
  const cles = Object.keys(champs);
  const { rows: [{ id }] } = await db.query(
    `insert into public.annonces (${cles.join(", ")}) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    cles.map((k) => champs[k]),
  );
  if (a.etat !== "brouillon") {
    // publiée il y a « jours » jours, pour 90 jours
    await db.query(
      `update public.annonces set publiee_le = now() - make_interval(days => $2::int),
                                  expire_le = now() - make_interval(days => $2::int) + public.duree_validite()
        where id = $1`,
      [id, a.jours ?? 0],
    );
  }
  for (const [i, format] of (a.photos ?? []).entries()) {
    await db.query("insert into public.photos_annonce (annonce_id, chemin, ordre) values ($1, $2, $3)",
      [id, `${id}/${i + 1}-${format}-${a.type_bien}.webp`, i]);
  }
}

// ── Annonces terminées ces derniers mois (archivées) : visibles nulle part, mais elles comptent pour les prix du marché
// (estimation, carte des prix, pages des communes : supabase/migrations/…_prix_marche.sql). Avec les annonces en ligne :
//   Cocody, appartement 3 pièces non meublé à louer : 7 annonces (prix du milieu 300 000 / mois) ; Riviera 2 seule : trop peu
//   Yopougon, appartement 2 pièces : 5 (100 000) · Plateau, 3 pièces : 5 (500 000) · Marcory, 2 pièces : 4 (trop peu)
//   Songon, terrain à vendre : 5 (50 000 / m²) · Cocody, villa 5 pièces à vendre : 5 (185 000 000)
const ancien = await auteurDe({ contact_nom: "Ancien Annonceur", contact_telephone: "+225 07 99 99 99 99", type_vendeur: "particulier" });
const appartement = (commune, quartier, pieces, prix) =>
  ({ commune, quartier, transaction: "location", type_bien: "appartement", prix, loyer_par: "mois", pieces, chambres: pieces - 1, dans_immeuble: true, etage: 1 });
const HISTORIQUE = [
  appartement("Cocody", "Riviera 2", 3, 250000), appartement("Cocody", "Riviera 2", 3, 300000),
  appartement("Cocody", "Angré", 3, 320000), appartement("Cocody", "Angré", 3, 350000),
  appartement("Cocody", "Deux-Plateaux", 3, 300000), appartement("Cocody", "Deux-Plateaux", 3, 400000),
  ...[90000, 100000, 100000, 110000].map((prix) => appartement("Yopougon", "Niangon", 2, prix)),
  ...[450000, 500000, 500000, 550000, 600000].map((prix) => appartement("Plateau", "Centre des affaires", 3, prix)),
  ...[150000, 170000, 180000, 200000].map((prix) => appartement("Marcory", "Zone 4", 2, prix)),
  ...[[20000000, 500], [27000000, 600], [22000000, 400], [36000000, 600]].map(([prix, surface]) =>
    ({ commune: "Songon", quartier: "Songon-Agban", transaction: "vente", type_bien: "terrain", prix, surface })),
  ...[150000000, 160000000, 200000000, 250000000].map((prix) =>
    ({ commune: "Cocody", quartier: "Angré", transaction: "vente", type_bien: "villa", prix, pieces: 5, chambres: 4 })),
];
for (const [i, h] of HISTORIQUE.entries()) {
  const { rows: [lieu] } = await db.query(
    `select v.id as ville_id, c.id as commune_id, q.id as quartier_id from public.villes v
       join public.communes c on c.ville_id = v.id and c.nom = $1 left join public.quartiers q on q.commune_id = c.id and q.nom = $2
      where v.nom = 'Abidjan'`, [h.commune, h.quartier]);
  const { commune, quartier, ...bien } = h;
  const champs = {
    auteur_id: ancien, statut: "archivee", titre: `Annonce terminée n° ${i + 1} — ${quartier}, ${commune}`, ...lieu, ...bien,
    type_vendeur: "particulier", contact_nom: "Ancien Annonceur", contact_telephone: "+225 07 99 99 99 99",
    publiee_le: new Date(Date.now() - (20 + i * 3) * 86400000).toISOString(),
  };
  const cles = Object.keys(champs);
  await db.query(`insert into public.annonces (${cles.join(", ")}) values (${cles.map((_, j) => `$${j + 1}`).join(", ")})`,
    cles.map((k) => champs[k]));
}

// ── Blog : 4 des premières versions publiées (les autres restent des brouillons, invisibles) ──
// (supabase/migrations/…_blog_premiers_articles.sql) ; le premier est à la une
for (const [i, slug] of ["acheter-un-terrain-les-verifications-avant-de-payer", "caution-avance-frais-d-agence-ce-que-vous-payez",
  "contrat-de-bail-ce-qu-il-doit-contenir", "arnaques-immobilieres-les-signes-qui-doivent-alerter"].entries()) {
  await db.query(`update public.articles set statut = 'publie', publie_le = now() - make_interval(days => $2), modifie_le = now() - make_interval(days => $2)
    where slug = $1`, [slug, 3 + i * 5]);
}

// ── Pages du site : 3 des premières versions publiées (celles qui n'ont pas de « [à compléter] ») ──
// (supabase/migrations/…_pages_premieres_versions.sql) ; les autres affichent « Page bientôt disponible »
await db.query(`update public.pages_site set statut = 'publie', publie_le = now() - interval '2 days', modifie_le = now() - interval '2 days'
  where slug in ('aide', 'devenir-partenaire', 'cookies')`);

// ── Une « photo » dessinée : ciel, sol et bâtiment selon le type de bien ──
const CIELS = [["#8EC5E8", "#E8F3FA"], ["#F6C98B", "#FBE9D0"], ["#A7D3C2", "#EAF6F1"], ["#C9B8E8", "#F1ECFA"]];
function photo(chemin) {
  const [, numero, format, type] = chemin.match(/(\d+)-(portrait|paysage)-(\w+)\.webp$/) ?? [null, "1", "paysage", "maison"];
  const [l, h] = format === "portrait" ? [900, 1200] : [1200, 900];
  const [c1, c2] = CIELS[Number(numero) % CIELS.length];
  const sol = h * 0.72;
  const x = l / 2;
  const dessins = {
    appartement: `<rect x="${x - 170}" y="${sol - 430}" width="340" height="430" fill="#E9E2D6"/>` +
      Array.from({ length: 12 }, (_, i) => `<rect x="${x - 140 + (i % 3) * 100}" y="${sol - 400 + Math.floor(i / 3) * 95}" width="70" height="55" fill="#5B8DB8"/>`).join(""),
    maison: `<rect x="${x - 200}" y="${sol - 220}" width="400" height="220" fill="#F3E3C3"/><polygon points="${x - 240},${sol - 220} ${x},${sol - 380} ${x + 240},${sol - 220}" fill="#B5543C"/><rect x="${x - 40}" y="${sol - 130}" width="80" height="130" fill="#6B4226"/>`,
    terrain: `<rect x="0" y="${sol - 20}" width="${l}" height="${h - sol + 20}" fill="#9CC46B"/>` +
      Array.from({ length: 9 }, (_, i) => `<rect x="${i * l / 8}" y="${sol - 70}" width="8" height="70" fill="#7A5A3A"/>`).join("") +
      `<rect x="0" y="${sol - 60}" width="${l}" height="6" fill="#7A5A3A"/>`,
    bureau: `<rect x="${x - 130}" y="${sol - 560}" width="260" height="560" fill="#B8C7D6"/>` +
      Array.from({ length: 14 }, (_, i) => `<rect x="${x - 115}" y="${sol - 540 + i * 38}" width="230" height="24" fill="#557A9A"/>`).join(""),
    commerce: `<rect x="${x - 230}" y="${sol - 260}" width="460" height="260" fill="#F4EDE2"/><rect x="${x - 250}" y="${sol - 290}" width="500" height="50" fill="#1B7A4A"/><rect x="${x - 190}" y="${sol - 200}" width="380" height="160" fill="#8EB8D8"/>`,
    immeuble: `<rect x="${x - 250}" y="${sol - 500}" width="500" height="500" fill="#E3D5C0"/>` +
      Array.from({ length: 20 }, (_, i) => `<rect x="${x - 220 + (i % 4) * 115}" y="${sol - 470 + Math.floor(i / 4) * 92}" width="75" height="55" fill="#5B8DB8"/>`).join(""),
    hotel: `<rect x="${x - 260}" y="${sol - 300}" width="520" height="300" fill="#F7F1E8"/><rect x="${x - 200}" y="${sol - 120}" width="400" height="90" fill="#FFFFFF" stroke="#C9A227" stroke-width="8"/><rect x="${x - 200}" y="${sol - 170}" width="120" height="50" fill="#EDE3F7"/>`,
  };
  dessins.villa = dessins.maison + `<rect x="${x + 230}" y="${sol + 30}" width="${Math.min(260, l / 2 - 250)}" height="90" fill="#3FA7D6"/>`;
  dessins.autres = dessins.maison;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}">
<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${l}" height="${h}" fill="url(#c)"/><rect y="${sol}" width="${l}" height="${h - sol}" fill="#C8B79A"/>
${dessins[type] ?? dessins.maison}
<text x="30" y="${h - 30}" font-family="sans-serif" font-size="44" fill="#fff" stroke="#0005" stroke-width="2">Photo ${numero} · ${format === "portrait" ? "en hauteur" : "en largeur"}</text>
</svg>`;
}

// ── Les demandes du site ──
const lire = (req) => new Promise((ok) => {
  let texte = "";
  req.on("data", (morceau) => (texte += morceau));
  req.on("end", () => ok(texte));
});
const json = (res, statut, donnees) => {
  res.writeHead(statut, { "Content-Type": "application/json" });
  res.end(JSON.stringify(donnees));
};

createServer(async (req, res) => {
  // Le navigateur (site sur un autre port) peut l'appeler
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url ?? "/", "http://base");
  if (req.method === "GET" && url.pathname === "/") return res.writeHead(200).end("Fausse base Supabase des tests : prête");

  const fichier = url.pathname.match(/^\/storage\/v1\/object\/public\/photos-annonces\/(.+)$/);
  if (req.method === "GET" && fichier) {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
    return res.end(photo(decodeURIComponent(fichier[1])));
  }

  if (req.method === "GET" && url.pathname.startsWith("/storage/v1/object/public/logos/")) {
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="36" fill="#0F5132"/>
<path d="M40 150 L120 70 L200 150 Z" fill="#C9A227"/><rect x="85" y="150" width="70" height="50" fill="#fff"/></svg>`);
  }

  const fonction = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
  if (req.method === "POST" && fonction) {
    const args = JSON.parse((await lire(req)) || "{}");
    // Pannes simulées (tests/pannes.spec.ts) : la base ne répond pas pour la fiche IMM-2026-77777, la vitrine « panne1 »,
    // l'article « article-en-panne » ni les prix de Grand-Bassam
    if ((fonction === "annonce_publique" && String(args.numero).toUpperCase() === "IMM-2026-77777")
        || (fonction === "vitrine" && args.code === "panne1")
        || (fonction === "blog_article" && args.adresse === "article-en-panne")
        || (fonction === "prix_commune" && args.commune === "Grand-Bassam")) {
      return json(res, 503, { code: "PGRST000", message: "Base momentanément injoignable (panne simulée)", details: null, hint: null });
    }
    const noms = Object.keys(args).filter((n) => /^[a-z_]+$/.test(n));
    const sql = `select public.${fonction}(${noms.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`;
    const cleSecrete = req.headers.apikey === CLE_SECRETE || req.headers.authorization === `Bearer ${CLE_SECRETE}`;
    try {
      const r = await db.transaction(async (tx) => {
        await tx.exec(cleSecrete ? "set local role service_role" : "set local role anon");   // serveur du site, ou visiteur sans compte
        // une liste (uuid[]…) passe telle quelle ; un objet (jsonb) en texte
        return tx.query(sql, noms.map((n) => (Array.isArray(args[n]) || typeof args[n] !== "object" || args[n] === null ? args[n] : JSON.stringify(args[n]))));
      });
      return json(res, 200, r.rows[0]?.r ?? null);
    } catch (e) {
      return json(res, 400, { code: e.code ?? "XX000", message: e.message, details: null, hint: null });
    }
  }
  json(res, 404, { code: "PGRST404", message: `Pas prévu dans la fausse base : ${req.method} ${url.pathname}` });
}).listen(PORT, "127.0.0.1", () => console.log(`Fausse base Supabase des tests : http://127.0.0.1:${PORT}`));
