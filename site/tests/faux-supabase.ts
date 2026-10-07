// Fausse base Supabase pour les tests des comptes : le navigateur croit parler à Supabase, mais chaque
// demande (inscription, connexion, profil…) reçoit ici une réponse, sans internet ni vraie base.
// Le site des tests est construit avec l'adresse de la fausse base tests/base/serveur.mjs (voir .github/workflows) :
// ce qui n'est pas simulé ici (annonces d'exemple, numéro sur demande, vues) lui est transmis.
// Le profil créé à l'inscription suit les mêmes règles que la base (supabase/migrations : creer_profil).
// Annonces, photos et lieux : petite imitation de la base (droits de l'auteur, 20 photos, nouvelle vérification
// d'une annonce en ligne qui change beaucoup, renouvellement) ; fichiers des photos : stockage imité.
// Favoris, conversations et messages : imités ici aussi (mêmes règles que supabase/migrations/…_favoris_messages.sql) ;
// les cartes des annonces d'exemple (favoris, conversations) viennent de la fausse base des annonces.
// Demandes de visite : imitées ici (mêmes règles que supabase/migrations/…_visites.sql), avec ou sans compte.
// Alertes de recherche : imitées ici (10 par compte, pas deux fois la même, lien « Arrêter cette alerte » par jeton).
// « Être rappelé » : imité ici (mêmes règles que supabase/migrations/…_rappels.sql), avec ou sans compte.
import type { Page } from "@playwright/test";
import { QUARTIERS, VILLES_COMMUNES } from "../lib/lieux";

const BASE_ANNONCES = "http://127.0.0.1:54329";

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

/** Le fichier d'un envoi « multipart » (comme le fait supabase-js pour une photo) */
function fichierEnvoye(corps: Buffer, entete: string): { type: string; contenu: Buffer } {
  const limite = entete.match(/boundary=(.+)$/)?.[1];
  if (!limite) return { type: entete, contenu: corps };
  for (const partie of corps.toString("latin1").split(`--${limite}`)) {
    const type = partie.match(/Content-Type: (image\/[\w.+-]+)/i)?.[1];
    const debut = partie.indexOf("\r\n\r\n");
    if (type && debut >= 0) return { type, contenu: Buffer.from(partie.slice(debut + 4, partie.lastIndexOf("\r\n")), "latin1") };
  }
  return { type: "application/octet-stream", contenu: Buffer.alloc(0) };
}

// Image renvoyée pour une photo absente du stockage imité (1 × 1 pixel)
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
  /** fichiers envoyés dans le stockage des photos (chemin → image et son type) */
  fichiers: Map<string, { type: string; contenu: Buffer }>;
  lieux: ReturnType<typeof lieux>;
  /** ajoute une annonce (d'un compte déjà inscrit) ; renvoie la ligne */
  annonce: (auteur: string, champs?: Ligne) => Ligne;
  favoris: { profil_id: string; annonce_id: string; cree_le: string }[];
  conversations: Ligne[];
  messages: Ligne[];
  /** ouvre une conversation (sans passer par le site) : annonce, client, annonceur ; renvoie la ligne */
  conversation: (annonce: string, client: string, annonceur: string) => Ligne;
  /** ajoute un message à une conversation ; renvoie la ligne */
  message: (conversation: string, auteur: string, contenu: string, champs?: Ligne) => Ligne;
  visites: Ligne[];
  /** ajoute une demande de visite (sans passer par le site) ; renvoie la ligne */
  visite: (annonce: string, champs?: Ligne) => Ligne;
  alertes: Ligne[];
  /** ajoute une alerte à un compte (sans passer par le site) ; renvoie la ligne */
  alerte: (profil: string, champs?: Ligne) => Ligne;
  rappels: Ligne[];
  /** ajoute une demande de rappel (sans passer par le site) ; renvoie la ligne */
  rappel: (annonce: string, champs?: Ligne) => Ligne;
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
    favoris: [],
    conversations: [],
    messages: [],
    visites: [],
    alertes: [],
    rappels: [],
    rappel(annonce, champs = {}) {
      const r: Ligne = {
        id: crypto.randomUUID(), annonce_id: annonce, demandeur_id: null, nom: "Visiteur", telephone: "+225 01 02 03 04 05",
        moment: "vite", message: null, statut: "a_rappeler", cree_le: new Date().toISOString(), traite_le: null, ...champs,
      };
      f.rappels.push(r);
      return r;
    },
    alerte(profil, champs = {}) {
      const a: Ligne = {
        id: crypto.randomUUID(), profil_id: profil, nom: "Appartements à louer à Cocody", adresse: "/annonces?tx=location&type=appartement&q=Cocody",
        criteres: { tx: "location", types: ["appartement"], ville: "Abidjan", commune: "Cocody" }, frequence: "quotidienne", active: true,
        jeton: crypto.randomUUID(), cree_le: new Date().toISOString(), verifiee_le: new Date().toISOString(), dernier_envoi: null, ...champs,
      };
      f.alertes.push(a);
      return a;
    },
    visite(annonce, champs = {}) {
      const apresDemain = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const v: Ligne = {
        id: crypto.randomUUID(), annonce_id: annonce, demandeur_id: null, nom: "Visiteur", telephone: "+225 01 02 03 04 05",
        email: null, message: null, creneau: `${apresDemain}T09:00:00.000Z`, creneau_propose: null, statut: "demandee",
        reponse: null, annulee_par: null, cree_le: new Date().toISOString(), modifie_le: new Date().toISOString(), ...champs,
      };
      f.visites.push(v);
      return v;
    },
    conversation(annonce, client, annonceur) {
      const c: Ligne = { id: crypto.randomUUID(), annonce_id: annonce, client_id: client, annonceur_id: annonceur, cree_le: new Date().toISOString(), dernier_message_le: null };
      f.conversations.push(c);
      return c;
    },
    message(conversation, auteur, contenu, champs = {}) {
      const m: Ligne = { id: crypto.randomUUID(), conversation_id: conversation, auteur_id: auteur, contenu, lu_le: null, cree_le: new Date().toISOString(), ...champs };
      f.messages.push(m);
      const c = f.conversations.find((x) => x.id === conversation);
      if (c) c.dernier_message_le = m.cree_le;
      return m;
    },
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
        code_vitrine: `c${id.slice(-5)}`, cree_le: new Date().toISOString(), modifie_le: new Date().toISOString(),
        emails_messages: true, emails_visites: true, emails_annonces: true,
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
      if (req.method() === "GET" && public_) {
        const envoye = f.fichiers.get(chemin);
        // photo d'une annonce d'exemple : celle de la fausse base (tests/base/serveur.mjs)
        if (!envoye && !f.annonces.some((a) => a.id === chemin.split("/")[0])) return route.fallback();
        return route.fulfill({ status: 200, contentType: envoye?.type ?? "image/png", body: envoye?.contenu ?? PIXEL });
      }
      if (req.method() === "POST" && chemin) {
        if (!moi || !f.annonces.some((a) => a.id === chemin.split("/")[0] && a.auteur_id === moi.id)) {
          return json({ statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }, 403);
        }
        f.fichiers.set(chemin, fichierEnvoye(req.postDataBuffer() ?? Buffer.alloc(0), req.headers()["content-type"] ?? ""));
        return json({ Key: `photos-annonces/${chemin}`, Id: crypto.randomUUID() });
      }
      if (req.method() === "DELETE") {
        const chemins = (corps?.prefixes as string[]) ?? [];
        chemins.forEach((c) => f.fichiers.delete(c));
        return json(chemins.map((name) => ({ name })));
      }
    }

    // ── Favoris : chacun les siens ──
    if (url.pathname === "/rest/v1/favoris") {
      if (!moi) return json({ code: "42501", message: "permission denied for table favoris" }, 401);
      const miens = () => f.favoris.filter((x) => x.profil_id === moi.id);
      if (req.method() === "GET") return json([...miens()].sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1)).map(({ annonce_id }) => ({ annonce_id })));
      if (req.method() === "POST") {
        const annonce = String(corps?.annonce_id);
        if (miens().some((x) => x.annonce_id === annonce)) return json({ code: "23505", message: "duplicate key value violates unique constraint \"favoris_pkey\"" }, 409);
        f.favoris.push({ profil_id: moi.id, annonce_id: annonce, cree_le: new Date().toISOString() });
        return route.fulfill({ status: 201 });
      }
      if (req.method() === "DELETE") {
        const annonce = url.searchParams.get("annonce_id")?.replace(/^eq\./, "");
        f.favoris.splice(0, f.favoris.length, ...f.favoris.filter((x) => !(x.profil_id === moi.id && x.annonce_id === annonce)));
        return route.fulfill({ status: 204 });
      }
    }

    // Nom discret d'un compte (« Jean K. ») ; cartes des annonces d'exemple (fausse base des annonces)
    const nomDe = (compte: unknown) => {
      const p = f.profils.get(String(compte));
      return p ? `${p.prenom} ${String(p.nom).charAt(0).toUpperCase()}.` : null;
    };
    const cartesExternes = async (ids: string[]): Promise<Ligne[]> => {
      const externes = [...new Set(ids)].filter((id) => !f.annonces.some((a) => a.id === id));
      const lues: unknown = externes.length
        ? await (await fetch(`${BASE_ANNONCES}/rest/v1/rpc/cartes_annonces`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: externes }) })).json()
        : [];
      return Array.isArray(lues) ? lues : [];
    };
    const photoDe = (annonce: unknown) => f.photos.filter((p) => p.annonce_id === annonce).sort((a, b) => Number(a.ordre) - Number(b.ordre))[0]?.chemin ?? null;

    // ── Conversations et messages : seulement leurs deux participants ──
    const participe = (c: Ligne | undefined) => !!c && !!moi && (c.client_id === moi.id || c.annonceur_id === moi.id);
    const conversationDe = (id: unknown) => f.conversations.find((c) => c.id === id);
    const contenuValide = (t: unknown) => typeof t === "string" && t.trim().length >= 1 && t.trim().length <= 2000;
    const refusContenu = () => json({ code: "23514", message: "new row for relation \"messages\" violates check constraint \"messages_contenu_check\"" }, 400);
    if (url.pathname.startsWith("/rest/v1/rpc/") && ["ecrire_annonceur", "mes_conversations", "marquer_lus"].includes(url.pathname.slice(13))) {
      if (!moi) return json({ code: "42501", message: "permission denied for function" }, 401);
      const fonction = url.pathname.slice(13);
      if (fonction === "ecrire_annonceur") {
        const annonce = String(corps?.annonce);
        const locale = f.annonces.find((a) => a.id === annonce);
        if (locale?.auteur_id === moi.id) return json({ code: "P0001", message: "C'est votre annonce : vous ne pouvez pas vous écrire." }, 400);
        if (!contenuValide(corps?.contenu)) return refusContenu();
        const c = f.conversations.find((x) => x.annonce_id === annonce && x.client_id === moi.id)
          ?? f.conversation(annonce, moi.id, String(locale?.auteur_id ?? "annonceur-externe"));
        f.message(String(c.id), moi.id, String(corps!.contenu).trim());
        return json(c.id);
      }
      if (fonction === "marquer_lus") {
        const c = conversationDe(corps?.conversation);
        const lus = participe(c) ? f.messages.filter((m) => m.conversation_id === c!.id && m.auteur_id !== moi.id && !m.lu_le) : [];
        lus.forEach((m) => (m.lu_le = new Date().toISOString()));
        return json(lus.length);
      }
      // mes_conversations : comme la base (nom discret de l'autre, dernier message, non lus), la plus récente d'abord
      const miennes = f.conversations.filter(participe);
      const cartes = await cartesExternes(miennes.map((c) => String(c.annonce_id)));
      const liste = miennes.map((c) => {
        const locale = f.annonces.find((a) => a.id === c.annonce_id);
        const carte = cartes.find((x) => x.id === c.annonce_id);
        const photo = locale ? photoDe(locale.id) : (carte?.photo ?? null);
        const annonce = locale
          ? { id: locale.id, reference: locale.reference, titre: locale.titre, photo, en_ligne: locale.statut === "publiee" }
          : { id: c.annonce_id, reference: carte?.reference, titre: carte?.titre, photo, en_ligne: carte?.en_ligne === true };
        const client = c.client_id === moi.id;
        const fil = f.messages.filter((m) => m.conversation_id === c.id).sort((a, b) => (a.cree_le! < b.cree_le! ? -1 : 1));
        const dernier = fil.at(-1);
        return { quand: String(c.dernier_message_le ?? c.cree_le), ligne: {
          id: c.id, role: client ? "client" : "annonceur", annonce,
          autre: nomDe(client ? c.annonceur_id : c.client_id) ?? (carte?.contact_nom as string | undefined) ?? "Annonceur",
          dernier: dernier ? { contenu: String(dernier.contenu).slice(0, 140), cree_le: dernier.cree_le, de_moi: dernier.auteur_id === moi.id } : null,
          non_lus: fil.filter((m) => m.auteur_id !== moi.id && !m.lu_le).length,
        } };
      });
      return json(liste.sort((a, b) => (a.quand < b.quand ? 1 : -1)).map((x) => x.ligne));
    }
    if (url.pathname === "/rest/v1/messages") {
      if (!moi) return json({ code: "42501", message: "permission denied for table messages" }, 401);
      if (req.method() === "GET") {
        const c = conversationDe(url.searchParams.get("conversation_id")?.replace(/^eq\./, ""));
        const fil = participe(c) ? f.messages.filter((m) => m.conversation_id === c!.id) : [];
        return json([...fil].sort((a, b) => (a.cree_le! < b.cree_le! ? -1 : 1)).map(({ id, auteur_id, contenu, lu_le, cree_le }) => ({ id, auteur_id, contenu, lu_le, cree_le })));
      }
      if (req.method() === "POST") {
        const c = conversationDe(corps?.conversation_id);
        if (!participe(c)) return json({ code: "42501", message: "new row violates row-level security policy for table \"messages\"" }, 403);
        if (!contenuValide(corps?.contenu)) return refusContenu();
        f.message(String(c!.id), moi.id, String(corps!.contenu).trim());
        return route.fulfill({ status: 201 });
      }
    }

    // ── Demandes de visite : avec ou sans compte ; réponses par repondre_visite ──
    const auteurDe = (v: Ligne) => f.annonces.find((a) => a.id === v.annonce_id)?.auteur_id;
    const aVenir = (v: Ligne) => new Date(String(v.creneau)).getTime() > Date.now();
    const dansLesTemps = (iso: unknown) => {
      const t = new Date(String(iso)).getTime();
      return t >= Date.now() + 3_600_000 && t <= Date.now() + 60 * 86_400_000;
    };
    const refusVisite = (message: string) => json({ code: "P0001", message }, 400);
    const contrainteVisite = (nom: string) => json({ code: "23514", message: `new row for relation "visites" violates check constraint "${nom}"` }, 400);
    if (url.pathname === "/rest/v1/visites" && req.method() === "POST") {
      const d = corps ?? {};
      const annonce = String(d.annonce_id);
      const locale = f.annonces.find((a) => a.id === annonce);
      if (locale && locale.statut !== "publiee") return refusVisite("Cette annonce n'est plus en ligne.");
      if (locale && moi && locale.auteur_id === moi.id) return refusVisite("C'est votre annonce : vous ne pouvez pas demander à la visiter.");
      if (!dansLesTemps(d.creneau)) return refusVisite("Choisissez un créneau à venir, dans les 60 prochains jours.");
      const nom = String(d.nom ?? "").trim();
      if (nom.length < 2 || nom.length > 80) return contrainteVisite("visites_nom_check");
      if (!/^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$/.test(String(d.telephone))) return contrainteVisite("visites_telephone_format");
      if (d.email != null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email))) return contrainteVisite("visites_email_format");
      const memeNumero = f.visites.filter((v) => v.telephone === d.telephone);
      if (memeNumero.filter((v) => Date.now() - new Date(String(v.cree_le)).getTime() < 86_400_000).length >= 5) {
        return refusVisite("Vous avez déjà demandé beaucoup de visites aujourd'hui : réessayez demain.");
      }
      if (memeNumero.some((v) => v.annonce_id === annonce && ["demandee", "confirmee"].includes(String(v.statut)) && aVenir(v))) {
        return refusVisite("Vous avez déjà une demande de visite en cours pour ce bien.");
      }
      f.visite(annonce, {
        demandeur_id: moi?.id ?? null, nom, telephone: d.telephone, email: String(d.email ?? "").trim() || null,
        message: String(d.message ?? "").trim() || null, creneau: new Date(String(d.creneau)).toISOString(),
      });
      return route.fulfill({ status: 201 });
    }
    if (req.method() === "POST" && url.pathname === "/rest/v1/rpc/creneaux_pris") {
      const pris = f.visites.filter((v) => v.annonce_id === corps?.annonce && v.statut === "confirmee" && aVenir(v));
      return json(pris.map((v) => String(v.creneau).replace(".000Z", "+00:00")).sort()); // écrit comme par la base
    }
    if (req.method() === "POST" && ["/rest/v1/rpc/mes_visites", "/rest/v1/rpc/repondre_visite", "/rest/v1/rpc/compteurs"].includes(url.pathname)) {
      if (!moi) return json({ code: "42501", message: "permission denied for function" }, 401);
      const fonction = url.pathname.slice(13);
      if (fonction === "compteurs") {
        const messages = f.messages.filter((m) => {
          const c = f.conversations.find((x) => x.id === m.conversation_id);
          return !!c && (c.client_id === moi.id || c.annonceur_id === moi.id) && m.auteur_id !== moi.id && !m.lu_le;
        }).length;
        const visites = f.visites.filter((v) => v.statut === "demandee" && aVenir(v) &&
          ((auteurDe(v) === moi.id && !v.creneau_propose) || (v.demandeur_id === moi.id && !!v.creneau_propose))).length;
        const rappels = f.rappels.filter((r) => r.statut === "a_rappeler" && auteurDe(r) === moi.id).length;
        return json({ messages, visites, rappels });
      }
      if (fonction === "repondre_visite") {
        const v = f.visites.find((x) => x.id === corps?.visite);
        if (!v) return refusVisite("Demande de visite introuvable.");
        const annonceur = auteurDe(v) === moi.id;
        const demandeur = v.demandeur_id === moi.id;
        if (!annonceur && !demandeur) return json({ code: "42501", message: "Action non autorisée pour ce compte." }, 403);
        const le = corps?.le_creneau ? new Date(String(corps.le_creneau)).toISOString() : null;
        const mot = String(corps?.la_reponse ?? "").trim() || null;
        if (mot && mot.length > 500) return refusVisite("Votre réponse fait 500 caractères au plus.");
        if (le && !dansLesTemps(le)) return refusVisite("Choisissez un créneau à venir, dans les 60 prochains jours.");
        const modifie_le = new Date().toISOString();
        const action = corps?.action;
        if (action === "confirmer" && annonceur && v.statut === "demandee") {
          Object.assign(v, { statut: "confirmee", creneau: le ?? v.creneau, creneau_propose: null, reponse: mot ?? v.reponse, modifie_le });
        } else if (action === "proposer" && annonceur && v.statut === "demandee" && le) {
          Object.assign(v, { creneau_propose: le, reponse: mot, modifie_le });
        } else if (action === "refuser" && annonceur && v.statut === "demandee") {
          Object.assign(v, { statut: "annulee", annulee_par: "annonceur", reponse: mot, modifie_le });
        } else if (action === "accepter" && demandeur && v.statut === "demandee" && v.creneau_propose) {
          Object.assign(v, { statut: "confirmee", creneau: v.creneau_propose, creneau_propose: null, modifie_le });
        } else if (action === "annuler" && ["demandee", "confirmee"].includes(String(v.statut))) {
          Object.assign(v, { statut: "annulee", annulee_par: annonceur ? "annonceur" : "demandeur", reponse: mot ?? v.reponse, modifie_le });
        } else {
          return refusVisite("Cette action n'est plus possible pour cette demande.");
        }
        return route.fulfill({ status: 204 });
      }
      // mes_visites : reçues (coordonnées du visiteur) et envoyées (nom discret de l'annonceur), par créneau
      const miennes = f.visites.filter((v) => auteurDe(v) === moi.id || v.demandeur_id === moi.id);
      const cartes = await cartesExternes(miennes.map((v) => String(v.annonce_id)));
      const liste = miennes.map((v) => {
        const locale = f.annonces.find((a) => a.id === v.annonce_id);
        const carte = cartes.find((x) => x.id === v.annonce_id);
        const annonceur = locale?.auteur_id === moi.id;
        return {
          id: v.id, role: annonceur ? "annonceur" : "demandeur",
          annonce: locale
            ? { id: locale.id, reference: locale.reference, titre: locale.titre, photo: photoDe(locale.id), en_ligne: locale.statut === "publiee" }
            : { id: v.annonce_id, reference: carte?.reference, titre: carte?.titre, photo: carte?.photo ?? null, en_ligne: carte?.en_ligne === true },
          creneau: v.creneau, creneau_propose: v.creneau_propose, statut: v.statut, annulee_par: v.annulee_par,
          message: v.message, reponse: v.reponse, cree_le: v.cree_le, modifie_le: v.modifie_le,
          nom: annonceur ? v.nom : null, telephone: annonceur ? v.telephone : null, email: annonceur ? v.email : null,
          avec_compte: v.demandeur_id != null,
          annonceur: annonceur ? null : (locale ? nomDe(locale.auteur_id) : (carte?.contact_nom as string | undefined) ?? null),
        };
      });
      return json(liste.sort((a, b) => (String(a.creneau) < String(b.creneau) ? -1 : 1)));
    }

    // ── Être rappelé : avec ou sans compte ; l'annonceur traite, le demandeur annule ──
    if (url.pathname === "/rest/v1/rappels" && req.method() === "POST") {
      const d = corps ?? {};
      const annonce = String(d.annonce_id);
      const locale = f.annonces.find((a) => a.id === annonce);
      if (locale && locale.statut !== "publiee") return refusVisite("Cette annonce n'est plus en ligne.");
      if (locale && moi && locale.auteur_id === moi.id) return refusVisite("C'est votre annonce : vous ne pouvez pas demander à être rappelé.");
      const nom = String(d.nom ?? "").trim();
      const contrainte = (c: string) => json({ code: "23514", message: `new row for relation "rappels" violates check constraint "${c}"` }, 400);
      if (nom.length < 2 || nom.length > 80) return contrainte("rappels_nom_check");
      if (!/^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$/.test(String(d.telephone))) return contrainte("rappels_telephone_format");
      if (!["vite", "matin", "apres_midi", "soir"].includes(String(d.moment))) return contrainte("rappels_moment_check");
      const memeNumero = f.rappels.filter((r) => r.telephone === d.telephone);
      if (memeNumero.filter((r) => Date.now() - new Date(String(r.cree_le)).getTime() < 86_400_000).length >= 5) {
        return refusVisite("Vous avez déjà demandé beaucoup de rappels aujourd'hui : réessayez demain.");
      }
      if (memeNumero.some((r) => r.annonce_id === annonce && r.statut === "a_rappeler")) {
        return refusVisite("Vous avez déjà demandé à être rappelé pour ce bien : l'annonceur va vous appeler.");
      }
      f.rappel(annonce, { demandeur_id: moi?.id ?? null, nom, telephone: d.telephone, moment: d.moment, message: String(d.message ?? "").trim() || null });
      return route.fulfill({ status: 201 });
    }
    if (req.method() === "POST" && ["/rest/v1/rpc/mes_rappels", "/rest/v1/rpc/traiter_rappel"].includes(url.pathname)) {
      if (!moi) return json({ code: "42501", message: "permission denied for function" }, 401);
      if (url.pathname.endsWith("traiter_rappel")) {
        const r = f.rappels.find((x) => x.id === corps?.rappel);
        if (!r) return refusVisite("Demande de rappel introuvable.");
        const annonceur = auteurDe(r) === moi.id;
        if (!annonceur && r.demandeur_id !== moi.id) return json({ code: "42501", message: "Action non autorisée pour ce compte." }, 403);
        const action = corps?.action;
        if (action === "fait" && annonceur && r.statut === "a_rappeler") Object.assign(r, { statut: "rappele", traite_le: new Date().toISOString() });
        else if (action === "a_faire" && annonceur && r.statut === "rappele") Object.assign(r, { statut: "a_rappeler", traite_le: null });
        else if (action === "annuler" && !annonceur && r.statut === "a_rappeler") Object.assign(r, { statut: "annule", traite_le: new Date().toISOString() });
        else return refusVisite("Cette action n'est plus possible pour cette demande.");
        return route.fulfill({ status: 204 });
      }
      const miens = f.rappels.filter((r) => auteurDe(r) === moi.id || r.demandeur_id === moi.id);
      const cartes = await cartesExternes(miens.map((r) => String(r.annonce_id)));
      return json(miens.map((r) => {
        const locale = f.annonces.find((a) => a.id === r.annonce_id);
        const carte = cartes.find((x) => x.id === r.annonce_id);
        const annonceur = locale?.auteur_id === moi.id;
        return {
          id: r.id, role: annonceur ? "annonceur" : "demandeur",
          annonce: locale
            ? { id: locale.id, reference: locale.reference, titre: locale.titre, en_ligne: locale.statut === "publiee" }
            : { id: r.annonce_id, reference: carte?.reference, titre: carte?.titre, en_ligne: carte?.en_ligne === true },
          nom: r.nom, telephone: annonceur ? r.telephone : null, moment: r.moment, message: r.message, statut: r.statut,
          cree_le: r.cree_le, traite_le: r.traite_le, avec_compte: r.demandeur_id != null,
          annonceur: annonceur ? null : (locale ? nomDe(locale.auteur_id) : (carte?.contact_nom as string | undefined) ?? null),
        };
      }).sort((a, b) => (String(a.cree_le) < String(b.cree_le) ? 1 : -1)));
    }

    // ── Alertes : chacun les siennes ; lien des e-mails par jeton, sans connexion ──
    if (url.pathname === "/rest/v1/alertes") {
      if (!moi) return json({ code: "42501", message: "permission denied for table alertes" }, 401);
      const miennes = () => f.alertes.filter((a) => a.profil_id === moi.id);
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const colonnes = (url.searchParams.get("select") ?? "*").split(",");
      const lire = (a: Ligne) => (colonnes[0] === "*" ? a : Object.fromEntries(colonnes.map((c) => [c, a[c]])));
      if (req.method() === "GET") return json(filtrer(miennes(), url.searchParams).map(lire));
      if (req.method() === "POST") {
        if (miennes().some((a) => a.adresse === corps?.adresse)) {
          return json({ code: "23505", message: "duplicate key value violates unique constraint \"alertes_une_fois\"" }, 409);
        }
        if (miennes().length >= 10) return json({ code: "P0001", message: "Vous avez déjà 10 alertes : supprimez-en une pour en créer une autre." }, 400);
        f.alerte(moi.id, { nom: String(corps?.nom ?? "").trim(), adresse: corps?.adresse, criteres: corps?.criteres, frequence: corps?.frequence ?? "quotidienne" });
        return route.fulfill({ status: 201 });
      }
      const a = miennes().find((x) => x.id === id);
      if (req.method() === "PATCH") {
        if (a && corps?.adresse && miennes().some((x) => x !== a && x.adresse === corps.adresse)) {
          return json({ code: "23505", message: "duplicate key value violates unique constraint \"alertes_une_fois\"" }, 409);
        }
        if (a) {
          for (const cle of ["nom", "adresse", "criteres", "frequence", "active"]) if (corps && cle in corps) a[cle] = corps[cle];
        }
        return route.fulfill({ status: 204 });
      }
      if (req.method() === "DELETE") {
        f.alertes.splice(0, f.alertes.length, ...f.alertes.filter((x) => x !== a));
        return route.fulfill({ status: 204 });
      }
    }
    if (req.method() === "POST" && ["/rest/v1/rpc/alerte_par_jeton", "/rest/v1/rpc/arreter_alerte"].includes(url.pathname)) {
      const jeton = String(corps?.jeton ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(jeton)) return json({ code: "22P02", message: `invalid input syntax for type uuid: "${jeton}"` }, 400);
      const a = f.alertes.find((x) => x.jeton === jeton);
      if (url.pathname.endsWith("alerte_par_jeton")) return json(a ? { nom: a.nom, active: a.active, adresse: a.adresse } : null);
      if (a) a.active = false;
      return json(!!a);
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
    // Comme PostgREST : sans « return=representation », une écriture ne renvoie rien
    const representation = (req.headers()["prefer"] ?? "").includes("return=representation");
    const ecrit = (lignes: Ligne[], statut: number) => (representation ? repondre(lignes, statut) : route.fulfill({ status: statut === 200 ? 204 : statut }));
    const annonceDe = (p: Ligne) => f.annonces.find((a) => a.id === p.annonce_id);
    const aMoi = (a: Ligne | undefined) => !!a && !!moi && a.auteur_id === moi.id;
    const maintenant = () => new Date().toISOString();
    if (table === "villes" || table === "communes" || table === "quartiers") return repondre(filtrer(f.lieux[table], url.searchParams));
    if (table === "annonces") {
      if (req.method() === "GET") {
        // Comme la vraie base : ni coordonnées ni position exacte lisibles dans la table (pas de « * ») ;
        // ses annonces complètes se lisent par la fonction mes_annonces
        const colonnes = url.searchParams.get("select") ?? "*";
        if (/(^|,)\*|contact_(nom|telephone|email)|latitude|longitude/.test(colonnes)) {
          return json({ code: "42501", message: "permission denied for table annonces" }, 403);
        }
        return repondre(filtrer(f.annonces.filter(visible), url.searchParams));
      }
      if (!moi) return route.fulfill(erreur(401, "no_authorization", "Unauthorized"));
      if (req.method() === "POST") return ecrit([f.annonce(moi.id, { ...corps, auteur_id: moi.id })], 201);
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
        return ecrit(lignes, 200);
      }
      if (req.method() === "DELETE") {
        const ids = new Set(lignes.map((a) => a.id));
        f.annonces.splice(0, f.annonces.length, ...f.annonces.filter((a) => !ids.has(a.id)));
        f.photos.splice(0, f.photos.length, ...f.photos.filter((p) => !ids.has(p.annonce_id)));
        return ecrit(lignes, 200);
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
    // Ses annonces, complètes (coordonnées comprises) : seulement les siennes
    if (req.method() === "POST" && url.pathname === "/rest/v1/rpc/mes_annonces") {
      if (!moi) return json({ code: "42501", message: "permission denied for function mes_annonces" }, 401);
      return json(filtrer(f.annonces.filter(aMoi), url.searchParams).map(enrichir));
    }
    // Vitrine d'un compte de ce test (les autres : la fausse base avec les annonces d'exemple)
    if (req.method() === "POST" && url.pathname === "/rest/v1/rpc/vitrine") {
      const p = [...f.profils.values()].find((x) => x.code_vitrine === corps?.code);
      if (p) {
        const prenom = String(p.prenom ?? "").trim();
        const initiale = String(p.nom ?? "").trim().charAt(0).toUpperCase();
        const enLigne = f.annonces.filter((a) => a.auteur_id === p.id && a.statut === "publiee" &&
          (!a.expire_le || new Date(a.expire_le as string).getTime() > Date.now()));
        return json({
          code: p.code_vitrine, nom: prenom ? (initiale ? `${prenom} ${initiale}.` : prenom) : "Annonceur",
          agence: false, verifiee: false, membre_depuis: p.cree_le, total: enLigne.length,
        });
      }
    }
    // Autres fonctions (numéro sur demande, vues…) : la fausse base avec les annonces d'exemple
    if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fallback();
    return route.fulfill(erreur(404, "not_found", `Pas prévu dans la fausse base : ${req.method()} ${url.pathname}`));
  });
  return f;
}
