"use client";

/*
 * « Créer une alerte » : ouvre la fenêtre de l'alerte (components/FenetreAlerte.tsx), remplie d'après la recherche
 * affichée (liste des annonces, ou biens semblables sur une fiche) ; on y confirme ce que l'on cherche. Sans compte :
 * l'alerte réglée est gardée, fenêtre « Connectez-vous », puis elle est créée au retour sur la page.
 * Un message en bas de l'écran confirme.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { demanderConnexion } from "@/components/DemandeConnexion";
import FenetreAlerte from "@/components/FenetreAlerte";
import Icone from "@/components/Icone";
import {
  alerteEnAttente, choixDepuisRecherche, creerAlerte, garderAlerteEnAttente, rechercheDe, type ChoixAlerte, type Frequence,
} from "@/lib/alertes";
import { messageErreur, useCompte } from "@/lib/compte";
import s from "./BoutonAlerte.module.css";

type Avis = { type: "creee" | "existe" | "erreur"; texte: string; frequence?: Frequence };
type Props = {
  /** recherche de la liste des annonces (/annonces?…) */
  adresse: string;
  className?: string;
  texte?: string;
};

export default function BoutonAlerte({ adresse, className, texte = "Créer une alerte" }: Props) {
  const { etat } = useCompte();
  const [avis, setAvis] = useState<Avis | null>(null);
  const [ouvert, setOuvert] = useState(false);
  /** derniers choix de la fenêtre (rouverte telle quelle) */
  const [reglage, setReglage] = useState<{ choix: ChoixAlerte; frequence: Frequence } | null>(null);
  /** alerte créée (ou déjà là) : le bouton le dit, même une fois le message fermé */
  const [faite, setFaite] = useState(false);
  /** sans compte : fenêtre « Connectez-vous » une fois la fenêtre de l'alerte fermée */
  const connexion = useRef(false);

  /** alerte créée (ou déjà là) : message, bouton « Alerte créée », fenêtre rouverte avec ces choix */
  const confirmer = (choix: ChoixAlerte, frequence: Frequence) => ({ resultat, nom }: Awaited<ReturnType<typeof creerAlerte>>) => {
    setReglage({ choix, frequence });
    setAvis({ type: resultat, texte: nom, frequence });
    setFaite(true);
  };

  // De retour après la connexion : l'alerte réglée est créée
  useEffect(() => {
    if (etat !== "connecte") return;
    const attente = alerteEnAttente();
    if (attente?.page !== adresse) return;
    garderAlerteEnAttente(null);
    creerAlerte(attente.choix, attente.frequence).then(
      confirmer(attente.choix, attente.frequence),
      (e) => setAvis({ type: "erreur", texte: messageErreur(e) }),
    );
  }, [etat, adresse]);

  // Le message s'efface tout seul
  useEffect(() => {
    if (!avis) return;
    const t = window.setTimeout(() => setAvis(null), 12_000);
    return () => window.clearTimeout(t);
  }, [avis]);

  const valider = async (choix: ChoixAlerte, frequence: Frequence) => {
    if (etat !== "connecte") {
      garderAlerteEnAttente({ page: adresse, choix, frequence });
      setReglage({ choix, frequence });
      connexion.current = true;
      return;
    }
    confirmer(choix, frequence)(await creerAlerte(choix, frequence));
  };
  const fermer = () => {
    setOuvert(false);
    if (connexion.current) {
      connexion.current = false;
      demanderConnexion("alerte");
    }
  };

  const confirmee = avis?.type === "creee" || avis?.type === "existe";
  return (
    <>
      <button type="button" className={className} disabled={etat === "chargement"} aria-label={faite ? "Alerte créée" : texte}
        onClick={() => {
          setAvis(null);
          setOuvert(true);
        }}>
        <Icone nom={faite ? "valide" : "cloche"} taille={15} />
        <span className={s.texte}>{faite ? "Alerte créée" : texte}</span>
      </button>
      {ouvert && (
        <FenetreAlerte titre="Créer une alerte" bouton="Créer l'alerte" valider={valider} fermer={fermer}
          depart={reglage?.choix ?? choixDepuisRecherche(rechercheDe(adresse))} frequence={reglage?.frequence ?? "quotidienne"}
          note={etat !== "connecte" ? "Vous vous connecterez ensuite (compte gratuit) : l'alerte sera créée aussitôt." : undefined} />
      )}
      <div className={s.zone} role="status">
        {avis && (
          <div className={`${s.avis} ${avis.type === "erreur" ? s.avisAttention : ""}`}>
            <Icone nom={confirmee ? "cloche" : "recherche"} taille={18} />
            <p>
              {avis.type === "creee" && (
                <>
                  Alerte créée : les nouvelles annonces « {avis.texte} » vous arriveront par e-mail,{" "}
                  {avis.frequence === "hebdomadaire" ? "chaque semaine" : "chaque matin"}.
                </>
              )}
              {avis.type === "existe" && <>Vous avez déjà une alerte avec ces critères : « {avis.texte} ».</>}
              {avis.type === "erreur" && avis.texte}
              {confirmee && <> <Link href="/mon-espace?section=alertes">Gérer mes alertes</Link></>}
            </p>
            <button type="button" className={s.fermer} onClick={() => setAvis(null)} aria-label="Fermer le message">
              <Icone nom="fermer" taille={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
