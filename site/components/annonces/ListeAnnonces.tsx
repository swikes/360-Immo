"use client";

/*
 * Liste des annonces : recherche d'un lieu, onglets Tous / À louer / À vendre, filtres (colonne de gauche sur
 * ordinateur, panneau « Filtres » sur téléphone), nombre de résultats et tri, puis les cartes (préparées par le
 * serveur). Chaque choix change l'adresse de la page (/annonces?…) : la liste est refaite aussitôt, et l'adresse
 * se partage ou se garde telle quelle. Seuls les critères qui ont un sens pour les types et la transaction choisis
 * sont proposés (lib/regles-biens.ts, mêmes règles que la maquette et que la base).
 */
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import BoutonAlerte from "@/components/BoutonAlerte";
import BoutonPartage from "@/components/BoutonPartage";
import ChampLieu from "@/components/ChampLieu";
import Icone from "@/components/Icone";
import { formaterPrix } from "@/lib/format";
import {
  adresseListe, avancesDe, chiffres, nombreFiltres, RECHERCHE_VIDE, reglesRecherche, TRIS,
  type Avances, type EtatRecherche, type Tri,
} from "@/lib/recherche";
import { aLaJournee, auMois, chambresMax, cleType, typesProposes, type Transaction } from "@/lib/regles-biens";
import s from "./ListeAnnonces.module.css";

type Props = {
  etat: EtatRecherche;
  titre: string;
  /** titre du lien partagé (« Appartements à louer à Cocody — Kamika Immobilier ») */
  titrePartage: string;
  /** adresse de la liste (/annonces) ou d'une vitrine (/annonceur/…) */
  base?: string;
  /** vitrine : présentation de l'annonceur, sous le titre */
  presentation?: ReactNode;
  total: number;
  parTransaction: Partial<Record<Transaction, number>>;
  parType: Record<string, number>;
  /** cartes et pages, préparées par le serveur */
  children: ReactNode;
};

const PIECES = ["Studio", "1", "2", "3", "4", "5+"];
const CHAMBRES = ["1", "2", "3", "4", "5+"];
const SANITAIRES = ["1", "2", "3", "4+"];
const CAUTION = ["1", "2", "3", "4+"];
const ETAGES = ["Rdc", "1er", "2ème", "3ème", "4ème", "5ème +"];

export default function ListeAnnonces({ etat, titre, titrePartage, base = "/annonces", presentation, total, parTransaction, parType, children }: Props) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [e, setE] = useOptimistic(etat);
  const [panneau, setPanneau] = useState(false); // téléphone : panneau des filtres ouvert

  // Recherche en cours, pour les champs appliqués après un court délai (budget, surface)
  const derniere = useRef(e);
  useEffect(() => {
    derniere.current = e;
  });

  // Nouvelle recherche : l'adresse change, le serveur refait la liste (le choix s'affiche tout de suite)
  const aller = (suivant: EtatRecherche) =>
    demarrer(() => {
      setE(suivant);
      router.replace(adresseListe(suivant, base), { scroll: false });
    });
  const changer = (c: Partial<EtatRecherche>) => aller({ ...derniere.current, ...c, page: 1 });
  const majAvances = (c: Partial<Avances>) => changer({ avances: { ...derniere.current.avances, ...c } });
  const toutEffacer = () => aller({ ...RECHERCHE_VIDE, tx: e.tx, duree: e.duree, lieu: e.lieu, tri: e.tri });

  const r = reglesRecherche(e);
  const a = avancesDe(e);
  const location = e.tx === "location";
  const nombre = nombreFiltres(e);
  const tous = (parTransaction.location ?? 0) + (parTransaction.vente ?? 0);
  const maxChambres = a.pieces ? chambresMax(a.pieces) : Infinity;
  const etage = r.etage === "toujours" || (r.etage === "option" && a.immeuble);
  const libellePrix = e.tx === "achat" ? "Prix (FCFA)" : e.duree === "jour" ? "Loyer par jour (FCFA)" : "Loyer par mois (FCFA)";

  // Panneau ouvert (téléphone) : Échap le ferme, la page derrière ne défile pas
  useEffect(() => {
    if (!panneau) return;
    const fermer = (ev: KeyboardEvent) => ev.key === "Escape" && setPanneau(false);
    document.addEventListener("keydown", fermer);
    document.documentElement.classList.add(s.sansDefilement);
    return () => {
      document.removeEventListener("keydown", fermer);
      document.documentElement.classList.remove(s.sansDefilement);
    };
  }, [panneau]);

  const onglet = (tx: EtatRecherche["tx"], texte: string, n: number) => (
    <button type="button" role="tab" aria-selected={e.tx === tx} className={s.onglet}
      onClick={() => changer({ tx, duree: tx === "location" ? e.duree : null })}>
      {texte} <span className={s.compte}>{n}</span>
    </button>
  );

  return (
    <div className={s.page}>
      {/* ── En haut : titre, lieu, onglets ── */}
      <div className={s.haut}>
        <div className={s.hautContenu}>
          <h1 className={s.titre}>{titre}</h1>
          {presentation}
          <FormLieu key={etat.lieu} lieu={e.lieu} chercher={(lieu) => changer({ lieu })} />
          <div className={s.onglets} role="tablist" aria-label="Transaction">
            {onglet(null, "Tous", tous)}
            {onglet("location", "À louer", parTransaction.location ?? 0)}
            {onglet("achat", "À vendre", parTransaction.vente ?? 0)}
          </div>
        </div>
      </div>

      <div className={s.corps}>
        {/* ── Filtres ── */}
        <aside id="filtres" className={`${s.filtres} ${panneau ? s.ouvert : ""}`} aria-label="Filtres">
          <div className={s.filtresEntete}>
            <span className={s.filtresTitre}>Filtres</span>
            {nombre > 0 && <button type="button" className={s.lien} onClick={toutEffacer}>Tout effacer</button>}
            <button type="button" className={s.fermer} onClick={() => setPanneau(false)} aria-label="Fermer les filtres">
              <Icone nom="fermer" taille={20} />
            </button>
          </div>
          <div className={s.filtresContenu}>
            <Groupe titre="Transaction">
              <Puces valeurs={["À louer", "À vendre"]} choisie={e.tx === "location" ? "À louer" : e.tx === "achat" ? "À vendre" : null}
                choisir={(v) => changer({ tx: v === "À louer" ? "location" : v === "À vendre" ? "achat" : null, duree: null })} />
              {location && (aLaJournee(r) || auMois(r)) && (
                <Puces valeurs={[...(auMois(r) ? ["Au mois"] : []), ...(aLaJournee(r) ? ["À la journée"] : [])]}
                  choisie={e.duree === "mois" ? "Au mois" : e.duree === "jour" ? "À la journée" : null}
                  choisir={(v) => changer({ duree: v === "Au mois" ? "mois" : v === "À la journée" ? "jour" : null })}
                  nom="Durée de location" />
              )}
            </Groupe>

            <Groupe titre="Type de bien">
              <ul className={s.types}>
                {typesProposes(e.tx === "achat" ? "vente" : e.tx === "location" ? "location" : null).map((t) => {
                  const coche = e.types.includes(t);
                  return (
                    <li key={t}>
                      <label className={s.type}>
                        <input type="checkbox" checked={coche}
                          onChange={() => changer({ types: coche ? e.types.filter((x) => x !== t) : [...e.types, t] })} />
                        <span>{t}</span>
                        <span className={s.typeCompte}>{parType[cleType(t) ?? ""] ?? 0}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Groupe>

            <Groupe titre={e.tx ? libellePrix : "Budget"}>
              {e.tx ? (
                <div className={s.intervalle}>
                  <ChampNombre valeur={e.min} valider={(min) => changer({ min })} etiquette="Minimum (FCFA)" texteVide="Min" montant />
                  <ChampNombre valeur={e.max} valider={(max) => changer({ max })} etiquette="Maximum (FCFA)" texteVide="Max" montant />
                </div>
              ) : (
                <p className={s.note}>Choisissez « À louer » ou « À vendre » pour indiquer un budget : un loyer et un prix de vente ne se comparent pas.</p>
              )}
            </Groupe>

            {r.pieces && (
              <Groupe titre="Nombre de pièces">
                <Puces valeurs={PIECES.filter((x) => (x === "Studio" ? r.studio : x === "1" ? r.unePiece : true))}
                  choisie={a.pieces} choisir={(pieces) => majAvances({ pieces })} />
              </Groupe>
            )}
            {r.chambres && (
              <Groupe titre="Chambres">
                <Puces valeurs={CHAMBRES} choisie={a.chambres} choisir={(chambres) => majAvances({ chambres })}
                  indispo={(x) => parseInt(x, 10) > maxChambres} />
              </Groupe>
            )}
            <Groupe titre={`${r.surface} (m²)`}>
              <div className={s.intervalle}>
                <ChampNombre valeur={e.avances.smin} valider={(smin) => majAvances({ smin })} etiquette={`${r.surface} minimum (m²)`} texteVide="Min m²" />
                <ChampNombre valeur={e.avances.smax} valider={(smax) => majAvances({ smax })} etiquette={`${r.surface} maximum (m²)`} texteVide="Max m²" />
              </div>
            </Groupe>
            {r.sanitaires && (
              <Groupe titre={`${r.sanitaires} (au moins)`}>
                <Puces valeurs={SANITAIRES} choisie={a.sdb} choisir={(sdb) => majAvances({ sdb })} />
              </Groupe>
            )}
            {location && e.duree !== "jour" && r.caution && (
              <Groupe titre="Mois de caution (au plus)">
                <Puces valeurs={CAUTION} choisie={a.caution} choisir={(caution) => majAvances({ caution })} />
              </Groupe>
            )}

            <Groupe titre="Préférences">
              <div className={s.interrupteurs}>
                {r.meuble && <Interrupteur texte="Déjà meublé" actif={a.meuble} basculer={() => majAvances({ meuble: !a.meuble })} />}
                <Interrupteur texte="Avec photos" actif={a.photos} basculer={() => majAvances({ photos: !a.photos })} />
                <Interrupteur texte="Publiées cette semaine" actif={a.recentes} basculer={() => majAvances({ recentes: !a.recentes })} />
                <Interrupteur texte="Biens vérifiés" actif={e.verifiees} basculer={() => changer({ verifiees: !e.verifiees })} />
                {r.etage === "option" && (
                  <Interrupteur texte="Dans un immeuble" actif={a.immeuble} basculer={() => majAvances({ immeuble: !a.immeuble })} />
                )}
              </div>
            </Groupe>
            {etage && (
              <Groupe titre="Étage">
                <Puces valeurs={ETAGES} choisie={a.etage} choisir={(x) => majAvances({ etage: x })} />
              </Groupe>
            )}
            {r.commodites.length > 0 && (
              <Groupe titre="Commodités">
                <div className={s.commodites}>
                  {r.commodites.map((c) => {
                    const on = a.commodites.includes(c);
                    return (
                      <button key={c} type="button" className={s.commodite} aria-pressed={on}
                        onClick={() => majAvances({ commodites: on ? e.avances.commodites.filter((x) => x !== c) : [...e.avances.commodites, c] })}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Groupe>
            )}
          </div>
          <div className={s.filtresPied}>
            <button type="button" className={s.voir} onClick={() => setPanneau(false)}>
              {enCours ? "Recherche…" : `Voir ${total ? `les ${formaterPrix(total)} annonce${total > 1 ? "s" : ""}` : "la liste"}`}
            </button>
          </div>
        </aside>
        {panneau && <div className={s.voile} onClick={() => setPanneau(false)} aria-hidden="true" />}

        {/* ── Résultats ── */}
        <section className={s.resultats} aria-labelledby="nombre-resultats" aria-busy={enCours}>
          {/* Nombre d'annonces et, sur téléphone, bouton « Filtres » : sur la même ligne, qui reste en haut de l'écran */}
          <div className={s.ligneNombre}>
            <p id="nombre-resultats" className={s.nombre} role="status">
              <strong>{formaterPrix(total)}</strong> annonce{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}
            </p>
            <button type="button" className={s.boutonFiltres} onClick={() => setPanneau(true)} aria-expanded={panneau} aria-controls="filtres">
              <Icone nom="filtres" taille={16} /> Filtres{nombre > 0 && <span className={s.pastilleNombre}>{nombre}</span>}
            </button>
          </div>
          <div className={s.outils}>
            <BoutonPartage adresse={adresseListe({ ...e, page: 1 }, base)} nom="Partager cette recherche"
              texte={`${titrePartage} : ${formaterPrix(total)} annonce${total > 1 ? "s" : ""} sur 360-Immo.ci`}
              aide="Les annonces affichées, avec vos critères, dans un lien à envoyer (par exemple à un client)." />
            {/* Alerte : sur la liste de toutes les annonces (pas sur une vitrine) */}
            {base === "/annonces" && <BoutonAlerte adresse={adresseListe({ ...e, page: 1 }, base)} className={s.alerte} />}
            <label className={s.tri}>
              <span className={s.cache}>Trier par</span>
              <select value={e.tri} onChange={(ev) => aller({ ...e, tri: ev.target.value as Tri, page: 1 })}>
                {TRIS.map((t) => <option key={t.valeur} value={t.valeur}>{t.texte}</option>)}
              </select>
            </label>
          </div>
          <div className={`${s.cartes} ${enCours ? s.attente : ""}`}>{children}</div>
        </section>
      </div>
    </div>
  );
}

// ── Morceaux ──
function FormLieu({ lieu, chercher }: { lieu: string; chercher: (lieu: string) => void }) {
  const [texte, setTexte] = useState(lieu);
  return (
    <form className={s.recherche} role="search" aria-label="Chercher un lieu"
      onSubmit={(ev) => {
        ev.preventDefault();
        chercher(texte.trim());
      }}>
      <Icone nom="lieu" taille={18} className={s.rechercheIcone} />
      <label htmlFor="listeLieu" className={s.cache}>Ville, commune ou quartier</label>
      <ChampLieu id="listeLieu" quartiers valeur={texte} onChange={setTexte} placeholder="Ville, commune ou quartier…" />
      {lieu && (
        <button type="button" className={s.effacerLieu} aria-label="Effacer le lieu" onClick={() => { setTexte(""); chercher(""); }}>
          <Icone nom="fermer" taille={16} />
        </button>
      )}
      <button type="submit" className={s.chercher} aria-label="Chercher">
        <Icone nom="recherche" taille={16} /> <span>Chercher</span>
      </button>
    </form>
  );
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className={s.groupe} role="group" aria-label={titre}>
      <div className={s.groupeTitre}>{titre}</div>
      {children}
    </div>
  );
}

function Puces({ valeurs, choisie, choisir, indispo, nom }: {
  valeurs: string[]; choisie: string | null; choisir: (v: string | null) => void; indispo?: (v: string) => boolean; nom?: string;
}) {
  return (
    <div className={s.puces} role={nom ? "group" : undefined} aria-label={nom}>
      {valeurs.map((v) => (
        <button key={v} type="button" className={s.puce} aria-pressed={choisie === v} disabled={indispo?.(v)}
          onClick={() => choisir(choisie === v ? null : v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

function Interrupteur({ texte, actif, basculer }: { texte: string; actif: boolean; basculer: () => void }) {
  return (
    <button type="button" className={s.interrupteur} aria-pressed={actif} onClick={basculer}>
      <span className={s.pastille} aria-hidden="true" />
      {texte}
    </button>
  );
}

/** Nombre (budget, surface) : appliqué quand on s'arrête de taper, en quittant le champ ou avec Entrée */
function ChampNombre({ valeur, valider, etiquette, texteVide, montant }: {
  valeur: string; valider: (v: string) => void; etiquette: string; texteVide: string; montant?: boolean;
}) {
  const [texte, setTexte] = useState(valeur);
  const [base, setBase] = useState(valeur);
  const [saisie, setSaisie] = useState(false);
  const minuteur = useRef<number | undefined>(undefined);
  // Valeur changée ailleurs (« Tout effacer ») : reprise, sauf pendant la saisie
  if (valeur !== base && !saisie) {
    setBase(valeur);
    setTexte(valeur);
  }
  const envoyer = (t: string) => {
    window.clearTimeout(minuteur.current);
    if (t !== valeur) valider(t);
  };
  useEffect(() => () => window.clearTimeout(minuteur.current), []);
  return (
    <input type="text" inputMode="numeric" aria-label={etiquette} placeholder={texteVide}
      value={montant && texte ? formaterPrix(Number(texte)) : texte}
      onFocus={() => setSaisie(true)}
      onBlur={() => {
        setSaisie(false);
        envoyer(texte);
      }}
      onKeyDown={(ev) => ev.key === "Enter" && envoyer(texte)}
      onChange={(ev) => {
        const t = chiffres(ev.target.value).slice(0, montant ? 12 : 6);
        setTexte(t);
        window.clearTimeout(minuteur.current);
        minuteur.current = window.setTimeout(() => envoyer(t), 900);
      }} />
  );
}
