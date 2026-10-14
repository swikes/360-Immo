"use client";

/*
 * Page « Estimer mon bien » : 3 étapes (type de bien, lieu, caractéristiques), puis le prix des biens semblables.
 * Le calcul se fait dans la base (estimer_bien : supabase/migrations/…_prix_marche.sql) : prix demandés dans les annonces
 * semblables (en ligne, ou terminées depuis moins de 6 mois), dans le quartier, sinon la commune, sinon la ville ;
 * 5 annonces au moins, sinon « pas encore assez d'annonces ». Aucun chiffre inventé.
 * Adresse : /estimation?lieu=Cocody&tx=location&type=appartement (venue d'une page « Prix à Cocody »)
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
import CarteAnnonce from "@/components/CarteAnnonce";
import ChampLieu from "@/components/ChampLieu";
import Icone from "@/components/Icone";
import type { CarteAnnonce as Carte } from "@/lib/annonces-en-ligne";
import { trouver } from "@/lib/choix-lieu";
import { messageErreur } from "@/lib/compte";
import {
  adressePublier, annonces, annoncesDe, arrondir, communesDe, dansLeLieu, fiabilite, fourchette, lienCommune, prixMarche, SEUIL, texteUnite,
  type Estimation as Resultat, type Unite,
} from "@/lib/prix-marche";
import { cleType, regles, typeDeCle, typesProposes, type Transaction } from "@/lib/regles-biens";
import { supabase } from "@/lib/supabase";
import s from "./Estimation.module.css";

const ETAPES = ["Type de bien", "Localisation", "Caractéristiques", "Résultat"];
const PIECES = [1, 2, 3, 4, 5];
const ETATS = [
  { cle: "neuf", texte: "Neuf ou rénové" },
  { cle: "bon", texte: "Bon état" },
  { cle: "renover", texte: "À rafraîchir" },
  { cle: "travaux", texte: "Gros travaux" },
] as const;
type Etat = (typeof ETATS)[number]["cle"];
/** Ce qui fait monter un prix, quand le reste est égal */
const ATOUTS = ["Piscine", "Jardin", "Garage", "Ascenseur", "Gardien", "Jacuzzi", "Rénové", "Titre foncier (ACD)",
  "Viabilisé (eau, électricité)", "Terrain clôturé", "Accès route bitumée"];

/** Le lieu tapé (null s'il n'est pas dans la liste) ; une ville d'une seule commune (Bouaké) vaut sa commune */
function lieuPrecis(texte: string) {
  const l = trouver(texte);
  if (!l || l.commune) return l;
  const communes = communesDe(l.ville);
  return communes.length === 1 ? { ...l, commune: communes[0] } : l;
}

export default function Estimation() {
  return (
    <Suspense fallback={<Contenu depart={new URLSearchParams()} />}>
      <AvecAdresse />
    </Suspense>
  );
}

function AvecAdresse() {
  return <Contenu depart={useSearchParams()} />;
}

function Contenu({ depart }: { depart: URLSearchParams }) {
  const typeDepart = typeDeCle(depart.get("type") ?? "") ?? "Appartement";
  const [etape, setEtape] = useState(1);
  const [transaction, setTransaction] = useState<Transaction>(depart.get("tx") === "vente" ? "vente" : "location");
  const [type, setType] = useState(typeDepart);
  const [journee, setJournee] = useState(false);
  const [lieu, setLieu] = useState(depart.get("lieu") ?? "");
  const [pieces, setPieces] = useState<number | null>(null);
  const [meuble, setMeuble] = useState(false);
  const [surface, setSurface] = useState("");
  const [etat, setEtat] = useState<Etat>("bon");
  const [atouts, setAtouts] = useState<string[]>([]);
  const [erreur, setErreur] = useState("");
  const [calcul, setCalcul] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [cartes, setCartes] = useState<Carte[]>([]);
  const titre = useRef<HTMLHeadingElement>(null);
  const premier = useRef(true);

  const r = regles(type);
  const types = typesProposes(transaction);
  const hotel = type === "Chambre d'hôtel";
  const journeePossible = transaction === "location" && !hotel && r.loyerPar.includes("Jour");
  const unite: Unite = transaction === "vente" ? (type === "Terrain" ? "m2" : "prix") : hotel ? "nuit" : journee && journeePossible ? "jour" : "mois";
  const meublePossible = transaction === "location" && r.meuble === true;
  const terrain = type === "Terrain";
  const lieuTrouve = lieuPrecis(lieu);

  // À chaque étape, le titre prend la main (lecteurs d'écran) et la page remonte dessus (téléphone)
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    titre.current?.focus();
    titre.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [etape]);

  const choisirTransaction = (t: Transaction) => {
    setTransaction(t);
    if (t === "vente" && !regles(type).vente) setType("Appartement");
  };
  const choisirType = (t: string) => {
    setType(t);
    if (!regles(t).pieces) setPieces(null);
    setAtouts((a) => a.filter((c) => regles(t).commodites.includes(c)));
  };

  function suivant() {
    setErreur("");
    if (etape === 2) {
      if (!lieuTrouve) return setErreur("Choisissez la ville, la commune ou le quartier dans la liste.");
      if (!lieuTrouve.commune) return setErreur(`Précisez la commune : ${lieuTrouve.ville} en compte plusieurs (par exemple « Cocody »).`);
    }
    if (etape === 3) {
      if (r.pieces && !pieces) return setErreur("Combien de pièces ?");
      if (terrain && transaction === "vente" && !(Number(surface) > 0)) return setErreur("Indiquez la superficie du terrain en m².");
      return estimer();
    }
    setEtape(etape + 1);
  }

  async function estimer() {
    const sb = supabase();
    if (!sb || !lieuTrouve?.commune) return setErreur("L'estimation n'est pas disponible pour le moment. Réessayez plus tard.");
    setCalcul(true);
    try {
      const { data, error } = await sb.rpc("estimer_bien", {
        bien: {
          transaction, type_bien: cleType(type), unite, ville: lieuTrouve.ville, commune: lieuTrouve.commune,
          quartier: lieuTrouve.quartier, pieces: r.pieces ? pieces : null, meuble: meublePossible ? meuble : false,
        },
      });
      if (error) throw error;
      const e = data as Resultat;
      let c: Carte[] = [];
      if (e.annonces.length) {
        const { data: d } = await sb.rpc("cartes_annonces", { ids: e.annonces });
        c = ((d ?? []) as (Carte & { en_ligne: boolean })[]).filter((x) => x.en_ligne);
      }
      setResultat(e);
      setCartes(c);
      setEtape(4);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setCalcul(false);
    }
  }

  function recommencer() {
    setResultat(null);
    setCartes([]);
    setErreur("");
    setEtape(1);
  }

  return (
    <>
      <section className={s.haut}>
        <div className={s.hautContenu}>
          <span className={s.badge}><Icone nom="viabilise" taille={14} epaisseur={2.5} /> Estimation gratuite</span>
          <h1 className={s.titre}>Combien vaut votre bien <em>aujourd&apos;hui</em> ?</h1>
          <p className={s.sousTitre}>
            D&apos;après les prix demandés dans les annonces semblables de votre quartier, de votre commune ou de votre ville.
          </p>
          <ul className={s.atoutsPage}>
            <li><Icone nom="valide" taille={15} epaisseur={2.5} /> Gratuit</li>
            <li><Icone nom="valide" taille={15} epaisseur={2.5} /> Sans inscription</li>
            <li><Icone nom="valide" taille={15} epaisseur={2.5} /> 1 minute</li>
          </ul>
        </div>
      </section>

      <div className={s.corps}>
        <div className={s.principal}>
          <div className={s.progression} aria-hidden="true"><span style={{ width: `${(etape / 4) * 100}%` }} /></div>
          <ol className={s.etapes} aria-label="Étapes de l'estimation">
            {ETAPES.map((nom, i) => (
              <li key={nom} className={`${s.etape} ${i + 1 === etape ? s.etapeActive : ""} ${i + 1 < etape ? s.etapeFaite : ""}`}
                aria-current={i + 1 === etape ? "step" : undefined}>
                <span className={s.numero}>{i + 1 < etape ? <Icone nom="valide" taille={13} epaisseur={3} /> : i + 1}</span>
                <span className={s.nomEtape}>{nom}</span>
              </li>
            ))}
          </ol>

          <div className={s.carte}>
            {etape < 4 && <p className={s.surtitre}>Étape {etape} sur 3</p>}

            {etape === 1 && (
              <>
                <h2 ref={titre} tabIndex={-1} className={s.question}>Quel bien souhaitez-vous estimer ?</h2>
                <p className={s.aide}>Choisissez le type de bien, et s&apos;il est à vendre ou à louer.</p>
                <fieldset className={s.groupe}>
                  <legend className={s.legende}>Vous voulez</legend>
                  <div className={s.deux}>
                    {(["location", "vente"] as const).map((t) => (
                      <button key={t} type="button" className={`${s.choix} ${transaction === t ? s.choisi : ""}`} aria-pressed={transaction === t}
                        onClick={() => choisirTransaction(t)}>
                        <Icone nom={t === "vente" ? "argent" : "maison"} taille={17} /> {t === "vente" ? "Vendre" : "Mettre en location"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className={s.groupe}>
                  <legend className={s.legende}>Type de bien</legend>
                  <div className={s.puces}>
                    {types.map((t) => (
                      <button key={t} type="button" className={`${s.puce} ${type === t ? s.puceChoisie : ""}`} aria-pressed={type === t}
                        onClick={() => choisirType(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {journeePossible && (
                  <fieldset className={s.groupe}>
                    <legend className={s.legende}>Location</legend>
                    <div className={s.deux}>
                      <button type="button" className={`${s.choix} ${!journee ? s.choisi : ""}`} aria-pressed={!journee} onClick={() => setJournee(false)}>
                        <Icone nom="calendrier" taille={17} /> Au mois
                      </button>
                      <button type="button" className={`${s.choix} ${journee ? s.choisi : ""}`} aria-pressed={journee} onClick={() => setJournee(true)}>
                        <Icone nom="horloge" taille={17} /> À la journée
                      </button>
                    </div>
                  </fieldset>
                )}
              </>
            )}

            {etape === 2 && (
              <>
                <h2 ref={titre} tabIndex={-1} className={s.question}>Où se trouve votre bien ?</h2>
                <p className={s.aide}>Le lieu compte plus que tout dans le prix : indiquez le quartier si vous le pouvez.</p>
                <label htmlFor="estimation-lieu" className={s.legende}>Commune ou quartier</label>
                <div className={s.champLieu}>
                  <ChampLieu id="estimation-lieu" valeur={lieu} onChange={(v) => { setLieu(v); setErreur(""); }} quartiers
                    placeholder="Ex : Riviera 2, Cocody, Bouaké…" />
                </div>
                {lieuTrouve?.commune && (
                  <p className={s.lieuChoisi}>
                    <Icone nom="lieu" taille={15} />
                    {[lieuTrouve.quartier, lieuTrouve.commune !== lieuTrouve.ville ? lieuTrouve.commune : null, lieuTrouve.ville].filter(Boolean).join(", ")}
                  </p>
                )}
              </>
            )}

            {etape === 3 && (
              <>
                <h2 ref={titre} tabIndex={-1} className={s.question}>Décrivez votre bien</h2>
                <p className={s.aide}>On le compare aux biens du même type et de la même taille.</p>
                {r.pieces && (
                  <fieldset className={s.groupe}>
                    <legend className={s.legende}>Nombre de pièces</legend>
                    <div className={s.puces}>
                      {PIECES.map((n) => (
                        <button key={n} type="button" className={`${s.puce} ${pieces === n ? s.puceChoisie : ""}`} aria-pressed={pieces === n}
                          onClick={() => { setPieces(n); setErreur(""); }}>
                          {n === 1 ? (r.pieces === "studio" ? "Studio / 1" : "1") : n === 5 ? "5 et +" : n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {terrain && transaction === "vente" && (
                  <div className={s.groupe}>
                    <label htmlFor="estimation-surface" className={s.legende}>Superficie (m²)</label>
                    <input id="estimation-surface" className={s.champ} inputMode="numeric" value={surface} placeholder="Ex : 500"
                      onChange={(e) => { setSurface(e.target.value.replace(/\D/g, "").slice(0, 7)); setErreur(""); }} />
                  </div>
                )}
                {meublePossible && (
                  <fieldset className={s.groupe}>
                    <legend className={s.legende}>Meublé</legend>
                    <div className={s.deux}>
                      <button type="button" className={`${s.choix} ${!meuble ? s.choisi : ""}`} aria-pressed={!meuble} onClick={() => setMeuble(false)}>Non meublé</button>
                      <button type="button" className={`${s.choix} ${meuble ? s.choisi : ""}`} aria-pressed={meuble} onClick={() => setMeuble(true)}>Meublé</button>
                    </div>
                  </fieldset>
                )}
                {!terrain && (
                  <fieldset className={s.groupe}>
                    <legend className={s.legende}>État général</legend>
                    <div className={s.puces}>
                      {ETATS.map((x) => (
                        <button key={x.cle} type="button" className={`${s.puce} ${etat === x.cle ? s.puceChoisie : ""}`} aria-pressed={etat === x.cle}
                          onClick={() => setEtat(x.cle)}>
                          {x.texte}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {r.commodites.length > 0 && (
                  <fieldset className={s.groupe}>
                    <legend className={s.legende}>Ce que le bien offre <span className={s.facultatif}>(facultatif)</span></legend>
                    <div className={s.puces}>
                      {r.commodites.map((c) => {
                        const oui = atouts.includes(c);
                        return (
                          <button key={c} type="button" className={`${s.puce} ${s.puceLegere} ${oui ? s.puceChoisie : ""}`} aria-pressed={oui}
                            onClick={() => setAtouts((a) => (oui ? a.filter((x) => x !== c) : [...a, c]))}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </>
            )}

            {etape === 4 && resultat && lieuTrouve?.commune && (
              <Resultats
                titre={titre} resultat={resultat} cartes={cartes} type={type} transaction={transaction} unite={unite}
                lieu={lieuTrouve} pieces={r.pieces ? pieces : null} meuble={meublePossible && meuble} surface={terrain ? surface : ""}
                etat={terrain ? null : etat} atouts={atouts} recommencer={recommencer}
              />
            )}

            {erreur && <p className={s.erreur} role="alert"><Icone nom="bouclier" taille={16} /> {erreur}</p>}

            {etape < 4 && (
              <div className={s.navigation}>
                {etape > 1 && (
                  <button type="button" className={s.retour} onClick={() => { setErreur(""); setEtape(etape - 1); }}>
                    <Icone nom="retour" taille={16} /> Retour
                  </button>
                )}
                <button type="button" className={s.continuer} onClick={suivant} disabled={calcul}>
                  {etape === 3 ? (calcul ? "Calcul en cours…" : "Estimer mon bien") : "Continuer"}
                  {!calcul && <Icone nom="suivant" taille={16} />}
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className={s.cote}>
          <div className={s.encadre}>
            <h2 className={s.encadreTitre}><Icone nom="statistiques" taille={17} /> Comment nous calculons</h2>
            <ul className={s.conseils}>
              <li>Nous comparons votre bien aux annonces <strong>du même type et de la même taille</strong>, mises en ligne ces 6 derniers mois.</li>
              <li>D&apos;abord dans votre <strong>quartier</strong> ; s&apos;il n&apos;y en a pas assez, dans la commune, puis dans la ville.</li>
              <li>Il faut <strong>{SEUIL} annonces au moins</strong> pour donner un prix. Les prix anormalement hauts ou bas sont écartés.</li>
              <li>Ce sont des <strong>prix demandés</strong> : le prix final se négocie souvent un peu en dessous.</li>
            </ul>
          </div>
          <Link href="/carte-des-prix" className={s.encadreLien}>
            <Icone nom="carte" taille={20} />
            <span><strong>Carte des prix</strong><br />Comparez les prix commune par commune</span>
            <Icone nom="suivant" taille={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}

/** Où viser dans la fourchette : l'état (null pour un terrain) et le nombre d'atouts qui font monter un prix */
function conseilPrix(etat: Etat | null, forts: number): string {
  if (etat === "travaux" || etat === "renover") return "Un bien à rafraîchir ou à rénover se place plutôt dans le bas de la fourchette.";
  if (etat === "neuf") return `Neuf ou rénové${forts ? ", avec ces atouts" : ""}, votre bien peut viser le haut de la fourchette.`;
  if (forts >= 2) return `Avec ces atouts, votre ${etat ? "bien" : "terrain"} peut viser le haut de la fourchette.`;
  return etat
    ? "Un bien en bon état, sans atout particulier, se place autour du prix du milieu."
    : "Un terrain sans titre foncier (ACD) ni viabilisation se place plutôt dans le bas de la fourchette.";
}

type PropsResultats = {
  titre: RefObject<HTMLHeadingElement | null>;
  resultat: Resultat;
  cartes: Carte[];
  type: string;
  transaction: Transaction;
  unite: Unite;
  lieu: { ville: string; commune: string | null; quartier: string | null };
  pieces: number | null;
  meuble: boolean;
  surface: string;
  etat: Etat | null;
  atouts: string[];
  recommencer: () => void;
};

function Resultats({ titre, resultat: e, cartes, type, transaction, unite, lieu, pieces, meuble, surface, etat, atouts, recommencer }: PropsResultats) {
  const location = transaction === "location";
  const m2 = Number(surface) > 0 && unite === "m2" ? Number(surface) : null;
  const liste = annoncesDe(lieu.commune ?? lieu.ville, { transaction, type_bien: cleType(type) ?? "autres", unite, pieces, meuble });

  if (!e.niveau || e.mediane == null || e.bas == null || e.haut == null) {
    return (
      <div className={s.resultat}>
        <h2 ref={titre} tabIndex={-1} className={s.question}>Pas encore assez d&apos;annonces semblables</h2>
        <p className={s.aide}>
          Il faut {SEUIL} annonces semblables au moins pour donner un prix sérieux. Voici ce que nous avons trouvé :
        </p>
        <ul className={s.essais}>
          {e.essais.map((x) => <li key={x.niveau}>{x.lieu} : {annonces(x.nombre)}</li>)}
        </ul>
        <p className={s.aide}>
          Le site est récent : les prix s&apos;affineront au fil des annonces. En attendant, la carte des prix montre les communes
          déjà renseignées.
        </p>
        <div className={s.actions}>
          <Link href={adressePublier({ type: cleType(type) ?? "autres", transaction, unite, ville: lieu.ville, commune: lieu.commune, quartier: lieu.quartier, pieces, meuble, surface, prix: null })} className={s.continuer}>
            <Icone nom="plus" taille={16} epaisseur={2.5} /> Publier mon annonce
          </Link>
          <Link href="/carte-des-prix" className={s.boutonContour}><Icone nom="carte" taille={16} /> Carte des prix</Link>
          <button type="button" className={s.boutonContour} onClick={recommencer}>Nouvelle estimation</button>
        </div>
      </div>
    );
  }

  const f = fiabilite(e.nombre);
  const premierEssai = e.essais[0];
  const elargi = e.essais.length > 1 && premierEssai.nombre < SEUIL;
  const conseil = conseilPrix(etat, atouts.filter((a) => ATOUTS.includes(a)).length);
  const prixPublier = arrondir(m2 ? e.mediane * m2 : e.mediane);

  return (
    <div className={s.resultat}>
      <h2 ref={titre} tabIndex={-1} className={s.surtitre}>Votre estimation</h2>
      <p className={s.libellePrix}>{location ? "Loyer habituel d'un bien comme le vôtre" : "Prix habituel d'un bien comme le vôtre"}</p>
      <p className={s.prix}>{m2 ? `${prixMarche(e.mediane * m2, "prix")}` : prixMarche(e.mediane, unite)}</p>
      <p className={s.fourchette}>
        Fourchette habituelle : <strong>{m2 ? fourchette(e.bas * m2, e.haut * m2) : `${fourchette(e.bas, e.haut)}${texteUnite(unite)}`}</strong>
      </p>
      {m2 && <p className={s.detailPrix}>Soit {prixMarche(e.mediane, "m2")} pour {surface} m².</p>}
      <div className={s.indicateurs}>
        <span className={`${s.fiabilite} ${s[f.niveau]}`}>Fiabilité : {f.texte}</span>
        <span>D&apos;après {annonces(e.nombre)} semblables {dansLeLieu(e.niveau, e.lieu ?? "")}</span>
      </div>
      {elargi && (
        <p className={s.note}>
          <Icone nom="lieu" taille={15} /> Pas assez d&apos;annonces {dansLeLieu(premierEssai.niveau, premierEssai.lieu)} ({premierEssai.nombre}) :
          comparaison {dansLeLieu(e.niveau, e.lieu ?? "")}.
        </p>
      )}
      <p className={s.note}><Icone nom="valide" taille={15} /> {conseil}</p>
      <p className={s.avertissement}>
        Ce sont les {location ? "loyers demandés" : "prix demandés"} dans les annonces des 6 derniers mois, pas des prix
        {location ? " signés" : " de vente"} : {location ? "le loyer final se discute" : "le prix final se négocie"} souvent un peu en dessous.
        Pour une vente importante ou une succession, faites aussi appel à un professionnel.
      </p>
      <div className={s.actions}>
        <Link href={adressePublier({ type: cleType(type) ?? "autres", transaction, unite, ville: lieu.ville, commune: lieu.commune, quartier: lieu.quartier, pieces, meuble, surface, prix: prixPublier })} className={s.continuer}>
          <Icone nom="plus" taille={16} epaisseur={2.5} /> Publier mon annonce à ce prix
        </Link>
        <Link href={liste} className={s.boutonContour}><Icone nom="recherche" taille={16} /> Voir les annonces semblables</Link>
        {lieu.commune && <Link href={lienCommune(lieu.commune)} className={s.boutonContour}><Icone nom="statistiques" taille={16} /> Prix à {lieu.commune}</Link>}
        <button type="button" className={s.boutonContour} onClick={recommencer}>Nouvelle estimation</button>
      </div>
      {cartes.length > 0 && (
        <section className={s.semblables} aria-labelledby="titre-semblables">
          <h3 id="titre-semblables" className={s.titreSemblables}>Annonces en ligne semblables à votre bien</h3>
          <div className={s.grille}>
            {cartes.map((c) => <CarteAnnonce key={c.id} annonce={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}
