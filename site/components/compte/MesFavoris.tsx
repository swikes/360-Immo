"use client";

/*
 * Mon Espace → Mes favoris : les annonces mises de côté (cœur), la plus récente d'abord, sur tous les appareils.
 * Une annonce retirée depuis (vendue, louée, expirée) reste avec son titre, pour pouvoir l'enlever.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CarteAnnonce from "@/components/CarteAnnonce";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { cartesFavoris, useFavoris, type Favori } from "@/lib/favoris";
import f from "./Formulaire.module.css";
import s from "./MesFavoris.module.css";

export default function MesFavoris() {
  const { ids, pret, basculer } = useFavoris();
  const [cartes, setCartes] = useState<Favori[] | null>(null);
  const [erreur, setErreur] = useState("");
  const lu = useRef(false);

  // Lus une fois : un cœur retiré ici enlève la carte sans tout relire
  useEffect(() => {
    if (!pret || lu.current) return;
    lu.current = true;
    cartesFavoris(ids).then(setCartes, (e) => setErreur(messageErreur(e)));
  }, [pret, ids]);

  if (erreur) return <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>;
  if (!cartes) return <p className={s.attente}>Chargement de vos favoris…</p>;
  const restants = cartes.filter((c) => ids.includes(c.id));

  return (
    <div className={s.favoris}>
      <div className={s.haut}>
        <span className={s.nombre}>
          {restants.length ? `${restants.length} bien${restants.length > 1 ? "s" : ""} sauvegardé${restants.length > 1 ? "s" : ""}` : ""}
        </span>
        <Link href="/annonces" className={s.chercher}>
          <Icone nom="recherche" taille={15} /> Chercher des biens
        </Link>
      </div>
      {restants.length === 0 ? (
        <div className={s.vide}>
          <Icone nom="coeur" taille={28} />
          <p>Aucun favori pour l&apos;instant. Touchez le cœur d&apos;une annonce pour la retrouver ici, sur tous vos appareils.</p>
        </div>
      ) : (
        <div className={s.grille}>
          {restants.map((c) =>
            c.en_ligne ? (
              <CarteAnnonce key={c.id} annonce={c} />
            ) : (
              <div key={c.id} className={s.retiree}>
                <span className={s.etiquette}>Plus en ligne</span>
                <span className={s.titre}>{c.titre}</span>
                <span className={s.explication}>Le bien a peut-être été vendu ou loué, ou l&apos;annonce a expiré.</span>
                <button type="button" className={s.retirer} onClick={() => void basculer(c.id)}>
                  <Icone nom="fermer" taille={14} /> Retirer des favoris
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
