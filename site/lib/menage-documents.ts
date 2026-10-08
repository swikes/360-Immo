/*
 * Ménage du matin du dossier privé « documents » (tâche de Vercel, app/api/notifications) : pièces d'identité dont la
 * conservation est finie (compte supprimé ou pièce remplacée depuis un an), documents des demandes traitées que le
 * navigateur de l'équipe n'a pas pu supprimer, logo d'une demande d'agence refusée. La base dit quoi supprimer
 * (documents_a_supprimer) ; le site supprime les fichiers avec la clé secrète, puis le note (documents_supprimes).
 * Un échec n'arrête pas le reste : la demande revient le lendemain.
 */

export type DemandeASupprimer = { id: string; fichiers: { dossier: string; chemin: string }[] };

export type Stockage = {
  aSupprimer: () => Promise<DemandeASupprimer[]>;
  /** supprime ces fichiers du dossier (erreur si le stockage refuse) */
  supprimer: (dossier: string, chemins: string[]) => Promise<void>;
  noter: (ids: string[]) => Promise<number>;
};

export async function menageDocuments(stockage: Stockage): Promise<{ demandes: number; fichiers: number; echecs: number }> {
  const faites: string[] = [];
  let fichiers = 0, echecs = 0;
  for (const demande of await stockage.aSupprimer()) {
    try {
      for (const dossier of ["documents", "logos"]) {
        const chemins = demande.fichiers.filter((f) => f.dossier === dossier).map((f) => f.chemin);
        if (chemins.length) await stockage.supprimer(dossier, chemins);
        fichiers += chemins.length;
      }
      faites.push(demande.id);
    } catch {
      echecs++;
    }
  }
  if (faites.length) await stockage.noter(faites);
  return { demandes: faites.length, fichiers, echecs };
}
