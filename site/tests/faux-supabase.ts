// Fausse base Supabase pour les tests des comptes : le navigateur croit parler à Supabase, mais chaque
// demande (inscription, connexion, profil…) reçoit ici une réponse, sans internet ni vraie base.
// Le site des tests est construit avec NEXT_PUBLIC_SUPABASE_URL=http://supabase.test (voir .github/workflows).
// Le profil créé à l'inscription suit les mêmes règles que la base (supabase/migrations : creer_profil).
// Annonces, photos et lieux : petite imitation de la base (droits de l'auteur, 20 photos, nouvelle vérification
// d'une annonce en ligne qui change beaucoup, renouvellement) ; fichiers des photos : stockage imité.
import type { Page } from "@playwright/test";
import { QUARTIERS, VILLES_COMMUNES } from "../lib/lieux";

type Ligne = Record<string, unknown>;

/** Villes, communes et quartiers du site, numérotés dans l'ordre (comme les données de référence) */
function lieux() {
  const villes: Ligne[] = [], communes: Ligne[] = [], quartiers: Ligne[] = [];
  const idVille = new Map<string, number>();
  for (const [v, c] of VILLES_COMMUNES) {
    if (!idVille.has(v)) {
      idVille.set(v, idVille.size + 1);
      villes.push({ id: idVille.get(v), nom: v });
    }
    communes.push({ id: communes.length + 1, ville_id: idVille.get(v), nom: c });
  }
  for (const [v, parCommune] of Object.entries(QUARTIERS)) {
    for (const [c, liste] of Object.entries(parCommune)) {
      const commune = communes.find((x) => x.nom === c && x.ville_id === idVille.get(v));
      for (const q of commune ? liste : []) quartiers.push({ id: quartiers.length + 1, commune_id: commune!.id, nom: q });
    }
  }
  return { villes, communes, quartiers };
}

/** Filtres de l'adresse (?id=eq.…, ?id=in.(…), ?order=…) comme PostgREST */
function filtrer(lignes: Ligne[], params: URLSearchParams): Ligne[] {
  let r = lignes;
  for (const [cle, val] of params) {
    const m = val.match(/^(eq|neq|in|is)\.(.*)$/);
    if (!m || ["select", "order", "limit", "offset", "columns"].includes(cle)) continue;
    const [, op, v] = m;
    if (op === "eq") r = r.filter((l) => String(l[cle]) === v);
    else if (op === "neq") r = r.filter((l) => String(l[cle]) !== v);
    else if (op === "is") r = r.filter((l) => (v === "null" ? l[cle] == null : String(l[cle]) === v));
    else {
      const liste = v.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      r = r.filter((l) => liste.includes(String(l[cle])));
    }
  }
  const ordre = params.get("order");
  if (ordre) {
    const [col, sens] = ordre.split(".");
    r = [...r].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (sens === "desc" ? -1 : 1));
  }
  return r;
}

// Image renvoyée pour toute photo du stockage (1 × 1 pixel)
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

export type Compte = { id: string; email: string; motDePasse: string; metadonnees: Record<string, unknown> };

export type FauxSupabase = {
  comptes: Compte[];
  profils: Map<string, Record<string, unknown>>;
  /** toutes les demandes reçues (chemin, méthode, contenu), pour vérifier ce que le site envoie */
  demandes: { chemin: string; methode: string; corps: Record<string, unknown> | null; adresse: string }[];
  /** ajoute un compte déjà inscrit ; renvoie son identifiant */
  inscrit: (email: string, motDePasse: string, metadonnees?: Record<string, unknown>) => string;
  annonces: Ligne[];
  photos: Ligne[];
  /** fichiers envoyés dans le stockage des photos (chemin → taille en octets) */
  fichiers: Map<string, number>;
  lieux: ReturnType<typeof lieux>;
  /** ajoute une annonce (d'un compte déjà inscrit) ; renvoie la ligne */
  annonce: (auteur: string, champs?: Ligne) => Ligne;
};

const base64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

export async function fauxSupabase(page: Page): Promise<FauxSupabase> {
  let numero = 0;
  const f: FauxSupabase = {
    comptes: [],
    profils: new Map(),
    demandes: [],
    annonces: [],
    photos: [],
    fichiers: new Map(),
    lieux: lieux(),
    annonce(auteur, champs = {}) {
      const maintenant = new Date().toISOString();
      const ligne: Ligne = {
        id: crypto.randomUUID(), reference: `IMM-2026-${String(++numero).padStart(5, "0")}`, auteur_id: auteur,
        statut: "brouillon", motif_refus: null, transaction: "location", type_bien: "appartement", titre: "Appartement à louer",
        description: "", prix: 100000, loyer_par: "mois", caution_mois: 2, ville_id: 2, commune_id: 2, quartier_id: null,
        quartier_texte: null, adresse: null, surface: null, pieces: null, studio: false, chambres: null, sanitaires: null,
        meuble: false, dans_immeuble: true, etage: null, commodites: [], type_vendeur: "particulier", contact_nom: null,
        contact_telephone: null, contact_telephone2: null, contact_whatsapp: true, contact_telephone2_whatsapp: false,
        contact_email: null, vues: 0, publiee_le: null, expire_le: null, cree_le: maintenant, modifie_le: maintenant,
        ...champs,
      };
      f.annonces.push(ligne);
      return ligne;
    },
    inscrit(email, motDePasse, metadonnees = {}) {
      const id = `00000000-0000-4000-8000-${String(f.comptes.length + 1).padStart(12, "0")}`;
      f.comptes.push({ id, email, motDePasse, metadonnees });
      const m = metadonnees as Record<string, string | boolean | undefined>;
      const agence = typeof m.agence === "string" && m.agence.trim() ? m.agence.trim() : null;
      f.profils.set(id, {
        id, prenom: m.prenom ?? "", nom: m.nom ?? "", telephone: m.telephone ?? null, telephone2: m.telephone2 ?? null,
        telephone_whatsapp: m.whatsapp ?? true, telephone2_whatsapp: m.whatsapp2 ?? false,
        telephone2_type: m.telephone2_type ?? "mobile", role: "particulier", agence_id: null,
        demande_agence: agence, demande_agence_le: agence ? new Date().toISOString() : null,
        cree_le: new Date().toISOString(), modifie_le: new Date().toISOString(),
      });
      return id;
    },
  };

  const utilisateur = (c: Compte) => ({
    id: c.id, aud: "authenticated", role: "authenticated", email: c.email, phone: "",
    email_confirmed_at: "2026-01-01T00:00:00Z", confirmed_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: c.metadonnees, identities: [], created_at: "2026-01-01T00:00:00Z",
    updated_at: new Date().toISOString(), is_anonymous: false,
  });
  const session = (c: Compte) => {
    const maintenant = Math.floor(Date.now() / 1000);
    const jeton = [
      base64url({ alg: "HS256", typ: "JWT" }),
      base64url({ sub: c.id, email: c.email, role: "authenticated", aud: "authenticated", iat: maintenant, exp: maintenant + 3600 }),
      "signature",
    ].join(".");
    return {
      access_token: jeton, token_type: "bearer", expires_in: 3600, expires_at: maintenant + 3600,
      refresh_token: `rafraichir-${c.id}`, user: utilisateur(c),
    };
  };
  const compteDuJeton = (entete: string | undefined) => {
    const jeton = entete?.replace(/^Bearer /, "") ?? "";
    try {
      const sub = JSON.parse(Buffer.from(jeton.split(".")[1], "base64url").toString()).sub;
      return f.comptes.find((c) => c.id === sub);
    } catch {
      return undefined;
    }
  };
  const erreur = (statut: number, code: string, msg: string) => ({
    status: statut, contentType: "application/json", body: JSON.stringify({ code: statut, error_code: code, msg }),
  });

  // Annonce avec ses photos et les noms de son lieu (comme select=*, photos_annonce(…), villes(nom)…)
  const enrichir = (a: Ligne) => ({
    ...a,
    photos_annonce: f.photos.filter((p) => p.annonce_id === a.id).map(({ id, chemin, ordre }) => ({ id, chemin, ordre })),
    villes: f.lieux.villes.find((v) => v.id === a.ville_id) ?? null,
    communes: f.lieux.communes.find((c) => c.id === a.commune_id) ?? null,
    quartiers: f.lieux.quartiers.find((q) => q.id === a.quartier_id) ?? null,
  });

  await page.route(/\/(auth|rest|storage)\/v1\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let corps: Record<string, unknown> | null = null;
    try {
      corps = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    } catch {
      corps = null; // envoi de fichier (photo)
    }
    f.demandes.push({ chemin: url.pathname, methode: req.method(), corps, adresse: req.url() });
    const json = (donnees: unknown, statut = 200) =>
      route.fulfill({ status: statut, contentType: "application/json", body: JSON.stringify(donnees) });
    const moi = compteDuJeton(req.headers()["authorization"]);

    switch (`${req.method()} ${url.pathname}`) {
      case "POST /auth/v1/signup": {
        const email = String(corps!.email).toLowerCase();
        if (f.comptes.some((c) => c.email === email)) return route.fulfill(erreur(422, "user_already_exists", "User already registered"));
        const id = f.inscrit(email, String(corps!.password), (corps!.data as Record<string, unknown>) ?? {});
        return json(session(f.comptes.find((c) => c.id === id)!));
      }
      case "POST /auth/v1/token": {
        if (url.searchParams.get("grant_type") === "refresh_token") {
          const c = f.comptes.find((x) => `rafraichir-${x.id}` === corps!.refresh_token);
          return c ? json(session(c)) : route.fulfill(erreur(400, "refresh_token_not_found", "Invalid Refresh Token"));
        }
        const c = f.comptes.find((x) => x.email === String(corps!.email).toLowerCase() && x.motDePasse === corps!.password);
        return c ? json(session(c)) : route.fulfill(erreur(400, "invalid_credentials", "Invalid login credentials"));
      }
      case "GET /auth/v1/user":
        return moi ? json(utilisateur(moi)) : route.fulfill(erreur(401, "no_authorization", "Unauthorized"));
      case "PUT /auth/v1/user":
        if (!moi) return route.fulfill(erreur(401, "no_authorization", "Unauthorized"));
        if (corps?.password) moi.motDePasse = String(corps.password);
        return json(utilisateur(moi));
      case "POST /auth/v1/logout":
        return route.fulfill({ status: 204 });
      case "POST /auth/v1/recover":
        return json({});
      case "GET /rest/v1/profils":
      case "PATCH /rest/v1/profils": {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? "";
        const p = moi && moi.id === id ? f.profils.get(id) : undefined; // chacun ne voit que son profil
        if (p && req.method() === "PATCH") {
          Object.assign(p, corps);
          if (corps && "demande_agence" in corps) p.demande_agence_le = corps.demande_agence ? new Date().toISOString() : null;
        }
        const seul = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
        if (seul && !p) return json({ code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
        return json(seul ? p : p ? [p] : []);
      }
    }

    // ── Stockage des photos ──
    const fichier = url.pathname.match(/^\/storage\/v1\/object\/(public\/)?photos-annonces\/?(.*)$/);
    if (fichier) {
      const [, public_, chemin] = fichier;
      if (req.method() === "GET" && public_) return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
      if (req.method() === "POST" && chemin) {
        if (!moi || !f.annonces.some((a) => a.id === chemin.split("/")[0] && a.auteur_id === moi.id)) {
          return json({ statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }, 403);
        }
        f.fichiers.set(chemin, req.postDataBuffer()?.length ?? 0);
        return json({ Key: `photos-annonces/${chemin}`, Id: crypto.randomUUID() });
      }
      if (req.method() === "DELETE") {
        const chemins = (corps?.prefixes as string[]) ?? [];
        chemins.forEach((c) => f.fichiers.delete(c));
        return json(chemins.map((name) => ({ name })));
      }
    }

    // ── Tables : annonces, photos, lieux ──
    const table = url.pathname.match(/^\/rest\/v1\/(annonces|photos_annonce|villes|communes|quartiers)$/)?.[1];
    const unSeul = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const repondre = (lignes: Ligne[], statut = 200) => {
      const sortie = table === "annonces" ? lignes.map(enrichir) : lignes;
      if (unSeul && sortie.length !== 1) return json({ code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
      return json(unSeul ? sortie[0] : sortie, statut);
    };
    const visible = (a: Ligne) => a.auteur_id === moi?.id || a.statut === "publiee";
    const annonceDe = (p: Ligne) => f.annonces.find((a) => a.id === p.annonce_id);
    const aMoi = (a: Ligne | undefined) => !!a && !!moi && a.auteur_id === moi.id;
    const maintenant = () => new Date().toISOString();
    if (table === "villes" || table === "communes" || table === "quartiers") return repondre(filtrer(f.lieux[table], url.searchParams));
    if (table === "annonces") {
      if (req.method() === "GET") return repondre(filtrer(f.annonces.filter(visible), url.searchParams));
      if (!moi) return route.fulfill(erreur(401, "no_authorization", "Unauthorized"));
      if (req.method() === "POST") return repondre([f.annonce(moi.id, { ...corps, auteur_id: moi.id })], 201);
      const lignes = filtrer(f.annonces.filter(aMoi), url.searchParams);
      if (req.method() === "PATCH") {
        for (const a of lignes) {
          const avant = { ...a };
          Object.assign(a, corps, { modifie_le: maintenant() });
          // Annonce en ligne qui change beaucoup : nouvelle vérification (comme annonces_controler)
          const gros = ["transaction", "type_bien", "commune_id", "quartier_id", "quartier_texte"].some((k) => a[k] !== avant[k]) ||
            Math.abs(Number(a.prix) - Number(avant.prix)) * 5 > Number(avant.prix);
          if (avant.statut === "publiee" && a.statut === "publiee" && gros) a.statut = "en_attente";
        }
        return repondre(lignes);
      }
      if (req.method() === "DELETE") {
        const ids = new Set(lignes.map((a) => a.id));
        f.annonces.splice(0, f.annonces.length, ...f.annonces.filter((a) => !ids.has(a.id)));
        f.photos.splice(0, f.photos.length, ...f.photos.filter((p) => !ids.has(p.annonce_id)));
        return repondre(lignes);
      }
    }
    if (table === "photos_annonce") {
      if (req.method() === "GET") return repondre(filtrer(f.photos.filter((p) => { const a = annonceDe(p); return !!a && visible(a); }), url.searchParams));
      if (req.method() === "POST") {
        const a = f.annonces.find((x) => x.id === corps?.annonce_id);
        if (!aMoi(a)) return json({ code: "42501", message: "new row violates row-level security policy for table \"photos_annonce\"" }, 403);
        if (f.photos.filter((p) => p.annonce_id === a!.id).length >= 20) return json({ code: "23514", message: "20 photos au plus par annonce." }, 400);
        const p = { id: crypto.randomUUID(), cree_le: maintenant(), ...corps };
        f.photos.push(p);
        if (a!.statut === "publiee") a!.statut = "en_attente";
        return repondre([p], 201);
      }
      const lignes = filtrer(f.photos.filter((p) => aMoi(annonceDe(p))), url.searchParams);
      if (req.method() === "PATCH") {
        lignes.forEach((p) => Object.assign(p, corps));
        return repondre(lignes);
      }
      if (req.method() === "DELETE") {
        const ids = new Set(lignes.map((p) => p.id));
        f.photos.splice(0, f.photos.length, ...f.photos.filter((p) => !ids.has(p.id)));
        return repondre(lignes);
      }
    }
    if (req.method() === "POST" && url.pathname === "/rest/v1/rpc/renouveler_annonce") {
      const a = f.annonces.find((x) => x.id === corps?.annonce);
      const bientot = a?.expire_le && new Date(a.expire_le as string).getTime() < Date.now() + 15 * 86_400_000;
      if (!aMoi(a) || a!.statut !== "publiee" || !bientot) {
        return json({ code: "23514", message: "Cette annonce ne peut pas encore être renouvelée : c'est possible dans ses 15 derniers jours, ou une fois expirée." }, 400);
      }
      a!.expire_le = new Date(Date.now() + 90 * 86_400_000).toISOString();
      return json(a!.expire_le);
    }
    return route.fulfill(erreur(404, "not_found", `Pas prévu dans la fausse base : ${req.method()} ${url.pathname}`));
  });
  return f;
}
