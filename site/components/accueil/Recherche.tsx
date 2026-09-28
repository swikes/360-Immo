"use client";

/*
 * Recherche de l'accueil : Acheter / Louer (au mois ou à la journée) / Vendre, lieu, type de bien, budget.
 * Les critères qui n'ont pas de sens pour le type de bien ne sont pas proposés (lib/regles-biens.ts) :
 * la location à la journée, par exemple, n'existe que pour les logements.
 * « Rechercher » ouvre la liste des annonces avec les critères dans l'adresse (lib/recherche.ts).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formaterPrix } from "@/lib/format";
import { LIEUX } from "@/lib/lieux";
import { adresseAnnonces, chiffres } from "@/lib/recherche";
import { reglesPour } from "@/lib/regles-biens";
import Icone from "../Icone";
import s from "./Recherche.module.css";

const TYPES = ["Appartement", "Maison / Villa", "Terrain", "Bureau", "Commerce / Magasin", "Immeuble"];
const POPULAIRES = ["Cocody", "Plateau", "Marcory", "Yopougon", "Riviera", "Bingerville"];

export default function Recherche() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"acheter" | "louer">("acheter");
  const [duree, setDuree] = useState<"mois" | "jour">("mois");
  const [lieu, setLieu] = useState("");
  const [type, setType] = useState("");
  const [budget, setBudget] = useState("");

  const location = onglet === "louer";
  const regles = reglesPour(type ? [type] : [], location ? "location" : "vente");
  // À la journée : seulement pour les logements (pas un terrain, un bureau, un commerce…)
  const journalierePossible = regles.loyerPar.includes("Jour");
  const journaliere = location && journalierePossible && duree === "jour";
  const libelleBudget = location ? `Loyer max (FCFA / ${journaliere ? "jour" : "mois"})` : "Prix max (FCFA)";

  const adresse = (autreLieu?: string) =>
    adresseAnnonces({
      location,
      journaliere,
      types: type ? [type] : [],
      lieu: autreLieu ?? lieu,
      max: budget,
    });

  const rechercher = (e: FormEvent) => {
    e.preventDefault();
    router.push(adresse());
  };

  return (
    <form className={s.recherche} onSubmit={rechercher} role="search" aria-label="Rechercher un bien">
      <div className={s.onglets}>
        <button type="button" className={s.onglet} aria-pressed={!location} onClick={() => setOnglet("acheter")}>
          Acheter
        </button>
        <button type="button" className={s.onglet} aria-pressed={location} onClick={() => setOnglet("louer")}>
          Louer
        </button>
        <Link href="/publier" className={s.onglet} title="Vendre son bien : publier une annonce">
          Vendre
        </Link>
      </div>

      {location && (
        <div className={s.duree} role="group" aria-label="Type de location">
          <span className={s.dureeTitre}>Type de location</span>
          <button type="button" className={s.dureeBtn} aria-pressed={!journaliere} onClick={() => setDuree("mois")}>
            <Icone nom="calendrier" taille={12} />
            Mensuelle
          </button>
          {journalierePossible && (
            <button type="button" className={s.dureeBtn} aria-pressed={journaliere} onClick={() => setDuree("jour")}>
              <Icone nom="horloge" taille={12} />
              Journalière
            </button>
          )}
        </div>
      )}

      <div className={s.boite}>
        <div className={s.champs}>
          <div className={`${s.champ} ${s.champLieu}`}>
            <label htmlFor="rechercheLieu">Villes, communes, quartiers</label>
            <div className={s.saisie}>
              <Icone nom="lieu" />
              <input
                id="rechercheLieu"
                type="text"
                list="listeLieux"
                autoComplete="off"
                placeholder="Ex : Abidjan, Cocody, Marcory…"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
              />
              <datalist id="listeLieux">
                {LIEUX.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
          </div>
          <div className={s.champ}>
            <label htmlFor="rechercheType">Type de bien</label>
            <div className={s.saisie}>
              <Icone nom="maison" />
              <select id="rechercheType" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tous les biens</option>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={s.champ}>
            <label htmlFor="rechercheBudget">{libelleBudget}</label>
            <div className={s.saisie}>
              <Icone nom="argent" />
              <input
                id="rechercheBudget"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex : 500 000"
                value={budget && formaterPrix(Number(budget))}
                onChange={(e) => setBudget(chiffres(e.target.value).slice(0, 12))}
              />
            </div>
          </div>
        </div>

        <div className={s.bas}>
          <div className={s.populaires}>
            <span className={s.populairesTitre}>Populaire :</span>
            {POPULAIRES.map((p) => (
              <Link key={p} href={adresse(p)} className={s.populaire}>
                {p}
              </Link>
            ))}
          </div>
          <button type="submit" className={s.rechercher}>
            <Icone nom="recherche" epaisseur={2.5} />
            Rechercher
          </button>
        </div>
      </div>
    </form>
  );
}
