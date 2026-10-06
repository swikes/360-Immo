"use client";

/*
 * « Créer une alerte » : la recherche affichée (liste des annonces, ou biens semblables sur une fiche) devient une
 * alerte ; ses nouvelles annonces arrivent par e-mail chaque matin (lib/alertes.ts). Sans compte : fenêtre
 * « Connectez-vous », puis l'alerte est créée au retour sur la page. Un message en bas de l'écran confirme.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { demanderConnexion } from "@/components/DemandeConnexion";
import Icone from "@/components/Icone";
import { alerteEnAttente, alertePossible, creerAlerte, garderAlerteEnAttente, rechercheDe } from "@/lib/alertes";
import { messageErreur, useCompte } from "@/lib/compte";
import { adresseAlerte, titreRecherche } from "@/lib/recherche";
import s from "./BoutonAlerte.module.css";

type Avis = { type: "creee" | "existe" | "vide" | "erreur"; texte?: string };
type Props = {
  /** recherche de la liste des annonces (/annonces?…) */
  adresse: string;
  className?: string;
  texte?: string;
};

export default function BoutonAlerte({ adresse, className, texte = "Créer une alerte" }: Props) {
  const { etat } = useCompte();
  const [avis, setAvis] = useState<Avis | null>(null);
  const [envoi, setEnvoi] = useState(false);
  /** alerte créée (ou déjà là) : le bouton le dit, même une fois le message fermé */
  const [faite, setFaite] = useState(false);
  const recherche = rechercheDe(adresse);
  const cible = adresseAlerte(recherche);
  const nom = titreRecherche(recherche);

  const resultat = (p: Promise<"creee" | "existe">) =>
    p.then(
      (type) => {
        setAvis({ type });
        setFaite(true);
      },
      (e) => setAvis({ type: "erreur", texte: messageErreur(e) }),
    ).finally(() => setEnvoi(false));

  // De retour après la connexion : l'alerte demandée est créée
  useEffect(() => {
    if (etat !== "connecte" || alerteEnAttente() !== cible) return;
    garderAlerteEnAttente(null);
    void resultat(creerAlerte(cible));
  }, [etat, cible]);

  // Le message s'efface tout seul
  useEffect(() => {
    if (!avis) return;
    const t = window.setTimeout(() => setAvis(null), 12_000);
    return () => window.clearTimeout(t);
  }, [avis]);

  const toucher = () => {
    if (envoi || etat === "chargement") return;
    if (!alertePossible(adresse)) return setAvis({ type: "vide" });
    if (etat !== "connecte") {
      garderAlerteEnAttente(cible);
      demanderConnexion("alerte");
      return;
    }
    setEnvoi(true);
    void resultat(creerAlerte(cible));
  };

  const creee = avis?.type === "creee" || avis?.type === "existe";
  return (
    <>
      <button type="button" className={className} onClick={toucher} disabled={envoi} aria-label={faite ? "Alerte créée" : texte}>
        <Icone nom={faite ? "valide" : "cloche"} taille={15} />
        <span className={s.texte}>{faite ? "Alerte créée" : texte}</span>
      </button>
      <div className={s.zone} role="status">
        {avis && (
          <div className={`${s.avis} ${avis.type === "erreur" || avis.type === "vide" ? s.avisAttention : ""}`}>
            <Icone nom={creee ? "cloche" : "recherche"} taille={18} />
            <p>
              {avis.type === "creee" && <>Alerte créée : les nouvelles annonces « {nom} » vous arriveront par e-mail, chaque matin.</>}
              {avis.type === "existe" && <>Vous avez déjà cette alerte : « {nom} ».</>}
              {avis.type === "vide" && <>Choisissez d&apos;abord ce que vous cherchez (louer ou acheter, un type de bien, un lieu…), puis créez l&apos;alerte.</>}
              {avis.type === "erreur" && avis.texte}
              {creee && <> <Link href="/mon-espace?section=alertes">Gérer mes alertes</Link></>}
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
