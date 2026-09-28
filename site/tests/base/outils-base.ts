// Outils des tests de la base : une vraie base PostgreSQL (PGlite, sans installation ni Docker),
// avec ce que Supabase fournit (supabase-simule.sql) puis toutes les migrations de supabase/migrations.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const DOSSIER_MIGRATIONS = path.join(__dirname, "../../supabase/migrations");

export async function nouvelleBase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-simule.sql"), "utf8"));
  for (const f of readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(DOSSIER_MIGRATIONS, f), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${f} : ${(e as Error).message}`);
    }
  }
  return db;
}

/** Agir comme un visiteur sans compte (null) ou comme un compte connecté (son identifiant) */
export async function en<T>(db: PGlite, compte: string | null, action: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [compte ?? ""]);
  await db.exec(`set role ${compte ? "authenticated" : "anon"}`);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

let numero = 0;
/** Inscription d'un compte (comme le formulaire du site : prénom, nom, téléphones, agence…) ; renvoie son identifiant */
export async function inscrire(
  db: PGlite,
  infos: { prenom: string; nom: string; telephone?: string; [autre: string]: unknown },
  role: "particulier" | "agence" | "admin" = "particulier",
): Promise<string> {
  const r = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`compte${++numero}@exemple.ci`, JSON.stringify(infos)],
  );
  const id = r.rows[0].id;
  if (role !== "particulier") await db.query("update public.profils set role = $2 where id = $1", [id, role]);
  return id;
}

/** Identifiants de ville, commune et quartier à partir de leurs noms */
export async function lieu(db: PGlite, ville: string, commune: string, quartier?: string) {
  const r = await db.query<{ ville_id: number; commune_id: number; quartier_id: number | null }>(
    `select v.id as ville_id, c.id as commune_id, q.id as quartier_id
       from public.villes v
       join public.communes c on c.ville_id = v.id and c.nom = $2
       left join public.quartiers q on q.commune_id = c.id and q.nom = $3
      where v.nom = $1`,
    [ville, commune, quartier ?? null],
  );
  if (!r.rows[0]) throw new Error(`Lieu inconnu : ${ville}, ${commune}`);
  return r.rows[0];
}

export type NouvelleAnnonce = Record<string, unknown>;

/** Une annonce valable (appartement 3 pièces à louer à Cocody, Riviera 2), modifiable champ par champ */
export async function annonceType(db: PGlite, changements: NouvelleAnnonce = {}): Promise<NouvelleAnnonce> {
  const l = await lieu(db, "Abidjan", "Cocody", "Riviera 2");
  return {
    transaction: "location", type_bien: "appartement", titre: "Appartement 3 pièces à Riviera 2",
    prix: 150000, loyer_par: "mois", caution_mois: 2, ...l,
    surface: 85, pieces: 3, chambres: 2, sanitaires: 1, meuble: true, etage: 2,
    commodites: ["Air conditionné", "Parking"], contact_telephone: "+225 07 48 32 11 90",
    ...changements,
  };
}

/** Enregistre une annonce (avec les droits du compte en cours) ; renvoie ses champs enregistrés */
export async function creerAnnonce(db: PGlite, champs: NouvelleAnnonce) {
  const cles = Object.keys(champs);
  const r = await db.query<Record<string, unknown>>(
    `insert into public.annonces (${cles.join(", ")}) values (${cles.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    cles.map((k) => champs[k]),
  );
  return r.rows[0];
}
