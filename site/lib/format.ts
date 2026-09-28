/** Montant en chiffres groupés par milliers : 85 000 000 */
export const formaterPrix = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
