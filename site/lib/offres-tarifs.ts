/** Prix des offres par défaut (FCFA), si la base n'en donne pas ; les vrais sont dans la table « offres » */
export const TARIFS = {
  remontee: 1000, remontees_3: 2000, premium_30: 5000, remontee_sup: 500,
  agence_20: 15000, agence_60: 35000, agence_200: 75000, bien_visite: 10000, bien_visite_plus: 25000,
} as const;
