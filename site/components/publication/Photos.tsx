"use client";

/*
 * Photos de l'annonce : ajout (appareil photo ou galerie du téléphone, glisser-déposer sur ordinateur),
 * réduction automatique (lib/photos.ts), ordre (la première est la photo principale), retrait. 20 au plus.
 * Les photos ne partent vers le stockage qu'à l'enregistrement de l'annonce (voir Formulaire.tsx).
 */
import { useRef, useState, type DragEvent } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import type { PhotoEnregistree } from "@/lib/annonces";
import { MAX_PHOTOS, reduirePhoto, taille, type PhotoPrete } from "@/lib/photos";
import s from "./Publication.module.css";

export type PhotoFormulaire = {
  cle: string;
  /** adresse de l'image affichée (fichier local ou photo déjà en ligne) */
  apercu: string;
  /** déjà enregistrée avec l'annonce */
  enregistree?: PhotoEnregistree;
  /** nouvelle, réduite, pas encore envoyée */
  nouvelle?: PhotoPrete;
};

type Props = {
  photos: PhotoFormulaire[];
  onChange: (photos: PhotoFormulaire[]) => void;
  erreur?: string;
};

export default function Photos({ photos, onChange, erreur }: Props) {
  const choix = useRef<HTMLInputElement>(null);
  const [preparation, setPreparation] = useState(0);
  const [refus, setRefus] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);
  const place = MAX_PHOTOS - photos.length;

  const ajouter = async (fichiers: File[]) => {
    const trop = fichiers.length > place;
    const aTraiter = fichiers.slice(0, Math.max(0, place));
    const refusees: string[] = trop ? [`${MAX_PHOTOS} photos au plus : ${fichiers.length - aTraiter.length} photo(s) non ajoutée(s).`] : [];
    setPreparation(aTraiter.length);
    const pretes: PhotoFormulaire[] = [];
    for (const f of aTraiter) {
      try {
        const p = await reduirePhoto(f);
        pretes.push({ cle: crypto.randomUUID(), apercu: URL.createObjectURL(p.blob), nouvelle: p });
      } catch (e) {
        refusees.push((e as Error).message);
      }
      setPreparation((n) => n - 1);
    }
    setRefus(refusees);
    if (pretes.length) onChange([...photos, ...pretes]);
  };

  const deplacer = (i: number, sens: -1 | 1) => {
    const liste = [...photos];
    [liste[i], liste[i + sens]] = [liste[i + sens], liste[i]];
    onChange(liste);
  };
  const retirer = (i: number) => {
    const p = photos[i];
    if (p.nouvelle) URL.revokeObjectURL(p.apercu);
    onChange(photos.filter((_, k) => k !== i));
  };
  const deposer = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    ajouter([...e.dataTransfer.files]);
  };

  return (
    <div className={s.photos}>
      <div
        className={`${s.depot} ${survol ? s.depotSurvol : ""} ${erreur ? s.depotErreur : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={deposer}
      >
        <Icone nom="plus" taille={22} epaisseur={2.2} />
        <p className={s.depotTitre}>Ajoutez vos photos</p>
        <p className={s.depotTexte}>
          Appareil photo ou galerie du téléphone ; sur ordinateur, glissez-les ici. JPG, PNG ou WebP, réduites
          automatiquement. {MAX_PHOTOS} photos au plus, au moins 5 conseillées.
        </p>
        <button type="button" className={s.boutonContour} onClick={() => choix.current?.click()} disabled={place <= 0}>
          Choisir des photos
        </button>
        <input
          ref={choix}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Choisir des photos"
          onChange={(e) => {
            ajouter([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {preparation > 0 && (
        <p className={s.photosInfo} role="status">
          Préparation de {preparation} photo{preparation > 1 ? "s" : ""}…
        </p>
      )}
      {refus.map((r) => (
        <p key={r} className={s.erreurTexte} role="alert">
          {r}
        </p>
      ))}
      {erreur && <p className={s.erreurTexte}>{erreur}</p>}

      {photos.length > 0 && (
        <>
          <p className={s.photosInfo}>
            {photos.length} / {MAX_PHOTOS} photos · la première est la photo principale de l&apos;annonce
          </p>
          <ul className={s.grille} aria-label="Photos de l'annonce">
            {photos.map((p, i) => (
              <li key={p.cle} className={s.vignette}>
                <PhotoCadree src={p.apercu} alt={`Photo ${i + 1}`} paresseuse={false} />
                {i === 0 && <span className={s.principale}>Principale</span>}
                {p.nouvelle && <span className={s.poids}>{taille(p.nouvelle.blob.size)}</span>}
                <div className={s.vignetteBoutons}>
                  <button type="button" aria-label={`Avancer la photo ${i + 1}`} disabled={i === 0} onClick={() => deplacer(i, -1)}>
                    <Icone nom="retour" taille={14} epaisseur={2.5} />
                  </button>
                  <button type="button" aria-label={`Reculer la photo ${i + 1}`} disabled={i === photos.length - 1} onClick={() => deplacer(i, 1)}>
                    <Icone nom="retour" taille={14} epaisseur={2.5} style={{ transform: "rotate(180deg)" }} />
                  </button>
                  <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => retirer(i)}>
                    <Icone nom="fermer" taille={14} epaisseur={2.5} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
