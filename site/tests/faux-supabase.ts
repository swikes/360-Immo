// Fausse base Supabase pour les tests des comptes : le navigateur croit parler à Supabase, mais chaque
// demande (inscription, connexion, profil…) reçoit ici une réponse, sans internet ni vraie base.
// Le site des tests est construit avec NEXT_PUBLIC_SUPABASE_URL=http://supabase.test (voir .github/workflows).
// Le profil créé à l'inscription suit les mêmes règles que la base (supabase/migrations : creer_profil).
import type { Page } from "@playwright/test";

export type Compte = { id: string; email: string; motDePasse: string; metadonnees: Record<string, unknown> };

export type FauxSupabase = {
  comptes: Compte[];
  profils: Map<string, Record<string, unknown>>;
  /** toutes les demandes reçues (chemin, méthode, contenu), pour vérifier ce que le site envoie */
  demandes: { chemin: string; methode: string; corps: Record<string, unknown> | null; adresse: string }[];
  /** ajoute un compte déjà inscrit ; renvoie son identifiant */
  inscrit: (email: string, motDePasse: string, metadonnees?: Record<string, unknown>) => string;
};

const base64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

export async function fauxSupabase(page: Page): Promise<FauxSupabase> {
  const f: FauxSupabase = {
    comptes: [],
    profils: new Map(),
    demandes: [],
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

  await page.route(/\/(auth|rest)\/v1\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const corps = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
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
        const unSeul = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
        if (unSeul && !p) return json({ code: "PGRST116", message: "Cannot coerce the result to a single JSON object" }, 406);
        return json(unSeul ? p : p ? [p] : []);
      }
      default:
        return route.fulfill(erreur(404, "not_found", `Pas prévu dans la fausse base : ${req.method()} ${url.pathname}`));
    }
  });
  return f;
}
