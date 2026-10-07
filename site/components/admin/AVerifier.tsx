"use client";

/*
 * Administration → À vérifier : les annonces envoyées, les plus anciennes d'abord. Pour chacune : photos (en grand
 * au toucher), prix, lieu, caractéristiques, description, contact affiché et compte de l'auteur ; « Revérification »
 * pour une annonce déjà publiée puis beaucoup modifiée. Publier, ou Refuser avec un motif (choix rapides ou texte
 * libre) que l'annonceur lit dans Mes annonces et reçoit par e-mail.
 */
import { useCallback, useEffect, useId, useState } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import { DECISIONS, MOTIFS_REFUS, annoncesAVerifier, modererAnnonce, type AnnonceAVerifier } from "@/lib/admin";
import { prixTexte } from "@/lib/annonces";
import { urlPhotoPublique } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { caracteristiques, dateHeure, dateJour } from "./outils";
import s from "./Admin.module.css";

export default function AVerifier({ relire }: { relire: () => void }) {
  const [annonces, setAnnonces] = useState<AnnonceAVerifier[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  useEffect(() => {
    let actif = true;
    annoncesAVerifier().then((a) => actif && setAnnonces(a), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  const decide = useCallback((a: AnnonceAVerifier, texte: string) => {
    setAnnonces((liste) => liste && liste.filter((x) => x.id !== a.id));
    setFait(texte);
    relire();
  }, [relire]);

  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!annonces) return <p className={s.attente}>Chargement des annonces à vérifier…</p>;
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      {annonces.length === 0 ? (
        <div className={s.vide}>
          <Icone nom="valide" taille={28} />
          <p>Rien à vérifier pour l&apos;instant : toutes les annonces envoyées ont été traitées.</p>
        </div>
      ) : (
        <>
          <p className={s.aide}>
            {annonces.length} annonce{annonces.length > 1 ? "s" : ""} à vérifier, les plus anciennes d&apos;abord. Regardez les photos,
            le prix et le contact ; en cas de doute, appelez l&apos;annonceur avant de décider.
          </p>
          <ul className={s.cartes}>
            {annonces.map((a) => <Carte key={a.id} a={a} decide={decide} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function Carte({ a, decide }: { a: AnnonceAVerifier; decide: (a: AnnonceAVerifier, texte: string) => void }) {
  const id = useId();
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const agir = async (decision: "publier" | "refuser") => {
    if (decision === "refuser" && motif.trim().length < 5) return setErreur("Écrivez le motif : l'annonceur le lira pour corriger son annonce.");
    setEnvoi(true);
    setErreur("");
    try {
      await modererAnnonce(a.id, decision, decision === "refuser" ? motif : undefined);
      decide(a, decision === "publier" ? `« ${a.titre} » est en ligne : l'annonceur est prévenu par e-mail.` : `« ${a.titre} » est refusée : l'annonceur lit le motif dans Mes annonces.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  const details = caracteristiques(a);
  const telephone = (tel: string, whatsapp: boolean) => (
    <span className={s.telephone} key={tel}>
      <a href={`tel:${tel.replace(/\s/g, "")}`}>{tel}</a>
      {whatsapp && (
        <a href={`https://wa.me/${tel.replace(/\D/g, "")}`} target="_blank" rel="noopener" className={s.whatsapp} aria-label={`WhatsApp ${tel}`}>
          <IconeWhatsApp />
        </a>
      )}
    </span>
  );
  const auteur = [a.auteur.prenom, a.auteur.nom].filter(Boolean).join(" ") || "Sans nom";
  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.badges}>
        {a.publiee_le && (
          <span className={`${s.badge} ${s.badgeInfo}`}>
            Revérification : en ligne depuis le {dateJour(a.publiee_le)}, modifiée (prix, lieu, type ou photos)
          </span>
        )}
        {a.signalements > 0 && (
          <span className={`${s.badge} ${s.badgeAlerte}`}>{a.signalements} signalement{a.signalements > 1 ? "s" : ""} en attente</span>
        )}
        {a.derniere_decision && (
          <span className={s.badge}>
            Dernière décision : {DECISIONS[a.derniere_decision.decision].toLowerCase()} le {dateJour(a.derniere_decision.le)}
            {a.derniere_decision.motif ? ` (« ${a.derniere_decision.motif} »)` : ""}
          </span>
        )}
      </div>
      <h2 id={`${id}-titre`} className={s.carteTitre}>{a.titre}</h2>
      <p className={s.prix}>{prixTexte(a.prix, a.loyer_par)}</p>
      <p className={s.meta}>
        {a.type_nom} {a.transaction === "vente" ? "à vendre" : "à louer"} · {[a.quartier, a.commune, a.ville].filter(Boolean).join(", ")}
        {a.quartier_hors_liste && <span className={s.horsListe}>quartier écrit à la main</span>}
        {" "}· réf. {a.reference} · envoyée le {dateHeure(a.modifie_le)}
      </p>

      {a.photos.length ? (
        <ul className={s.photos} aria-label={`${a.photos.length} photo${a.photos.length > 1 ? "s" : ""}`}>
          {a.photos.map((p, i) => (
            <li key={p}>
              <a href={urlPhotoPublique(p)} target="_blank" rel="noopener" className={s.photo} aria-label={`Photo ${i + 1} en grand`}>
                <PhotoCadree src={urlPhotoPublique(p)} alt={`Photo ${i + 1}`} />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.manque}><Icone nom="photo" taille={15} /> Aucune photo</p>
      )}

      {details.length > 0 && <ul className={s.details} aria-label="Caractéristiques">{details.map((d) => <li key={d}>{d}</li>)}</ul>}
      {a.description?.trim()
        ? <p className={s.description}>{a.description}</p>
        : <p className={s.manque}><Icone nom="document" taille={15} /> Pas de description</p>}
      {a.commodites.length > 0 && <p className={s.commodites}>{a.commodites.join(" · ")}</p>}
      {a.adresse && <p className={s.meta}>Adresse précise (non publiée) : {a.adresse}</p>}

      <div className={s.colonnes}>
        <section className={s.encadre} aria-label="Contact affiché sur l'annonce">
          <h3 className={s.encadreTitre}>Contact affiché</h3>
          <p>{a.contact_nom || "—"} · {a.type_vendeur === "agence" ? "Agence" : "Particulier"}</p>
          <p className={s.telephones}>
            {a.contact_telephone && telephone(a.contact_telephone, a.contact_whatsapp)}
            {a.contact_telephone2 && telephone(a.contact_telephone2, a.contact_telephone2_whatsapp)}
            {!a.contact_telephone && !a.contact_telephone2 && "Aucun numéro"}
          </p>
          {a.contact_email && <p><a href={`mailto:${a.contact_email}`}>{a.contact_email}</a></p>}
        </section>
        <section className={s.encadre} aria-label="Compte de l'auteur">
          <h3 className={s.encadreTitre}>Compte de l&apos;auteur</h3>
          <p>
            {auteur} · {a.auteur.agence ? `Agence ${a.auteur.agence}` : a.auteur.role === "agence" ? "Agence" : a.auteur.role === "admin" ? "Équipe" : "Particulier"}
          </p>
          <p className={s.telephones}>
            {a.auteur.telephone && telephone(a.auteur.telephone, false)}
            {a.auteur.email && <a href={`mailto:${a.auteur.email}`}>{a.auteur.email}</a>}
          </p>
          <p className={s.meta}>
            Inscrit le {dateJour(a.auteur.inscrit_le)} · {a.auteur.en_ligne} annonce{a.auteur.en_ligne > 1 ? "s" : ""} en ligne
            {a.auteur.refusees > 0 && <> · <strong className={s.attention}>{a.auteur.refusees} refus ou retrait{a.auteur.refusees > 1 ? "s" : ""}</strong></>}
          </p>
        </section>
      </div>

      {!refus ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => agir("publier")}>
            <Icone nom="valide" taille={16} /> Publier
          </button>
          <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setRefus(true)}>
            <Icone nom="fermer" taille={16} /> Refuser…
          </button>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif du refus (l&apos;annonceur le lit pour corriger son annonce)</label>
          <div className={s.puces} role="group" aria-label="Motifs courants">
            {MOTIFS_REFUS.map((m) => (
              <button key={m} type="button" className={s.puce} onClick={() => setMotif(m)}>{m.split(" :")[0]}</button>
            ))}
          </div>
          <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Photos floues : ajoutez des photos nettes du salon et des chambres." />
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi} onClick={() => agir("refuser")}>Refuser l&apos;annonce</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setRefus(false); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
