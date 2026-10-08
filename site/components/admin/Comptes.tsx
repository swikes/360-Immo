"use client";

/*
 * Administration → Comptes : chercher un compte (e-mail, nom ou téléphone ; sans rien : les derniers inscrits), voir
 * ses annonces, refus et signalements, son identité vérifiée ; Suspendre avec un motif (ses annonces sont retirées, il ne
 * peut plus publier ni contacter ; e-mail à la personne) ou Réactiver. Un administrateur se suspend seulement après avoir
 * perdu son accès.
 * Un numéro par compte : les numéros partagés par plusieurs comptes (inscrits avant la règle) sont listés en haut ;
 * « Libérer le numéro… » le retire d'un compte (réclamé par son vrai propriétaire), avec un motif envoyé par e-mail.
 */
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Icone from "@/components/Icone";
import { chercherComptes, libererNumero, nomCompte, numerosPartages, reactiverCompte, suspendreCompte, type Compte } from "@/lib/admin";
import { messageErreur } from "@/lib/compte";
import { dateJour } from "./outils";
import s from "./Admin.module.css";

export const ROLES: Record<Compte["role"], string> = { particulier: "Particulier", agence: "Agence", admin: "Équipe" };

/** Recherche de comptes, partagée avec l'onglet Équipe */
export function useRecherche(debut = "") {
  const [texte, setTexte] = useState(debut);
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [erreur, setErreur] = useState("");
  const chercher = async (t = texte) => {
    setErreur("");
    try {
      setComptes(await chercherComptes(t));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };
  return { texte, setTexte, comptes, setComptes, erreur, chercher };
}

export function Recherche({ r, etiquette }: { r: ReturnType<typeof useRecherche>; etiquette: string }) {
  const id = useId();
  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    void r.chercher();
  };
  return (
    <form className={s.recherche} onSubmit={envoyer} role="search">
      <label htmlFor={id} className={s.cache}>{etiquette}</label>
      <Icone nom="recherche" taille={16} />
      <input id={id} type="search" className={s.champ} value={r.texte} onChange={(e) => r.setTexte(e.target.value)} placeholder={etiquette} />
      <button type="submit" className={s.boutonPlein}>Chercher</button>
    </form>
  );
}

export default function Comptes({ relire }: { relire: () => void }) {
  const r = useRecherche();
  const [fait, setFait] = useState("");
  const [partages, setPartages] = useState<{ numero: string; comptes: Compte[] }[]>([]);
  const lirePartages = useCallback(() => numerosPartages().then(setPartages, () => {}), []);
  // Au départ : les derniers inscrits, et les numéros partagés
  useEffect(() => {
    let actif = true;
    chercherComptes("").then((c) => actif && r.setComptes(c), () => {});
    numerosPartages().then((p) => actif && setPartages(p), () => {});
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'ouverture de l'onglet
  }, []);

  const apres = (texte: string) => {
    setFait(texte);
    relire();
    void r.chercher();
    void lirePartages();
  };
  return (
    <div className={s.liste}>
      {partages.length > 0 && (
        <section aria-labelledby="numeros-partages" className={s.liste}>
          <h2 id="numeros-partages" className={s.groupeTitre}>Numéros partagés par plusieurs comptes ({partages.length})</h2>
          <p className={s.aide}>
            Un numéro ne sert qu&apos;à un compte. Ces comptes ont été créés avant cette règle, ou quelqu&apos;un a pris le numéro d&apos;une
            autre personne : appelez le numéro, puis libérez-le du compte qui n&apos;est pas le sien.
          </p>
          <ul className={s.cartes} aria-label="Numéros partagés">
            {partages.map((g) => (
              <li key={g.numero} className={s.liste}>
                <h3 className={s.carteTitre}>{g.numero}</h3>
                <ul className={s.cartes}>{g.comptes.map((c) => <CarteCompte key={c.id} c={c} apres={apres} />)}</ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Recherche r={r} etiquette="E-mail, nom ou téléphone" />
      <p className={s.info} role="status">{fait}</p>
      {r.erreur && <p className={s.erreur} role="alert">{r.erreur}</p>}
      {!r.comptes ? <p className={s.attente}>Chargement des comptes…</p>
        : r.comptes.length === 0 ? <p className={s.vide}>Aucun compte ne correspond.</p>
        : (
          <>
            <p className={s.aide}>{r.texte.trim() ? `${r.comptes.length} compte${r.comptes.length > 1 ? "s" : ""} trouvé${r.comptes.length > 1 ? "s" : ""} (20 au plus).` : "Les derniers inscrits."}</p>
            <ul className={s.cartes} aria-label="Comptes">{r.comptes.map((c) => <CarteCompte key={c.id} c={c} apres={apres} />)}</ul>
          </>
        )}
    </div>
  );
}

function CarteCompte({ c, apres }: { c: Compte; apres: (texte: string) => void }) {
  const id = useId();
  const [mode, setMode] = useState<"" | "suspendre" | "liberer">("");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const personne = nomCompte(c);

  const agir = async (action: () => Promise<void>, texte: string) => {
    setEnvoi(true);
    setErreur("");
    try {
      await action();
      setMode("");
      setMotif("");
      apres(texte);
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.annonceurLigne}>
        <h3 id={`${id}-titre`} className={s.carteTitre}>{personne}{c.moi && <span className={s.vous}> (vous)</span>}</h3>
        <span className={s.badges}>
          {c.identite_verifiee && (
            <span className={`${s.badge} ${s.badgeOk}`}>
              Identité vérifiée{c.identite_expire_le ? ` jusqu'au ${dateJour(c.identite_expire_le)}` : ""}
            </span>
          )}
          <span className={`${s.badge} ${c.role === "admin" ? s.badgeOk : ""}`}>{ROLES[c.role]}{c.agence ? ` · ${c.agence}` : ""}</span>
        </span>
      </div>
      <p className={s.meta}>
        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
        {c.telephone && <> · <a href={`tel:${c.telephone.replace(/\s/g, "")}`}>{c.telephone}</a></>}
        {" "}· inscrit le {dateJour(c.inscrit_le)}
      </p>
      <p className={s.meta}>
        {c.annonces_en_ligne} annonce{c.annonces_en_ligne > 1 ? "s" : ""} en ligne sur {c.annonces} envoyée{c.annonces > 1 ? "s" : ""}
        {c.refus > 0 && <> · <strong className={s.attention}>{c.refus} refus ou retrait{c.refus > 1 ? "s" : ""}</strong></>}
        {c.signalements > 0 && <> · <strong className={s.attention}>{c.signalements} signalement{c.signalements > 1 ? "s" : ""}</strong></>}
        {c.demande_agence && <> · demande d&apos;agence « {c.demande_agence} »</>}
      </p>
      {!!c.meme_numero && (
        <p className={s.manque}>
          <Icone nom="telephone" taille={15} /> Même numéro que {c.meme_numero} autre{c.meme_numero > 1 ? "s" : ""} compte{c.meme_numero > 1 ? "s" : ""}
        </p>
      )}
      {c.suspendu_le && (
        <p className={s.erreur}>
          <strong>Suspendu le {dateJour(c.suspendu_le)}</strong>{c.suspension_motif ? ` : ${c.suspension_motif}` : ""}
        </p>
      )}
      {c.suspendu_le ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonPlein} disabled={envoi}
            onClick={() => agir(() => reactiverCompte(c.id), `Le compte de ${personne} est réactivé : la personne est prévenue par e-mail.`)}>
            <Icone nom="valide" taille={16} /> Réactiver le compte
          </button>
        </div>
      ) : c.moi ? null : c.role === "admin" ? (
        <p className={s.aide}>Membre de l&apos;équipe : pour le suspendre, retirez d&apos;abord son accès (onglet Équipe).</p>
      ) : !mode ? (
        <div className={s.actions}>
          <button type="button" className={s.boutonContour} onClick={() => setMode("suspendre")}><Icone nom="cadenas" taille={16} /> Suspendre…</button>
          {c.telephone && (
            <button type="button" className={s.boutonContour} onClick={() => setMode("liberer")}><Icone nom="telephone" taille={16} /> Libérer le numéro…</button>
          )}
        </div>
      ) : mode === "liberer" ? (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>
            Pourquoi retirer le numéro {c.telephone} de ce compte ? (motif envoyé par e-mail ; la personne pourra en ajouter un autre)
          </label>
          <textarea id={`${id}-motif`} className={s.zone} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Ce numéro appartient à une autre personne, qui l'a réclamé." />
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi}
              onClick={() => motif.trim().length < 5 ? setErreur("Écrivez le motif : la personne le recevra par e-mail.")
                : agir(() => libererNumero(c.id, motif), `Le numéro ${c.telephone} est retiré du compte de ${personne} : il peut servir à un autre compte.`)}>
              Retirer le numéro
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className={s.refus}>
          <label htmlFor={`${id}-motif`} className={s.etiquette}>Motif de la suspension (envoyé par e-mail ; ses annonces seront retirées)</label>
          <textarea id={`${id}-motif`} className={s.zone} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Arnaques signalées : avances demandées avant les visites." />
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi}
              onClick={() => motif.trim().length < 5 ? setErreur("Écrivez le motif : la personne le recevra par e-mail.")
                : agir(() => suspendreCompte(c.id, motif), `Le compte de ${personne} est suspendu et ses annonces retirées.`)}>
              Suspendre le compte
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => { setMode(""); setErreur(""); }}>Annuler</button>
          </div>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
