"use client";

/*
 * Mon Espace → Mes annonces : chaque annonce avec sa photo, son état et ce qu'on peut en faire.
 *   brouillon : continuer, supprimer            en vérification : modifier, supprimer
 *   en ligne : statistiques, modifier, vendu / loué, renouveler (15 derniers jours ou expirée)
 *   refusée : motif, corriger                    retirée : remettre en ligne (nouvelle vérification), supprimer
 * En haut, « Ma vitrine » : la page de toutes ses annonces en ligne (/annonceur/…), à envoyer aux clients.
 * Chaque annonce en ligne se partage aussi seule (WhatsApp, lien).
 * Offres payantes (lib/offres.ts, si le paiement est ouvert) : « Faire voir mon annonce » (remonter, Premium), état du
 * Premium et des remontées automatiques.
 */
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import BoutonPartage, { ChoixPartage } from "@/components/BoutonPartage";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import {
  STATUTS, changerStatut, joursRestants, lieuTexte, maVitrine, mesAnnonces, photosTriees, prixTexte, renouveler,
  supprimerAnnonce, urlVignette, type Annonce,
} from "@/lib/annonces";
import { lienAnnonce, lienVitrine, type Vitrine } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { dateComplete } from "@/lib/format";
import { PAIEMENTS_OUVERTS, mesOffres, premiumActif, programmerRemontees, visiteEnCours, type MesOffres } from "@/lib/offres";
import { texteCreneau } from "@/lib/creneaux";
import FenetreBooster from "@/components/offres/FenetreBooster";
import f from "./Formulaire.module.css";
import s from "./MesAnnonces.module.css";


export default function MesAnnonces({ auteur, codeVitrine, statistiques }: {
  auteur: string; codeVitrine: string | null;
  /** ouvre Mon Espace → Statistiques sur cette annonce */
  statistiques?: (id: string) => void;
}) {
  const [annonces, setAnnonces] = useState<Annonce[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  // Offres payantes : ce qui est payé d'avance et programmé ; l'annonce dont la fenêtre « Faire voir » est ouverte
  const [offres, setOffres] = useState<MesOffres | null>(null);
  const [booster, setBooster] = useState<Annonce | null>(null);

  const charger = useCallback(
    () => Promise.all([
      mesAnnonces(auteur).then(setAnnonces, (e) => setErreur(messageErreur(e))),
      PAIEMENTS_OUVERTS ? mesOffres().then(setOffres, () => {}) : null,
    ]),
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
        <span className={s.hautLiens}>
          {PAIEMENTS_OUVERTS && <Link href="/offres" className={s.offres}><Icone nom="etoile" taille={14} /> Nos offres</Link>}
          <Link href="/publier" className={s.publier}>
            <Icone nom="plus" taille={15} epaisseur={2.5} /> Publier une annonce
          </Link>
        </span>
      </div>
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
      {info && <p className={`${f.message} ${f.messageSucces}`} role="status"><Icone nom="valide" taille={16} /> {info}</p>}

      {codeVitrine && annonces.length > 0 && <MaVitrine code={codeVitrine} annonces={annonces} />}

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
          const enAvant = a.statut === "publiee" && !expiree;
          const programme = offres?.programmees.find((x) => x.annonce === a.id);
          const visite = visiteEnCours(offres, a.id);
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
                {photo ? <PhotoCadree src={urlVignette(photo.chemin)} /> : <Icone nom="maison" taille={26} />}
                <span className={`${s.statut} ${s[`statut_${expiree ? "expiree" : a.statut}`]}`}>
                  {expiree ? "Expirée" : STATUTS[a.statut].texte}
                </span>
              </div>
              <div className={s.corps}>
                <span className={s.titre}>{a.titre}</span>
                <span className={s.prix}>{prixTexte(a.prix, a.loyer_par)}</span>
                <span className={s.detail}>
                  <Icone nom="lieu" taille={12} />
                  <span>
                    {lieuTexte(a) || "Lieu à préciser"} · <span className={s.reference}>réf. {a.reference}</span>
                  </span>
                </span>
                <span className={s.detail}>
                  {a.statut === "publiee" && a.expire_le
                    ? expiree
                      ? `Expirée le ${dateComplete(a.expire_le)} : plus visible. Renouvelez-la pour 90 jours.`
                      : `En ligne jusqu'au ${dateComplete(a.expire_le)} · ${a.vues} vue${a.vues > 1 ? "s" : ""}`
                    : `${STATUTS[a.statut].aide} Modifiée le ${dateComplete(a.modifie_le)}.`}
                </span>
                {a.statut === "refusee" && a.motif_refus && <span className={s.motif}>Motif du refus : {a.motif_refus}</span>}
                {enAvant && premiumActif(a) && a.premium_jusquau && (
                  <span className={s.premium}><Icone nom="etoile" taille={12} /> Premium jusqu&apos;au {dateComplete(a.premium_jusquau)}</span>
                )}
                {a.bien_visite_le && (
                  <span className={s.visite}><Icone nom="bouclier" taille={12} /> Bien visité le {dateComplete(a.bien_visite_le)}</span>
                )}
                {visite && (
                  <span className={s.detail}>
                    <Icone nom="calendrier" taille={12} />
                    <span>
                      {visite.statut === "planifiee" && visite.rendez_vous
                        ? `Visite « Bien visité » : l'agent ${visite.agent ?? ""} passe le ${texteCreneau(visite.rendez_vous)}.`
                        : "Visite « Bien visité » demandée : l'équipe 360-Immo.ci vous appelle pour fixer le rendez-vous."}
                    </span>
                  </span>
                )}
                {enAvant && a.remontee_le && a.publiee_le && a.remontee_le > a.publiee_le && (
                  <span className={s.detail}><Icone nom="monter" taille={12} /> Remontée le {dateComplete(a.remontee_le)}</span>
                )}
                {programme && (
                  <span className={s.detail}>
                    <Icone nom="horloge" taille={12} />
                    <span>
                      Remontées automatiques tous les {programme.tous_les} jours : prochaine le {dateComplete(programme.prochaine)}.{" "}
                      <button type="button" className={s.lienBouton} disabled={occupe}
                        onClick={() => agir(a, () => programmerRemontees(a.id, false), "Remontées automatiques arrêtées.")}>
                        Arrêter
                      </button>
                    </span>
                  </span>
                )}
              </div>
              <div className={s.actions}>
                {enAvant && PAIEMENTS_OUVERTS && (
                  <button type="button" className={`${s.action} ${s.actionOr}`} onClick={() => setBooster(a)}>
                    <Icone nom="monter" taille={14} /> Faire voir mon annonce
                  </button>
                )}
                {a.statut === "publiee" && !expiree && (
                  <Link href={lienAnnonce(a)} className={`${s.action} ${s.actionPrincipale}`}>
                    <Icone nom="voir" taille={14} /> Voir l&apos;annonce
                  </Link>
                )}
                {a.statut === "publiee" && !expiree && (
                  <BoutonPartage adresse={lienAnnonce(a)} texte={`${a.titre} — ${prixTexte(a.prix, a.loyer_par)}`}
                    nom="Partager l'annonce" style="discret" aide="Envoyez cette annonce à un client ou à un proche." />
                )}
                {statistiques && a.publiee_le && (a.statut === "publiee" || a.statut === "archivee") && (
                  <button type="button" className={s.action} onClick={() => statistiques(a.id)}>
                    <Icone nom="statistiques" taille={14} /> Statistiques
                  </button>
                )}
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
            </li>
          );
        })}
      </ul>
      {booster && (
        <FenetreBooster annonce={booster} offres={offres} fermer={() => setBooster(null)}
          fait={(message) => {
            setInfo(message);
            charger();
          }} />
      )}
    </div>
  );
}

const sansAbonnement = () => () => {};

/** Encadré « Ma vitrine » : son adresse, le nom sous lequel on y apparaît, et de quoi l'envoyer */
function MaVitrine({ code, annonces }: { code: string; annonces: Annonce[] }) {
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const site = useSyncExternalStore(sansAbonnement, () => window.location.host, () => "");
  // relue quand les annonces changent (une annonce retirée ou renouvelée change le nombre en ligne)
  useEffect(() => {
    let actif = true;
    maVitrine(code).then((v) => actif && setVitrine(v), () => {});
    return () => {
      actif = false;
    };
  }, [code, annonces]);
  if (!vitrine) return null;
  const lien = lienVitrine(vitrine);
  return (
    <section className={s.vitrine} aria-labelledby="ma-vitrine">
      <div className={s.vitrineTexte}>
        <h3 id="ma-vitrine" className={s.vitrineTitre}><Icone nom="maison" taille={17} /> Ma vitrine</h3>
        <p>
          Toutes vos annonces en ligne sur une seule page, avec les filtres. Envoyez-la à vos clients : ils y
          cherchent eux-mêmes le bien qui leur convient.
        </p>
        <p className={s.vitrineInfos}>
          <span className={s.vitrineAdresse}>{site}{lien}</span>
          <span>
            {vitrine.total} annonce{vitrine.total > 1 ? "s" : ""} en ligne · vous y apparaissez sous le nom « {vitrine.nom} »
          </span>
        </p>
      </div>
      <div className={s.vitrineBoutons}>
        <Link href={lien} className={`${s.action} ${s.actionPrincipale}`}>
          <Icone nom="voir" taille={14} /> Voir ma vitrine
        </Link>
        <ChoixPartage adresse={lien} texte={`Découvrez mes annonces immobilières (${vitrine.nom}) sur 360-Immo.ci :`} classe={s.action} />
      </div>
    </section>
  );
}
