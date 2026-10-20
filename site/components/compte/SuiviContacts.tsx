"use client";

/*
 * Mon Espace → Suivi des contacts (comptes agence, si les offres payantes sont ouvertes) : pour les agences abonnées,
 * tous les contacts reçus sur 7, 30 ou 90 jours — messages (répondu ou non), demandes de visite et de rappel (avec le
 * numéro laissé) —, pour quelle annonce, avec un filtre et l'export pour Excel ; puis les gestes comptés sans savoir
 * qui (numéros affichés, appels, WhatsApp, e-mails). Sans abonnement : ce qu'il apporterait.
 */
import { useEffect, useState } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { MOMENTS_RAPPEL, texteCreneau, type MomentRappel } from "@/lib/creneaux";
import { telechargerCsv } from "@/lib/export-csv";
import { dateComplete } from "@/lib/format";
import { suiviContacts, type ContactSuivi, type SuiviContacts as Suivi } from "@/lib/offres";
import f from "./Formulaire.module.css";
import s from "./SuiviContacts.module.css";

const PERIODES = [7, 30, 90];
const GENRES: Record<ContactSuivi["genre"], { texte: string; icone: NomIcone; section: "messages" | "visites" | "rappels" }> = {
  message: { texte: "Message", icone: "message", section: "messages" },
  visite: { texte: "Demande de visite", icone: "calendrier", section: "visites" },
  rappel: { texte: "Demande de rappel", icone: "telephone", section: "rappels" },
};
const STATUTS: Record<string, string> = {
  repondu: "Répondu", sans_reponse: "Sans réponse",
  demandee: "À confirmer", confirmee: "Confirmée", annulee: "Annulée", effectuee: "Effectuée",
  a_rappeler: "À rappeler", rappele: "Rappelé", annule: "Annulé",
};
const aTraiter = (c: ContactSuivi) => ["sans_reponse", "demandee", "a_rappeler"].includes(c.statut);

export default function SuiviContacts({ aller }: { aller: (section: "messages" | "visites" | "rappels" | "abonnement") => void }) {
  const [jours, setJours] = useState(30);
  const [suivi, setSuivi] = useState<Suivi | null>(null);
  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState("");
  const [genre, setGenre] = useState<ContactSuivi["genre"] | "">("");
  const [annonce, setAnnonce] = useState("");
  useEffect(() => {
    let actif = true;
    suiviContacts(jours).then(
      (x) => {
        if (!actif) return;
        setSuivi(x);
        setErreur("");
      },
      (e) => {
        if (!actif) return;
        const m = messageErreur(e);
        if (/abonnement agence/.test(m)) setRefus(true);
        else setErreur(m);
      },
    );
    return () => {
      actif = false;
    };
  }, [jours]);

  if (refus) {
    return (
      <section className={`${s.carte} ${s.offre}`} aria-labelledby="contacts-offre">
        <h2 id="contacts-offre" className={s.carteTitre}><Icone nom="etoile" taille={16} /> Le suivi des contacts vient avec l&apos;abonnement agence</h2>
        <p className={s.texte}>
          Tous vos contacts au même endroit : qui a écrit, demandé une visite ou un rappel, pour quelle annonce, ce qui attend
          encore une réponse, et l&apos;export pour Excel. Avec aussi des remontées incluses chaque mois et les statistiques détaillées.
        </p>
        <button type="button" className={s.boutonOffre} onClick={() => aller("abonnement")}>Voir l&apos;abonnement agence</button>
      </section>
    );
  }
  if (erreur && !suivi) return <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p>;
  if (!suivi) return <p className={s.attente}>Chargement de vos contacts…</p>;

  const annonces = [...new Map(suivi.contacts.map((c) => [c.annonce.id, c.annonce])).values()];
  const liste = suivi.contacts.filter((c) => (!genre || c.genre === genre) && (!annonce || c.annonce.id === annonce));
  const enAttente = suivi.contacts.filter(aTraiter).length;
  const exporter = () => telechargerCsv(`contacts-360-immo-${jours}-jours.csv`, [
    ["Date", "Type", "Nom", "Téléphone", "Annonce", "Référence", "État", "Créneau ou moment"],
    ...liste.map((c) => [dateComplete(c.le), GENRES[c.genre].texte, c.nom, c.telephone ?? "", c.annonce.titre, c.annonce.reference,
      STATUTS[c.statut] ?? c.statut, c.creneau ? texteCreneau(c.creneau) : c.moment ? MOMENTS_RAPPEL[c.moment as MomentRappel]?.texte ?? "" : ""]),
  ]);

  return (
    <div className={s.liste}>
      <div className={s.barre}>
        <div className={s.periodes} role="radiogroup" aria-label="Période">
          {PERIODES.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={p === jours} className={`${s.periode} ${p === jours ? s.periodeChoisie : ""}`}
              onClick={() => setJours(p)}>
              {p} jours
            </button>
          ))}
        </div>
        <button type="button" className={s.exporter} onClick={exporter} disabled={!liste.length}>
          <Icone nom="document" taille={14} /> Exporter (Excel)
        </button>
      </div>

      <section className={s.carte} aria-labelledby="contacts-titre">
        <div className={s.carteHaut}>
          <h2 id="contacts-titre" className={s.carteTitre}>
            {suivi.contacts.length} contact{suivi.contacts.length > 1 ? "s" : ""} en {jours} jours
          </h2>
          {enAttente > 0 && <span className={s.attendent}>{enAttente} attend{enAttente > 1 ? "ent" : ""} une réponse</span>}
        </div>
        {suivi.contacts.length > 0 && (
          <div className={s.filtres}>
            <label>
              <span>Type</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value as ContactSuivi["genre"] | "")}>
                <option value="">Tous</option>
                <option value="message">Messages</option>
                <option value="visite">Demandes de visite</option>
                <option value="rappel">Demandes de rappel</option>
              </select>
            </label>
            <label>
              <span>Annonce</span>
              <select value={annonce} onChange={(e) => setAnnonce(e.target.value)}>
                <option value="">Toutes</option>
                {annonces.map((a) => <option key={a.id} value={a.id}>{a.titre} (réf. {a.reference})</option>)}
              </select>
            </label>
          </div>
        )}
        {liste.length === 0 ? (
          <p className={s.texte}>Aucun contact sur la période{genre || annonce ? " avec ces filtres" : ""}.</p>
        ) : (
          <ul className={s.contacts}>
            {liste.map((c) => (
              <li key={`${c.genre}-${c.id}`} className={s.contact}>
                <span className={s.icone}><Icone nom={GENRES[c.genre].icone} taille={16} /></span>
                <div className={s.corps}>
                  <div className={s.haut}>
                    <span className={s.nom}>{c.nom}</span>
                    <span className={`${s.statut} ${aTraiter(c) ? s.statutAttente : ""}`}>{STATUTS[c.statut] ?? c.statut}</span>
                  </div>
                  <span className={s.meta}>
                    {GENRES[c.genre].texte} · {dateComplete(c.le)}
                    {c.creneau && <> · créneau : {texteCreneau(c.creneau)}</>}
                    {c.moment && <> · {MOMENTS_RAPPEL[c.moment as MomentRappel]?.texte}</>}
                  </span>
                  <span className={s.meta}>{c.annonce.titre} · réf. {c.annonce.reference}</span>
                  <div className={s.actions}>
                    {c.telephone && <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className={s.action}><Icone nom="telephone" taille={13} /> {c.telephone}</a>}
                    <button type="button" className={s.action} onClick={() => aller(GENRES[c.genre].section)}>
                      Ouvrir dans {GENRES[c.genre].section === "messages" ? "Messages" : GENRES[c.genre].section === "visites" ? "Visites" : "Rappels"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.carte} aria-labelledby="gestes-titre">
        <h2 id="gestes-titre" className={s.carteTitre}>Appels et numéros affichés</h2>
        <p className={s.aide}>
          Ils passent par le téléphone du visiteur : le site en compte le nombre, sans jamais savoir qui a appelé.
        </p>
        {suivi.gestes.length === 0 ? (
          <p className={s.texte}>Aucun sur la période.</p>
        ) : (
          <div className={s.defilement}>
            <table className={s.tableau}>
              <thead>
                <tr><th scope="col">Annonce</th><th scope="col">Numéros affichés</th><th scope="col">Appels</th><th scope="col">WhatsApp</th><th scope="col">E-mails</th></tr>
              </thead>
              <tbody>
                {suivi.gestes.map((g) => (
                  <tr key={g.annonce.id}>
                    <th scope="row">{g.annonce.titre}</th><td>{g.numeros}</td><td>{g.appels}</td><td>{g.whatsapp}</td><td>{g.emails}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
