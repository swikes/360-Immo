"use client";

/*
 * Formulaire « Publier une annonce » (comme la maquette 360-immo-publier-annonce.html) :
 *   type de bien et transaction · localisation · caractéristiques · prix · commodités · description · photos · contact
 * Seuls les champs qui ont un sens pour le type de bien sont proposés (lib/regles-biens.ts : terrain sans pièces,
 * chambre d'hôtel en location à la nuit…). À droite (en bas sur téléphone) : l'aperçu de l'annonce et les boutons.
 *   « Enregistrer le brouillon » : gardée pour plus tard, invisible des visiteurs
 *   « Envoyer pour vérification » : l'équipe 360-Immo.ci la vérifie avant de la publier
 *   annonce en ligne : « Enregistrer les modifications » (un gros changement la renvoie en vérification)
 */
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import BlocTelephones, { champsTelephones, erreurTelephones, telephonesDuProfil, type Telephones } from "@/components/compte/BlocTelephones";
import { emailValide } from "@/components/compte/Champs";
import Icone from "@/components/Icone";
import {
  STATUTS, ajouterPhoto, enregistrerAnnonce, idsDuLieu, lieuTexte, lireAnnonce, photosTriees, prixTexte, reordonnerPhotos, retirerPhotos,
  typeBase, typeSite, uniteBase, uniteSite, urlPhoto, type Annonce, type ChampsAnnonce, type Statut,
} from "@/lib/annonces";
import { messageErreur, type Profil } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { QUARTIERS, VILLES_COMMUNES } from "@/lib/lieux";
import { TYPES_BIEN, regles, reglesPour, type Transaction, type UniteLoyer } from "@/lib/regles-biens";
import { decomposer } from "@/lib/telephone";
import Photos, { type PhotoFormulaire } from "./Photos";
import s from "./Publication.module.css";

// ── Lieux : villes, puis communes de la ville choisie ──
const tri = new Intl.Collator("fr", { sensitivity: "base" });
const VILLES = [...new Set(VILLES_COMMUNES.map(([v]) => v))].sort(tri.compare);
const communesDe = (ville: string) => VILLES_COMMUNES.filter(([v]) => v === ville).map(([, c]) => c).sort(tri.compare);
const quartiersDe = (ville: string, commune: string) => QUARTIERS[ville]?.[commune] ?? [];

type Champs = {
  type: string;
  transaction: Transaction | "";
  meuble: boolean;
  immeuble: boolean;
  etage: number | null;
  ville: string;
  commune: string;
  quartier: string;
  adresse: string;
  pieces: number | null;
  studio: boolean;
  chambres: number;
  sanitaires: number;
  surface: string;
  caution: number;
  prix: string;
  loyerPar: UniteLoyer | "";
  commodites: string[];
  titre: string;
  titreModifie: boolean;
  description: string;
  typeVendeur: "particulier" | "agence";
  contactNom: string;
  tels: Telephones;
  email: string;
};

function depuisProfil(profil: Profil, email: string): Champs {
  const agence = profil.role === "agence" || !!profil.demande_agence;
  return {
    type: "", transaction: "", meuble: false, immeuble: false, etage: null,
    ville: "Abidjan", commune: "", quartier: "", adresse: "",
    pieces: null, studio: false, chambres: 1, sanitaires: 1, surface: "", caution: 2,
    prix: "", loyerPar: "", commodites: [], titre: "", titreModifie: false, description: "",
    typeVendeur: agence ? "agence" : "particulier",
    contactNom: (agence && profil.demande_agence) || [profil.prenom, profil.nom].filter(Boolean).join(" "),
    tels: telephonesDuProfil(profil),
    email,
  };
}

function depuisAnnonce(a: Annonce): Champs {
  const t1 = decomposer(a.contact_telephone), t2 = decomposer(a.contact_telephone2);
  return {
    type: typeSite(a.type_bien), transaction: a.transaction, meuble: a.meuble, immeuble: a.dans_immeuble, etage: a.etage,
    ville: a.villes?.nom ?? "", commune: a.communes?.nom ?? "", quartier: a.quartiers?.nom ?? a.quartier_texte ?? "",
    adresse: a.adresse ?? "", pieces: a.pieces, studio: a.studio, chambres: a.chambres ?? 0, sanitaires: a.sanitaires ?? 0,
    surface: a.surface ? String(a.surface) : "", caution: a.caution_mois ?? 2, prix: String(a.prix),
    loyerPar: uniteSite(a.loyer_par) ?? "", commodites: a.commodites, titre: a.titre, titreModifie: true,
    description: a.description, typeVendeur: a.type_vendeur, contactNom: a.contact_nom ?? "",
    tels: {
      iso1: t1.iso, tel1: t1.valeur, wa1: a.contact_whatsapp, second: !!a.contact_telephone2, type2: "mobile",
      iso2: t2.iso, tel2: t2.valeur, wa2: a.contact_telephone2_whatsapp,
    },
    email: a.contact_email ?? "",
  };
}

/** Ne garder que ce qui a un sens pour le type de bien et la transaction choisis */
function ajuster(x: Champs): Champs {
  if (!x.type) return x;
  const y = { ...x };
  if (y.transaction === "vente" && !regles(y.type).vente) y.transaction = "location"; // chambre d'hôtel
  const r = reglesPour([y.type], y.transaction || null);
  if (!r.meuble) y.meuble = r.meubleToujours;
  if (r.etage === false) y.immeuble = false;
  if (r.etage === "toujours") y.immeuble = true;
  if (!y.immeuble) y.etage = null;
  if (!r.pieces) y.pieces = null;
  if (!r.studio) y.studio = false;
  if (y.studio) y.pieces = 1;
  if (y.pieces && y.chambres > y.pieces - 1) y.chambres = Math.max(0, y.pieces - 1);
  y.commodites = y.commodites.filter((c) => r.commodites.includes(c));
  if (y.transaction === "location") {
    if (!r.loyerPar.includes(y.loyerPar as UniteLoyer)) y.loyerPar = r.loyerPar.includes("Mois") ? "Mois" : r.loyerPar[0];
  } else y.loyerPar = "";
  return y;
}

const FEMININS = ["Maison", "Villa", "Chambre d'hôtel"];

/** Titre proposé : « Appartement 3 pièces meublé à louer — Riviera 2 » (modifiable) */
function titreAuto(x: Champs): string {
  if (!x.type) return "";
  const nom = x.studio ? "Studio" : x.type === "Commerce / Magasin" ? "Local commercial" : x.type === "Autres" ? "Bien" : x.type;
  const m = [nom];
  if (x.pieces && !x.studio) m.push(`${x.pieces} pièce${x.pieces > 1 ? "s" : ""}`);
  if (["Terrain", "Bureau", "Commerce / Magasin", "Immeuble"].includes(x.type) && Number(x.surface) > 0) m.push(`${x.surface} m²`);
  if (x.meuble && x.type !== "Chambre d'hôtel") m.push(FEMININS.includes(x.type) ? "meublée" : "meublé");
  if (x.transaction) m.push(x.transaction === "vente" ? "à vendre" : "à louer");
  const lieu = x.quartier.trim() || x.commune || x.ville;
  return m.join(" ") + (lieu ? ` — ${lieu}` : "");
}

type Erreurs = Partial<Record<keyof Champs | "photos", string>>;

function verifier(x: Champs, titre: string, complet: boolean): Erreurs {
  const r = reglesPour(x.type ? [x.type] : [], x.transaction || null);
  const e: Erreurs = {};
  if (!x.type) e.type = "Choisissez le type de bien.";
  if (!x.transaction) e.transaction = "À louer ou à vendre ?";
  if (!x.ville) e.ville = "Choisissez la ville.";
  if (!x.commune) e.commune = "Choisissez la commune.";
  if (!(Number(x.prix) > 0)) e.prix = x.transaction === "vente" ? "Indiquez le prix." : "Indiquez le loyer.";
  if (x.transaction === "location" && !x.loyerPar) e.loyerPar = "Loyer par nuit, jour, mois ou année ?";
  if (titre.trim().length < 10 || titre.trim().length > 120) e.titre = "Le titre fait de 10 à 120 caractères.";
  if (x.tels.tel1.trim() || complet) {
    const m = erreurTelephones(x.tels);
    if (m) e.tels = m;
  }
  if (x.email.trim() && !emailValide(x.email)) e.email = "E-mail invalide.";
  if (complet) {
    if (x.type && r.pieces && !x.pieces) e.pieces = "Combien de pièces ?";
    if (!(Number(x.surface) > 0)) e.surface = `Indiquez la ${r.surface.toLowerCase()} en m².`;
    if (x.description.trim().length < 30) e.description = "Décrivez le bien en quelques phrases (30 caractères au moins).";
    if (!x.contactNom.trim()) e.contactNom = "Indiquez le nom affiché sur l'annonce.";
  }
  return e;
}

type Props = {
  profil: Profil;
  email: string;
  /** annonce à modifier (absente : nouvelle annonce) */
  annonce?: Annonce;
  /** chaque enregistrement (identifiant de l'annonce, nouvelle ou non) */
  enregistree: (id: string) => void;
  /** une fois l'annonce envoyée pour vérification */
  envoyee: (a: Annonce) => void;
};

export default function Formulaire({ profil, email, annonce: initiale, enregistree: signaler, envoyee }: Props) {
  const [annonce, setAnnonce] = useState<Annonce | undefined>(initiale);
  const [x, setX] = useState<Champs>(() => (initiale ? depuisAnnonce(initiale) : depuisProfil(profil, email)));
  const [photos, setPhotos] = useState<PhotoFormulaire[]>(() =>
    initiale ? photosTriees(initiale).map((p) => ({ cle: p.id, apercu: urlPhoto(p.chemin), enregistree: p })) : [],
  );
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [envoi, setEnvoi] = useState<string>("");
  const [message, setMessage] = useState<{ texte: string; erreur?: boolean } | null>(null);

  const r = useMemo(() => reglesPour(x.type ? [x.type] : [], x.transaction || null), [x.type, x.transaction]);
  const titre = x.titreModifie ? x.titre : titreAuto(x);
  const statut: Statut | "nouvelle" = annonce?.statut ?? "nouvelle";
  const enLigne = statut === "publiee" || statut === "en_attente";

  const changer = (c: Partial<Champs>) => {
    setX((avant) => {
      const suivant = { ...avant, ...c };
      // meublé imposé par l'ancien type (chambre d'hôtel) : pas gardé pour un autre type
      if (c.type && avant.type && c.type !== avant.type && regles(avant.type).meuble === "toujours") suivant.meuble = false;
      return ajuster(suivant);
    });
    setMessage(null);
    const cles = Object.keys(c) as (keyof Champs)[];
    if (cles.some((k) => erreurs[k])) setErreurs((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !cles.includes(k as keyof Champs))));
  };

  const enregistrer = async (action: "brouillon" | "envoyer" | "modifier") => {
    const complet = action !== "brouillon";
    const e = verifier(x, titre, complet);
    setErreurs(e);
    setMessage(null);
    if (Object.keys(e).length) {
      setMessage({ texte: "Certains champs sont à compléter ou à corriger (en rouge).", erreur: true });
      document.querySelector(`[data-champ="${Object.keys(e)[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    try {
      setEnvoi("Enregistrement de l'annonce…");
      const lieu = await idsDuLieu(x.ville, x.commune, x.quartier);
      const t = champsTelephones(x.tels);
      const champs: ChampsAnnonce = {
        transaction: x.transaction as Transaction,
        type_bien: typeBase(x.type),
        titre: titre.trim(),
        description: x.description.trim(),
        prix: Number(x.prix),
        loyer_par: x.transaction === "location" ? uniteBase(x.loyerPar as UniteLoyer) : null,
        caution_mois: x.transaction === "location" && r.caution ? x.caution : null,
        ...lieu,
        adresse: x.adresse.trim() || null,
        surface: Number(x.surface) > 0 ? Number(x.surface) : null,
        pieces: r.pieces ? x.pieces : null,
        studio: r.studio && x.studio,
        chambres: r.chambres ? x.chambres : null,
        sanitaires: r.sanitaires ? x.sanitaires : null,
        meuble: x.meuble,
        dans_immeuble: x.immeuble,
        etage: x.immeuble ? x.etage : null,
        commodites: x.commodites,
        type_vendeur: x.typeVendeur,
        contact_nom: x.contactNom.trim() || null,
        contact_telephone: t.telephone || null,
        contact_telephone2: t.telephone2,
        contact_whatsapp: t.telephone_whatsapp,
        contact_telephone2_whatsapp: t.telephone2_whatsapp,
        contact_email: x.email.trim() || null,
        ...(action === "modifier" ? {} : { statut: action === "envoyer" ? "en_attente" : "brouillon" }),
      };
      let a = await enregistrerAnnonce(champs, annonce?.id);

      // Photos : retirées, nouvelles (envoyées une à une), puis ordre
      const gardees = new Set(photos.filter((p) => p.enregistree).map((p) => p.enregistree!.id));
      await retirerPhotos(photosTriees(a).filter((p) => !gardees.has(p.id)));
      const nouvelles = photos.filter((p) => p.nouvelle);
      let n = 0;
      const liste = [...photos];
      for (const [i, p] of photos.entries()) {
        if (!p.nouvelle) continue;
        setEnvoi(`Envoi des photos : ${++n} / ${nouvelles.length}…`);
        const enregistree = await ajouterPhoto(a.id, p.nouvelle.blob, p.nouvelle.extension, i);
        liste[i] = { cle: p.cle, apercu: p.apercu, enregistree };
      }
      const aReordonner = liste
        .map((p, i) => ({ ...p.enregistree!, ordre: i }))
        .filter((p, i) => photos[i].enregistree && photos[i].enregistree!.ordre !== i);
      if (aReordonner.length) await reordonnerPhotos(aReordonner);
      setPhotos(liste);

      // statut et photos à jour (une nouvelle photo renvoie une annonce en ligne en vérification)
      if (nouvelles.length || aReordonner.length) a = await lireAnnonce(a.id);
      setAnnonce(a);
      signaler(a.id);
      window.history.replaceState(null, "", `/publier?annonce=${a.id}`);
      if (action === "envoyer") return envoyee(a);
      setMessage({
        texte:
          action === "brouillon"
            ? `Brouillon enregistré (réf. ${a.reference}). Vous pouvez le terminer plus tard depuis Mon Espace.`
            : statut === "publiee" && a.statut === "en_attente"
              ? "Modifications enregistrées. Comme elles changent beaucoup l'annonce, l'équipe 360-Immo.ci la vérifie avant de la remettre en ligne."
              : "Modifications enregistrées.",
      });
    } catch (err) {
      setMessage({ texte: messageErreur(err), erreur: true });
    } finally {
      setEnvoi("");
    }
  };

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    enregistrer(enLigne ? "modifier" : "envoyer");
  };

  const communes = communesDe(x.ville);
  const quartiers = quartiersDe(x.ville, x.commune);
  const vente = x.transaction === "vente";

  return (
    <form className={s.mise} onSubmit={soumettre} noValidate>
      <div className={s.colonne}>
        <div className={s.entete}>
          <span className={s.surtitre}>{annonce ? `Annonce ${annonce.reference}` : "Nouvelle annonce"}</span>
          <h1 className={s.titre}>{annonce ? "Modifier l'annonce" : "Publier une annonce"}</h1>
          <p className={s.sousTitre}>
            {annonce
              ? STATUTS[annonce.statut].aide
              : "Vente ou location : décrivez votre bien, ajoutez des photos. L'équipe 360-Immo.ci vérifie chaque annonce avant de la publier."}
          </p>
          {annonce?.statut === "refusee" && annonce.motif_refus && (
            <p className={`${s.message} ${s.messageErreur}`}>
              <Icone nom="cadenas" taille={16} /> Motif du refus : {annonce.motif_refus}
            </p>
          )}
        </div>

        {/* 1. Le bien */}
        <Section numero={1} titre="Type de bien">
          <Groupe titre="Catégorie" obligatoire erreur={erreurs.type} champ="type">
            <Puces options={TYPES_BIEN} valeur={x.type} onChange={(type) => changer({ type })} nom="Catégorie" />
          </Groupe>
          <Groupe titre="Transaction" obligatoire erreur={erreurs.transaction} champ="transaction">
            <Puces
              options={x.type && !regles(x.type).vente ? ["À louer"] : ["À louer", "À vendre"]}
              valeur={x.transaction === "location" ? "À louer" : x.transaction === "vente" ? "À vendre" : ""}
              onChange={(t) => changer({ transaction: t === "À vendre" ? "vente" : "location" })}
              nom="Transaction"
            />
            {x.type === "Chambre d'hôtel" && <p className={s.note}>Une chambre d&apos;hôtel se loue uniquement, à la nuit.</p>}
          </Groupe>
          {x.type && (r.meuble || r.etage === "option") && (
            <Groupe titre="Options">
              <div className={s.cases}>
                {r.meuble && (
                  <label className={s.case}>
                    <input type="checkbox" checked={x.meuble} onChange={(e) => changer({ meuble: e.target.checked })} /> Déjà meublé
                  </label>
                )}
                {r.etage === "option" && (
                  <label className={s.case}>
                    <input type="checkbox" checked={x.immeuble} onChange={(e) => changer({ immeuble: e.target.checked })} /> Dans un
                    immeuble
                  </label>
                )}
              </div>
            </Groupe>
          )}
          {x.immeuble && (
            <Groupe titre="Étage">
              <Nombres
                options={[0, 1, 2, 3, 4, 5]}
                etiquette={(n) => (n === 0 ? "Rdc" : n === 1 ? "1er" : `${n}e`)}
                valeur={x.etage}
                onChange={(etage) => changer({ etage })}
                plus={{ min: 6, max: 100, texte: "6e et +" }}
                nom="Étage"
              />
            </Groupe>
          )}
        </Section>

        {/* 2. Où */}
        <Section numero={2} titre="Localisation">
          <div className={s.deux}>
            <Groupe titre="Ville" obligatoire erreur={erreurs.ville} champ="ville" pour="pub-ville">
              <select id="pub-ville" className={s.champ} value={x.ville} onChange={(e) => {
                const ville = e.target.value, liste = communesDe(ville);
                changer({ ville, commune: liste.length === 1 ? liste[0] : "", quartier: "" });
              }}>
                <option value="">Choisir…</option>
                {VILLES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Groupe>
            <Groupe titre="Commune" obligatoire erreur={erreurs.commune} champ="commune" pour="pub-commune">
              <select id="pub-commune" className={s.champ} value={x.commune} disabled={!x.ville} onChange={(e) => changer({ commune: e.target.value, quartier: "" })}>
                <option value="">Choisir…</option>
                {communes.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Groupe>
          </div>
          <div className={s.deux}>
            <Groupe titre="Quartier" pour="pub-quartier">
              <input id="pub-quartier" className={s.champ} list="pub-quartiers" value={x.quartier} placeholder={quartiers[0] ? `Ex : ${quartiers[0]}` : "Ex : Centre"}
                onChange={(e) => changer({ quartier: e.target.value })} maxLength={80} />
              <datalist id="pub-quartiers">{quartiers.map((q) => <option key={q} value={q} />)}</datalist>
            </Groupe>
            <Groupe titre="Adresse précise ou repère" pour="pub-adresse">
              <input id="pub-adresse" className={s.champ} value={x.adresse} placeholder="Ex : près de la pharmacie…" onChange={(e) => changer({ adresse: e.target.value })} maxLength={200} />
            </Groupe>
          </div>
        </Section>

        {/* 3. Caractéristiques */}
        <Section numero={3} titre="Caractéristiques">
          {!x.type && <p className={s.note}>Choisissez d&apos;abord le type de bien : seuls les champs utiles s&apos;affichent.</p>}
          {x.type && r.pieces && (
            <Groupe titre="Nombre de pièces" obligatoire erreur={erreurs.pieces} champ="pieces">
              <Nombres
                options={[...(r.studio ? [0] : []), ...(r.unePiece ? [1] : []), 2, 3, 4, 5]}
                etiquette={(n) => (n === 0 ? "Studio" : String(n))}
                valeur={x.studio ? 0 : x.pieces}
                onChange={(n) => changer(n === 0 ? { studio: true, pieces: 1, chambres: 0 } : { studio: false, pieces: n })}
                plus={{ min: 6, max: 50, texte: "6 et +" }}
                nom="Nombre de pièces"
              />
              <p className={s.note}>Le séjour compte pour une pièce : un 3 pièces a 2 chambres au plus.</p>
            </Groupe>
          )}
          {x.type && (
            <div className={s.trois}>
              {r.chambres && !x.studio && (
                <Groupe titre="Chambres">
                  <Compteur valeur={x.chambres} min={0} max={x.pieces ? x.pieces - 1 : 49} onChange={(chambres) => changer({ chambres })} nom="Chambres" />
                </Groupe>
              )}
              {r.sanitaires && (
                <Groupe titre={r.sanitaires}>
                  <Compteur valeur={x.sanitaires} min={0} max={50} onChange={(sanitaires) => changer({ sanitaires })} nom={r.sanitaires} />
                </Groupe>
              )}
              {x.transaction === "location" && r.caution && (
                <Groupe titre="Mois de caution">
                  <Compteur valeur={x.caution} min={0} max={24} onChange={(caution) => changer({ caution })} nom="Mois de caution" />
                </Groupe>
              )}
            </div>
          )}
          {x.type && (
            <Groupe titre={`${r.surface} (m²)`} obligatoire erreur={erreurs.surface} champ="surface" pour="pub-surface">
              <input id="pub-surface" className={`${s.champ} ${s.champCourt}`} inputMode="decimal" value={x.surface} placeholder="Ex : 85"
                onChange={(e) => changer({ surface: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} />
              <details className={s.aide}>
                <summary>Comment calculer la {r.surface.toLowerCase()} ?</summary>
                {x.type === "Terrain" ? (
                  <p>Superficie du titre foncier ou de l&apos;attestation (ACD) ; sinon longueur × largeur du terrain en mètres.</p>
                ) : (
                  <p>Additionnez la surface de chaque pièce (longueur × largeur en mètres), couloirs compris, sans les murs, la terrasse ni le
                    balcon. Pour un bureau ou un commerce : surface utile, hors parties communes.</p>
                )}
              </details>
            </Groupe>
          )}
        </Section>

        {/* 4. Prix */}
        <Section numero={4} titre={vente ? "Prix de vente" : "Prix"}>
          <div className={s.deux}>
            <Groupe titre={vente ? "Prix" : "Loyer"} obligatoire erreur={erreurs.prix} champ="prix" pour="pub-prix">
              <div className={s.avecUnite}>
                <input id="pub-prix" className={s.champ} inputMode="numeric" value={x.prix ? formaterPrix(Number(x.prix)) : ""} placeholder={vente ? "Ex : 45 000 000" : "Ex : 150 000"}
                  onChange={(e) => changer({ prix: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
                <span className={s.unite}>FCFA</span>
              </div>
            </Groupe>
            {x.transaction === "location" && (
              <Groupe titre="Par" obligatoire erreur={erreurs.loyerPar} champ="loyerPar">
                <Puces options={r.loyerPar} valeur={x.loyerPar} onChange={(u) => changer({ loyerPar: u as UniteLoyer })} nom="Loyer par" />
              </Groupe>
            )}
          </div>
          {vente && <p className={s.note}>Prix total du bien : pas de prix par jour ni par mois pour une vente.</p>}
        </Section>

        {/* 5. Commodités */}
        <Section numero={5} titre="Commodités et équipements">
          {!x.type && <p className={s.note}>Choisissez d&apos;abord le type de bien.</p>}
          {x.type && (
            <div className={s.puces} role="group" aria-label="Commodités">
              {r.commodites.map((c) => (
                <button key={c} type="button" aria-pressed={x.commodites.includes(c)}
                  className={`${s.puce} ${x.commodites.includes(c) ? s.puceChoisie : ""}`}
                  onClick={() => changer({ commodites: x.commodites.includes(c) ? x.commodites.filter((k) => k !== c) : [...x.commodites, c] })}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* 6. Description */}
        <Section numero={6} titre="Description">
          <Groupe titre="Titre de l'annonce" obligatoire erreur={erreurs.titre} champ="titre" pour="pub-titre">
            <input id="pub-titre" className={s.champ} value={titre} maxLength={120} placeholder="Choisissez le type de bien : un titre est proposé"
              onChange={(e) => changer({ titre: e.target.value, titreModifie: true })} />
            {x.titreModifie && !annonce && (
              <button type="button" className={s.lien} onClick={() => changer({ titreModifie: false })}>Reprendre le titre proposé</button>
            )}
          </Groupe>
          <Groupe titre="Description" obligatoire erreur={erreurs.description} champ="description" pour="pub-description">
            <textarea id="pub-description" className={`${s.champ} ${s.zone}`} value={x.description} maxLength={5000} rows={6}
              placeholder="État général, environnement, points forts, accès, transports à proximité…"
              onChange={(e) => changer({ description: e.target.value })} />
            <span className={s.compte}>{x.description.trim().length} caractères (au moins 30 ; 50 et plus conseillés)</span>
          </Groupe>
        </Section>

        {/* 7. Photos */}
        <Section numero={7} titre="Photos du bien">
          <div data-champ="photos">
            <Photos photos={photos} onChange={(p) => { setPhotos(p); setMessage(null); }} erreur={erreurs.photos} />
          </div>
        </Section>

        {/* 8. Contact */}
        <Section numero={8} titre="Contact affiché sur l'annonce">
          <Groupe titre="Vous êtes" obligatoire>
            <Puces options={["Particulier", "Agence immobilière"]} valeur={x.typeVendeur === "agence" ? "Agence immobilière" : "Particulier"}
              onChange={(v) => changer({ typeVendeur: v === "Particulier" ? "particulier" : "agence" })} nom="Type de vendeur" />
          </Groupe>
          <Groupe titre={x.typeVendeur === "agence" ? "Nom de l'agence" : "Nom affiché"} obligatoire erreur={erreurs.contactNom} champ="contactNom" pour="pub-nom">
            <input id="pub-nom" className={s.champ} value={x.contactNom} maxLength={120} placeholder="Ex : Kamika Immobilier ou Jean Kouassi" onChange={(e) => changer({ contactNom: e.target.value })} />
          </Groupe>
          <div data-champ="tels">
            <BlocTelephones valeur={x.tels} onChange={(tels) => changer({ tels })} erreur={erreurs.tels} titre="Numéros à appeler" />
          </div>
          <Groupe titre="E-mail de contact (facultatif)" erreur={erreurs.email} champ="email" pour="pub-email">
            <input id="pub-email" type="email" inputMode="email" className={s.champ} value={x.email} placeholder="contact@agence.ci" onChange={(e) => changer({ email: e.target.value })} />
          </Groupe>
        </Section>
      </div>

      {/* ── À droite : aperçu, conseils, Premium, boutons ── */}
      <aside className={s.cote}>
        <div className={s.carte}>
          <span className={s.carteTitre}>Aperçu de l&apos;annonce</span>
          <Apercu x={x} titre={titre} photo={photos[0]?.apercu} />
        </div>
        <div className={s.carte}>
          <span className={s.carteTitre}>Conseils</span>
          <ul className={s.conseils}>
            <li className={photos.length >= 5 ? s.fait : ""}>Au moins 5 photos lumineuses : jusqu&apos;à 3 fois plus de contacts.</li>
            <li className={x.description.trim().length >= 50 ? s.fait : ""}>Une description précise (état, accès, environnement).</li>
            <li className={x.quartier.trim() ? s.fait : ""}>Le quartier, pour être trouvé dans les recherches.</li>
          </ul>
        </div>
        <div className={`${s.carte} ${s.premium}`}>
          <span className={s.carteTitre}>
            Annonce Premium <span className={s.bientot}>Bientôt</span>
          </span>
          <p className={s.premiumTexte}>En tête des résultats pendant 30 jours, badge « Premium », statistiques et alertes aux acheteurs ciblés — 5 000 FCFA.</p>
        </div>

        {message && (
          <p className={`${s.message} ${message.erreur ? s.messageErreur : s.messageSucces}`} role={message.erreur ? "alert" : "status"}>
            <Icone nom={message.erreur ? "cadenas" : "valide"} taille={16} />
            {message.texte}
          </p>
        )}
        {envoi && <p className={s.progression} role="status">{envoi}</p>}
        <div className={s.boutons}>
          <button type="submit" className={s.boutonPlein} disabled={!!envoi}>
            <Icone nom="valide" taille={17} />
            {enLigne ? "Enregistrer les modifications" : "Envoyer pour vérification"}
          </button>
          {!enLigne && (
            <button type="button" className={s.boutonContour} disabled={!!envoi} onClick={() => enregistrer("brouillon")}>
              Enregistrer le brouillon
            </button>
          )}
          <Link href="/mon-espace?section=annonces" className={s.lien}>Mes annonces</Link>
        </div>
      </aside>
    </form>
  );
}

// ── Petits morceaux du formulaire ──
function Section({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={`section-${numero}`}>
      <h2 id={`section-${numero}`} className={s.sectionTitre}>
        <span className={s.numero}>{numero}</span>
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Groupe(props: { titre: string; obligatoire?: boolean; erreur?: string; champ?: string; pour?: string; children: ReactNode }) {
  const { titre, obligatoire, erreur, champ, pour, children } = props;
  const Etiquette = pour ? "label" : "span";
  return (
    <div className={`${s.groupe} ${erreur ? s.groupeErreur : ""}`} data-champ={champ}>
      <Etiquette className={s.etiquette} {...(pour ? { htmlFor: pour } : {})}>
        {titre}
        {obligatoire && <span className={s.obligatoire} aria-hidden="true"> *</span>}
      </Etiquette>
      {children}
      {erreur && <p className={s.erreurTexte}>{erreur}</p>}
    </div>
  );
}

function Puces({ options, valeur, onChange, nom }: { options: string[]; valeur: string; onChange: (v: string) => void; nom: string }) {
  return (
    <div className={s.puces} role="radiogroup" aria-label={nom}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={valeur === o} className={`${s.puce} ${valeur === o ? s.puceChoisie : ""}`} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Nombres(props: {
  options: number[]; etiquette: (n: number) => string; valeur: number | null; onChange: (n: number) => void;
  plus: { min: number; max: number; texte: string }; nom: string;
}) {
  const { options, etiquette, valeur, onChange, plus, nom } = props;
  const auDela = valeur !== null && valeur >= plus.min;
  return (
    <div className={s.puces} role="radiogroup" aria-label={nom}>
      {options.map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valeur === n} className={`${s.puce} ${valeur === n ? s.puceChoisie : ""}`} onClick={() => onChange(n)}>
          {etiquette(n)}
        </button>
      ))}
      <button type="button" role="radio" aria-checked={auDela} className={`${s.puce} ${auDela ? s.puceChoisie : ""}`} onClick={() => onChange(auDela ? valeur! : plus.min)}>
        {plus.texte}
      </button>
      {auDela && (
        <input type="number" className={`${s.champ} ${s.champNombre}`} min={plus.min} max={plus.max} value={valeur ?? plus.min} aria-label={`${nom} (nombre)`}
          onChange={(e) => onChange(Math.min(plus.max, Math.max(plus.min, Number(e.target.value) || plus.min)))} />
      )}
    </div>
  );
}

function Compteur({ valeur, min, max, onChange, nom }: { valeur: number; min: number; max: number; onChange: (n: number) => void; nom: string }) {
  return (
    <div className={s.compteur}>
      <button type="button" aria-label={`${nom} : moins`} disabled={valeur <= min} onClick={() => onChange(valeur - 1)}>−</button>
      <span aria-live="polite" aria-label={nom}>{valeur}</span>
      <button type="button" aria-label={`${nom} : plus`} disabled={valeur >= max} onClick={() => onChange(valeur + 1)}>+</button>
    </div>
  );
}

function Apercu({ x, titre, photo }: { x: Champs; titre: string; photo?: string }) {
  const prix = Number(x.prix) > 0 ? prixTexte(Number(x.prix), x.transaction === "location" && x.loyerPar ? uniteBase(x.loyerPar) : null) : "Prix à indiquer";
  const details = [
    x.studio ? "Studio" : x.pieces ? `${x.pieces} pièce${x.pieces > 1 ? "s" : ""}` : "",
    x.chambres && x.pieces ? `${x.chambres} ch.` : "",
    Number(x.surface) > 0 ? `${x.surface} m²` : "",
  ].filter(Boolean);
  return (
    <div className={s.apercu}>
      <div className={s.apercuPhoto}>
        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local de la photo principale */}
        {photo ? <img src={photo} alt="" /> : <Icone nom="maison" taille={34} />}
        {x.transaction && <span className={`${s.badge} ${x.transaction === "vente" ? s.badgeVente : ""}`}>{x.transaction === "vente" ? "À vendre" : "À louer"}</span>}
      </div>
      <div className={s.apercuCorps}>
        <span className={s.apercuPrix}>{prix}</span>
        <span className={s.apercuTitre}>{titre || "Titre de l'annonce"}</span>
        <span className={s.apercuLieu}>
          <Icone nom="lieu" taille={13} /> {lieuTexte({ villes: { nom: x.ville }, communes: x.commune ? { nom: x.commune } : null, quartiers: null, quartier_texte: x.quartier.trim() || null }) || "Lieu à indiquer"}
        </span>
        {details.length > 0 && <span className={s.apercuDetails}>{details.join(" · ")}</span>}
      </div>
    </div>
  );
}
