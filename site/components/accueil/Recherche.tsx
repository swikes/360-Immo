"use client";

/*
 * Recherche de l'accueil : Louer (au mois ou à la journée, choisi d'office) / Acheter / Publier, lieu, type de bien,
 * budget.
 * Les types de bien sont ceux de la publication (lib/regles-biens.ts), et les critères qui n'ont pas de sens
 * pour le type choisi ne sont pas proposés : la location à la journée, par exemple, n'existe que pour les
 * logements, et une chambre d'hôtel ne s'achète pas.
 * « Plus de critères » ouvre les critères avancés (components/accueil/CriteresAvances.tsx).
 * « Rechercher » ouvre la liste des annonces avec les critères dans l'adresse (lib/recherche.ts).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formaterPrix } from "@/lib/format";
import { AVANCES_VIDES, adresseAnnonces, avancesValables, chiffres, nombreAvances, type Avances } from "@/lib/recherche";
import { aLaJournee, auMois, reglesPour, typesProposes } from "@/lib/regles-biens";
import ChampLieu from "../ChampLieu";
import Icone from "../Icone";
import CriteresAvances from "./CriteresAvances";
import s from "./Recherche.module.css";

const POPULAIRES = ["Cocody", "Plateau", "Marcory", "Yopougon", "Riviera", "Bingerville"];

export default function Recherche() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"acheter" | "louer">("louer");
  const [duree, setDuree] = useState<"mois" | "jour">("mois");
  const [lieu, setLieu] = useState("");
  const [type, setType] = useState("");
  const [budget, setBudget] = useState("");
  const [prixMin, setPrixMin] = useState("");
  const [avances, setAvances] = useState<Avances>(AVANCES_VIDES);
  const [plus, setPlus] = useState(false); // « Plus de critères » ouvert

  const location = onglet === "louer";
  // Mêmes types que la publication ; à l'achat, pas ceux qui ne se vendent pas (chambre d'hôtel)
  const types = typesProposes(location ? "location" : "vente");
  const typeChoisi = types.includes(type) ? type : "";
  const regles = reglesPour(typeChoisi ? [typeChoisi] : [], location ? "location" : "vente");
  // Au mois ou à la journée selon le bien : un terrain ne se loue pas à la journée,
  // une chambre d'hôtel se loue à la nuit et jamais au mois
  const moisPossible = auMois(regles);
  const journalierePossible = aLaJournee(regles);
  const journaliere = location && journalierePossible && (duree === "jour" || !moisPossible);
  const unite = !journaliere ? "mois" : regles.loyerPar.includes("Jour") ? "jour" : "nuit";
  const libelleBudget = location ? `Loyer max (FCFA / ${unite})` : "Prix max (FCFA)";
  // Critères avancés : seuls comptent ceux qui ont un sens pour le type de bien et la transaction
  const valables = avancesValables(avances, regles, { location, mensuelle: !journaliere });
  const nombre = nombreAvances(valables) + (prixMin ? 1 : 0);

  const adresse = (autreLieu?: string) =>
    adresseAnnonces({
      location,
      journaliere,
      types: typeChoisi ? [typeChoisi] : [],
      lieu: autreLieu ?? lieu,
      min: prixMin,
      max: budget,
      avances: valables,
    });

  const rechercher = (e: FormEvent) => {
    e.preventDefault();
    router.push(adresse());
  };

  return (
    <form className={s.recherche} onSubmit={rechercher} role="search" aria-label="Rechercher un bien">
      <div className={s.onglets}>
        <button type="button" className={s.onglet} aria-pressed={location} onClick={() => setOnglet("louer")}>
          Louer
        </button>
        <button type="button" className={s.onglet} aria-pressed={!location} onClick={() => setOnglet("acheter")}>
          Acheter
        </button>
        <Link href="/publier" className={s.onglet} title="Publier une annonce : vendre ou louer son bien">
          Publier
        </Link>
      </div>

      {location && (
        <div className={s.duree} role="group" aria-label="Type de location">
          <span className={s.dureeTitre}>Type de location</span>
          {moisPossible && (
            <button type="button" className={s.dureeBtn} aria-pressed={!journaliere} onClick={() => setDuree("mois")}>
              <Icone nom="calendrier" taille={12} />
              Mensuelle
            </button>
          )}
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
              <ChampLieu
                id="rechercheLieu"
                quartiers
                placeholder="Ex : Abidjan, Cocody, Riviera 2…"
                valeur={lieu}
                onChange={setLieu}
              />
            </div>
          </div>
          <div className={s.champ}>
            <label htmlFor="rechercheType">Type de bien</label>
            <div className={s.saisie}>
              <Icone nom="maison" />
              <select id="rechercheType" value={typeChoisi} onChange={(e) => setType(e.target.value)}>
                <option value="">Tous les biens</option>
                {types.map((t) => (
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
          <div className={s.actions}>
            <button
              type="button"
              className={s.plus}
              aria-expanded={plus}
              aria-controls="criteresAvances"
              onClick={() => setPlus(!plus)}
            >
              <Icone nom={plus ? "moins" : "filtres"} taille={14} />
              {plus ? "Moins de critères" : "Plus de critères"}
              {nombre > 0 && <span className={s.nombre}>{nombre}</span>}
            </button>
            <button type="submit" className={s.rechercher}>
              <Icone nom="recherche" epaisseur={2.5} />
              Rechercher
            </button>
          </div>
        </div>

        <div id="criteresAvances" hidden={!plus}>
          {plus && (
            <CriteresAvances
              avances={avances}
              valables={valables}
              maj={(changement) => setAvances((a) => ({ ...a, ...changement }))}
              regles={regles}
              location={location}
              mensuelle={!journaliere}
              libellePrix={location ? `Loyer (FCFA / ${unite})` : "Prix de vente (FCFA)"}
              prixMin={prixMin}
              prixMax={budget}
              setPrixMin={setPrixMin}
              setPrixMax={setBudget}
              onEffacer={() => {
                setAvances(AVANCES_VIDES);
                setPrixMin("");
              }}
              nombre={nombre}
            />
          )}
        </div>
      </div>
    </form>
  );
}
