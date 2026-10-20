"use client";

/*
 * « Faire voir mon annonce » (Mon Espace → Mes annonces, annonce en ligne) : choisir une offre et payer par Mobile
 * Money, ou utiliser ce qui est déjà payé (remontées d'un pack, jours Premium gardés, remontées incluses dans
 * l'abonnement agence, à la main ou programmées). « Bien visité » : la visite d'un agent, au prix qui convient au bien.
 * Règles : lib/offres.ts et supabase/migrations/…_offres.sql, …_abonnements_bien_visite.sql.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import Icone from "@/components/Icone";
import { joursRestants, type Annonce } from "@/lib/annonces";
import { messageErreur } from "@/lib/compte";
import { texteCreneau } from "@/lib/creneaux";
import { dateComplete, formaterPrix } from "@/lib/format";
import {
  PAIEMENT_SIMULE, TARIFS, abonne, incluses, offreBienVisite, payer, premiumActif, prochaineRemontee, programmerRemontees,
  utiliserJoursPremium, utiliserRemontee, visiteEnCours, type CleOffre, type MesOffres,
} from "@/lib/offres";
import s from "./FenetreBooster.module.css";

type Props = {
  annonce: Annonce;
  offres: MesOffres | null;
  fermer: () => void;
  /** remontée, programmation ou jours Premium utilisés : le message à afficher, puis Mes annonces se recharge */
  fait: (message: string) => void;
};

/** Fréquences proposées aux agences abonnées pour les remontées programmées */
const FREQUENCES = [1, 2, 3, 5, 7, 10, 14, 21, 30];

const heure = (d: Date) =>
  `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" })} à ${
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).replace(":", " h ")}`;

type Choix = { cle: CleOffre; titre: string; texte: string; desactivee?: string };

export default function FenetreBooster({ annonce: a, offres, fermer, fait }: Props) {
  const boite = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!boite.current?.open) boite.current?.showModal();
  }, []);
  const prix = (cle: CleOffre) => offres?.tarifs.find((o) => o.cle === cle)?.prix ?? TARIFS[cle];
  const premium = premiumActif(a);
  const attendre = prochaineRemontee(a);
  const jours = joursRestants(a);
  const agenceAbonnee = abonne(offres);
  const restantes = incluses(offres);
  const abonnement = offres?.abonnement?.en_cours ?? null;
  const programme = offres?.programmees.find((x) => x.annonce === a.id) ?? null;
  const cleVisite = offreBienVisite(a);
  const visite = visiteEnCours(offres, a.id);

  const attente = attendre ? `Déjà remontée il y a moins de 24 heures : prochaine remontée possible le ${heure(attendre)}.` : undefined;
  const choix: Choix[] = [
    ...(agenceAbonnee
      ? restantes === 0
        ? [{ cle: "remontee_sup" as const, titre: "Remontée supplémentaire",
             texte: "Vos remontées incluses de ce mois sont utilisées : celle-ci est à moitié prix, en tête des annonces ordinaires.",
             desactivee: attente }]
        : []
      : [
          { cle: "remontee" as const, titre: "Remonter mon annonce",
            texte: "En tête des annonces ordinaires de « Plus récentes », comme publiée à l'instant.", desactivee: attente },
          { cle: "remontees_3" as const, titre: "Pack de 3 remontées",
            texte: attendre ? `Les 3 remontées sont gardées 30 jours ; la première possible le ${heure(attendre)}.`
              : `Une maintenant, puis 2 à utiliser dans les 30 jours : environ ${formaterPrix(Math.round(prix("remontees_3") / 3))} FCFA la remontée.` },
        ]),
    { cle: "premium_30", titre: premium ? "Prolonger le Premium de 30 jours" : "Premium 30 jours",
      texte: "Au-dessus des annonces ordinaires pendant 30 jours, badge « Premium », 30 photos au lieu de 20, « À la une » des e-mails d'alerte." },
    { cle: cleVisite, titre: "Bien visité",
      texte: "Un agent de 360-Immo.ci visite le bien, prend de vraies photos (ajoutées à l'annonce) et voit l'original des papiers : badge « Bien visité ». L'équipe vous appelle pour fixer le rendez-vous.",
      desactivee: a.bien_visite_le
        ? `Votre bien a le badge « Bien visité » depuis le ${dateComplete(a.bien_visite_le)}.`
        : visite?.statut === "planifiee" && visite.rendez_vous
          ? `Rendez-vous fixé : l'agent ${visite.agent ?? ""} passe le ${texteCreneau(visite.rendez_vous)}.`
          : visite ? "Visite déjà demandée : l'équipe 360-Immo.ci vous appelle pour fixer le rendez-vous." : undefined },
  ];
  // offre choisie d'office : le Premium si l'annonce vient d'être remontée, sinon la première possible
  const [choisi, setChoisi] = useState<CleOffre | null>(() =>
    (attendre ? choix.find((c) => c.cle === "premium_30") : undefined)?.cle ?? choix.find((c) => !c.desactivee)?.cle ?? null);
  const [auto, setAuto] = useState(true);
  const [tousLes, setTousLes] = useState(programme?.tous_les ?? 5);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const agir = async (action: () => Promise<unknown>) => {
    setEnvoi(true);
    setErreur("");
    try {
      await action();
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };
  const terminer = (message: string) => {
    boite.current?.close();
    fait(message);
  };
  const remonterGratuit = () => agir(async () => {
    const r = await utiliserRemontee(a.id);
    const reste = r.incluses ?? r.restantes;
    const quoi = r.incluses !== null ? `incluse${reste > 1 ? "s" : ""} ce mois-ci` : "d'avance";
    terminer(`Annonce remontée en tête de la liste.${reste ? ` Il vous reste ${reste} remontée${reste > 1 ? "s" : ""} ${quoi}.` : ""}`);
  });
  const programmer = () => agir(async () => {
    await programmerRemontees(a.id, true, tousLes);
    terminer(`Remontées automatiques programmées : tous les ${tousLes > 1 ? `${tousLes} jours` : "jours"}, sur vos remontées incluses.`);
  });
  const premiumGarde = () => agir(async () => {
    const fin = await utiliserJoursPremium(a.id);
    terminer(`Annonce Premium jusqu'au ${dateComplete(fin)}.`);
  });

  const choixActif = choix.find((c) => c.cle === choisi && !c.desactivee) ?? null;
  return (
    <dialog ref={boite} className={s.boite} aria-labelledby={`${id}-titre`} onClose={fermer}>
      <div className={s.contenu}>
        <div className={s.entete}>
          <h2 id={`${id}-titre`} className={s.titre}>Faire voir mon annonce</h2>
          <button type="button" className={s.fermer} aria-label="Fermer" onClick={() => boite.current?.close()}>
            <Icone nom="fermer" taille={18} />
          </button>
        </div>
        <p className={s.annonce}>{a.titre} · réf. {a.reference}</p>

        {premium && a.premium_jusquau && (
          <p className={s.info}><Icone nom="etoile" taille={15} /> Premium jusqu&apos;au {dateComplete(a.premium_jusquau)}.</p>
        )}
        {jours !== null && jours <= 7 && (
          <p className={s.attention}>
            <Icone nom="horloge" taille={15} />
            <span>
              Votre annonce se termine dans {jours} jour{jours > 1 ? "s" : ""} : renouvelez-la d&apos;abord (gratuit, bouton
              « Renouveler »). Une remontée ne prolonge pas l&apos;annonce.
            </span>
          </p>
        )}

        {/* Abonnement agence : remontées incluses, à la main ou programmées */}
        {abonnement && restantes !== null && (
          <div className={s.avance} role="group" aria-label="Abonnement agence">
            <div className={s.avanceLigne}>
              <span>
                <strong>Abonnement agence : {restantes} remontée{restantes > 1 ? "s" : ""} incluse{restantes > 1 ? "s" : ""}</strong> à
                utiliser d&apos;ici le {dateComplete(abonnement.fin)}
              </span>
              <button type="button" className={s.petitBouton} disabled={envoi || !!attendre || restantes === 0} onClick={remonterGratuit}>
                <Icone nom="monter" taille={14} /> Remonter maintenant
              </button>
            </div>
            <div className={s.avanceLigne}>
              <label className={s.frequence}>
                <span>{programme ? `Programmée tous les ${programme.tous_les} jours. Changer :` : "Remonter automatiquement :"}</span>
                <select value={tousLes} onChange={(e) => setTousLes(Number(e.target.value))} disabled={envoi}>
                  {FREQUENCES.map((n) => <option key={n} value={n}>{n === 1 ? "chaque jour" : `tous les ${n} jours`}</option>)}
                </select>
              </label>
              <button type="button" className={s.petitBouton} disabled={envoi} onClick={programmer}>
                <Icone nom="horloge" taille={14} /> Programmer
              </button>
            </div>
          </div>
        )}

        {/* Déjà payé d'avance */}
        {offres && ((!agenceAbonnee && offres.remontees > 0) || offres.jours_premium > 0) && (
          <div className={s.avance}>
            {!agenceAbonnee && offres.remontees > 0 && (
              <div className={s.avanceLigne}>
                <span>
                  <strong>{offres.remontees} remontée{offres.remontees > 1 ? "s" : ""} d&apos;avance</strong>
                  {offres.remontees_fin && <> à utiliser avant le {dateComplete(offres.remontees_fin)}</>}
                </span>
                <button type="button" className={s.petitBouton} disabled={envoi || !!attendre} onClick={remonterGratuit}>
                  <Icone nom="monter" taille={14} /> Remonter maintenant
                </button>
              </div>
            )}
            {offres.jours_premium > 0 && (
              <div className={s.avanceLigne}>
                <span><strong>{offres.jours_premium} jour{offres.jours_premium > 1 ? "s" : ""} Premium gardés</strong> (bien vendu, loué ou retiré)</span>
                <button type="button" className={s.petitBouton} disabled={envoi} onClick={premiumGarde}>
                  <Icone nom="etoile" taille={14} /> Les utiliser ici
                </button>
              </div>
            )}
          </div>
        )}

        <fieldset className={s.options}>
          <legend className={s.legende}>Choisissez une offre</legend>
          {choix.map((c) => (
            <div key={c.cle} className={s.choix}>
              <label className={`${s.option} ${choisi === c.cle ? s.choisie : ""} ${c.desactivee ? s.desactivee : ""}`}>
                <input type="radio" name={`${id}-offre`} value={c.cle} checked={choisi === c.cle} disabled={!!c.desactivee}
                  onChange={() => setChoisi(c.cle)} />
                <span className={s.optionTexte}>
                  <span className={s.optionHaut}>
                    <span className={s.optionTitre}>{c.titre}</span>
                    <span className={s.optionPrix}>{formaterPrix(prix(c.cle))} FCFA</span>
                  </span>
                  <span className={s.optionDetail}>{c.desactivee ?? c.texte}</span>
                </span>
              </label>
              {c.cle === "remontees_3" && choisi === "remontees_3" && !attendre && (
                <label className={s.auto}>
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                  Faire les 2 suivantes automatiquement, tous les 3 jours
                </label>
              )}
            </div>
          ))}
        </fieldset>

        <p className={s.paiement}>
          <Icone nom="telephone" taille={15} />
          <span>
            Paiement par <strong>Orange Money, MTN MoMo, Moov Money ou Wave</strong> : vous validez sur votre téléphone, l&apos;offre
            s&apos;applique dès que le paiement est reçu. Reçu par e-mail.
            {PAIEMENT_SIMULE && <strong className={s.essai}> Mode essai : paiement simulé, aucun argent n&apos;est débité.</strong>}
          </span>
        </p>
        {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
        <div className={s.boutons}>
          <button type="button" className={s.plein} disabled={envoi || !choixActif}
            onClick={() => choixActif && agir(() => payer(choixActif.cle, a.id, choixActif.cle === "remontees_3" && auto && !attendre))}>
            {envoi ? "Un instant…" : choixActif ? `Payer ${formaterPrix(prix(choixActif.cle))} FCFA` : "Choisissez une offre"}
          </button>
          <Link href="/offres" className={s.lien}>Comment ça marche ?</Link>
        </div>
      </div>
    </dialog>
  );
}
