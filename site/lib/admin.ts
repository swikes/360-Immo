"use client";

/*
 * Espace Administration de l'équipe 360-Immo.ci (/admin) et « Signaler cette annonce » (fiche) :
 * supabase/migrations/…_moderation.sql. Tout ce qui est réservé à l'équipe est vérifié par la base (compte « admin ») :
 * un autre compte reçoit « Réservé à l'équipe 360-Immo.ci ».
 */
import type { AnnonceSemblable } from "./annonces";
import { supabase } from "./supabase";

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

// ══ Signaler une annonce (visiteurs, avec ou sans compte) ══

export type MotifSignalement = "arnaque" | "indisponible" | "photos" | "prix" | "doublon" | "autre";

export const MOTIFS_SIGNALEMENT: Record<MotifSignalement, { texte: string; aide: string }> = {
  arnaque: { texte: "Arnaque ou demande d'argent suspecte", aide: "On vous demande de payer avant la visite, le bien semble ne pas exister…" },
  indisponible: { texte: "Bien déjà loué ou vendu", aide: "L'annonceur vous a dit que le bien n'est plus disponible." },
  photos: { texte: "Photos ou description trompeuses", aide: "Le bien ne ressemble pas à l'annonce, photos prises ailleurs…" },
  prix: { texte: "Prix faux ou trompeur", aide: "Le prix annoncé n'est pas le vrai prix, frais cachés…" },
  doublon: { texte: "Annonce en double", aide: "Le même bien est publié plusieurs fois." },
  autre: { texte: "Autre raison", aide: "Expliquez en quelques mots." },
};

export const signalerAnnonce = (annonce: string, motif: MotifSignalement, message: string) =>
  rpc<void>("signaler_annonce", { annonce, motif, message: message.trim() || null });

// ══ Espace de l'équipe ══

export type Tableau = {
  a_verifier: number; a_reverifier: number; signalees: number; documents: number; en_ligne: number; expirees: number; refusees: number;
  brouillons: number; biens_verifies: number; comptes: number; identites_verifiees: number; agences: number; agences_verifiees: number;
  demandes_agence: number; suspendus: number; administrateurs: number;
  semaine: { inscriptions: number; annonces: number; publiees: number; refusees: number; signalements: number };
};

export type AnnonceAVerifier = {
  id: string; reference: string; titre: string; description: string | null;
  transaction: "vente" | "location"; type_bien: string; type_nom: string;
  prix: number; loyer_par: "nuit" | "jour" | "mois" | "annee" | null; caution_mois: number | null;
  ville: string; commune: string; quartier: string | null; quartier_hors_liste: boolean; adresse: string | null;
  surface: number | null; pieces: number | null; studio: boolean; chambres: number | null; sanitaires: number | null;
  meuble: boolean; dans_immeuble: boolean; etage: number | null; commodites: string[]; disponibles?: number;
  type_vendeur: "particulier" | "agence"; contact_nom: string | null; contact_telephone: string | null; contact_whatsapp: boolean;
  contact_telephone2: string | null; contact_telephone2_whatsapp: boolean; contact_email: string | null;
  photos: string[]; cree_le: string; modifie_le: string; publiee_le: string | null; expire_le: string | null;
  signalements: number;
  derniere_decision: { decision: Decision; motif: string | null; le: string } | null;
  /** doublons possibles (supabase/migrations/…_doublons.sql) */
  doublons: { semblables: AnnonceSemblable[]; photos_ailleurs: PhotosAilleurs[] };
  auteur: {
    id: string; prenom: string; nom: string; email: string | null; telephone: string | null; role: "particulier" | "agence" | "admin";
    agence: string | null; inscrit_le: string; en_ligne: number; refusees: number;
    /** annonces en double déjà refusées ou retirées à ce compte */
    doublons_refuses: number;
  };
};

/** Annonce du même auteur qui ressemble à celle à vérifier (ou annonce qu'il a supprimée depuis moins de 30 jours) */
export type { AnnonceSemblable } from "./annonces";
/** Annonce d'un autre annonceur qui utilise les mêmes photos (paires : sa photo ↔ celle de l'annonce à vérifier) */
export type PhotosAilleurs = {
  id: string; reference: string; titre: string; statut: string; auteur: string;
  paires: { ma_photo: string; sa_photo: string }[];
};

export type AnnonceSignalee = {
  annonce: {
    id: string; reference: string; titre: string; statut: string; en_ligne: boolean; prix: number;
    loyer_par: AnnonceAVerifier["loyer_par"]; commune: string; photo: string | null; annonceur: string; contact_telephone: string | null;
  };
  nombre: number;
  signalements: { motif: MotifSignalement; message: string | null; le: string; avec_compte: boolean }[];
};

export type Decision = "publiee" | "refusee" | "retiree" | "classee";
/** Actions sur les comptes et les agences, vérifications (journal) */
export type ActionEquipe = "admin_donne" | "admin_retire" | "compte_suspendu" | "compte_reactive" | "agence_validee" | "agence_refusee" | "agence_modifiee"
  | "verification_validee" | "verification_refusee" | "piece_consultee" | "numero_libere";
export type LigneJournal = {
  decision: Decision | ActionEquipe; motif: string | null; le: string; reference: string | null; titre: string;
  annonce_id: string | null; par: string | null;
};

export const DECISIONS: Record<Decision | ActionEquipe, string> = {
  publiee: "Publiée", refusee: "Refusée", retiree: "Retirée", classee: "Signalements classés",
  admin_donne: "Accès administrateur donné", admin_retire: "Accès administrateur retiré", compte_suspendu: "Compte suspendu",
  compte_reactive: "Compte réactivé", agence_validee: "Agence validée", agence_refusee: "Demande d'agence refusée",
  agence_modifiee: "Agence modifiée", verification_validee: "Vérification validée", verification_refusee: "Vérification refusée",
  piece_consultee: "Pièce d'identité ouverte (plainte)", numero_libere: "Numéro libéré",
};

/** Motif d'un refus pour annonce en double (compté pour les avertissements) */
export const MOTIF_DOUBLON = "Annonce en double : ce bien est déjà publié.";

/** Motifs de refus les plus courants (l'annonceur les lit pour corriger son annonce) */
export const MOTIFS_REFUS = [
  "Photos floues, trop sombres ou absentes : ajoutez des photos nettes de chaque pièce.",
  "Prix incohérent avec le bien : vérifiez le montant et l'unité (par mois, par jour, prix de vente).",
  "Description trop courte : précisez l'état du bien, l'accès, l'eau et l'électricité.",
  MOTIF_DOUBLON,
  "Numéro de contact injoignable ou invalide.",
  "Ce bien ne peut pas être publié sur 360-Immo.ci (hors immobilier ou interdit).",
];

// ══ Équipe, comptes, agences ══

/** Un compte, tel que l'équipe le voit */
export type Compte = {
  id: string; prenom: string; nom: string; email: string | null; telephone: string | null;
  role: "particulier" | "agence" | "admin"; agence: string | null; demande_agence: string | null;
  suspendu_le: string | null; suspension_motif: string | null; inscrit_le: string; moi: boolean;
  annonces_en_ligne: number; annonces: number; refus: number; signalements: number;
  /** identité vérifiée et pièce encore valable ; date de fin de la pièce */
  identite_verifiee?: boolean; identite_expire_le?: string | null;
  /** autres comptes qui ont le même numéro principal (inscrits avant la règle « un numéro par compte ») */
  meme_numero?: number;
};
export type Administrateur = Compte & { depuis: string | null };
export type DemandeAgence = Compte & { demande_le: string; semblables: { id: string; nom: string }[] };
export type Agence = {
  id: string; nom: string; slug: string; telephone: string | null; email: string | null; verifiee: boolean; cree_le: string;
  comptes: { id: string; nom: string; email: string | null }[]; annonces_en_ligne: number;
  vitrine: { code: string; nom: string } | null;
};

export const nomCompte = (c: Pick<Compte, "prenom" | "nom">) => [c.prenom, c.nom].filter(Boolean).join(" ") || "Sans nom";

export const chercherComptes = (texte: string) => rpc<Compte[]>("admin_chercher_comptes", { texte: texte.trim() });
export const suspendreCompte = (compte: string, motif: string) => rpc<void>("suspendre_compte", { compte, motif: motif.trim() });
export const reactiverCompte = (compte: string) => rpc<void>("reactiver_compte", { compte });
export const equipe = () => rpc<Administrateur[]>("admin_equipe");
export const changerAccesAdmin = (compte: string, donner: boolean) => rpc<void>("changer_acces_admin", { compte, donner });
export const demandesAgence = () => rpc<DemandeAgence[]>("admin_demandes_agence");
/** Nouvelle agence (nom choisi, ou celui de la demande), ou rattachement à une agence existante */
export const validerAgence = (compte: string, choix: { nom?: string; agence?: string }) =>
  rpc<string>("valider_agence", { compte, nom: choix.nom?.trim() || null, agence: choix.agence ?? null });
export const refuserAgence = (compte: string, motif: string) => rpc<void>("refuser_agence", { compte, motif: motif.trim() });
export const agencesAdmin = () => rpc<Agence[]>("admin_agences");
export const modifierAgence = (agence: string, champs: { nom: string; telephone: string; email: string; verifiee: boolean }) =>
  rpc<void>("modifier_agence", { agence, nom: champs.nom.trim(), telephone: champs.telephone.trim() || null, email: champs.email.trim() || null, verifiee: champs.verifiee });

/** Numéros principaux partagés par plusieurs comptes (inscrits avant la règle, ou numéro pris par quelqu'un d'autre) */
export const numerosPartages = () => rpc<{ numero: string; comptes: Compte[] }[]>("admin_numeros_partages");
/** Retire le numéro d'un compte (réclamé par son vrai propriétaire) ; la personne reçoit le motif par e-mail */
export const libererNumero = (compte: string, motif: string) => rpc<void>("liberer_numero", { compte, motif: motif.trim() });

export const tableauAdmin = () => rpc<Tableau>("admin_tableau");
export const annoncesAVerifier = () => rpc<AnnonceAVerifier[]>("admin_a_verifier");
export const annoncesSignalees = () => rpc<AnnonceSignalee[]>("admin_signalements");
export const journalAdmin = () => rpc<LigneJournal[]>("admin_journal", { nombre: 100 });
/** doublon : refus ou retrait pour annonce en double, compté sur le compte (avertissement au 2e) */
export const modererAnnonce = (annonce: string, decision: "publier" | "refuser" | "retirer", motif?: string, doublon = false) =>
  rpc<void>("moderer_annonce", { annonce, decision, motif: motif?.trim() || null, doublon });
export const traiterSignalements = (annonce: string, decision: "retirer" | "classer", motif?: string, doublon = false) =>
  rpc<void>("traiter_signalements", { annonce, decision, motif: motif?.trim() || null, doublon });
