"use client";

/*
 * Administration → Documents : les demandes de vérification envoyées depuis Mon Espace → Vérification.
 *   Identité   CNI (recto et verso) ou passeport (page photo), et photo de la personne tenant la pièce
 *   Agence     RCCM et logo de l'agence
 *   Bien       titre de propriété ou mandat d'une annonce
 * Chaque document s'ouvre par un lien valable 10 minutes (dossier privé). Valider donne le badge (identité : l'équipe note
 * le numéro et la date de fin de la pièce, gardée pour une éventuelle plainte) ; Refuser demande un motif, que la
 * personne reçoit par e-mail. Les autres documents sont ensuite supprimés du dossier privé.
 * En bas : « Pièces d'identité conservées » : en cas de plainte, retrouver une pièce (nom, e-mail, téléphone ou numéro de
 * la pièce, même d'un compte supprimé depuis moins d'un an) et l'ouvrir avec le motif, noté au journal.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { nomCompte } from "@/lib/admin";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { taille } from "@/lib/photos";
import {
  consulterPieces, demandesVerification, liensDocuments, MOTIFS_REFUS_DOCUMENTS, NOM_CHOIX, NOM_PIECE, piecesConservees,
  traiterVerification, type DemandeVerification, type FichierEnvoye, type PieceConservee,
} from "@/lib/verifications";
import { dateHeure, dateJour } from "./outils";
import s from "./Admin.module.css";

const SUJETS = { identite: "Identité", agence: "Agence", bien: "Bien" } as const;

export default function Documents({ relire }: { relire: () => void }) {
  const [demandes, setDemandes] = useState<DemandeVerification[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => demandesVerification().then(setDemandes, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    demandesVerification().then((d) => actif && setDemandes(d), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);
  const apres = (texte: string) => {
    setFait(texte);
    relire();
    void charger();
  };

  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!demandes) return <p className={s.attente}>Chargement des documents…</p>;
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      <section aria-labelledby="demandes-documents" className={s.liste}>
        <h2 id="demandes-documents" className={s.groupeTitre}>À vérifier ({demandes.length})</h2>
        <p className={s.aide}>
          Ouvrez chaque document et comparez-le au compte : nom, photo, validité de la pièce ; nom de l&apos;agence sur le RCCM ;
          lieu et superficie du bien sur le titre. Ne les enregistrez pas ailleurs : la pièce d&apos;identité validée est gardée
          ici (compte + 1 an) ; les autres documents sont supprimés dès votre décision.
        </p>
        {demandes.length === 0 ? (
          <p className={s.vide}>Aucun document à vérifier.</p>
        ) : (
          <ul className={s.cartes}>{demandes.map((d) => <CarteDemande key={d.id} d={d} apres={apres} />)}</ul>
        )}
      </section>
      <PiecesConservees />
    </div>
  );
}

/** Les documents en vignettes (photos) ou en lien (PDF), ouverts par des liens temporaires */
function Vignettes({ fichiers, etiquette }: { fichiers: FichierEnvoye[]; etiquette: string }) {
  const [liens, setLiens] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    liensDocuments(fichiers).then((l) => actif && setLiens(l), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [fichiers]);
  return (
    <>
      <ul className={s.documents} aria-label={etiquette}>
        {fichiers.map((x) => {
          const lien = liens?.[x.chemin];
          const nom = NOM_PIECE[x.piece] ?? x.piece;
          return (
            <li key={x.chemin} className={s.document}>
              <span className={s.documentNom}>{nom}</span>
              {!lien ? (
                <span className={s.documentApercu}>{erreur || liens ? "Lien indisponible" : "…"}</span>
              ) : x.type.startsWith("image/") ? (
                <a href={lien} target="_blank" rel="noopener" className={s.documentApercu} aria-label={`Ouvrir : ${nom}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lien} alt="" />
                </a>
              ) : (
                <a href={lien} target="_blank" rel="noopener" className={`${s.documentApercu} ${s.documentPdf}`}>
                  <Icone nom="document" taille={26} /> Ouvrir le PDF
                </a>
              )}
              <span className={s.documentDetail}>{x.nom} · {taille(x.taille)}</span>
            </li>
          );
        })}
      </ul>
      {erreur && <p className={s.erreur} role="alert">Les documents n&apos;ont pas pu être ouverts : {erreur}</p>}
    </>
  );
}

function CarteDemande({ d, apres }: { d: DemandeVerification; apres: (texte: string) => void }) {
  const id = useId();
  const [mode, setMode] = useState<"" | "valider" | "refuser">("");
  const [motif, setMotif] = useState("");
  const [numero, setNumero] = useState("");
  const [fin, setFin] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const personne = nomCompte(d.compte);
  const sujet = d.type === "identite" ? personne : d.type === "agence" ? `« ${d.agence ?? ""} »` : `« ${d.annonce?.titre ?? ""} »`;
  const dePiece = d.type_piece === "passeport" ? "du passeport" : d.type_piece === "cni" ? "de la CNI" : "de la pièce";

  const decider = async () => {
    if (mode === "refuser" && motif.trim().length < 5) return setErreur("Écrivez le motif : la personne le recevra par e-mail.");
    if (mode === "valider" && d.type === "identite" && (!numero.trim() || !fin)) {
      return setErreur("Notez le numéro et la date de fin de validité de la pièce : ils servent en cas de plainte.");
    }
    setEnvoi(true);
    setErreur("");
    try {
      await traiterVerification(d, mode === "valider" ? "valider" : "refuser", motif, d.type === "identite" ? { numero, fin } : undefined);
      apres(mode === "valider"
        ? d.type === "identite"
          ? `Identité de ${personne} vérifiée jusqu'au ${dateJour(fin)} : badge donné, e-mail envoyé ; la pièce est conservée (plainte).`
          : `${SUJETS[d.type]} ${sujet} : vérification validée, badge donné. ${personne} est prévenu(e) par e-mail ; les documents sont supprimés.`
        : `${SUJETS[d.type]} ${sujet} : vérification refusée. ${personne} reçoit le motif par e-mail ; les documents sont supprimés.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.badges}>
        <span className={`${s.badge} ${s.badgeInfo}`}>{SUJETS[d.type]}</span>
        {d.type === "identite" && d.type_piece && <span className={s.badge}>{NOM_CHOIX[d.type_piece]}</span>}
      </div>
      <h3 id={`${id}-titre`} className={s.carteTitre}>
        {d.type === "bien" && d.annonce ? (
          d.annonce.en_ligne ? <Link href={lienAnnonce(d.annonce)} target="_blank">{d.annonce.titre}</Link> : d.annonce.titre
        ) : d.type === "agence" ? `Agence « ${d.agence ?? ""} »` : personne}
      </h3>
      {d.annonce && (
        <p className={s.meta}>
          Réf. {d.annonce.reference}{d.annonce.commune ? ` · ${d.annonce.commune}` : ""} · {d.annonce.en_ligne ? "en ligne" : "en vérification"}
        </p>
      )}
      <p className={s.meta}>
        Envoyée le {dateHeure(d.cree_le)} par <strong>{personne}</strong>
        {d.compte.email && <> · <a href={`mailto:${d.compte.email}`}>{d.compte.email}</a></>}
        {d.compte.telephone && <> · <a href={`tel:${d.compte.telephone.replace(/\s/g, "")}`}>{d.compte.telephone}</a></>}
      </p>
      <p className={s.meta}>
        Inscrit le {dateJour(d.compte.inscrit_le)} · {d.compte.annonces_en_ligne} annonce{d.compte.annonces_en_ligne > 1 ? "s" : ""} en ligne
        {d.compte.refus > 0 && <> · <strong className={s.attention}>{d.compte.refus} refus</strong></>}
        {d.compte.signalements > 0 && <> · <strong className={s.attention}>{d.compte.signalements} signalement{d.compte.signalements > 1 ? "s" : ""}</strong></>}
      </p>
      {d.note && <p className={s.description}>« {d.note} »</p>}

      <Vignettes fichiers={d.fichiers} etiquette="Documents envoyés" />

      {!mode ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonPlein} onClick={() => setMode("valider")}><Icone nom="valide" taille={16} /> Valider…</button>
          <button type="button" className={s.boutonContour} onClick={() => setMode("refuser")}><Icone nom="fermer" taille={16} /> Refuser…</button>
        </div>
      ) : mode === "valider" && d.type === "identite" ? (
        <div className={s.refus}>
          <span className={s.etiquette}>
            Le nom et la photo {dePiece} correspondent à {personne} ? Notez son numéro et sa date de fin : ils servent en cas
            de plainte, et une pièce ne vérifie qu&apos;un seul compte.
          </span>
          <div className={s.champs}>
            <label className={s.etiquette}>
              Numéro {dePiece}
              <input type="text" className={s.champ} value={numero} maxLength={30} autoComplete="off" onChange={(e) => setNumero(e.target.value)} />
            </label>
            <label className={s.etiquette}>
              Valable jusqu&apos;au
              <input type="date" className={s.champ} value={fin} onChange={(e) => setFin(e.target.value)} />
            </label>
          </div>
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={decider}>Valider l&apos;identité</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      ) : mode === "valider" ? (
        <div className={s.confirmation}>
          <span>
            {d.type === "agence" ? `Donner le badge « Agence vérifiée » à ${sujet}${d.fichiers.some((x) => x.piece === "logo") ? " et afficher son logo" : ""} ?` : `Donner le badge « Bien vérifié » à ${sujet} ?`}
          </span>
          <button type="button" className={s.boutonPlein} disabled={envoi} onClick={decider}>Oui, valider</button>
          <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setMode("")}>Non</button>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif du refus (envoyé par e-mail : la personne renvoie les bons documents)</label>
          <div className={s.puces} role="group" aria-label="Motifs courants">
            {MOTIFS_REFUS_DOCUMENTS[d.type].map((m) => (
              <button key={m} type="button" className={s.puce} onClick={() => setMotif(m)}>{m.split(" :")[0]}</button>
            ))}
          </div>
          <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Photo floue : on doit pouvoir lire toute la pièce." />
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi} onClick={decider}>Refuser la vérification</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}

/** En cas de plainte : retrouver une pièce d'identité conservée et l'ouvrir avec le motif (noté au journal) */
function PiecesConservees() {
  const id = useId();
  const [texte, setTexte] = useState("");
  const [pieces, setPieces] = useState<PieceConservee[] | null>(null);
  const [erreur, setErreur] = useState("");
  const chercher = async (e: FormEvent) => {
    e.preventDefault();
    setErreur("");
    try {
      setPieces(await piecesConservees(texte));
    } catch (x) {
      setErreur(messageErreur(x));
    }
  };
  return (
    <section aria-labelledby={`${id}-titre`} className={s.liste}>
      <h2 id={`${id}-titre`} className={s.groupeTitre}>Pièces d&apos;identité conservées (plaintes)</h2>
      <p className={s.aide}>
        En cas de plainte contre un annonceur : cherchez sa pièce par son nom, son e-mail, son téléphone ou le numéro de la pièce
        (même si le compte a été supprimé depuis moins d&apos;un an), puis ouvrez-la en écrivant le motif. Chaque ouverture est
        notée au journal, avec votre nom.
      </p>
      <form className={s.recherche} onSubmit={chercher} role="search">
        <label htmlFor={`${id}-texte`} className={s.cache}>Nom, e-mail, téléphone ou numéro de la pièce</label>
        <Icone nom="recherche" taille={16} />
        <input id={`${id}-texte`} type="search" className={s.champ} value={texte} onChange={(e) => setTexte(e.target.value)}
          placeholder="Nom, e-mail, téléphone ou numéro de la pièce" />
        <button type="submit" className={s.boutonPlein}>Chercher</button>
      </form>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      {pieces && (pieces.length === 0
        ? <p className={s.vide}>Aucune pièce conservée ne correspond.</p>
        : <ul className={s.cartes} aria-label="Pièces conservées">{pieces.map((p) => <CartePiece key={p.id} p={p} />)}</ul>)}
    </section>
  );
}

function CartePiece({ p }: { p: PieceConservee }) {
  const id = useId();
  const [ouvrir, setOuvrir] = useState(false);
  const [motif, setMotif] = useState("");
  const [fichiers, setFichiers] = useState<FichierEnvoye[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const titulaire = p.titulaire ? nomCompte(p.titulaire) : p.nom_actuel ?? "Sans nom";

  const consulter = async () => {
    if (motif.trim().length < 5) return setErreur("Écrivez le motif (la plainte reçue) : il est noté au journal.");
    setEnvoi(true);
    setErreur("");
    try {
      setFichiers(await consulterPieces(p.id, motif));
      setOuvrir(false);
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.annonceurLigne}>
        <h3 id={`${id}-titre`} className={s.carteTitre}>{titulaire}</h3>
        <span className={`${s.badge} ${p.compte_supprime ? s.badgeAlerte : p.badge ? s.badgeOk : ""}`}>
          {p.compte_supprime ? "Compte supprimé" : p.badge ? "Badge affiché" : "Badge retiré ou expiré"}
        </span>
      </div>
      <p className={s.meta}>
        {p.type_piece ? NOM_CHOIX[p.type_piece] : "Pièce"} n° <strong>{p.numero_piece ?? "non noté"}</strong>
        {p.piece_expire_le && <> · valable jusqu&apos;au {dateJour(p.piece_expire_le)}</>}
        {" "}· vérifiée le {dateJour(p.validee_le)}
      </p>
      {p.titulaire && (
        <p className={s.meta}>
          Au jour de la vérification : {[p.titulaire.email, p.titulaire.telephone].filter(Boolean).join(" · ") || "sans contact"}
          {p.nom_actuel && p.nom_actuel !== titulaire && <> · nom actuel du compte : <strong>{p.nom_actuel}</strong></>}
        </p>
      )}
      <p className={s.meta}>
        {p.conserver_jusqu_au ? `Supprimée le ${dateJour(p.conserver_jusqu_au)}` : "Gardée tant que le compte existe"}
        {p.consultations > 0 && <> · déjà ouverte {p.consultations} fois</>}
      </p>
      {fichiers ? (
        <Vignettes fichiers={fichiers} etiquette="Pièce d'identité conservée" />
      ) : !ouvrir ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonContour} onClick={() => setOuvrir(true)}><Icone nom="cadenas" taille={16} /> Ouvrir pour une plainte…</button>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif (noté au journal avec votre nom)</label>
          <textarea id={`${id}-motif`} className={s.zone} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Plainte de M. Traoré du 12 octobre : avance de 100 000 FCFA demandée, bien inexistant." />
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={consulter}>Ouvrir la pièce</button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setOuvrir(false); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
