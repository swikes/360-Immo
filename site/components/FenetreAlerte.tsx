"use client";

/*
 * Fenêtre « Créer une alerte » (et « Modifier l'alerte », Mon Espace → Alertes) : remplie d'après la recherche, on y
 * confirme ou change ce que l'on cherche. Ce qui est proposé suit le plan du type de bien (lib/alertes.ts, planAlerte) :
 *   Indispensable  louer / acheter, type, lieu, budget (plafond : les biens moins chers aussi), pièces au moins,
 *                  surface au moins (terrain, bureau, commerce), titre foncier (terrain)
 *   Souhaits       meublé, chambres, surface (logement), commodités : jamais bloquants, ils classent l'e-mail
 * Même fenêtre que « Planifier une visite » (fiche/PlanifierVisite.module.css) : centrée sur ordinateur, qui monte du
 * bas de l'écran sur téléphone ; les boutons restent visibles en bas.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import ChampLieu from "@/components/ChampLieu";
import Icone from "@/components/Icone";
import { ACD, choixValable, construireAlerte, planAlerte, problemeAlerte, type ChoixAlerte, type Frequence } from "@/lib/alertes";
import { messageErreur } from "@/lib/compte";
import { formaterPrix } from "@/lib/format";
import { chiffres } from "@/lib/recherche";
import { typesProposes } from "@/lib/regles-biens";
import f from "@/components/compte/Formulaire.module.css";
import v from "@/components/fiche/PlanifierVisite.module.css";
import s from "./FenetreAlerte.module.css";

type Props = {
  titre: string;
  bouton: string;
  depart: ChoixAlerte;
  frequence: Frequence;
  /** enregistre l'alerte (une erreur s'affiche dans la fenêtre) ; la fenêtre se ferme ensuite */
  valider: (choix: ChoixAlerte, frequence: Frequence) => Promise<void>;
  fermer: () => void;
  /** sous les boutons (ex. : « vous vous connecterez ensuite ») */
  note?: ReactNode;
  /** à la création : l'encadré qui dit à quoi sert une alerte */
  accroche?: boolean;
};

const PIECES = [2, 3, 4, 5];
const CHAMBRES = [1, 2, 3, 4];

export default function FenetreAlerte({ titre, bouton, depart, frequence: frequenceDepart, valider, fermer, note, accroche = false }: Props) {
  const boite = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [brut, setBrut] = useState(depart);
  const [frequence, setFrequence] = useState(frequenceDepart);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const c = choixValable(brut);
  const p = planAlerte(c);
  const { nom } = construireAlerte(c);

  useEffect(() => {
    if (!boite.current?.open) boite.current?.showModal();
  }, []);

  const maj = (champs: Partial<ChoixAlerte>) => {
    setErreur("");
    setBrut((x) => ({ ...choixValable(x), ...champs }));
  };
  const choisirTx = (tx: ChoixAlerte["tx"]) =>
    // à l'achat, un terrain se veut avec titre foncier
    maj({ tx, ...(tx === "achat" && c.types.includes("Terrain") && c.tx !== "achat" ? { acd: true } : {}) });
  const basculerType = (t: string) => {
    const types = c.types.includes(t) ? c.types.filter((x) => x !== t) : [...c.types, t];
    maj({ types, ...(t === "Terrain" && types.includes(t) && c.tx === "achat" ? { acd: true } : {}) });
  };
  const basculerCommodite = (x: string) =>
    maj({ commodites: c.commodites.includes(x) ? c.commodites.filter((y) => y !== x) : [...c.commodites, x] });

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const probleme = problemeAlerte(c);
    if (probleme) return setErreur(probleme);
    setEnvoi(true);
    setErreur("");
    try {
      await valider(c, frequence);
      boite.current?.close();
    } catch (ex) {
      setErreur(messageErreur(ex));
      setEnvoi(false);
    }
  };

  const montant = (valeur: string, champ: "min" | "max", etiquette: string, exemple: string) => (
    <label className={s.montant}>
      <span className={s.petit}>{etiquette}</span>
      <span className={s.saisie}>
        <input type="text" inputMode="numeric" aria-label={etiquette} value={valeur ? formaterPrix(Number(valeur)) : ""} placeholder={exemple}
          onChange={(ev) => maj({ [champ]: chiffres(ev.target.value).slice(0, 12) })} />
        <span className={s.unite} aria-hidden="true">FCFA</span>
      </span>
    </label>
  );
  const surface = (etiquette: string) => (
    <label className={s.montant}>
      <span className={s.petit}>{etiquette}</span>
      <span className={s.saisie}>
        <input type="text" inputMode="numeric" aria-label={etiquette} value={c.surface} placeholder={c.types.includes("Terrain") ? "Ex : 500" : "Ex : 100"}
          onChange={(ev) => maj({ surface: chiffres(ev.target.value).slice(0, 6) })} />
        <span className={s.unite} aria-hidden="true">m²</span>
      </span>
    </label>
  );
  const exemple = c.tx === "achat" ? "Ex : 45 000 000" : c.duree === "jour" ? "Ex : 25 000" : "Ex : 150 000";
  const souhaits = p.meuble || p.chambres || p.surface === "souhait" || p.commodites.length > 0;

  return (
    <dialog ref={boite} className={`${v.boite} ${s.boite}`} aria-labelledby={`${id}-titre`} onClose={fermer}
      onClick={(e) => e.target === boite.current && boite.current?.close()}>
      <form className={s.formulaire} onSubmit={envoyer} noValidate>
        <div className={`${v.contenu} ${s.contenu}`}>
          <div className={v.haut}>
            <h2 id={`${id}-titre`} className={v.titre}>{titre}</h2>
            <button type="button" className={v.fermer} onClick={() => boite.current?.close()} aria-label="Fermer">
              <Icone nom="fermer" taille={20} />
            </button>
          </div>
          {accroche ? (
            <div className={s.accroche}>
              <Icone nom="cloche" taille={20} />
              <p>
                <strong>Ne ratez aucune nouvelle annonce</strong>
                Recevez par e-mail les nouveautés de cette recherche. Confirmez ci-dessous ce que vous cherchez.
              </p>
            </div>
          ) : (
            <p className={v.sousTitre}>Confirmez ce que vous cherchez : les nouvelles annonces qui correspondent vous arrivent par e-mail.</p>
          )}
          <p className={s.nom} aria-live="polite">
            <Icone nom="cloche" taille={15} /> <span><span className={s.cache}>Alerte : </span>{nom}</span>
          </p>

          <Groupe titre="Je cherche à">
            <div className={s.puces}>
              {([["location", "Louer"], ["achat", "Acheter"]] as const).map(([tx, texte]) => (
                <Puce key={tx} choisie={c.tx === tx} onClick={() => choisirTx(tx)}>{texte}</Puce>
              ))}
            </div>
            {p.durees.length > 1 && (
              <div className={s.puces} role="group" aria-label="Durée de location">
                {p.durees.map((d) => (
                  <Puce key={d} choisie={c.duree === d} onClick={() => maj({ duree: d })}>{d === "mois" ? "Au mois" : "À la journée"}</Puce>
                ))}
              </div>
            )}
          </Groupe>

          <Groupe titre="Type de bien">
            <div className={s.puces}>
              <Puce choisie={!c.types.length} onClick={() => maj({ types: [] })}>Tous les biens</Puce>
              {typesProposes(c.tx === "achat" ? "vente" : c.tx === "location" ? "location" : null).map((t) => (
                <Puce key={t} choisie={c.types.includes(t)} onClick={() => basculerType(t)}>{t}</Puce>
              ))}
            </div>
          </Groupe>

          <Groupe titre="Où ?" pour={`${id}-lieu`}>
            <div className={s.lieu}>
              <Icone nom="lieu" taille={17} />
              <ChampLieu id={`${id}-lieu`} quartiers valeur={brut.lieu} onChange={(lieu) => maj({ lieu })} placeholder="Ville, commune ou quartier" />
            </div>
          </Groupe>

          <Groupe titre={p.budget}>
            {c.tx ? (
              <>
                <div className={s.deux}>
                  {montant(c.max, "max", "Maximum", exemple)}
                  {montant(c.min, "min", "Minimum (facultatif)", "Aucun")}
                </div>
                <p className={s.aide}>Plafond : les biens moins chers vous sont aussi envoyés, s&apos;ils ont l&apos;essentiel.</p>
              </>
            ) : (
              <p className={s.aide}>Choisissez « Louer » ou « Acheter » pour indiquer un budget.</p>
            )}
          </Groupe>

          {(p.pieces || p.surface === "essentiel" || p.acd) && (
            <Groupe titre="Indispensable" note="Les annonces qui ne l'ont pas ne vous sont pas envoyées.">
              {p.pieces && (
                <div className={s.ligne} role="group" aria-label="Pièces au moins">
                  <span className={s.petit} aria-hidden="true">Pièces au moins</span>
                  <div className={s.puces}>
                    <Puce choisie={!c.pieces} onClick={() => maj({ pieces: null })}>Peu importe</Puce>
                    {PIECES.map((n) => <Puce key={n} choisie={c.pieces === n} onClick={() => maj({ pieces: n })}>{n} et +</Puce>)}
                  </div>
                </div>
              )}
              {p.surface === "essentiel" && <div className={s.deux}>{surface(`${p.nomSurface} au moins`)}</div>}
              {p.acd && (
                <label className={s.case}>
                  <input type="checkbox" checked={c.acd} onChange={() => maj({ acd: !c.acd })} />
                  <span>
                    <strong>{ACD} exigé</strong>
                    <small>{c.types.length > 1 ? "Pour les terrains : ceux sans ACD ne vous sont pas envoyés." : "Les terrains sans ACD ne vous sont pas envoyés."}</small>
                  </span>
                </label>
              )}
            </Groupe>
          )}

          {souhaits && (
            <Groupe titre="Souhaits (facultatifs)" note="Jamais bloquants : les annonces qui en ont le plus arrivent en premier dans l'e-mail, avec ce qu'elles ont ou non.">
              {p.meuble && (
                <div className={s.puces}>
                  <Puce choisie={c.meuble} onClick={() => maj({ meuble: !c.meuble })}>Meublé</Puce>
                </div>
              )}
              {p.chambres && (
                <div className={s.ligne} role="group" aria-label="Chambres au moins">
                  <span className={s.petit} aria-hidden="true">Chambres au moins</span>
                  <div className={s.puces}>
                    <Puce choisie={!c.chambres} onClick={() => maj({ chambres: null })}>Peu importe</Puce>
                    {CHAMBRES.map((n) => <Puce key={n} choisie={c.chambres === n} onClick={() => maj({ chambres: n })}>{n} et +</Puce>)}
                  </div>
                </div>
              )}
              {p.surface === "souhait" && <div className={s.deux}>{surface(`${p.nomSurface} au moins`)}</div>}
              {p.commodites.length > 0 && (
                <div className={s.ligne} role="group" aria-label="Commodités souhaitées">
                  <span className={s.petit} aria-hidden="true">Commodités</span>
                  <div className={s.puces}>
                    {p.commodites.map((x) => <Puce key={x} choisie={c.commodites.includes(x)} onClick={() => basculerCommodite(x)}>{x}</Puce>)}
                  </div>
                </div>
              )}
            </Groupe>
          )}

          <Groupe titre="Recevoir les nouvelles annonces">
            <div className={s.puces}>
              {([["quotidienne", "Chaque jour"], ["hebdomadaire", "Chaque semaine"]] as const).map(([fr, texte]) => (
                <Puce key={fr} choisie={frequence === fr} onClick={() => setFrequence(fr)}>{texte}</Puce>
              ))}
            </div>
            <p className={s.aide}>Le matin, seulement s&apos;il y a du nouveau.</p>
          </Groupe>
        </div>

        <div className={s.pied}>
          {erreur && (
            <p className={`${f.message} ${f.messageErreur}`} role="alert">
              <Icone nom="cloche" taille={16} />
              {erreur}
            </p>
          )}
          <div className={v.boutons}>
            <button type="button" className={v.secondaire} onClick={() => boite.current?.close()}>Annuler</button>
            <button type="submit" className={v.principal} disabled={envoi}>
              <Icone nom="cloche" taille={16} /> {envoi ? "Enregistrement…" : bouton}
            </button>
          </div>
          {note && <p className={s.notePied}>{note}</p>}
        </div>
      </form>
    </dialog>
  );
}

function Groupe({ titre, note, pour, children }: { titre: string; note?: string; pour?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={s.groupe} aria-labelledby={id}>
      {pour ? (
        <label id={id} htmlFor={pour} className={s.groupeTitre}>{titre}</label>
      ) : (
        <h3 id={id} className={s.groupeTitre}>{titre}</h3>
      )}
      {note && <p className={s.aide}>{note}</p>}
      {children}
    </section>
  );
}

function Puce({ choisie, onClick, children }: { choisie: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={s.puce} aria-pressed={choisie} onClick={onClick}>
      {choisie && <Icone nom="valide" taille={13} />}
      {children}
    </button>
  );
}
