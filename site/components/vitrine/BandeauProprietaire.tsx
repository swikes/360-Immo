"use client";

/*
 * Sur sa propre vitrine (compte connecté) : « C'est votre vitrine », avec le bouton pour la partager.
 * Invisible pour les visiteurs.
 */
import { useEffect, useState } from "react";
import BoutonPartage from "@/components/BoutonPartage";
import Icone from "@/components/Icone";
import { lireProfil, useCompte } from "@/lib/compte";
import s from "./EnteteVitrine.module.css";

export default function BandeauProprietaire({ code, nom, adresse }: { code: string; nom: string; adresse: string }) {
  const { utilisateur } = useCompte();
  const [sienne, setSienne] = useState(false);
  const id = utilisateur?.id;
  useEffect(() => {
    if (!id) return;
    let actif = true;
    lireProfil(id).then((p) => actif && setSienne(p.code_vitrine === code), () => {});
    return () => {
      actif = false;
    };
  }, [id, code]);
  if (!sienne || !id) return null;
  return (
    <div className={s.bandeau} role="note">
      <p className={s.bandeauTexte}>
        <Icone nom="maison" taille={16} />
        <span>
          <strong>C&apos;est votre vitrine.</strong> Vos clients y voient toutes vos annonces en ligne et peuvent les filtrer.
          Choisissez leurs critères, puis « Partager » pour leur envoyer la sélection.
        </span>
      </p>
      <BoutonPartage adresse={adresse} nom="Partager ma vitrine" texteBouton="Partager ma vitrine"
        texte={`Découvrez mes annonces immobilières (${nom}) sur 360-Immo.ci :`} />
    </div>
  );
}
