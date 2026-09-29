"use client";

/*
 * Photos d'un bien : sur ordinateur, la photo principale et deux autres ; sur téléphone, une bande que l'on fait
 * glisser du doigt. Un clic (ou « Voir les N photos ») ouvre les photos en plein écran : flèches, clavier (← →,
 * Échap), glisser du doigt. Chaque photo est montrée en entier, même prise en hauteur (PhotoCadree).
 */
import { useEffect, useRef, useState } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import s from "./Galerie.module.css";

type Props = { photos: string[]; titre: string; badge: string; vente: boolean };

export default function Galerie({ photos, titre, badge, vente }: Props) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [visible, setVisible] = useState(0); // téléphone : photo affichée dans la bande
  const bande = useRef<HTMLDivElement>(null);
  const n = photos.length;

  const suivreBande = () => {
    const b = bande.current;
    if (b) setVisible(Math.round(b.scrollLeft / b.clientWidth));
  };

  if (!n) {
    return (
      <div className={`${s.galerie} ${s.aucune}`}>
        <span className={`${s.badge} ${vente ? s.vente : ""}`}>{badge}</span>
        <Icone nom="photo" taille={40} epaisseur={1.5} />
        <p>Pas encore de photos pour ce bien.</p>
      </div>
    );
  }

  const tuile = (i: number, classe: string) => (
    <button type="button" key={photos[i]} className={`${s.tuile} ${classe}`} onClick={() => setOuverte(i)}
      aria-label={`Agrandir la photo ${i + 1} sur ${n}`}>
      <PhotoCadree src={photos[i]} alt={`${titre} — photo ${i + 1}`} paresseuse={i > 0} />
    </button>
  );

  return (
    <>
      {/* Ordinateur : photo principale + deux autres */}
      <div className={`${s.galerie} ${s[`nombre${Math.min(n, 3)}`]}`}>
        {tuile(0, s.principale)}
        {n > 1 && tuile(1, s.seconde)}
        {n > 2 && tuile(2, s.troisieme)}
        <span className={`${s.badge} ${vente ? s.vente : ""}`}>{badge}</span>
        <button type="button" className={s.toutes} onClick={() => setOuverte(0)}>
          <Icone nom="photo" taille={16} /> {n > 1 ? `Voir les ${n} photos` : "Agrandir la photo"}
        </button>
      </div>

      {/* Téléphone : bande à faire glisser */}
      <div className={s.bandeCadre}>
        <div className={s.bande} ref={bande} onScroll={suivreBande} aria-label={`Photos (${n})`}>
          {photos.map((p, i) => (
            <button type="button" key={p} className={s.diapo} onClick={() => setOuverte(i)} aria-label={`Agrandir la photo ${i + 1} sur ${n}`}>
              <PhotoCadree src={p} alt={`${titre} — photo ${i + 1}`} paresseuse={i > 0} />
            </button>
          ))}
        </div>
        <span className={`${s.badge} ${vente ? s.vente : ""}`}>{badge}</span>
        {n > 1 && <span className={s.compteur} aria-hidden="true">{visible + 1} / {n}</span>}
      </div>

      {ouverte !== null && <PleinEcran photos={photos} titre={titre} depart={ouverte} fermer={() => setOuverte(null)} />}
    </>
  );
}

function PleinEcran({ photos, titre, depart, fermer }: { photos: string[]; titre: string; depart: number; fermer: () => void }) {
  const boite = useRef<HTMLDialogElement>(null);
  const bande = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(depart);
  const vers = useRef<number | null>(null); // photo visée pendant un glissement lancé par les flèches
  const n = photos.length;

  const aller = (k: number) => {
    const b = bande.current;
    const cible = (k + n) % n;
    vers.current = cible;
    // photo voisine : on glisse ; de la dernière à la première (ou l'inverse) : on saute
    b?.scrollTo({ left: cible * b.clientWidth, behavior: Math.abs(cible - i) > 1 ? "instant" : "smooth" });
    setI(cible);
  };

  useEffect(() => {
    const d = boite.current;
    if (!d) return;
    d.showModal();
    const b = bande.current;
    if (b) b.scrollLeft = depart * b.clientWidth;
    document.documentElement.classList.add(s.sansDefilement);
    return () => document.documentElement.classList.remove(s.sansDefilement);
  }, [depart]);

  return (
    <dialog ref={boite} className={s.pleinEcran} aria-label={`Photos : ${titre}`} onClose={fermer}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") aller(i + 1);
        if (e.key === "ArrowLeft") aller(i - 1);
      }}>
      <div className={s.pleinHaut}>
        <span className={s.pleinCompteur} aria-live="polite">{i + 1} / {n}</span>
        <button type="button" className={s.pleinFermer} onClick={() => boite.current?.close()} aria-label="Fermer les photos" autoFocus>
          <Icone nom="fermer" taille={22} />
        </button>
      </div>
      <div className={s.pleinBande} ref={bande}
        onScroll={() => {
          const b = bande.current;
          if (!b) return;
          const ici = Math.round(b.scrollLeft / b.clientWidth);
          // glissement lancé par les flèches : le compteur montre déjà la photo visée
          if (vers.current !== null) {
            if (ici === vers.current) vers.current = null;
            return;
          }
          setI(ici);
        }}>
        {photos.map((p, k) => (
          // eslint-disable-next-line @next/next/no-img-element -- photo du stockage Supabase, montrée en entier
          <img key={p} src={p} alt={`${titre} — photo ${k + 1}`} className={s.pleinPhoto} loading={Math.abs(k - depart) < 2 ? "eager" : "lazy"} />
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" className={`${s.fleche} ${s.precedente}`} onClick={() => aller(i - 1)} aria-label="Photo précédente">
            <Icone nom="retour" taille={24} epaisseur={2.5} />
          </button>
          <button type="button" className={`${s.fleche} ${s.suivante}`} onClick={() => aller(i + 1)} aria-label="Photo suivante">
            <Icone nom="suivant" taille={24} epaisseur={2.5} />
          </button>
        </>
      )}
    </dialog>
  );
}
