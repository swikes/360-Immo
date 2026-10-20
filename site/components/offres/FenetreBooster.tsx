"use client";

/*
 * « Faire voir mon annonce » (Mon Espace → Mes annonces, annonce en ligne) : choisir une offre et payer par Mobile
 * Money, ou utiliser ce qui est déjà payé d'avance (remontées d'un pack, jours Premium gardés).
 * Règles : lib/offres.ts et supabase/migrations/…_offres.sql.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import Icone from "@/components/Icone";
import { joursRestants, type Annonce } from "@/lib/annonces";
import { messageErreur } from "@/lib/compte";
import { dateComplete, formaterPrix } from "@/lib/format";
import {
  PAIEMENT_SIMULE, TARIFS, payer, premiumActif, prochaineRemontee, utiliserJoursPremium, utiliserRemontee,
  type CleOffre, type MesOffres,
} from "@/lib/offres";
import s from "./FenetreBooster.module.css";

type Props = {
  annonce: Annonce;
  offres: MesOffres | null;
  fermer: () => void;
  /** remontée ou jours Premium utilisés : le message à afficher, puis Mes annonces se recharge */
  fait: (message: string) => void;
};

const heure = (d: Date) =>
  `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" })} à ${
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).replace(":", " h ")}`;

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
  const [choix, setChoix] = useState<CleOffre>(attendre ? "premium_30" : "remontee");
  const [auto, setAuto] = useState(true);
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
  const remonterGratuit = () => agir(async () => {
    const restantes = await utiliserRemontee(a.id);
    boite.current?.close();
    fait(`Annonce remontée en tête de la liste. ${restantes ? `Il vous reste ${restantes} remontée${restantes > 1 ? "s" : ""} d'avance.` : ""}`.trim());
  });
  const premiumGarde = () => agir(async () => {
    const fin = await utiliserJoursPremium(a.id);
    boite.current?.close();
    fait(`Annonce Premium jusqu'au ${dateComplete(fin)}.`);
  });

  const option = (cle: CleOffre, titre: string, texte: string, desactivee?: string) => (
    <label className={`${s.option} ${choix === cle ? s.choisie : ""} ${desactivee ? s.desactivee : ""}`}>
      <input type="radio" name={`${id}-offre`} value={cle} checked={choix === cle} disabled={!!desactivee}
        onChange={() => setChoix(cle)} />
      <span className={s.optionTexte}>
        <span className={s.optionHaut}>
          <span className={s.optionTitre}>{titre}</span>
          <span className={s.optionPrix}>{formaterPrix(prix(cle))} FCFA</span>
        </span>
        <span className={s.optionDetail}>{desactivee ?? texte}</span>
      </span>
    </label>
  );

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

        {/* Déjà payé d'avance */}
        {offres && (offres.remontees > 0 || offres.jours_premium > 0) && (
          <div className={s.avance}>
            {offres.remontees > 0 && (
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
          {option("remontee", "Remonter mon annonce",
            "En tête des annonces ordinaires de « Plus récentes », comme publiée à l'instant.",
            attendre ? `Déjà remontée il y a moins de 24 heures : prochaine remontée possible le ${heure(attendre)}.` : undefined)}
          {option("remontees_3", "Pack de 3 remontées",
            attendre ? `Les 3 remontées sont gardées 30 jours ; la première possible le ${heure(attendre)}.`
              : `Une maintenant, puis 2 à utiliser dans les 30 jours : environ ${formaterPrix(Math.round(prix("remontees_3") / 3))} FCFA la remontée.`)}
          {choix === "remontees_3" && !attendre && (
            <label className={s.auto}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Faire les 2 suivantes automatiquement, tous les 3 jours
            </label>
          )}
          {option("premium_30", premium ? "Prolonger le Premium de 30 jours" : "Premium 30 jours",
            "Au-dessus des annonces ordinaires pendant 30 jours, badge « Premium », 30 photos au lieu de 20, « À la une » des e-mails d'alerte.")}
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
          <button type="button" className={s.plein} disabled={envoi}
            onClick={() => agir(() => payer(choix, a.id, choix === "remontees_3" && auto && !attendre))}>
            {envoi ? "Un instant…" : `Payer ${formaterPrix(prix(choix))} FCFA`}
          </button>
          <Link href="/offres" className={s.lien}>Comment ça marche ?</Link>
        </div>
      </div>
    </dialog>
  );
}
