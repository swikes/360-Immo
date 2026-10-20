"use client";

/*
 * Mon Espace → Abonnement agence (comptes agence, si les offres payantes sont ouvertes) : le mois en cours (remontées
 * incluses utilisées, annonces en ligne face à la formule), le mois suivant s'il est payé d'avance, et le choix de la
 * formule pour s'abonner ou payer le mois suivant. Pas de prélèvement automatique : un mois par paiement, rappel par
 * e-mail 3 jours avant la fin. Règles : lib/offres.ts et supabase/migrations/…_abonnements_bien_visite.sql.
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { dateComplete, formaterPrix } from "@/lib/format";
import {
  ANNONCES_FORMULE, FORMULES, PAIEMENT_SIMULE, TARIFS, formuleConseillee, mesOffres, payer, type CleFormule, type MesOffres,
} from "@/lib/offres";
import f from "./Formulaire.module.css";
import s from "./MonAbonnement.module.css";

export default function MonAbonnement({ aller }: { aller: (section: "contacts" | "statistiques" | "annonces") => void }) {
  const id = useId();
  const [offres, setOffres] = useState<MesOffres | null>(null);
  const [erreur, setErreur] = useState("");
  const [choisie, setChoisie] = useState<CleFormule | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    let actif = true;
    mesOffres().then((o) => actif && setOffres(o), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  if (erreur && !offres) return <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>;
  if (!offres) return <p className={s.attente}>Chargement de votre abonnement…</p>;
  const ab = offres.abonnement;
  if (!ab) {
    return (
      <p className={`${f.message} ${f.messageInfo}`}>
        <Icone nom="maison" taille={16} />
        <span>L&apos;abonnement est réservé aux agences : demandez un compte agence depuis Mon profil (l&apos;équipe le valide).</span>
      </p>
    );
  }

  const prix = (cle: CleFormule) => offres.tarifs.find((o) => o.cle === cle)?.prix ?? TARIFS[cle];
  const incluses = (cle: CleFormule) => offres.tarifs.find((o) => o.cle === cle)?.remontees ?? ANNONCES_FORMULE[cle];
  const maxi = (cle: CleFormule) => offres.tarifs.find((o) => o.cle === cle)?.annonces_max ?? ANNONCES_FORMULE[cle];
  const conseillee = formuleConseillee(ab.annonces_en_ligne);
  // une formule plus petite que le nombre d'annonces en ligne n'est pas proposée (sauf la plus grande, au-delà de 200)
  const trop = (cle: CleFormule) => ab.annonces_en_ligne > maxi(cle) && cle !== FORMULES[FORMULES.length - 1];
  const formule = choisie ?? (ab.en_cours && !trop(ab.en_cours.offre) ? ab.en_cours.offre : conseillee);
  const encours = ab.en_cours;
  const restantes = encours ? encours.incluses - encours.utilisees : 0;
  const depasse = encours ? ab.annonces_en_ligne > encours.annonces_max : false;

  const acheter = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await payer(formule, null);
    } catch (e) {
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  };

  return (
    <div className={s.liste}>
      <section className={s.carte} aria-labelledby={`${id}-mois`}>
        <h2 id={`${id}-mois`} className={s.carteTitre}>{ab.agence}</h2>
        {encours ? (
          <>
            <p className={s.statut}>
              <Icone nom="valide" taille={16} />
              <span><strong>{encours.nom}</strong> : du {dateComplete(encours.debut)} au {dateComplete(encours.fin)}</span>
            </p>
            <div className={s.jauge}>
              <div className={s.jaugeHaut}>
                <span>Remontées incluses ce mois-ci</span>
                <strong>{encours.utilisees} utilisée{encours.utilisees > 1 ? "s" : ""} sur {encours.incluses}</strong>
              </div>
              <span className={s.barre} aria-hidden="true">
                <span style={{ width: `${encours.incluses ? Math.min(100, (encours.utilisees / encours.incluses) * 100) : 0}%` }} />
              </span>
              <span className={s.aide}>
                {restantes > 0
                  ? `Il en reste ${restantes}, à répartir comme vous voulez sur vos annonces (à la main ou programmées) d'ici le ${dateComplete(encours.fin)} : elles ne se reportent pas.`
                  : "Toutes utilisées : la remontée supplémentaire coûte 500 FCFA (moitié prix) jusqu'à la fin du mois."}
              </span>
            </div>
            <p className={depasse ? s.attention : s.aide}>
              {ab.annonces_en_ligne} annonce{ab.annonces_en_ligne > 1 ? "s" : ""} en ligne pour une formule jusqu&apos;à {encours.annonces_max}.
              {depasse && ` Rien n'est bloqué pendant ce mois ; au renouvellement, choisissez la formule pour ${ANNONCES_FORMULE[conseillee]} annonces.`}
            </p>
            <div className={s.liens}>
              <button type="button" className={s.lien} onClick={() => aller("annonces")}><Icone nom="monter" taille={14} /> Remonter mes annonces</button>
              <button type="button" className={s.lien} onClick={() => aller("contacts")}><Icone nom="personne" taille={14} /> Suivi des contacts</button>
              <button type="button" className={s.lien} onClick={() => aller("statistiques")}><Icone nom="statistiques" taille={14} /> Statistiques détaillées</button>
            </div>
          </>
        ) : (
          <p className={s.texte}>
            Pas d&apos;abonnement en cours{ab.termine_le ? ` (le dernier s'est terminé le ${dateComplete(ab.termine_le)})` : ""}. Vos annonces restent
            en ligne normalement ; l&apos;abonnement ajoute des remontées incluses chaque mois, les statistiques détaillées et le suivi des contacts.
          </p>
        )}
        {ab.suivant && (
          <p className={s.statut}>
            <Icone nom="calendrier" taille={16} />
            <span>Mois suivant payé : <strong>{ab.suivant.nom}</strong>, du {dateComplete(ab.suivant.debut)} au {dateComplete(ab.suivant.fin)}.</span>
          </p>
        )}
      </section>

      {!ab.suivant && (
        <section className={s.carte} aria-labelledby={`${id}-formules`}>
          <h2 id={`${id}-formules`} className={s.carteTitre}>{encours ? "Payer le mois suivant" : "Choisir ma formule"}</h2>
          <p className={s.aide}>
            La formule couvre toutes les annonces de l&apos;agence ; elle se choisit selon le nombre d&apos;annonces en ligne
            ({ab.annonces_en_ligne} aujourd&apos;hui). {encours ? `Le mois payé commence le ${dateComplete(encours.fin)}, à la suite du mois en cours.` : "Le mois commence dès le paiement reçu."}
          </p>
          <fieldset className={s.formules}>
            <legend className={s.legende}>Formule</legend>
            {FORMULES.map((cle) => {
              const n = incluses(cle);
              const non = trop(cle);
              return (
                <label key={cle} className={`${s.formule} ${formule === cle ? s.choisie : ""} ${non ? s.desactivee : ""}`}>
                  <input type="radio" name={`${id}-formule`} value={cle} checked={formule === cle} disabled={non} onChange={() => setChoisie(cle)} />
                  <span className={s.formuleTexte}>
                    <span className={s.formuleHaut}>
                      <span className={s.formuleNom}>Jusqu&apos;à {maxi(cle)} annonces</span>
                      <span className={s.formulePrix}>{formaterPrix(prix(cle))} FCFA <small>/ mois</small></span>
                    </span>
                    <span className={s.formuleDetail}>
                      {non
                        ? `Votre agence a ${ab.annonces_en_ligne} annonces en ligne : formule trop petite.`
                        : `${n} remontées incluses par mois · une remontée revient à ${formaterPrix(Math.round(prix(cle) / n))} FCFA`}
                    </span>
                    {cle === conseillee && <span className={s.conseil}>Conseillée pour vos {ab.annonces_en_ligne} annonces</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className={s.paiement}>
            <Icone nom="telephone" taille={15} />
            <span>
              Paiement par <strong>Orange Money, MTN MoMo, Moov Money ou Wave</strong>. Jamais de prélèvement automatique : vous
              payez chaque mois, avec un rappel par e-mail 3 jours avant la fin. Sans engagement.
              {PAIEMENT_SIMULE && <strong className={s.essai}> Mode essai : paiement simulé, aucun argent n&apos;est débité.</strong>}
            </span>
          </p>
          {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>}
          <button type="button" className={s.plein} disabled={envoi} onClick={acheter}>
            {envoi ? "Un instant…" : `${encours ? "Payer le mois suivant" : "M'abonner"} : ${formaterPrix(prix(formule))} FCFA`}
          </button>
        </section>
      )}

      <section className={s.carte} aria-labelledby={`${id}-regles`}>
        <h2 id={`${id}-regles`} className={s.carteTitre}>Ce que comprend l&apos;abonnement</h2>
        <ul className={s.regles}>
          <li><Icone nom="monter" taille={15} /> Des remontées incluses chaque mois, à répartir librement entre vos annonces, à la main ou programmées (par exemple tous les 5 jours). Une même annonce se remonte une fois par 24 heures au plus.</li>
          <li><Icone nom="argent" taille={15} /> Au-delà du forfait : 500 FCFA la remontée supplémentaire (moitié prix).</li>
          <li><Icone nom="statistiques" taille={15} /> Statistiques détaillées : d&apos;où viennent les visiteurs de chaque annonce, export pour Excel.</li>
          <li><Icone nom="personne" taille={15} /> Suivi des contacts : qui a écrit, demandé une visite ou un rappel, pour quelle annonce.</li>
          <li><Icone nom="bouclier" taille={15} /> Équité : une même agence n&apos;a jamais plus de 3 annonces dans les 10 premières d&apos;une liste.</li>
          <li><Icone nom="horloge" taille={15} /> Fin de l&apos;abonnement : les remontées restantes sont perdues ; vos annonces, votre badge, votre logo et votre vitrine restent.</li>
        </ul>
        <Link href="/offres" className={s.lienTexte}>Toutes nos offres</Link>
      </section>
    </div>
  );
}
