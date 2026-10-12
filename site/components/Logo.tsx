/*
 * Logo « 360-Immo.ci » du graphiste (marque/svg/, copié dans public/logo/) : barre du haut, menu ☰, pied de page.
 * « sombre » : version blanche et or, pour un fond foncé ; « symbole » : l'épingle seule, sans le nom.
 * La hauteur se règle en CSS (.logo img), la largeur suit.
 */
export default function Logo({ sombre = false, symbole = false, className }: { sombre?: boolean; symbole?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel : next/image n'apporte rien
    <img
      src={`/logo/360-immo-${symbole ? "symbole" : "logo"}${sombre ? "-fond-sombre" : ""}.svg`}
      alt="360-Immo.ci"
      width={symbole ? 168 : 752}
      height={symbole ? 218 : 135}
      className={className}
    />
  );
}
