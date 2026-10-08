"use client";

/*
 * Annonces d'un compte : lire, enregistrer (brouillon ou envoi pour vérification), photos, archiver,
 * renouveler, supprimer. Les règles (types de bien, lieux, publication réservée à l'équipe, 90 jours de
 * validité, 20 photos) sont aussi vérifiées par la base : voir supabase/migrations.
 */
import { supabase } from "./supabase";
import type { Vitrine } from "./annonces-en-ligne";
import { cleType, typeDeCle, type Transaction, type UniteLoyer } from "./regles-biens";

export type Statut = "brouillon" | "en_attente" | "publiee" | "refusee" | "archivee";

export const STATUTS: Record<Statut, { texte: string; aide: string }> = {
  brouillon: { texte: "Brouillon", aide: "Pas encore envoyée : terminez-la, puis envoyez-la pour vérification." },
  en_attente: { texte: "En vérification", aide: "L'équipe 360-Immo.ci la vérifie avant de la publier." },
  publiee: { texte: "En ligne", aide: "Visible de tous." },
  refusee: { texte: "Refusée", aide: "Corrigez-la, puis renvoyez-la." },
  archivee: { texte: "Retirée", aide: "Vendue, louée ou retirée : plus visible." },
};

export type PhotoEnregistree = { id: string; chemin: string; ordre: number; empreinte?: string | null };

/** Une annonce telle que la base la renvoie (avec ses photos et les noms de son lieu) */
export type Annonce = {
  id: string;
  reference: string;
  auteur_id: string;
  statut: Statut;
  motif_refus: string | null;
  transaction: Transaction;
  type_bien: string;
  titre: string;
  description: string;
  prix: number;
  loyer_par: "nuit" | "jour" | "mois" | "annee" | null;
  caution_mois: number | null;
  ville_id: number;
  commune_id: number;
  quartier_id: number | null;
  quartier_texte: string | null;
  adresse: string | null;
  surface: number | null;
  pieces: number | null;
  studio: boolean;
  chambres: number | null;
  sanitaires: number | null;
  meuble: boolean;
  dans_immeuble: boolean;
  etage: number | null;
  commodites: string[];
  /** biens identiques proposés (même résidence, même lotissement) ; 1 : un seul bien */
  disponibles: number;
  type_vendeur: "particulier" | "agence";
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_telephone2: string | null;
  contact_whatsapp: boolean;
  contact_telephone2_whatsapp: boolean;
  contact_email: string | null;
  vues: number;
  publiee_le: string | null;
  expire_le: string | null;
  cree_le: string;
  modifie_le: string;
  photos_annonce: PhotoEnregistree[];
  villes: { nom: string } | null;
  communes: { nom: string } | null;
  quartiers: { nom: string } | null;
};

const CHAMPS = "*, photos_annonce(id, chemin, ordre, empreinte), villes(nom), communes(nom), quartiers(nom)";

// Unités du loyer : libellés du site ↔ valeurs de la base
const UNITES: Record<UniteLoyer, NonNullable<Annonce["loyer_par"]>> = { Nuit: "nuit", Jour: "jour", Mois: "mois", "Année": "annee" };
export const uniteBase = (u: UniteLoyer) => UNITES[u];
export const uniteSite = (u: Annonce["loyer_par"]) =>
  (Object.keys(UNITES) as UniteLoyer[]).find((k) => UNITES[k] === u) ?? null;
export const typeSite = (cle: string) => typeDeCle(cle) ?? cle;
export const typeBase = (nom: string) => cleType(nom) ?? nom;

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

/** Adresse publique d'une photo */
export function urlPhoto(chemin: string): string {
  return client().storage.from("photos-annonces").getPublicUrl(chemin).data.publicUrl;
}

/** Photos dans l'ordre (la première est la photo principale) */
export const photosTriees = (a: Pick<Annonce, "photos_annonce">) =>
  [...(a.photos_annonce ?? [])].sort((x, y) => x.ordre - y.ordre);

/** Lieu en clair : « Riviera 2, Cocody » ; « Air France 2, Bouaké » */
export function lieuTexte(a: Pick<Annonce, "villes" | "communes" | "quartiers" | "quartier_texte">): string {
  const quartier = a.quartiers?.nom ?? a.quartier_texte;
  const commune = a.communes?.nom ?? a.villes?.nom ?? "";
  return [quartier, commune].filter(Boolean).join(", ");
}

// Ses annonces se lisent par la fonction mes_annonces de la base : complètes (coordonnées comprises), et
// seulement les siennes. La table ne donne à un compte que ce que la page publique montre (pas les numéros).
const miennes = () => client().rpc("mes_annonces").select(CHAMPS);

export async function mesAnnonces(auteur: string): Promise<Annonce[]> {
  const { data, error } = await miennes().eq("auteur_id", auteur).order("modifie_le", { ascending: false });
  if (error) throw error;
  return data as Annonce[];
}

/** Une de ses annonces ; null si elle n'existe pas ou n'est pas à soi */
export async function lireAnnonce(id: string): Promise<Annonce | null> {
  const { data, error } = await miennes().eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Annonce | null;
}

/** Identifiants de la ville, de la commune et du quartier (s'il est dans la liste ; sinon : texte libre) */
export async function idsDuLieu(ville: string, commune: string, quartier: string) {
  const sb = client();
  const v = await sb.from("villes").select("id").eq("nom", ville).maybeSingle();
  if (v.error) throw v.error;
  if (!v.data) throw new Error(`Ville inconnue : ${ville}`);
  const c = await sb.from("communes").select("id").eq("ville_id", v.data.id).eq("nom", commune).maybeSingle();
  if (c.error) throw c.error;
  if (!c.data) throw new Error(`Commune inconnue à ${ville} : ${commune}`);
  let quartier_id: number | null = null;
  const q = quartier.trim();
  if (q) {
    const r = await sb.from("quartiers").select("id").eq("commune_id", c.data.id).eq("nom", q).maybeSingle();
    if (r.error) throw r.error;
    quartier_id = r.data?.id ?? null;
  }
  return { ville_id: v.data.id as number, commune_id: c.data.id as number, quartier_id, quartier_texte: quartier_id || !q ? null : q };
}

/** Ce que le formulaire enregistre (statut absent : inchangé, par exemple pour une annonce en ligne retouchée) */
export type ChampsAnnonce = Omit<
  Annonce,
  "id" | "reference" | "auteur_id" | "statut" | "motif_refus" | "vues" | "publiee_le" | "expire_le" | "cree_le" | "modifie_le" | "photos_annonce" | "villes" | "communes" | "quartiers"
> & { statut?: Statut };

/**
 * Nouvelle annonce (id absent) ou modification ; renvoie l'annonce enregistrée.
 * L'identifiant d'une nouvelle annonce est choisi ici : l'annonce se relit ensuite par mes_annonces.
 */
export async function enregistrerAnnonce(champs: ChampsAnnonce, id?: string): Promise<Annonce> {
  const sb = client();
  const cle = id ?? crypto.randomUUID();
  const r = id ? await sb.from("annonces").update(champs).eq("id", id) : await sb.from("annonces").insert({ ...champs, id: cle });
  if (r.error) throw r.error;
  const a = await lireAnnonce(cle);
  if (!a) throw Object.assign(new Error("permission denied for table annonces"), { code: "42501" });
  return a;
}

/** Envoie une photo réduite et l'ajoute à l'annonce, avec son empreinte (lib/photos.ts) */
export async function ajouterPhoto(
  annonce: string, blob: Blob, extension: string, ordre: number, empreinte: string | null = null,
): Promise<PhotoEnregistree> {
  const sb = client();
  const chemin = `${annonce}/${crypto.randomUUID()}.${extension}`;
  const envoi = await sb.storage.from("photos-annonces").upload(chemin, blob, { contentType: blob.type, upsert: false });
  if (envoi.error) throw envoi.error;
  const { data, error } = await sb.from("photos_annonce").insert({ annonce_id: annonce, chemin, ordre, empreinte })
    .select("id, chemin, ordre, empreinte").single();
  if (error) {
    await sb.storage.from("photos-annonces").remove([chemin]);
    throw error;
  }
  return data as PhotoEnregistree;
}

export async function retirerPhotos(photos: PhotoEnregistree[]) {
  if (!photos.length) return;
  const sb = client();
  const { error } = await sb.from("photos_annonce").delete().in("id", photos.map((p) => p.id));
  if (error) throw error;
  await sb.storage.from("photos-annonces").remove(photos.map((p) => p.chemin));
}

export async function reordonnerPhotos(photos: PhotoEnregistree[]) {
  const sb = client();
  for (const p of photos) {
    const { error } = await sb.from("photos_annonce").update({ ordre: p.ordre }).eq("id", p.id);
    if (error) throw error;
  }
}

export async function changerStatut(id: string, statut: "brouillon" | "en_attente" | "archivee") {
  const { error } = await client().from("annonces").update({ statut }).eq("id", id);
  if (error) throw error;
}

export async function renouveler(id: string) {
  const { error } = await client().rpc("renouveler_annonce", { annonce: id });
  if (error) throw error;
}

/** Supprime l'annonce et ses photos (d'abord les fichiers : ils ne sont plus accessibles une fois l'annonce effacée) */
export async function supprimerAnnonce(a: Pick<Annonce, "id" | "photos_annonce">) {
  const sb = client();
  const chemins = (a.photos_annonce ?? []).map((p) => p.chemin);
  if (chemins.length) await sb.storage.from("photos-annonces").remove(chemins);
  const { error } = await sb.from("annonces").delete().eq("id", a.id);
  if (error) throw error;
}

/**
 * Une de ses annonces qui ressemble à celle qu'on envoie (supabase/migrations/…_doublons.sql) : en ligne, en
 * vérification, refusée ou retirée depuis moins de 30 jours, ou supprimée depuis moins de 30 jours (« effacee », sans id)
 */
export type AnnonceSemblable = {
  id: string | null; reference: string; titre: string; statut: Statut | "effacee"; expiree: boolean | null;
  prix: number; loyer_par: Annonce["loyer_par"]; type_bien: string; transaction: Transaction;
  commune: string | null; quartier: string | null; pieces: number | null; surface: number | null; etage: number | null;
  photo: string | null; cree_le: string | null; publiee_le: string | null; efface_le: string | null;
  /** mêmes caractéristiques (type, lieu, prix à 10 % près, pièces…) */
  caracteristiques: boolean;
  /** nombre de photos presque identiques */
  photos: number;
};

/** Ses annonces qui ressemblent à celle qu'on va envoyer (caractéristiques ou photos) ; jamais celles des autres */
export async function annoncesSemblables(champs: ChampsAnnonce, empreintes: string[], sauf?: string): Promise<AnnonceSemblable[]> {
  const { type_bien, transaction, commune_id, quartier_id, prix, loyer_par, pieces, surface, etage } = champs;
  const { data, error } = await client().rpc("annonces_semblables", {
    bien: { type_bien, transaction, commune_id, quartier_id, prix, loyer_par, pieces, surface, etage },
    empreintes,
    sauf: sauf ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AnnonceSemblable[];
}

/** Jours restants avant la fin de la validité (négatif : expirée) */
export function joursRestants(a: Pick<Annonce, "expire_le">, maintenant = Date.now()): number | null {
  return a.expire_le ? Math.ceil((new Date(a.expire_le).getTime() - maintenant) / 86_400_000) : null;
}

/** Prix en clair : « 150 000 FCFA / mois », « 45 000 000 FCFA » */
export function prixTexte(prix: number, loyer: Annonce["loyer_par"]): string {
  const unite = { nuit: " / nuit", jour: " / jour", mois: " / mois", annee: " / an" }[loyer ?? "mois"];
  return `${new Intl.NumberFormat("fr-FR").format(prix)} FCFA${loyer ? unite : ""}`;
}

/** Sa vitrine (nom affiché, nombre d'annonces en ligne) : pour Mes annonces et le menu */
export async function maVitrine(code: string): Promise<Vitrine | null> {
  const { data, error } = await client().rpc("vitrine", { code });
  if (error) throw error;
  return data as Vitrine | null;
}
