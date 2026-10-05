/*
 * Carte d'une annonce (liste des annonces, accueil, biens similaires) : photo principale, prix, titre, lieu,
 * caractéristiques, annonceur. Toute la carte mène à la fiche du bien ; le cœur (favoris) reste à part.
 * Le numéro de l'annonceur n'y figure pas : il s'affiche sur la fiche, après un clic.
 * Un particulier y apparaît sous le nom discret de sa vitrine (« Awa K. ») ; une agence, sous le nom de l'annonce.
 */
import Link from "next/link";
import {
  caracteristiques, depuis, estNouvelle, lienAnnonce, lieuAnnonce, uniteLoyer, urlPhotoPublique, type CarteAnnonce as Annonce,
} from "@/lib/annonces-en-ligne";
import { formaterPrix } from "@/lib/format";
import BoutonFavori from "./BoutonFavori";
import Icone from "./Icone";
import PhotoCadree from "./PhotoCadree";
import s from "./CarteAnnonce.module.css";

const initiales = (nom: string) =>
  nom.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "?";

export default function CarteAnnonce({ annonce: a, titreNiveau = 3 }: { annonce: Annonce; titreNiveau?: 2 | 3 }) {
  const aLouer = a.transaction === "location";
  const unite = uniteLoyer(a.loyer_par);
  const Titre = `h${titreNiveau}` as const;
  const nouveau = estNouvelle(a.publiee_le);
  const agence = a.type_vendeur === "agence";
  const nom = agence ? (a.contact_nom ?? "Agence immobilière") : (a.annonceur_nom ?? "Particulier");
  return (
    <article className={s.carte} aria-labelledby={`annonce-${a.id}`}>
      <div className={s.image}>
        {a.photo ? <PhotoCadree src={urlPhotoPublique(a.photo)} /> : <Icone nom={a.type_bien === "terrain" ? "terrain" : a.type_bien === "bureau" ? "bureau" : "maison"} taille={56} epaisseur={1} className={s.sansPhoto} />}
        <div className={s.badges}>
          <span className={`${s.badge} ${aLouer ? s.louer : s.vendre}`}>{aLouer ? "À louer" : "À vendre"}</span>
          {a.premium && <span className={`${s.badge} ${s.premium}`}>Premium</span>}
          {a.verifiee && <span className={`${s.badge} ${s.verifie}`}><Icone nom="valide" taille={11} epaisseur={3} /> Vérifié</span>}
          {!a.premium && !a.verifiee && nouveau && <span className={`${s.badge} ${s.nouveau}`}>Nouveau</span>}
        </div>
        {a.nb_photos > 0 && (
          <span className={s.nbPhotos}>
            <Icone nom="photo" taille={12} /> {a.nb_photos} photo{a.nb_photos > 1 ? "s" : ""}
          </span>
        )}
        <BoutonFavori annonce={a.id} titre={a.titre} className={s.favori} />
      </div>
      <div className={s.corps}>
        <div className={s.prix}>
          {formaterPrix(a.prix)} <span>FCFA{unite && ` / ${unite}`}</span>
        </div>
        <Titre id={`annonce-${a.id}`} className={s.titre}>
          <Link href={lienAnnonce(a)} className={s.lien}>{a.titre}</Link>
        </Titre>
        <div className={s.lieu}>
          <Icone nom="lieu" taille={13} />
          {lieuAnnonce(a)}
        </div>
        {caracteristiques(a).length > 0 && (
          <ul className={s.caracteristiques}>
            {caracteristiques(a).map((c) => (
              <li key={c.texte}>
                <Icone nom={c.icone} taille={13} />
                {c.texte}
              </li>
            ))}
          </ul>
        )}
        <div className={s.agence}>
          <div className={s.agenceNom}>
            <span className={s.avatar} aria-hidden="true">{initiales(nom)}</span>
            <span className={s.nom}>
              {nom}
              <small>{agence ? "Agence" : "Particulier"}</small>
            </span>
          </div>
          <span className={s.depuis}>{depuis(a.publiee_le)}</span>
        </div>
      </div>
    </article>
  );
}
