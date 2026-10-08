"use client";

/*
 * Administration → Équipe : les membres de l'équipe (comptes « admin ») ; retirer l'accès d'un membre (jamais le
 * sien : l'équipe n'est jamais sans administrateur) ; donner l'accès à un compte existant, trouvé par son e-mail ou son
 * nom (la personne crée d'abord son compte sur le site ; elle reçoit un e-mail). Chaque changement va au journal.
 */
import { useCallback, useEffect, useState } from "react";
import Icone from "@/components/Icone";
import { changerAccesAdmin, equipe, nomCompte, type Administrateur, type Compte } from "@/lib/admin";
import { messageErreur } from "@/lib/compte";
import { Recherche, ROLES, useRecherche } from "./Comptes";
import { dateJour } from "./outils";
import s from "./Admin.module.css";

export default function Equipe() {
  const [membres, setMembres] = useState<Administrateur[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");
  const r = useRecherche();

  const charger = useCallback(() => equipe().then(setMembres, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    equipe().then((m) => actif && setMembres(m), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);
  const apres = (texte: string) => {
    setFait(texte);
    void charger();
    if (r.comptes) void r.chercher();
  };

  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!membres) return <p className={s.attente}>Chargement de l&apos;équipe…</p>;
  const candidats = (r.comptes ?? []).filter((c) => c.role !== "admin");
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      <section aria-labelledby="membres" className={s.liste}>
        <h2 id="membres" className={s.groupeTitre}>Membres de l&apos;équipe ({membres.length})</h2>
        <ul className={s.cartes} aria-label="Membres de l'équipe">
          {membres.map((m) => (
            <Ligne key={m.id} c={m} detail={m.depuis ? `membre depuis le ${dateJour(m.depuis)}` : null} donner={false} apres={apres} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="ajouter" className={s.liste}>
        <h2 id="ajouter" className={s.groupeTitre}>Ajouter un membre</h2>
        <p className={s.aide}>
          La personne crée d&apos;abord son compte sur le site. Cherchez-la par son e-mail ou son nom, puis donnez-lui l&apos;accès :
          elle reçoit un e-mail et voit l&apos;espace Administration dans Mon Espace.
        </p>
        <Recherche r={r} etiquette="E-mail ou nom de la personne" />
        {r.erreur && <p className={s.erreur} role="alert">{r.erreur}</p>}
        {r.comptes && (candidats.length === 0
          ? <p className={s.vide}>Aucun compte ne correspond (les membres de l&apos;équipe sont déjà listés plus haut).</p>
          : <ul className={s.cartes} aria-label="Comptes trouvés">
              {candidats.map((c) => <Ligne key={c.id} c={c} detail={`${ROLES[c.role]}${c.agence ? ` · ${c.agence}` : ""}`} donner apres={apres} />)}
            </ul>)}
      </section>
    </div>
  );
}

function Ligne({ c, detail, donner, apres }: { c: Compte; detail: string | null; donner: boolean; apres: (texte: string) => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const personne = nomCompte(c);

  const agir = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await changerAccesAdmin(c.id, donner);
      apres(donner ? `${personne} fait maintenant partie de l'équipe : un e-mail l'a prévenue.` : `${personne} n'a plus accès à l'espace Administration.`);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <li className={`${s.carte} ${s.carteCourte}`}>
      <div className={s.annonceurLigne}>
        <span className={s.membre}>
          <strong>{personne}</strong>{c.moi && <span className={s.vous}> (vous)</span>}
          <span className={s.meta}>{[c.email, c.telephone, detail].filter(Boolean).join(" · ")}</span>
        </span>
        {!c.moi && !confirmer && (
          <button type="button" className={donner ? s.boutonPlein : s.boutonContour} disabled={envoi || !!c.suspendu_le} onClick={() => setConfirmer(true)}>
            <Icone nom={donner ? "bouclier" : "fermer"} taille={15} /> {donner ? "Donner l'accès administrateur" : "Retirer l'accès"}
          </button>
        )}
      </div>
      {c.suspendu_le && donner && <p className={s.aide}>Compte suspendu : réactivez-le d&apos;abord (onglet Comptes).</p>}
      {confirmer && (
        <div className={s.confirmation}>
          <span>{donner ? `Donner à ${personne} l'accès à tout l'espace Administration ?` : `Retirer l'accès de ${personne} ?`}</span>
          <button type="button" className={donner ? s.boutonPlein : s.boutonDanger} disabled={envoi} onClick={agir}>Oui, confirmer</button>
          <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setConfirmer(false)}>Non</button>
        </div>
      )}
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
    </li>
  );
}
