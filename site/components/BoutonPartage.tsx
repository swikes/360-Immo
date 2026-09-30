"use client";

/*
 * Bouton « Partager » avec son petit menu : WhatsApp (message prérempli), copier le lien, et sur téléphone le
 * partage du téléphone. Sert à partager une recherche, une vitrine ou une annonce.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import s from "./BoutonPartage.module.css";

type Props = {
  /** adresse à partager, sur ce site (/annonces?…, /annonceur/…) */
  adresse: string;
  /** texte du message, avant le lien */
  texte: string;
  /** explication en haut du menu */
  aide?: string;
  texteBouton?: string;
  nom?: string;
  /** « contour » (vert) ou « discret » (comme les petits boutons de Mes annonces) */
  style?: "contour" | "discret";
};

const sansAbonnement = () => () => {};
const partageDuTelephone = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export default function BoutonPartage({ adresse, texte, aide, texteBouton = "Partager", nom = "Partager", style = "contour" }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);

  // Fermer en touchant ailleurs ou avec Échap
  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: Event) => !cadre.current?.contains(e.target as Node) && setOuvert(false);
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("pointerdown", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <div className={s.partage} ref={cadre}>
      <button type="button" className={`${s.bouton} ${s[style]}`} aria-label={nom !== texteBouton ? nom : undefined}
        aria-expanded={ouvert} aria-haspopup="menu" onClick={() => setOuvert(!ouvert)}>
        <Icone nom="partager" taille={15} /> <span className={s.texte}>{texteBouton}</span>
      </button>
      {ouvert && (
        <div className={s.menu} role="menu" aria-label={nom}>
          {aide && <p className={s.aide}>{aide}</p>}
          <ChoixPartage adresse={adresse} texte={texte} classe={s.choix} role="menuitem" choisi={() => setOuvert(false)} />
        </div>
      )}
    </div>
  );
}

/** WhatsApp, Copier le lien (et « Autres… » : le partage du téléphone), dans le menu ou directement dans la page */
export function ChoixPartage({ adresse, texte, classe, role, choisi }: {
  adresse: string;
  texte: string;
  classe: string;
  role?: "menuitem";
  /** après WhatsApp (le menu se ferme) */
  choisi?: () => void;
}) {
  const [copie, setCopie] = useState(false);
  const natif = useSyncExternalStore(sansAbonnement, partageDuTelephone, () => false);
  const origine = useSyncExternalStore(sansAbonnement, () => window.location.origin, () => "");
  const lien = `${origine}${adresse}`;
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
    } catch {
      window.prompt("Copiez le lien :", lien);
    }
    setCopie(true);
    window.setTimeout(() => setCopie(false), 2500);
  };
  return (
    <>
      <a role={role} className={classe} href={`https://wa.me/?text=${encodeURIComponent(`${texte} ${lien}`)}`}
        target="_blank" rel="noopener" onClick={choisi}>
        <IconeWhatsApp taille={15} /> WhatsApp
      </a>
      <button type="button" role={role} className={classe} onClick={copier}>
        <Icone nom={copie ? "valide" : "lien"} taille={15} /> {copie ? "Lien copié" : "Copier le lien"}
      </button>
      {natif && (
        <button type="button" role={role} className={classe}
          onClick={() => navigator.share({ title: texte, text: texte, url: lien }).catch(() => {})}>
          <Icone nom="partager" taille={15} /> Autres…
        </button>
      )}
    </>
  );
}
