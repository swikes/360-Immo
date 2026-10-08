"use client";

/*
 * Vérification par l'équipe 360-Immo.ci (supabase/migrations/…_documents.sql) :
 *   identité   pièce d'identité (recto, verso facultatif) et photo de soi tenant la pièce → badge « Identité vérifiée »
 *   agence     RCCM (logo facultatif) → badge « Agence vérifiée », logo sur les annonces, la vitrine et l'accueil
 *   bien       titre de propriété ou mandat d'une annonce → badge « Bien vérifié »
 * Les documents vont dans un dossier privé (« documents ») : seuls leur propriétaire et l'équipe peuvent les ouvrir,
 * par un lien valable quelques minutes. L'équipe les supprime une fois la demande traitée. Le logo va dans le dossier
 * public « logos ». Les photos sont réduites avant l'envoi (lisibles, mais légères en 3G) ; un PDF part tel quel.
 */
import { reduirePhoto, taille } from "./photos";
import { supabase } from "./supabase";
import type { Compte } from "./admin";

function client() {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  return sb;
}

async function rpc<T>(fonction: string, parametres?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fonction, parametres);
  if (error) throw error;
  return data as T;
}

export type TypeVerification = "identite" | "agence" | "bien";
export type Piece = "piece_recto" | "piece_verso" | "selfie" | "rccm" | "logo" | "titre" | "autre";
export type Dossier = "documents" | "logos";

/** Les documents demandés pour chaque vérification (mêmes listes que la fonction pieces_verification de la base) */
export const PIECES: Record<TypeVerification, { piece: Piece; texte: string; aide: string; obligatoire: boolean }[]> = {
  identite: [
    { piece: "piece_recto", texte: "Pièce d'identité (recto)", obligatoire: true,
      aide: "CNI, passeport, carte consulaire ou permis de conduire, en cours de validité : photo nette, les 4 coins visibles." },
    { piece: "piece_verso", texte: "Pièce d'identité (verso)", obligatoire: false, aide: "Pour une carte : l'autre face." },
    { piece: "selfie", texte: "Photo de vous tenant la pièce", obligatoire: true,
      aide: "Votre visage et la pièce bien visibles sur la même photo : l'équipe vérifie que c'est bien vous." },
  ],
  agence: [
    { piece: "rccm", texte: "RCCM de l'agence", obligatoire: true, aide: "Registre du commerce et du crédit mobilier : photo nette ou PDF." },
    { piece: "logo", texte: "Logo de l'agence", obligatoire: false,
      aide: "Image carrée de préférence (JPG, PNG ou WebP) : affiché sur vos annonces, votre vitrine et l'accueil une fois l'agence vérifiée." },
  ],
  bien: [
    { piece: "titre", texte: "Titre de propriété ou mandat", obligatoire: true,
      aide: "ACD, lettre d'attribution, attestation villageoise… ou le mandat du propriétaire si vous louez ou vendez pour lui." },
    { piece: "autre", texte: "Autre document", obligatoire: false, aide: "Par exemple : pièce d'identité du propriétaire, plan, facture CIE ou SODECI." },
  ],
};

export const NOM_PIECE = Object.fromEntries(Object.values(PIECES).flat().map((p) => [p.piece, p.texte])) as Record<Piece, string>;

/** Un document envoyé, tel que la demande le décrit */
export type FichierEnvoye = { piece: Piece; dossier: Dossier; chemin: string; nom: string; type: string; taille: number };

export const TAILLE_MAX: Record<Dossier, number> = { documents: 10 * 1024 * 1024, logos: 2 * 1024 * 1024 };
const FORMATS_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const estPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const estImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

/** Ce que l'on peut choisir pour ce document (attribut accept du champ fichier) */
export const formatsAcceptes = (piece: Piece) => (piece === "logo" ? FORMATS_IMAGE.join(",") : "image/*,application/pdf");

/** Contrôle immédiat d'un fichier choisi : message clair, ou null s'il convient */
export function problemeFichier(piece: Piece, f: File): string | null {
  if (piece === "logo") return estImage(f) && !estPdf(f) ? null : "Le logo doit être une image : JPG, PNG ou WebP.";
  if (estPdf(f)) return f.size > TAILLE_MAX.documents ? `« ${f.name} » est trop lourd (${taille(f.size)}) : 10 Mo au plus.` : null;
  return estImage(f) ? null : `« ${f.name} » n'est ni une photo ni un PDF.`;
}

/** Fichier choisi → contenu à envoyer (photo réduite, ou PDF tel quel) */
async function preparer(piece: Piece, f: File): Promise<{ blob: Blob; type: string; extension: string }> {
  const probleme = problemeFichier(piece, f);
  if (probleme) throw new Error(probleme);
  // type écrit en clair : certains téléphones donnent un PDF sans type, que le dossier refuserait
  if (estPdf(f)) return { blob: new Blob([f], { type: "application/pdf" }), type: "application/pdf", extension: "pdf" };
  // un document reste lisible à 2000 pixels ; un logo n'a pas besoin de plus de 512
  const photo = await reduirePhoto(f, piece === "logo" ? 512 : 2000);
  return { blob: photo.blob, type: photo.type, extension: photo.extension };
}

/** Envoie un document dans son dossier (le sien : <compte>/…) */
async function envoyerFichier(moi: string, piece: Piece, f: File): Promise<FichierEnvoye> {
  const pret = await preparer(piece, f);
  const dossier: Dossier = piece === "logo" ? "logos" : "documents";
  if (pret.blob.size > TAILLE_MAX[dossier]) throw new Error(`« ${f.name} » est trop lourd (${taille(pret.blob.size)}) : ${dossier === "logos" ? "2" : "10"} Mo au plus.`);
  const chemin = `${moi}/${crypto.randomUUID()}-${piece}.${pret.extension}`;
  const { error } = await client().storage.from(dossier).upload(chemin, pret.blob, { contentType: pret.type, upsert: false });
  if (error) throw Object.assign(new Error(`« ${f.name} » n'a pas pu être envoyé. Réessayez.`), { cause: error });
  return { piece, dossier, chemin, nom: f.name.slice(0, 120), type: pret.type, taille: pret.blob.size };
}

/** Supprime des fichiers envoyés (sans erreur si c'est déjà fait) */
async function supprimer(fichiers: Pick<FichierEnvoye, "dossier" | "chemin">[]) {
  for (const dossier of ["documents", "logos"] as const) {
    const chemins = fichiers.filter((f) => f.dossier === dossier).map((f) => f.chemin);
    if (chemins.length) await client().storage.from(dossier).remove(chemins).catch(() => undefined);
  }
}

/**
 * Demande de vérification : envoie les documents choisis, puis la demande. Si quelque chose échoue, les documents
 * déjà envoyés sont supprimés (rien ne reste dans le dossier privé). avancement(n, total) : pour afficher « 2 sur 3 ».
 */
export async function demanderVerification(
  moi: string, type: TypeVerification, choisis: Partial<Record<Piece, File>>,
  options: { annonce?: string | null; note?: string; avancement?: (fait: number, total: number) => void } = {},
): Promise<void> {
  const liste = PIECES[type].filter((p) => choisis[p.piece]);
  const manque = PIECES[type].find((p) => p.obligatoire && !choisis[p.piece]);
  if (manque) throw new Error(`Ajoutez : ${manque.texte.charAt(0).toLowerCase()}${manque.texte.slice(1)}.`);
  const envoyes: FichierEnvoye[] = [];
  try {
    for (const p of liste) {
      options.avancement?.(envoyes.length, liste.length);
      envoyes.push(await envoyerFichier(moi, p.piece, choisis[p.piece]!));
    }
    options.avancement?.(envoyes.length, liste.length);
    await rpc<string>("demander_verification", {
      type, annonce: options.annonce ?? null, fichiers: envoyes, note: options.note?.trim() || null,
    });
  } catch (e) {
    await supprimer(envoyes);
    throw e;
  }
}

/** Où en est une demande (la dernière) */
export type Demande = { statut: "soumise" | "validee" | "refusee"; motif: string | null; le: string } | null;
export type MesVerifications = {
  identite: { verifiee_le: string | null; demande: Demande };
  agence: { nom: string; verifiee: boolean; logo: string | null; demande: Demande } | null;
  biens: { id: string; titre: string; reference: string; statut: "publiee" | "en_attente"; verifiee: boolean; demande: Demande }[];
};

export const mesVerifications = () => rpc<MesVerifications>("mes_verifications");

// ══ L'équipe (onglet Documents de l'espace Administration) ══

export type DemandeVerification = {
  id: string; type: TypeVerification; fichiers: FichierEnvoye[]; note: string | null; cree_le: string;
  compte: Compte;
  annonce: { id: string; titre: string; reference: string; statut: string; en_ligne: boolean; commune: string | null; type_bien: string } | null;
  agence: string | null;
};

export const demandesVerification = () => rpc<DemandeVerification[]>("admin_verifications");

/** Liens pour ouvrir les documents : temporaires (10 minutes) pour le dossier privé, publics pour un logo */
export async function liensDocuments(fichiers: FichierEnvoye[]): Promise<Record<string, string>> {
  const liens: Record<string, string> = {};
  const prives = fichiers.filter((f) => f.dossier === "documents").map((f) => f.chemin);
  if (prives.length) {
    const { data, error } = await client().storage.from("documents").createSignedUrls(prives, 600);
    if (error) throw error;
    for (const l of data ?? []) if (l.path && l.signedUrl) liens[l.path] = l.signedUrl;
  }
  for (const f of fichiers.filter((x) => x.dossier === "logos")) liens[f.chemin] = client().storage.from("logos").getPublicUrl(f.chemin).data.publicUrl;
  return liens;
}

/**
 * Valider (badge) ou refuser (motif envoyé par e-mail). Les documents du dossier privé ne servent plus : ils sont
 * supprimés aussitôt. Le logo d'une agence validée reste (il s'affiche sur le site) ; celui d'une demande refusée part aussi.
 */
export async function traiterVerification(d: Pick<DemandeVerification, "id" | "fichiers">, decision: "valider" | "refuser", motif?: string): Promise<void> {
  const chemins = await rpc<string[]>("traiter_verification", { verification: d.id, decision, motif: motif?.trim() || null });
  const logos = decision === "refuser" ? d.fichiers.filter((f) => f.dossier === "logos") : [];
  await supprimer([...chemins.map((chemin) => ({ dossier: "documents" as const, chemin })), ...logos]);
}

/** Motifs de refus les plus courants, par vérification (la personne les lit pour renvoyer les bons documents) */
export const MOTIFS_REFUS_DOCUMENTS: Record<TypeVerification, string[]> = {
  identite: [
    "Photo floue ou coupée : on doit pouvoir lire toute la pièce, les 4 coins visibles.",
    "Pièce d'identité expirée : envoyez une pièce en cours de validité.",
    "Visage ou pièce pas visible : sur la photo où vous tenez la pièce, on doit voir votre visage et la pièce.",
    "Nom différent : le nom sur la pièce ne correspond pas à celui du compte.",
  ],
  agence: [
    "RCCM illisible : envoyez une photo nette ou le PDF du document entier.",
    "Nom différent : le RCCM ne correspond pas au nom de l'agence.",
    "Pas un RCCM : le document envoyé n'est pas le registre du commerce de l'agence.",
  ],
  bien: [
    "Document illisible ou incomplet : envoyez toutes les pages, bien nettes.",
    "Autre bien : le document ne correspond pas au bien de l'annonce (lieu, lot, superficie).",
    "Mandat manquant : si vous n'êtes pas le propriétaire, joignez le mandat qu'il a signé.",
  ],
};
