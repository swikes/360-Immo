"use client";

/*
 * Mon Espace → Alertes de recherche : les recherches gardées par le compte, dont les nouvelles annonces arrivent par
 * e-mail chaque matin. Pour chacune : l'essentiel et les souhaits en clair, chaque jour ou chaque semaine, en pause ou
 * active, voir les annonces, modifier (même fenêtre qu'à la création), supprimer. On en crée depuis la liste des
 * annonces (« Créer une alerte ») ou depuis une fiche.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import FenetreAlerte from "@/components/FenetreAlerte";
import Icone from "@/components/Icone";
import {
  ALERTES_MAX, choixDe, construireAlerte, mesAlertes, modifierAlerte, rechercheDe, resumeAlerte, supprimerAlerte,
  type Alerte, type ChoixAlerte, type Frequence,
} from "@/lib/alertes";
import { messageErreur } from "@/lib/compte";
import { resumeRecherche } from "@/lib/recherche";
import f from "./Formulaire.module.css";
import s from "./MesAlertes.module.css";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export default function MesAlertes({ email }: { email: string }) {
  const [alertes, setAlertes] = useState<Alerte[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    mesAlertes().then(
      (a) => actif && setAlertes(a),
      (e) => actif && setErreur(messageErreur(e)),
    );
    return () => {
      actif = false;
    };
  }, []);

  if (erreur && !alertes) {
    return (
      <p className={`${f.message} ${f.messageErreur}`} role="alert">
        <Icone nom="cloche" taille={16} />
        Vos alertes n&apos;ont pas pu être chargées : {erreur}
      </p>
    );
  }
  if (!alertes) return <p className={s.attente}>Chargement de vos alertes…</p>;
  if (!alertes.length) {
    return (
      <div className={s.vide}>
        <Icone nom="cloche" taille={30} />
        <p>
          Aucune alerte pour l&apos;instant. Faites une recherche, puis touchez « Créer une alerte » : les nouvelles
          annonces qui vous intéressent vous arriveront par e-mail.
        </p>
        <Link href="/annonces" className={f.bouton}>Chercher un bien</Link>
      </div>
    );
  }

  const changer = (a: Alerte) => setAlertes((liste) => liste && liste.map((x) => (x.id === a.id ? a : x)));
  const retirer = (id: string) => setAlertes((liste) => liste && liste.filter((x) => x.id !== id));
  return (
    <div className={s.alertes}>
      <p className={s.info}>
        <Icone nom="email" taille={15} />
        <span>
          Les nouvelles annonces arrivent chaque matin à <strong>{email}</strong> · {alertes.length} alerte
          {alertes.length > 1 ? "s" : ""} sur {ALERTES_MAX}
        </span>
      </p>
      <ul className={s.liste}>
        {alertes.map((a) => <CarteAlerte key={a.id} alerte={a} changer={changer} retirer={retirer} />)}
      </ul>
    </div>
  );
}

function CarteAlerte({ alerte: a, changer, retirer }: { alerte: Alerte; changer: (a: Alerte) => void; retirer: (id: string) => void }) {
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [modifier, setModifier] = useState(false);
  const [erreur, setErreur] = useState("");
  // Réglée dans la fenêtre : essentiel et souhaits ; sinon (alertes d'avant la fenêtre) : la recherche d'origine
  const v2 = a.criteres?.v === 2;
  const { essentiels, souhaits } = v2 ? resumeAlerte(choixDe(a)) : { essentiels: resumeRecherche(rechercheDe(a.adresse)), souhaits: [] };
  const idTitre = `alerte-${a.id}`;

  const agir = async (action: () => Promise<void>, ensuite: () => void) => {
    setEnvoi(true);
    setErreur("");
    try {
      await action();
      ensuite();
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };
  const frequence = (fr: Frequence) => agir(() => modifierAlerte(a.id, { frequence: fr }), () => changer({ ...a, frequence: fr }));
  const basculer = () => agir(() => modifierAlerte(a.id, { active: !a.active }), () => changer({ ...a, active: !a.active }));
  const enregistrer = async (choix: ChoixAlerte, fr: Frequence) => {
    const champs = { ...construireAlerte(choix), frequence: fr };
    await modifierAlerte(a.id, champs);
    changer({ ...a, ...champs });
  };

  return (
    <li className={`${s.alerte} ${a.active ? "" : s.enPause}`} aria-labelledby={idTitre}>
      <div className={s.haut}>
        <span className={s.icone} aria-hidden="true"><Icone nom="cloche" taille={18} /></span>
        <div className={s.titres}>
          <h2 id={idTitre} className={s.titre}>{a.nom}</h2>
          {essentiels.length > 0 && (
            <ul className={s.details} aria-label="Critères">
              {essentiels.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
          {souhaits.length > 0 && (
            <div className={s.souhaits}>
              <span>Souhaits :</span>
              <ul className={s.details} aria-label="Souhaits">
                {souhaits.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
        <span className={`${s.etat} ${a.active ? s.etatActive : ""}`}>{a.active ? "Active" : "En pause"}</span>
      </div>
      <p className={s.suivi}>
        Créée le {dateFr(a.cree_le)}
        {a.dernier_envoi ? ` · dernier e-mail le ${dateFr(a.dernier_envoi)}` : " · pas encore de nouvelle annonce"}
      </p>
      <div className={s.reglages}>
        <div className={s.frequence} role="radiogroup" aria-label={`Fréquence de l'alerte ${a.nom}`}>
          {([["quotidienne", "Chaque jour"], ["hebdomadaire", "Chaque semaine"]] as const).map(([valeur, texte]) => {
            const choisie = valeur === "quotidienne" ? a.frequence !== "hebdomadaire" : a.frequence === "hebdomadaire";
            return (
              <button key={valeur} type="button" role="radio" aria-checked={choisie} disabled={envoi}
                className={`${s.option} ${choisie ? s.optionChoisie : ""}`} onClick={() => !choisie && frequence(valeur)}>
                {texte}
              </button>
            );
          })}
        </div>
        <div className={s.actions}>
          <Link href={a.adresse} className={s.lien}>
            <Icone nom="recherche" taille={14} /> Voir les annonces
          </Link>
          <button type="button" className={s.lien} onClick={() => setModifier(true)}>
            <Icone nom="filtres" taille={14} /> Modifier
          </button>
          <button type="button" className={s.lien} disabled={envoi} onClick={basculer}>
            <Icone nom={a.active ? "horloge" : "cloche"} taille={14} /> {a.active ? "Mettre en pause" : "Réactiver"}
          </button>
          {!confirmer ? (
            <button type="button" className={`${s.lien} ${s.danger}`} onClick={() => setConfirmer(true)}>
              <Icone nom="fermer" taille={14} /> Supprimer
            </button>
          ) : (
            <span className={s.confirmation}>
              Supprimer cette alerte ?
              <button type="button" className={`${s.lien} ${s.danger}`} disabled={envoi}
                onClick={() => agir(() => supprimerAlerte(a.id), () => retirer(a.id))}>
                Oui, supprimer
              </button>
              <button type="button" className={s.lien} onClick={() => setConfirmer(false)}>Non</button>
            </span>
          )}
        </div>
      </div>
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
      {modifier && (
        <FenetreAlerte titre="Modifier l'alerte" bouton="Enregistrer" depart={choixDe(a)} valider={enregistrer}
          frequence={a.frequence === "hebdomadaire" ? "hebdomadaire" : "quotidienne"} fermer={() => setModifier(false)} />
      )}
    </li>
  );
}
