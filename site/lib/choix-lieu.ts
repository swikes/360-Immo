/*
 * Recherche d'un lieu : villes, communes et quartiers (reprise de js/choix-lieu.js de la maquette, mêmes règles).
 *
 *   chercher("rivi", { quartiers: true })  → Riviera 1, Riviera 2… (Quartier · Cocody)
 *   trouver("riviera 2, cocody")           → { type: "quartier", ville: "Abidjan", commune: "Cocody", quartier: "Riviera 2" }
 *
 * La recherche ignore accents, majuscules, tirets et apostrophes
 * (« bouake » → Bouaké, « port bouet » → Port-Bouët, « mbah » → M'Bahiakro).
 */
import { QUARTIERS, VILLES_COMMUNES } from "./lieux";

export type TypeLieu = "ville" | "commune" | "quartier";

export type EntreeLieu = {
  type: TypeLieu;
  ville: string;
  /** commune (pour une ville à une seule commune : celle-ci) */
  commune: string | null;
  quartier: string | null;
  libelle: string;
  /** « Ville · 13 communes », « Commune · Abidjan », « Quartier · Cocody » */
  detail: string;
  nLibelle: string;
  nDetail: string;
};

export type Lieu = { type: TypeLieu; ville: string; commune: string | null; quartier: string | null; texte: string };

const TRI = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

// Normalise une lettre : sans accent, minuscule ; tiret → espace ; apostrophe → rien.
function normCar(c: string): string {
  if (c === "'" || c === "’" || c === "`") return "";
  if (c === "-" || c === "_") return " ";
  return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
export function normaliser(s: string): string {
  return Array.from(s || "").map(normCar).join("").replace(/\s+/g, " ").trim();
}

function entree(type: TypeLieu, ville: string, commune: string | null, libelle: string, detail: string): EntreeLieu {
  return {
    type, ville, commune, quartier: type === "quartier" ? libelle : null,
    libelle, detail, nLibelle: normaliser(libelle), nDetail: normaliser(detail),
  };
}
function trier(a: EntreeLieu, b: EntreeLieu): number {
  return TRI.compare(a.ville, b.ville) || (a.type === "ville" ? -1 : b.type === "ville" ? 1 : TRI.compare(a.libelle, b.libelle));
}
// Du plus large au plus précis : ville, commune, quartier
const RANG: Record<TypeLieu, number> = { ville: 0, commune: 1, quartier: 2 };

// ── Entrées : chaque ville, chaque commune d'une ville à plusieurs communes, chaque quartier ──
const communesDe = new Map<string, string[]>();
for (const [v, c] of VILLES_COMMUNES) communesDe.set(v, [...(communesDe.get(v) ?? []), c]);

const VILLES_COMMUNES_ENTREES: EntreeLieu[] = [];
communesDe.forEach((cs, v) => {
  VILLES_COMMUNES_ENTREES.push(
    entree("ville", v, cs.length === 1 ? cs[0] : null, v, cs.length > 1 ? `Ville · ${cs.length} communes` : "Ville"),
  );
  if (cs.length > 1) for (const c of cs) VILLES_COMMUNES_ENTREES.push(entree("commune", v, c, c, `Commune · ${v}`));
});
VILLES_COMMUNES_ENTREES.sort(trier);

const QUARTIERS_ENTREES: EntreeLieu[] = Object.entries(QUARTIERS)
  .flatMap(([v, communes]) =>
    Object.entries(communes).flatMap(([c, qs]) => qs.map((q) => entree("quartier", v, c, q, `Quartier · ${c}`))),
  )
  .sort((a, b) => TRI.compare(a.libelle, b.libelle) || TRI.compare(a.commune ?? "", b.commune ?? ""));

const TOUTES = [...VILLES_COMMUNES_ENTREES, ...QUARTIERS_ENTREES];

/** Texte écrit dans le champ pour un lieu : « Cocody », « Riviera 2, Cocody » (un même nom de quartier existe
 *  dans plusieurs communes : Remblais à Koumassi et à Marcory) */
export const texteLieu = (e: EntreeLieu) => (e.type === "quartier" ? `${e.libelle}, ${e.commune}` : e.libelle);

// ── Correspondance : chaque mot tapé doit commencer un mot du nom (ou du détail), ou y figurer ──
function score(e: EntreeLieu, mots: string[], q: string, qCompact: string): number {
  const texte = `${e.nLibelle} ${e.nDetail}`;
  const motsTexte = texte.split(" ");
  const compact = e.nLibelle.replace(/ /g, ""); // « portbouet » → Port-Bouët
  for (const m of mots) {
    if (!motsTexte.some((w) => w.startsWith(m)) && !texte.includes(m) && !compact.includes(qCompact)) return -1;
  }
  if (e.nLibelle === q) return 0;
  if (e.nLibelle.startsWith(q)) return 1;
  if (e.nLibelle.split(" ").some((w) => w.startsWith(mots[0]))) return 2;
  if (e.nDetail.split(" ").some((w) => w.startsWith(mots[0]))) return 3;
  return 4;
}

/** Lieux correspondant à la saisie, les meilleurs d'abord. Rien de tapé : villes et communes seulement. */
export function chercher(saisie: string, { quartiers = false } = {}): EntreeLieu[] {
  const q = normaliser(saisie);
  if (!q) return VILLES_COMMUNES_ENTREES.slice();
  const mots = q.split(" "), qCompact = q.replace(/ /g, "");
  return (quartiers ? TOUTES : VILLES_COMMUNES_ENTREES)
    .map((e) => ({ e, s: score(e, mots, q, qCompact) }))
    .filter((x) => x.s >= 0)
    // à score égal, les quartiers après les villes et communes
    .sort((a, b) => a.s - b.s || +(a.e.type === "quartier") - +(b.e.type === "quartier") || trier(a.e, b.e))
    .map((x) => x.e);
}

// L'entrée désignée par un texte : son nom exact d'abord (« Riviera 2, Cocody »), sinon son nom seul, du plus
// large au plus précis (« Divo » : la ville, pas le quartier de Koumassi). Un nom de quartier présent dans
// plusieurs communes (« Remblais ») ne désigne aucune entrée : on ne devine pas.
export function correspondance(texte: string): EntreeLieu | null {
  const q = normaliser(texte);
  if (!q) return null;
  const parRang = (a: EntreeLieu, b: EntreeLieu) => RANG[a.type] - RANG[b.type];
  const exact = TOUTES.filter((x) => normaliser(texteLieu(x)) === q).sort(parRang)[0];
  if (exact) return exact;
  const parNom = TOUTES.filter((x) => x.nLibelle === q).sort(parRang);
  if (parNom.length > 1 && parNom[0].type === "quartier") return null;
  return parNom[0] ?? null;
}

/** Le lieu désigné par un texte de recherche ; nom de quartier de plusieurs communes → commune: null ;
 *  texte inconnu → null (recherche libre) */
export function trouver(texte: string): Lieu | null {
  const e = correspondance(texte);
  if (e) return { type: e.type, ville: e.ville, commune: e.type === "ville" ? null : e.commune, quartier: e.quartier, texte: texteLieu(e) };
  const q = normaliser(texte);
  const quartier = q ? QUARTIERS_ENTREES.find((x) => x.nLibelle === q) : undefined;
  return quartier ? { type: "quartier", ville: quartier.ville, commune: null, quartier: quartier.libelle, texte: quartier.libelle } : null;
}

/** Morceaux d'un texte, avec les lettres tapées mises en évidence : [{ texte: "Rivi", tape: true }, { texte: "era 2" }] */
export function surligner(texte: string, saisie: string): { texte: string; tape: boolean }[] {
  const mots = normaliser(saisie).split(" ").filter(Boolean);
  const lettres = Array.from(texte);
  if (!mots.length) return [{ texte, tape: false }];
  // version normalisée lettre par lettre, avec la position de chaque lettre dans le texte d'origine
  let n = "";
  const pos: number[] = [];
  lettres.forEach((c, i) => {
    for (const k of normCar(c)) { n += k; pos.push(i); }
  });
  const marques = new Array<boolean>(lettres.length).fill(false);
  for (const m of mots) {
    const r = new RegExp("(^| )" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).exec(n);
    const debut = r ? r.index + r[1].length : n.indexOf(m);
    if (debut < 0) continue;
    for (let k = debut; k < debut + m.length && k < pos.length; k++) marques[pos[k]] = true;
  }
  const morceaux: { texte: string; tape: boolean }[] = [];
  lettres.forEach((c, i) => {
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.tape === marques[i]) dernier.texte += c;
    else morceaux.push({ texte: c, tape: marques[i] });
  });
  return morceaux;
}
