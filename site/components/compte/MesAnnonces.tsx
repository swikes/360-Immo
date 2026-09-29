"use client";

/*
 * Mon Espace → Mes annonces : chaque annonce avec sa photo, son état et ce qu'on peut en faire.
 *   brouillon : continuer, supprimer            en vérification : modifier, supprimer
 *   en ligne : modifier, vendu / loué, renouveler (15 derniers jours ou expirée)
 *   refusée : motif, corriger                    retirée : remettre en ligne (nouvelle vérification), supprimer
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icone from "@/components/Icone";
import {
  STATUTS, changerStatut, joursRestants, lieuTexte, mesAnnonces, photosTriees, prixTexte, renouveler, supprimerAnnonce,
  urlPhoto, type Annonce,
} from "@/lib/annonces";
import { messageErreur } from "@/lib/compte";
import f from "./Formulaire.module.css";
import s from "./MesAnnonces.module.css";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function MesAnnonces({ auteur }: { auteur: string }) {
  const [annonces, setAnnonces] = useState<Annonce[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [info, setInfo] = useState("");

  const charger = useCallback(
    () => mesAnnonces(auteur).then(setAnnonces, (e) => setErreur(messageErreur(e))),
    [auteur],
  );
  useEffect(() => {
    charger();
  }, [charger]);

  const agir = async (a: Annonce, action: () => Promise<unknown>, reussite: string) => {
    setEnCours(a.id);
    setErreur("");
    setInfo("");
    try {
      await action();
      setInfo(reussite);
      await charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnCours(null);
  };

  if (!annonces) return erreur ? <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p> : <p className={s.attente}>Chargement de vos annonces…</p>;

  return (
    <div className={s.liste}>
      <div className={s.haut}>
        <span className={s.nombre}>
          {annonces.length} annonce{annonces.length > 1 ? "s" : ""}
        </span>
        <Link href="/publier" className={s.publier}>
          <Icone nom="plus" taille={15} epaisseur={2.5} /> Publier une annonce
        </Link>
      </div>
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
      {info && <p className={`${f.message} ${f.messageSucces}`} role="status"><Icone nom="valide" taille={16} /> {info}</p>}

      {annonces.length === 0 && (
        <div className={s.vide}>
          <Icone nom="document" taille={28} />
          <p>Vous n&apos;avez pas encore d&apos;annonce.</p>
          <Link href="/publier" className={f.bouton}>Publier ma première annonce</Link>
        </div>
      )}

      <ul className={s.annonces}>
        {annonces.map((a) => {
          const photo = photosTriees(a)[0];
          const jours = joursRestants(a);
          const expiree = a.statut === "publiee" && jours !== null && jours <= 0;
          const renouvelable = a.statut === "publiee" && jours !== null && jours <= 15;
          const occupe = enCours === a.id;
          const modifier = (
            <Link href={`/publier?annonce=${a.id}`} className={s.action}>
              <Icone nom="document" taille={14} /> {a.statut === "brouillon" ? "Continuer" : a.statut === "refusee" ? "Corriger" : "Modifier"}
            </Link>
          );
          const supprimer = (
            <button type="button" className={`${s.action} ${s.actionDanger}`} disabled={occupe}
              onClick={() => window.confirm(`Supprimer définitivement l'annonce « ${a.titre} » et ses photos ?`) &&
                agir(a, () => supprimerAnnonce(a), "Annonce supprimée.")}>
              <Icone nom="fermer" taille={14} /> Supprimer
            </button>
          );
          return (
            <li key={a.id} className={s.annonce} aria-busy={occupe || undefined}>
              <div className={s.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element -- photo du stockage Supabase */}
                {photo ? <img src={urlPhoto(photo.chemin)} alt="" loading="lazy" /> : <Icone nom="maison" taille={26} />}
                <span className={`${s.statut} ${s[`statut_${expiree ? "expiree" : a.statut}`]}`}>
                  {expiree ? "Expirée" : STATUTS[a.statut].texte}
                </span>
              </div>
              <div className={s.corps}>
                <span className={s.titre}>{a.titre}</span>
                <span className={s.prix}>{prixTexte(a.prix, a.loyer_par)}</span>
                <span className={s.detail}>
                  <Icone nom="lieu" taille={12} /> {lieuTexte(a) || "Lieu à préciser"} · réf. {a.reference}
                </span>
                <span className={s.detail}>
                  {a.statut === "publiee" && a.expire_le
                    ? expiree
                      ? `Expirée le ${dateFr(a.expire_le)} : plus visible. Renouvelez-la pour 90 jours.`
                      : `En ligne jusqu'au ${dateFr(a.expire_le)} · ${a.vues} vue${a.vues > 1 ? "s" : ""}`
                    : `${STATUTS[a.statut].aide} Modifiée le ${dateFr(a.modifie_le)}.`}
                </span>
                {a.statut === "refusee" && a.motif_refus && <span className={s.motif}>Motif du refus : {a.motif_refus}</span>}
                <div className={s.actions}>
                  {modifier}
                  {a.statut === "publiee" && (
                    <button type="button" className={s.action} disabled={occupe}
                      onClick={() => window.confirm(`« ${a.titre} » est vendu ou loué ? L'annonce sera retirée du site.`) &&
                        agir(a, () => changerStatut(a.id, "archivee"), "Annonce retirée du site.")}>
                      <Icone nom="valide" taille={14} /> {a.transaction === "vente" ? "Vendu" : "Loué"}
                    </button>
                  )}
                  {renouvelable && (
                    <button type="button" className={`${s.action} ${s.actionPrincipale}`} disabled={occupe}
                      onClick={() => agir(a, () => renouveler(a.id), "Annonce renouvelée pour 90 jours.")}>
                      <Icone nom="horloge" taille={14} /> Renouveler
                    </button>
                  )}
                  {a.statut === "archivee" && (
                    <button type="button" className={s.action} disabled={occupe}
                      onClick={() => agir(a, () => changerStatut(a.id, "en_attente"), "Annonce renvoyée pour vérification.")}>
                      <Icone nom="entree" taille={14} /> Remettre en ligne
                    </button>
                  )}
                  {a.statut !== "publiee" && supprimer}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
