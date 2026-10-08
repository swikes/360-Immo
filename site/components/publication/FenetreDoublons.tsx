"use client";

/*
 * « Vous avez déjà une annonce qui ressemble à celle-ci » : à l'envoi d'une annonce pour vérification, si l'annonceur
 * en a déjà une semblable (mêmes caractéristiques ou mêmes photos : supabase/migrations/…_doublons.sql).
 * Un bien = une seule annonce : il modifie, renouvelle ou remet en ligne l'annonce existante, ou confirme qu'il s'agit
 * d'un autre bien (l'équipe voit alors « Doublon possible » en la vérifiant).
 */
import Link from "next/link";
import { useEffect, useRef } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import { STATUTS, prixTexte, urlPhoto, type AnnonceSemblable } from "@/lib/annonces";
import s from "./FenetreDoublons.module.css";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

const etat = (a: AnnonceSemblable) =>
  a.statut === "effacee" ? `Supprimée le ${dateFr(a.efface_le!)}` : a.statut === "publiee" && a.expiree ? "Expirée" : STATUTS[a.statut].texte;

function conseil(a: AnnonceSemblable): string {
  switch (a.statut) {
    case "publiee":
      return a.expiree
        ? "Renouvelez-la plutôt (c'est gratuit) depuis Mon Espace → Mes annonces."
        : "Elle est déjà en ligne : modifiez-la si quelque chose a changé (prix, photos, description).";
    case "en_attente":
      return "Elle est déjà en vérification : modifiez-la si besoin.";
    case "refusee":
      return "Corrigez-la et renvoyez-la plutôt.";
    case "archivee":
      return "Remettez-la en ligne plutôt, depuis Mon Espace → Mes annonces.";
    case "effacee":
      return "Supprimer une annonce puis republier le même bien n'est pas permis.";
    default:
      return "";
  }
}

const raison = (a: AnnonceSemblable) =>
  a.photos > 0
    ? `${a.photos} photo${a.photos > 1 ? "s" : ""} identique${a.photos > 1 ? "s" : ""}${a.caracteristiques ? ", mêmes caractéristiques" : ""}`
    : "Mêmes type, lieu, prix et nombre de pièces";

type Props = {
  semblables: AnnonceSemblable[];
  /** « Annuler l'envoi » : retour au formulaire */
  fermer: () => void;
  /** « C'est un autre bien : envoyer » */
  envoyer: () => void;
};

export default function FenetreDoublons({ semblables, fermer, envoyer }: Props) {
  const boite = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!boite.current?.open) boite.current?.showModal();
  }, []);
  const plusieurs = semblables.length > 1;
  return (
    <dialog ref={boite} className={s.boite} aria-labelledby="titre-doublons" aria-describedby="texte-doublons" onClose={fermer}>
      <div className={s.contenu}>
        <span className={s.icone} aria-hidden="true"><Icone nom="bouclier" taille={22} /></span>
        <h2 id="titre-doublons" className={s.titre}>
          {plusieurs ? "Vous avez déjà des annonces qui ressemblent à celle-ci" : "Vous avez déjà une annonce qui ressemble à celle-ci"}
        </h2>
        <p id="texte-doublons" className={s.texte}>
          Un bien = une seule annonce. Publier deux fois le même bien n&apos;est pas permis : la nouvelle annonce serait refusée.
        </p>
        <ul className={s.liste}>
          {semblables.map((a) => (
            <li key={a.reference} className={s.annonce}>
              <div className={s.photo}>
                {a.photo ? <PhotoCadree src={urlPhoto(a.photo)} alt="" /> : <Icone nom="photo" taille={22} />}
              </div>
              <div className={s.infos}>
                <p className={s.nom}>{a.titre}</p>
                <p className={s.meta}>
                  {prixTexte(a.prix, a.loyer_par)} · réf. {a.reference} · <span className={s.etat}>{etat(a)}</span>
                </p>
                <p className={s.raison}>{raison(a)}</p>
                <p className={s.conseil}>{conseil(a)}</p>
                {a.id && (
                  <Link href={a.statut === "archivee" || (a.statut === "publiee" && a.expiree) ? "/mon-espace?section=annonces" : `/publier?annonce=${a.id}`}
                    className={s.lien} onClick={() => boite.current?.close()}>
                    {a.statut === "archivee" || (a.statut === "publiee" && a.expiree) ? "Voir dans Mes annonces"
                      : a.statut === "refusee" ? "Corriger cette annonce" : "Modifier cette annonce"}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className={s.astuce}>
          <Icone nom="maison" taille={15} /> Plusieurs logements identiques (même résidence, même lotissement) ? Une seule annonce suffit :
          indiquez dans sa description le nombre de logements disponibles.
        </p>
        <div className={s.boutons}>
          <button type="button" className={s.plein} onClick={() => boite.current?.close()}>Annuler l&apos;envoi</button>
          <button type="button" className={s.contour} onClick={() => { envoyer(); boite.current?.close(); }}>
            C&apos;est un autre bien : envoyer
          </button>
        </div>
      </div>
    </dialog>
  );
}
