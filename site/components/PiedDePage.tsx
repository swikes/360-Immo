/*
 * Pied de page de toutes les pages : estimation gratuite, liens utiles, mentions.
 * Les réseaux sociaux s'afficheront quand les comptes 360-Immo.ci existeront (voir RESEAUX).
 *
 * Les liens du pied de page ne sont pas préchargés (prefetch={false}) : ils servent peu,
 * et on épargne ainsi le forfait internet des visiteurs sur téléphone.
 */
import Link from "next/link";
import Icone from "./Icone";
import s from "./PiedDePage.module.css";

const COLONNES: { titre: string; liens: { texte: string; lien: string }[] }[] = [
  {
    titre: "Explorer",
    liens: [
      { texte: "Appartements à louer", lien: "/annonces?tx=location&type=appartement" },
      { texte: "Villas à vendre", lien: "/annonces?tx=achat&type=villa" },
      { texte: "Terrains", lien: "/annonces?type=terrain" },
      { texte: "Bureaux & commerces", lien: "/annonces?type=bureau,commerce" },
      { texte: "Nouvelles annonces", lien: "/annonces?sort=recent" },
    ],
  },
  {
    titre: "Villes",
    liens: ["Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro", "Daloa"].map((ville) => ({
      texte: ville,
      lien: "/annonces?q=" + encodeURIComponent(ville),
    })),
  },
  {
    titre: "360-Immo.ci",
    liens: [
      { texte: "À propos", lien: "/a-propos" },
      { texte: "Publier une annonce", lien: "/publier" },
      { texte: "Devenir partenaire", lien: "/connexion" },
      { texte: "Aide & FAQ", lien: "/aide" },
      { texte: "Contact", lien: "/contact" },
    ],
  },
];

// Réseaux sociaux : ajouter ici l'adresse de chaque compte quand il existera ({ nom: "Facebook", lien: "https://…" })
const RESEAUX: { nom: string; lien: string }[] = [];

export default function PiedDePage() {
  return (
    <footer className={s.pied}>
      <div className={s.estimation}>
        <div className={s.estimationContenu}>
          <div>
            <div className={s.estimationSurtitre}>Outil gratuit</div>
            <div className={s.estimationTitre}>Combien vaut votre bien ?</div>
            <div className={s.estimationTexte}>
              Estimation instantanée basée sur 3 842 annonces actives en Côte d&apos;Ivoire
            </div>
          </div>
          <Link href="/estimation" className={s.estimationBouton} prefetch={false}>
            <Icone nom="viabilise" taille={16} epaisseur={2.5} />
            Estimer gratuitement
          </Link>
        </div>
      </div>

      <div className={s.grille}>
        <div>
          <Link href="/" className={`logo ${s.logo}`} prefetch={false}>
            360<span>-Immo</span>.ci
          </Link>
          <p className={s.description}>
            La première plateforme immobilière de Côte d&apos;Ivoire. Location, vente, achat — nous connectons les
            Ivoiriens à leurs biens idéaux.
          </p>
          {RESEAUX.length > 0 && (
            <div className={s.reseaux}>
              {RESEAUX.map((r) => (
                <a key={r.nom} href={r.lien} className={s.reseau} target="_blank" rel="noopener">
                  {r.nom}
                </a>
              ))}
            </div>
          )}
        </div>

        {COLONNES.map((col) => (
          <div key={col.titre} className={s.colonne}>
            <h2>{col.titre}</h2>
            <ul>
              {col.liens.map((l) => (
                <li key={l.lien}>
                  <Link href={l.lien} prefetch={false}>
                    {l.texte}
                  </Link>
                </li>
              ))}
              {col.titre === "360-Immo.ci" && (
                <li>
                  <Link href="/estimation" className={s.dore} prefetch={false}>
                    ✦ Estimer mon bien
                  </Link>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className={s.bas}>
        <span>© {new Date().getFullYear()} 360-Immo.ci — Tous droits réservés</span>
        <div className={s.mentions}>
          <Link href="/mentions-legales" prefetch={false}>Mentions légales</Link>
          <Link href="/confidentialite" prefetch={false}>Confidentialité</Link>
          <Link href="/cgu" prefetch={false}>CGU</Link>
        </div>
      </div>
    </footer>
  );
}
