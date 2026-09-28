/*
 * Carte d'une annonce (accueil, et bientôt liste des annonces, favoris…).
 */
import type { Annonce } from "@/lib/annonces-demo";
import { formaterPrix } from "@/lib/format";
import BoutonFavori from "./BoutonFavori";
import Icone, { IconeWhatsApp } from "./Icone";
import s from "./CarteAnnonce.module.css";

export default function CarteAnnonce({ annonce: a }: { annonce: Annonce }) {
  const aLouer = a.transaction === "location";
  const messageWhatsApp = `Bonjour, je suis intéressé(e) par votre annonce « ${a.titre} » vue sur 360-Immo.ci`;
  return (
    <article className={s.carte} aria-labelledby={`annonce-${a.id}`}>
      <div className={s.image} style={{ background: `linear-gradient(135deg, ${a.visuel.de}, ${a.visuel.a})` }}>
        <Icone nom={a.visuel.icone} taille={60} epaisseur={1} style={{ color: a.visuel.trait, opacity: 0.4 }} />
        <div className={s.badges}>
          <span className={`${s.badge} ${aLouer ? s.louer : s.vendre}`}>{aLouer ? "À louer" : "À vendre"}</span>
          {a.premium && <span className={`${s.badge} ${s.premium}`}>Premium</span>}
        </div>
        <BoutonFavori titre={a.titre} className={s.favori} />
      </div>
      <div className={s.corps}>
        <div className={s.prix}>
          {formaterPrix(a.prix)} <span>FCFA{aLouer && ` / ${a.loyerPar ?? "mois"}`}</span>
        </div>
        <h3 id={`annonce-${a.id}`} className={s.titre}>
          {a.titre}
        </h3>
        <div className={s.lieu}>
          <Icone nom="lieu" taille={13} />
          {a.lieu}
        </div>
        <ul className={s.caracteristiques}>
          {a.caracteristiques.map((c) => (
            <li key={c.texte}>
              <Icone nom={c.icone} taille={13} />
              {c.texte}
            </li>
          ))}
        </ul>
        <div className={s.agence}>
          <div className={s.agenceNom}>
            <span className={s.avatar} style={{ background: a.agence.fond, color: a.agence.couleur }} aria-hidden="true">
              {a.agence.initiales}
            </span>
            {a.agence.nom}
          </div>
          {a.whatsapp ? (
            <a
              className={s.whatsapp}
              href={`https://wa.me/${a.whatsapp}?text=${encodeURIComponent(messageWhatsApp)}`}
              target="_blank"
              rel="noopener"
            >
              <IconeWhatsApp />
              WhatsApp
            </a>
          ) : (
            <span className={s.depuis}>{a.depuis}</span>
          )}
        </div>
      </div>
    </article>
  );
}
