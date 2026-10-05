"use client";

/*
 * Choix d'un créneau de visite : un des 7 jours qui suivent, puis l'heure (9 h, 11 h, 14 h, 16 h, 18 h, heure d'Abidjan).
 * Les créneaux déjà confirmés pour le bien sont grisés. Sert à la demande (fiche) et à la contre-proposition de
 * l'annonceur (Mon Espace → Visites).
 */
import { HEURES, creneauDe, texteJour } from "@/lib/visites";
import s from "./ChoixCreneau.module.css";

type Props = {
  jours: string[];
  jour: string;
  heure: number | null;
  onJour: (jour: string) => void;
  onHeure: (heure: number) => void;
  /** créneaux déjà pris (ISO) */
  pris?: string[];
  /** intitulés (« Quel jour ? ») */
  questions?: [string, string];
};

export default function ChoixCreneau({ jours, jour, heure, onJour, onHeure, pris = [], questions = ["Quel jour ?", "À quelle heure ?"] }: Props) {
  return (
    <>
      <fieldset className={s.choix}>
        <legend className={s.question}>{questions[0]}</legend>
        <div className={s.jours}>
          {jours.map((j) => (
            <button key={j} type="button" className={`${s.puce} ${j === jour ? s.choisie : ""}`} aria-pressed={j === jour} onClick={() => onJour(j)}>
              {texteJour(j)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className={s.choix}>
        <legend className={s.question}>{questions[1]}</legend>
        <div className={s.heures}>
          {HEURES.map((h) => {
            const texte = `${String(h).padStart(2, "0")}:00`;
            const occupe = !!jour && pris.includes(creneauDe(jour, h));
            const choisie = h === heure && !occupe;
            return (
              <button key={h} type="button" className={`${s.puce} ${choisie ? s.choisie : ""} ${occupe ? s.prise : ""}`}
                aria-pressed={choisie} disabled={occupe} onClick={() => onHeure(h)} aria-label={occupe ? `${texte}, déjà pris` : undefined}>
                {texte}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
