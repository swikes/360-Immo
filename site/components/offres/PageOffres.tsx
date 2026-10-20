/*
 * Page « Nos offres » (app/offres/page.tsx) : publier reste gratuit ; remonter une annonce, pack de 3 remontées,
 * Premium 30 jours ; comment payer ; les règles (document « Offre commerciale »).
 */
import Link from "next/link";
import Icone, { type NomIcone } from "@/components/Icone";
import { formaterPrix } from "@/lib/format";
import { TARIFS } from "@/lib/offres-tarifs";
import s from "./PageOffres.module.css";

export default function PageOffres({ prix }: { prix: Record<string, number> }) {
  const tarif = (cle: keyof typeof TARIFS) => prix[cle] ?? TARIFS[cle];
  const carte = (icone: NomIcone, titre: string, montant: number, sous: string, points: string[], vedette = false) => (
    <article className={`${s.offre} ${vedette ? s.vedette : ""}`}>
      <span className={s.offreIcone} aria-hidden="true"><Icone nom={icone} taille={22} /></span>
      <h3 className={s.offreTitre}>{titre}</h3>
      <p className={s.offrePrix}>{formaterPrix(montant)} <span>FCFA</span></p>
      <p className={s.offreSous}>{sous}</p>
      <ul className={s.points}>
        {points.map((x) => <li key={x}><Icone nom="valide" taille={15} /> {x}</li>)}
      </ul>
    </article>
  );

  return (
    <div className={s.page}>
      <header className={s.entete}>
        <span className={s.surtitre}>Pour les annonceurs</span>
        <h1 className={s.titre}>Faites voir vos annonces</h1>
        <p className={s.chapo}>
          Publier sur 360-Immo.ci reste <strong>gratuit</strong>. Pour être vu plus vite, remontez votre annonce en tête de la liste
          ou passez-la en <strong>Premium</strong>. Paiement par Mobile Money, en une minute.
        </p>
        <div className={s.actions}>
          <Link href="/mon-espace?section=annonces" className={s.bouton}><Icone nom="monter" taille={17} /> Faire voir mon annonce</Link>
          <Link href="/publier" className={s.boutonContour}>Publier une annonce gratuitement</Link>
        </div>
      </header>

      <section className={s.offres} aria-label="Les offres">
        {carte("monter", "Remonter mon annonce", tarif("remontee"), "une remontée", [
          "En tête des annonces ordinaires de « Plus récentes », comme publiée à l'instant",
          "Appliquée dès que le paiement est reçu",
          "Idéal quand votre annonce commence à descendre dans la liste",
        ])}
        {carte("monter", "Pack de 3 remontées", tarif("remontees_3"), `soit environ ${formaterPrix(Math.round(tarif("remontees_3") / 3))} FCFA la remontée`, [
          "Une tout de suite, puis 2 à utiliser dans les 30 jours",
          "Au moment choisi, ou automatiquement tous les 3 jours",
          "Bien vendu ou loué entre-temps : les remontées servent pour une autre annonce",
        ])}
        {carte("etoile", "Premium 30 jours", tarif("premium_30"), `moins de ${formaterPrix(Math.ceil(tarif("premium_30") / 30))} FCFA par jour`, [
          "Au-dessus des annonces ordinaires pendant 30 jours",
          "Badge « Premium » sur la carte et la page de l'annonce",
          "30 photos au lieu de 20",
          "« À la une » des e-mails d'alerte des personnes qui cherchent un bien comme le vôtre",
        ], true)}
      </section>

      <section className={s.bloc} aria-labelledby="comment">
        <h2 id="comment" className={s.blocTitre}>Comment ça marche</h2>
        <ol className={s.etapes}>
          <li><strong>Mon Espace → Mes annonces</strong> : touchez « Faire voir mon annonce » sur une annonce en ligne.</li>
          <li><strong>Choisissez l&apos;offre</strong>, puis payez par Orange Money, MTN MoMo, Moov Money ou Wave : vous validez sur votre téléphone.</li>
          <li><strong>C&apos;est fait</strong> : l&apos;offre s&apos;applique dès que le paiement est reçu, et le reçu arrive par e-mail. Vos paiements restent dans Mon Espace → Paiements.</li>
        </ol>
      </section>

      <section className={s.bloc} aria-labelledby="regles">
        <h2 id="regles" className={s.blocTitre}>Des règles claires, pour que tout le monde y gagne</h2>
        <ul className={s.regles}>
          <li>Une remontée par annonce toutes les 24 heures au plus : pas d&apos;argent gaspillé, pas d&apos;annonce qui occupe le haut toute la journée.</li>
          <li>La vraie date de publication reste affichée, et le tri par prix ne change jamais : les visiteurs gardent confiance.</li>
          <li>« À la une » des alertes seulement quand votre bien a tout l&apos;essentiel de ce que la personne cherche.</li>
          <li>Bien vendu ou loué avant la fin du Premium : les jours restants se reportent sur une autre de vos annonces.</li>
          <li>Paiement refusé ou annulé : rien n&apos;est débité ni changé. Une offre qui ne peut pas s&apos;appliquer vous est créditée.</li>
          <li>Publier plusieurs fois le même bien pour être vu davantage n&apos;est pas permis : un bien = une seule annonce.</li>
        </ul>
      </section>

      <section className={`${s.bloc} ${s.gratuit}`} aria-labelledby="gratuit">
        <h2 id="gratuit" className={s.blocTitre}>Toujours gratuit</h2>
        <p>
          Publier et renouveler vos annonces, votre vitrine, les statistiques de base, les badges « Identité vérifiée », « Agence
          vérifiée » et « Bien vérifié ». Les personnes qui cherchent un bien ne paient jamais.
        </p>
        <p className={s.bientot}>Agences : des abonnements mensuels avec remontées incluses arrivent bientôt.</p>
      </section>
    </div>
  );
}
