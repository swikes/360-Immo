/*
 * Page pas encore reconstruite sur le nouveau site : on explique, et on renvoie vers la maquette.
 */
import Link from "next/link";
import { pageMaquette } from "@/lib/maquette";
import Icone from "./Icone";
import s from "./BientotDisponible.module.css";

type Props = {
  titre: string;
  /** étape du plan de migration où la page sera reconstruite */
  etape?: string;
  /** texte à la place de « Cette page arrive bientôt… » */
  texte?: string;
  /** fichier de la page sur la maquette (absent : pas d'équivalent) */
  maquette?: string;
  /** paramètres transmis tels quels à la maquette (recherche…) */
  parametres?: URLSearchParams;
  /** ce que la personne a demandé, en clair (ex. critères de recherche) */
  resume?: string[];
};

export default function BientotDisponible({ titre, etape, texte, maquette, parametres, resume }: Props) {
  return (
    <section className={s.page}>
      <div className={s.carte}>
        <span className={s.surtitre}>Nouveau site en construction</span>
        <h1 className={s.titre}>{titre}</h1>
        <p className={s.texte}>
          {texte ?? `Cette page arrive bientôt sur le nouveau site (étape « ${etape} »).`}
          {maquette && " En attendant, elle reste consultable sur la maquette."}
        </p>
        {resume && resume.length > 0 && (
          <div className={s.resume} aria-label="Votre recherche">
            <span className={s.resumeTitre}>Votre recherche</span>
            <ul>
              {resume.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <div className={s.boutons}>
          {maquette && (
            <a href={pageMaquette(maquette, parametres)} className={s.btnPlein}>
              Voir sur la maquette
              <Icone nom="fleche" taille={16} epaisseur={2.5} />
            </a>
          )}
          <Link href="/" className={s.btnContour}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
