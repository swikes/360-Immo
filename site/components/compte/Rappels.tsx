"use client";

/*
 * Mon Espace → Rappels : les personnes qui demandent à être rappelées pour vos annonces (avec leur numéro : Appeler,
 * WhatsApp ; puis « Marquer comme rappelé ») et, avec un compte, vos propres demandes (suivre, annuler).
 * Les demandes déjà traitées sont rangées à part. Même présentation que Mon Espace → Visites.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { rafraichirNonLus } from "@/lib/messages";
import { mesRappels, texteMoment, traiterRappel, type Rappel } from "@/lib/rappels";
import f from "./Formulaire.module.css";
import s from "./Visites.module.css";

const quand = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) + " à " +
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function Rappels() {
  const [rappels, setRappels] = useState<Rappel[] | null>(null);
  const [erreur, setErreur] = useState("");

  const lire = useCallback(async () => {
    try {
      setRappels(await mesRappels());
      setErreur("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    let actif = true;
    mesRappels().then(
      (r) => actif && setRappels(r),
      (e) => actif && setErreur(messageErreur(e)),
    );
    return () => {
      actif = false;
    };
  }, []);

  if (erreur && !rappels) {
    return (
      <p className={`${f.message} ${f.messageErreur}`} role="alert">
        <Icone nom="telephone" taille={16} />
        Vos demandes de rappel n&apos;ont pas pu être chargées : {erreur}
      </p>
    );
  }
  if (!rappels) return <p className={s.attente}>Chargement de vos demandes de rappel…</p>;
  if (!rappels.length) {
    return (
      <div className={s.vide}>
        <Icone nom="telephone" taille={30} />
        <p>
          Aucune demande de rappel pour l&apos;instant. Les personnes intéressées par vos annonces peuvent laisser leur
          numéro avec « Être rappelé » : elles apparaîtront ici.
        </p>
      </div>
    );
  }

  const aRappeler = rappels.filter((r) => r.role === "annonceur" && r.statut === "a_rappeler");
  const envoyes = rappels.filter((r) => r.role === "demandeur" && r.statut === "a_rappeler");
  const traites = rappels.filter((r) => r.statut !== "a_rappeler");
  const carte = (r: Rappel) => <CarteRappel key={r.id} r={r} relire={lire} />;
  return (
    <div className={s.visites}>
      {aRappeler.length > 0 && (
        <section className={s.groupe} aria-labelledby="rappels-a-faire">
          <h2 id="rappels-a-faire" className={s.groupeTitre}>À rappeler <span className={s.nombre}>{aRappeler.length}</span></h2>
          <ul className={s.liste}>{aRappeler.map(carte)}</ul>
        </section>
      )}
      {envoyes.length > 0 && (
        <section className={s.groupe} aria-labelledby="rappels-envoyes">
          <h2 id="rappels-envoyes" className={s.groupeTitre}>Mes demandes <span className={s.nombre}>{envoyes.length}</span></h2>
          <ul className={s.liste}>{envoyes.map(carte)}</ul>
        </section>
      )}
      {!aRappeler.length && !envoyes.length && <p className={s.attente}>Aucun rappel en attente.</p>}
      {traites.length > 0 && (
        <details className={s.anciennes}>
          <summary>Déjà traitées ({traites.length})</summary>
          <ul className={s.liste}>{traites.map(carte)}</ul>
        </details>
      )}
    </div>
  );
}

function CarteRappel({ r, relire }: { r: Rappel; relire: () => Promise<void> }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const annonceur = r.role === "annonceur";
  const idTitre = `rappel-${r.id}`;
  const statut =
    r.statut === "rappele" ? { texte: annonceur ? "Rappelé" : "Rappelé par l'annonceur", classe: s.confirmee }
    : r.statut === "annule" ? { texte: annonceur ? "Annulée par la personne" : "Annulée", classe: s.annulee }
    : { texte: annonceur ? "À rappeler" : "En attente de l'appel", classe: annonceur ? s.aTraiter : s.attenteStatut };

  const agir = async (action: "fait" | "a_faire" | "annuler") => {
    setEnvoi(true);
    setErreur("");
    try {
      await traiterRappel(r.id, action);
      rafraichirNonLus();
      await relire();
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };
  const texteWhatsapp = `Bonjour ${r.nom}, je vous rappelle au sujet de votre demande sur 360-Immo.ci pour « ${r.annonce.titre} » (réf. ${r.annonce.reference}).`;

  return (
    <li className={`${s.visite} ${r.statut === "a_rappeler" ? "" : s.ancienne}`} aria-labelledby={idTitre}>
      <div className={s.infos}>
        <div className={s.ligneHaut}>
          <span className={`${s.statut} ${statut.classe}`}>{statut.texte}</span>
          <span className={s.role}>
            Demandé le {quand(r.cree_le)}
            {r.traite_le && r.statut === "rappele" ? ` · rappelé le ${quand(r.traite_le)}` : ""}
          </span>
        </div>
        <h3 id={idTitre} className={s.titre}>
          <span className={s.cache}>Rappel de {r.nom} : </span>
          {r.annonce.en_ligne ? <Link href={lienAnnonce(r.annonce)}>{r.annonce.titre}</Link> : r.annonce.titre}
          {!r.annonce.en_ligne && <span className={s.horsLigne}>Plus en ligne</span>}
        </h3>
        {annonceur ? (
          <div className={s.visiteur}>
            <span className={s.visiteurNom}>
              <Icone nom="personne" taille={14} /> {r.nom}
              {!r.avec_compte && <span className={s.sansCompte}>sans compte</span>}
            </span>
            {r.telephone && r.statut !== "annule" && (
              <span className={s.liensContact}>
                <a href={`tel:${r.telephone.replace(/\s/g, "")}`} className={s.lienContact}>
                  <Icone nom="telephone" taille={14} /> {r.telephone}
                </a>
                <a href={`https://wa.me/${r.telephone.replace(/\D/g, "")}?text=${encodeURIComponent(texteWhatsapp)}`} target="_blank"
                  rel="noopener" className={`${s.lienContact} ${s.lienWhatsapp}`}>
                  <IconeWhatsApp /> WhatsApp
                </a>
              </span>
            )}
          </div>
        ) : (
          <p className={s.role}>Annonceur : {r.annonceur}</p>
        )}
        <p className={s.mot}><span className={s.motAuteur}>Quand :</span> {texteMoment(r.moment)}</p>
        {r.message && (
          <p className={s.mot}>
            <span className={s.motAuteur}>{annonceur ? "Son message" : "Votre message"} :</span> {r.message}
          </p>
        )}
        <div className={s.actions}>
          {annonceur && r.statut === "a_rappeler" && (
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => agir("fait")}>
              <Icone nom="valide" taille={15} /> Marquer comme rappelé
            </button>
          )}
          {annonceur && r.statut === "rappele" && (
            <button type="button" className={s.boutonDiscret} disabled={envoi} onClick={() => agir("a_faire")}>
              Remettre à rappeler
            </button>
          )}
          {!annonceur && r.statut === "a_rappeler" && (
            <button type="button" className={s.boutonDiscret} disabled={envoi} onClick={() => agir("annuler")}>
              Annuler ma demande
            </button>
          )}
        </div>
        {erreur && (
          <p className={`${f.message} ${f.messageErreur}`} role="alert">
            <Icone nom="telephone" taille={16} />
            {erreur}
          </p>
        )}
      </div>
    </li>
  );
}
