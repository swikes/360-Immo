/*
 * Paiement des offres (étape 8a), côté serveur du site : quel « fournisseur » encaisse, et ce qu'il faut pour payer.
 *
 * Réglage dans Vercel : NEXT_PUBLIC_PAIEMENTS = le nom de l'agrégateur choisi (Mobile Money), une fois son compte
 * marchand ouvert et son branchement ajouté ici. Sans réglage, les offres ne s'affichent pas sur le site.
 * « simulation » : paiement imité pour les essais (tests automatiques, ordinateur) ; jamais sur Vercel, où un
 * paiement simulé donnerait une offre gratuite sur la vraie base.
 */

export type Fournisseur = "simulation";

// (NEXT_PUBLIC_… est écrit dans le site au moment de sa fabrication : il faut le nommer tel quel ; VERCEL est lu au
// moment de l'appel)
const REGLAGES = () => ({ NEXT_PUBLIC_PAIEMENTS: process.env.NEXT_PUBLIC_PAIEMENTS, VERCEL: process.env.VERCEL });

/** Le fournisseur réglé, ou la raison pour laquelle le paiement n'est pas possible ici */
export function fournisseurRegle(env: Record<string, string | undefined> = REGLAGES()): { nom: Fournisseur } | { nom: null; raison: string } {
  const nom = env.NEXT_PUBLIC_PAIEMENTS?.trim();
  if (!nom) return { nom: null, raison: "Les offres payantes ne sont pas encore ouvertes." };
  if (nom === "simulation") {
    // Vercel pose VERCEL=1 sur ses serveurs (production et aperçus) : la simulation n'y est jamais permise
    if (env.VERCEL) return { nom: null, raison: "Paiement simulé refusé en ligne : réglez l'agrégateur de paiement (DEPANNAGE.md)." };
    return { nom: "simulation" };
  }
  return { nom: null, raison: `Agrégateur de paiement « ${nom} » pas encore branché.` };
}

/** Un paiement tel que la base le présente au serveur (paiement_a_payer) */
export type PaiementAPayer = {
  id: string; reference: string; statut: "en_attente" | "payee" | "echouee" | "remboursee"; montant: number; offre: string;
  nom: string; annonce: { reference?: string; titre?: string }; email: string | null; prenom: string | null;
};

/** Adresse où l'annonceur paie ; pour la simulation, une page du site qui imite celle de l'agrégateur */
export function adressePaiement(fournisseur: Fournisseur, p: PaiementAPayer): string {
  switch (fournisseur) {
    case "simulation":
      return `/paiement/simulation?paiement=${encodeURIComponent(p.id)}`;
  }
}

/** Page de retour après le paiement (réussi, refusé ou abandonné) : Mon Espace → Paiements */
export const adresseRetour = (paiement: string) => `/mon-espace?section=paiements&paiement=${encodeURIComponent(paiement)}`;
