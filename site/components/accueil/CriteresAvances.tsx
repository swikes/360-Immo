"use client";

/*
 * « Plus de critères » de la recherche (reprise de la maquette) : pièces, chambres, surface, prix, salles de bain,
 * caution, préférences, étage, commodités. Seuls les critères qui ont un sens pour le type de bien et la
 * transaction sont proposés (lib/regles-biens.ts) : un terrain n'a ni pièces ni « meublé », une villa n'est jamais
 * « dans un immeuble », la caution ne concerne que la location au mois…
 */
import type { ReactNode } from "react";
import { formaterPrix } from "@/lib/format";
import { chiffres, type Avances } from "@/lib/recherche";
import { chambresMax, type ReglesCombinees } from "@/lib/regles-biens";
import s from "./CriteresAvances.module.css";

type Props = {
  /** critères tels que choisis */
  avances: Avances;
  /** critères qui ont un sens pour le type et la transaction (ceux qui s'affichent choisis) */
  valables: Avances;
  maj: (changement: Partial<Avances>) => void;
  regles: ReglesCombinees;
  location: boolean;
  mensuelle: boolean;
  libellePrix: string;
  prixMin: string;
  prixMax: string;
  setPrixMin: (v: string) => void;
  setPrixMax: (v: string) => void;
  onEffacer: () => void;
  nombre: number;
};

const PIECES = ["Studio", "1", "2", "3", "4", "5+"];
const CHAMBRES = ["1", "2", "3", "4", "5+"];
const SANITAIRES = ["1", "2", "3", "4+"];
const CAUTION = ["1", "2", "3", "4+"];
const ETAGES = ["Rdc", "1er", "2ème", "3ème", "4ème", "5ème +"];

function Groupe({ titre, children, large }: { titre: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={`${s.groupe} ${large ? s.large : ""}`} role="group" aria-label={titre}>
      <div className={s.titre}>{titre}</div>
      {children}
    </div>
  );
}

function Puces({ valeurs, choisie, choisir, indispo }: {
  valeurs: string[]; choisie: string | null; choisir: (v: string | null) => void; indispo?: (v: string) => boolean;
}) {
  return (
    <div className={s.puces}>
      {valeurs.map((v) => (
        <button
          key={v}
          type="button"
          className={s.puce}
          aria-pressed={choisie === v}
          disabled={indispo?.(v)}
          onClick={() => choisir(choisie === v ? null : v)}
        >
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

const montant = (v: string) => (v ? formaterPrix(Number(v)) : "");

export default function CriteresAvances(p: Props) {
  const { avances: a, valables: v, maj, regles: r } = p;
  const piecesProposees = PIECES.filter((x) => (x === "Studio" ? r.studio : x === "1" ? r.unePiece : true));
  const maxChambres = v.pieces ? chambresMax(v.pieces) : Infinity;
  const etage = r.etage === "toujours" || (r.etage === "option" && v.immeuble);

  return (
    <div className={s.panneau}>
      <div className={s.grille}>
        {r.pieces && (
          <Groupe titre="Nombre de pièces">
            <Puces valeurs={piecesProposees} choisie={v.pieces} choisir={(x) => maj({ pieces: x })} />
          </Groupe>
        )}
        {r.chambres && (
          <Groupe titre="Nombre de chambres">
            <Puces
              valeurs={CHAMBRES}
              choisie={v.chambres}
              choisir={(x) => maj({ chambres: x })}
              indispo={(x) => parseInt(x, 10) > maxChambres} // le séjour compte pour une pièce
            />
          </Groupe>
        )}
        <Groupe titre={`${r.surface} (m²)`}>
          <div className={s.intervalle}>
            <input
              type="text" inputMode="numeric" aria-label={`${r.surface} minimum (m²)`} placeholder="Min m²"
              value={a.smin} onChange={(e) => maj({ smin: chiffres(e.target.value).slice(0, 6) })}
            />
            <input
              type="text" inputMode="numeric" aria-label={`${r.surface} maximum (m²)`} placeholder="Max m²"
              value={a.smax} onChange={(e) => maj({ smax: chiffres(e.target.value).slice(0, 6) })}
            />
          </div>
        </Groupe>
        <Groupe titre={p.libellePrix}>
          <div className={s.intervalle}>
            <input
              type="text" inputMode="numeric" aria-label="Minimum (FCFA)" placeholder="Min"
              value={montant(p.prixMin)} onChange={(e) => p.setPrixMin(chiffres(e.target.value).slice(0, 12))}
            />
            <input
              type="text" inputMode="numeric" aria-label="Maximum (FCFA)" placeholder="Max"
              value={montant(p.prixMax)} onChange={(e) => p.setPrixMax(chiffres(e.target.value).slice(0, 12))}
            />
          </div>
        </Groupe>
        {r.sanitaires && (
          <Groupe titre={r.sanitaires}>
            <Puces valeurs={SANITAIRES} choisie={v.sdb} choisir={(x) => maj({ sdb: x })} />
          </Groupe>
        )}
        {p.location && p.mensuelle && r.caution && (
          <Groupe titre="Mois de caution max">
            <Puces valeurs={CAUTION} choisie={v.caution} choisir={(x) => maj({ caution: x })} />
          </Groupe>
        )}

        <Groupe titre="Préférences" large>
          <div className={s.interrupteurs}>
            {r.meuble && <Interrupteur texte="Déjà meublé" actif={v.meuble} basculer={() => maj({ meuble: !a.meuble })} />}
            <Interrupteur texte="Avec photos" actif={v.photos} basculer={() => maj({ photos: !a.photos })} />
            <Interrupteur texte="Annonces récentes" actif={v.recentes} basculer={() => maj({ recentes: !a.recentes })} />
            {r.etage === "option" && (
              <Interrupteur texte="Dans un immeuble" actif={v.immeuble} basculer={() => maj({ immeuble: !a.immeuble })} />
            )}
          </div>
        </Groupe>

        {etage && (
          <div className={`${s.large} ${s.etage}`} role="group" aria-label="Étage souhaité">
            <div className={s.titre}>Étage souhaité</div>
            <Puces valeurs={ETAGES} choisie={v.etage} choisir={(x) => maj({ etage: x })} />
          </div>
        )}

        {r.commodites.length > 0 && (
          <Groupe titre="Commodités" large>
            <div className={s.commodites}>
              {r.commodites.map((c) => {
                const on = v.commodites.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={s.commodite}
                    aria-pressed={on}
                    onClick={() => maj({ commodites: on ? a.commodites.filter((x) => x !== c) : [...a.commodites, c] })}
                  >
                    <span className={s.point} aria-hidden="true" />
                    {c}
                  </button>
                );
              })}
            </div>
          </Groupe>
        )}
      </div>

      {/* Téléphone : pas besoin de remonter jusqu'au bouton « Rechercher » */}
      <div className={s.pied}>
        <button type="button" className={s.effacer} onClick={p.onEffacer} disabled={!p.nombre}>
          Effacer les critères
        </button>
        <button type="submit" className={s.rechercher}>
          Rechercher
        </button>
      </div>
    </div>
  );
}
