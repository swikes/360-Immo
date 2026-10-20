"use client";

/*
 * Administration → Biens visités (si le paiement est ouvert) : les visites « Bien visité » payées par les annonceurs.
 *   À planifier        appeler l'annonceur, fixer le rendez-vous et l'agent (l'annonceur le reçoit par e-mail)
 *   Rendez-vous fixés  après la visite : ajouter les photos de l'agent (elles vont sur l'annonce), cocher les papiers
 *                      vus en original, puis poser le badge « Bien visité » ; ou noter « visite impossible » avec la
 *                      raison (le remboursement se note dans l'onglet Paiements)
 *   Notées             les 90 derniers jours (badge posé, retiré si le bien a changé, visites impossibles)
 * La base vérifie elle-même chaque action (supabase/migrations/…_abonnements_bien_visite.sql).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import { ajouterPhoto } from "@/lib/annonces";
import { urlVignettePublique } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { texteCreneau } from "@/lib/creneaux";
import { formaterPrix } from "@/lib/format";
import {
  PAPIERS, STATUTS_PAIEMENT, STATUTS_VISITE_AGENT, biensVisites, noterVisite, planifierVisite, type TableauBiensVisites,
  type VisiteEquipe,
} from "@/lib/offres";
import { reduirePhotoAnnonce } from "@/lib/photos";
import { dateHeure } from "./outils";
import s from "./Admin.module.css";

export default function BiensVisites({ relire }: { relire?: () => void }) {
  const [t, setT] = useState<TableauBiensVisites | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => biensVisites().then(setT, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    biensVisites().then((x) => actif && setT(x), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  if (!t) return erreur ? <p className={s.erreur} role="alert">{erreur}</p> : <p className={s.attente}>Chargement des visites…</p>;
  const groupe = (titre: string, liste: VisiteEquipe[]) => liste.length > 0 && (
    <section aria-label={titre}>
      <h2 className={s.groupeTitre}>{titre} ({liste.length})</h2>
      <ul className={s.cartes}>
        {liste.map((v) => (
          <Carte key={v.id} v={v} termine={async (texte) => {
            setFait(texte);
            await charger();
            relire?.();
          }} />
        ))}
      </ul>
    </section>
  );
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      <ul className={s.tuiles} aria-label="En bref">
        <li className={`${s.tuile} ${t.a_planifier ? s.tuileAction : ""}`}>
          <span className={s.tuileTitre}>À planifier</span><span className={s.tuileValeur}>{t.a_planifier}</span>
          <span className={s.tuileDetail}>appeler l&apos;annonceur pour le rendez-vous</span>
        </li>
        <li className={s.tuile}>
          <span className={s.tuileTitre}>Rendez-vous fixés</span><span className={s.tuileValeur}>{t.planifiees}</span>
          <span className={s.tuileDetail}>visite à faire, puis à noter</span>
        </li>
        <li className={s.tuile}>
          <span className={s.tuileTitre}>Badges en ligne</span><span className={s.tuileValeur}>{t.badges}</span>
          <span className={s.tuileDetail}>annonces « Bien visité »</span>
        </li>
      </ul>
      {t.visites.length === 0 && <p className={s.aide}>Aucune visite demandée pour l&apos;instant.</p>}
      {groupe("À planifier", t.visites.filter((v) => v.statut === "a_planifier"))}
      {groupe("Rendez-vous fixés", t.visites.filter((v) => v.statut === "planifiee"))}
      {groupe("Notées ces 90 derniers jours", t.visites.filter((v) => v.statut !== "a_planifier" && v.statut !== "planifiee"))}
    </div>
  );
}

/** « 2026-10-22T09:30 » (champ date et heure) pour un rendez-vous déjà fixé */
const champDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};

function Carte({ v, termine }: { v: VisiteEquipe; termine: (texte: string) => Promise<void> }) {
  const id = useId();
  const a = v.annonce;
  const ouverte = v.statut === "a_planifier" || v.statut === "planifiee";
  const [quand, setQuand] = useState(champDate(v.rendez_vous));
  const [agent, setAgent] = useState(v.agent ?? "");
  const [papiers, setPapiers] = useState<string[]>([]);
  const [compteRendu, setCompteRendu] = useState("");
  const [photosAgent, setPhotosAgent] = useState(a.photos_agent ?? 0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [etape, setEtape] = useState<"" | "rendez_vous" | "resultat">("");

  const agir = async (action: () => Promise<string>) => {
    setEnvoi(true);
    setErreur("");
    try {
      const texte = await action();
      await termine(texte);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };
  const envoyerPhotos = async (fichiers: FileList | null) => {
    if (!fichiers?.length || !a.id) return;
    setEnvoi(true);
    setErreur("");
    try {
      let ordre = (a.photos ?? 0) + photosAgent;
      for (const fichier of Array.from(fichiers)) {
        const p = await reduirePhotoAnnonce(fichier);
        await ajouterPhoto(a.id, p.blob, p.extension, ordre++, p.empreinte, p.vignette, true);
        setPhotosAgent((n) => n + 1);
      }
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <li className={s.carte} aria-labelledby={`${id}-titre`}>
      <div className={s.badges}>
        <span className={`${s.badge} ${v.statut === "a_planifier" ? s.badgeInfo : v.statut === "impossible" || v.statut === "annulee" ? s.badgeAlerte : ""}`}>
          {STATUTS_VISITE_AGENT[v.statut]}
        </span>
        {v.badge_retire_le && <span className={`${s.badge} ${s.badgeAlerte}`}>Badge retiré</span>}
        {v.paiement && v.paiement.statut !== "payee" && <span className={`${s.badge} ${s.badgeAlerte}`}>Paiement {STATUTS_PAIEMENT[v.paiement.statut].toLowerCase()}</span>}
      </div>
      <div className={s.visiteHaut}>
        <span className={s.miniPhoto}>{a.photo ? <PhotoCadree src={urlVignettePublique(a.photo)} alt="" /> : <Icone nom="photo" taille={20} />}</span>
        <div className={s.visiteTexte}>
          <h3 id={`${id}-titre`} className={s.carteTitre}>
            {a.en_ligne && a.reference
              ? <Link href={`/annonces/${a.reference.toLowerCase()}`} target="_blank">{a.titre}</Link>
              : a.titre ?? "Annonce supprimée"}
          </h3>
          <p className={s.meta}>
            {[a.type_nom, a.reference && `réf. ${a.reference}`, a.surface ? `${formaterPrix(a.surface)} m²` : null].filter(Boolean).join(" · ")}
          </p>
          <p className={s.meta}>
            <Icone nom="lieu" taille={13} /> {[a.adresse, a.quartier, a.commune, a.ville].filter(Boolean).join(", ") || "Lieu inconnu"}
          </p>
        </div>
      </div>
      <p className={s.meta}>
        {v.nom} · {formaterPrix(v.montant)} FCFA{v.paiement && <> · {v.paiement.reference}</>} · demandée le {dateHeure(v.cree_le)}
      </p>
      <p className={s.meta}>
        {v.compte ? (
          <>
            {v.compte.nom ?? "Sans nom"}
            {v.compte.telephone && <> · <a href={`tel:${v.compte.telephone.replace(/\s/g, "")}`}>{v.compte.telephone}</a></>}
            {v.compte.email && <> · <a href={`mailto:${v.compte.email}`}>{v.compte.email}</a></>}
          </>
        ) : "Compte supprimé"}
      </p>
      {v.rendez_vous && ouverte && <p className={s.meta}><strong>Rendez-vous : {texteCreneau(v.rendez_vous)}</strong>, agent {v.agent}</p>}
      {v.statut === "visitee" && (
        <p className={s.meta}>
          Visité le {dateHeure(v.visitee_le!)} par {v.agent ?? "l'agent"} · originaux vus : {v.papiers.join(", ")}
          {v.badge_retire_le && <> · badge retiré le {dateHeure(v.badge_retire_le)} : {v.badge_retire_raison}</>}
        </p>
      )}
      {v.compte_rendu && <p className={s.description}>{v.compte_rendu}</p>}

      {ouverte && etape === "" && (
        <div className={s.actions}>
          <button type="button" className={s.boutonContour} onClick={() => setEtape("rendez_vous")}>
            <Icone nom="calendrier" taille={16} /> {v.rendez_vous ? "Changer le rendez-vous" : "Fixer le rendez-vous"}
          </button>
          {v.statut === "planifiee" && (
            <button type="button" className={s.boutonPlein} onClick={() => setEtape("resultat")}>
              <Icone nom="valide" taille={16} /> Noter la visite
            </button>
          )}
          {v.statut === "a_planifier" && (
            <button type="button" className={s.boutonContour} onClick={() => setEtape("resultat")}>Visite impossible…</button>
          )}
        </div>
      )}

      {etape === "rendez_vous" && (
        <div className={s.refus}>
          <label htmlFor={`${id}-quand`} className={s.etiquette}>Date et heure du rendez-vous (fixées avec l&apos;annonceur au téléphone)</label>
          <input id={`${id}-quand`} type="datetime-local" className={s.zone} value={quand} onChange={(e) => setQuand(e.target.value)} />
          <label htmlFor={`${id}-agent`} className={s.etiquette}>Agent qui fera la visite</label>
          <input id={`${id}-agent`} className={s.zone} value={agent} maxLength={80} onChange={(e) => setAgent(e.target.value)} placeholder="Prénom et nom" />
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi}
              onClick={() => agir(async () => {
                if (!quand) throw Object.assign(new Error("Choisissez la date et l'heure du rendez-vous."), { code: "P0001" });
                await planifierVisite(v.id, new Date(quand).toISOString(), agent);
                return `Rendez-vous fixé pour ${a.titre ?? "le bien"} : l'annonceur le reçoit par e-mail.`;
              })}>
              Enregistrer le rendez-vous
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setEtape("")}>Annuler</button>
          </div>
        </div>
      )}

      {etape === "resultat" && (
        <div className={s.refus}>
          {v.statut === "planifiee" && a.id && (
            <>
              <span className={s.etiquette}>Photos prises par l&apos;agent ({photosAgent} ajoutée{photosAgent > 1 ? "s" : ""} à l&apos;annonce)</span>
              <label className={s.boutonContour}>
                <Icone nom="photo" taille={16} /> Ajouter des photos
                <input type="file" accept="image/*" multiple hidden disabled={envoi} onChange={(e) => envoyerPhotos(e.target.files)} />
              </label>
              <fieldset className={s.papiers}>
                <legend className={s.etiquette}>Papiers dont l&apos;agent a vu l&apos;original</legend>
                {PAPIERS.map((x) => (
                  <label key={x} className={s.caseDoublon}>
                    <input type="checkbox" checked={papiers.includes(x)}
                      onChange={(e) => setPapiers(e.target.checked ? [...papiers, x] : papiers.filter((y) => y !== x))} />
                    {x}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <label htmlFor={`${id}-cr`} className={s.etiquette}>
            Compte rendu (lu par l&apos;annonceur){v.statut === "a_planifier" ? " : pourquoi la visite ne peut pas se faire" : ""}
          </label>
          <textarea id={`${id}-cr`} className={s.zone} rows={3} maxLength={1000} value={compteRendu} onChange={(e) => setCompteRendu(e.target.value)}
            placeholder="Ex : Bien conforme à l'annonce, propriétaire présent." />
          {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
          <div className={s.actions}>
            {v.statut === "planifiee" && (
              <button type="button" className={s.boutonPlein} disabled={envoi}
                onClick={() => agir(async () => {
                  await noterVisite(v.id, "visitee", papiers, compteRendu);
                  return `Badge « Bien visité » posé sur ${a.titre}.`;
                })}>
                Poser le badge « Bien visité »
              </button>
            )}
            <button type="button" className={s.boutonDanger} disabled={envoi}
              onClick={() => agir(async () => {
                await noterVisite(v.id, "impossible", [], compteRendu);
                return "Visite notée impossible : l'annonceur est prévenu par e-mail. Remboursement éventuel : onglet Paiements.";
              })}>
              Visite impossible
            </button>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => setEtape("")}>Annuler</button>
          </div>
        </div>
      )}
    </li>
  );
}
