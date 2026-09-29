"use client";

/*
 * Partager une annonce : WhatsApp (le lien s'affiche avec la photo, le prix et le quartier), Facebook,
 * copier le lien, et sur téléphone le partage du téléphone (SMS, Messenger…).
 */
import { useState, useSyncExternalStore } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import s from "./Fiche.module.css";

const partageDuTelephone = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export default function Partager({ adresse, texte }: { adresse: string; texte: string }) {
  const [copie, setCopie] = useState(false);
  const natif = useSyncExternalStore(() => () => {}, partageDuTelephone, () => false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresse);
    } catch {
      window.prompt("Copiez le lien de l'annonce :", adresse);
    }
    setCopie(true);
    window.setTimeout(() => setCopie(false), 2500);
  };
  return (
    <div className={s.partager}>
      <span className={s.carteTitre}>Partager cette annonce</span>
      <div className={s.partagerBoutons}>
        <a className={s.partagerBouton} href={`https://wa.me/?text=${encodeURIComponent(`${texte} ${adresse}`)}`} target="_blank" rel="noopener">
          <IconeWhatsApp /> WhatsApp
        </a>
        <a className={s.partagerBouton} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(adresse)}`} target="_blank" rel="noopener">
          <Icone nom="partager" taille={15} /> Facebook
        </a>
        <button type="button" className={s.partagerBouton} onClick={copier}>
          <Icone nom={copie ? "valide" : "lien"} taille={15} /> {copie ? "Lien copié" : "Copier le lien"}
        </button>
        {natif && (
          <button type="button" className={s.partagerBouton} onClick={() => navigator.share({ title: texte, url: adresse }).catch(() => {})}>
            <Icone nom="partager" taille={15} /> Autres…
          </button>
        )}
      </div>
    </div>
  );
}
