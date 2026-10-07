"use client";

/*
 * Partager une annonce : WhatsApp (le lien s'affiche avec la photo, le prix et le quartier), Facebook,
 * copier le lien, et sur téléphone le partage du téléphone (SMS, Messenger…). Chaque partage est noté pour les
 * statistiques de l'annonceur (une fois par visite).
 */
import { useState, useSyncExternalStore } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { noterAction } from "@/lib/statistiques";
import s from "./Fiche.module.css";

const partageDuTelephone = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export default function Partager({ annonce, adresse, texte }: { annonce: string; adresse: string; texte: string }) {
  const [copie, setCopie] = useState(false);
  const partage = () => noterAction(annonce, "partage");
  const natif = useSyncExternalStore(() => () => {}, partageDuTelephone, () => false);
  const copier = async () => {
    partage();
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
        <a className={s.partagerBouton} href={`https://wa.me/?text=${encodeURIComponent(`${texte} ${adresse}`)}`} target="_blank" rel="noopener"
          onClick={partage}>
          <IconeWhatsApp /> WhatsApp
        </a>
        <a className={s.partagerBouton} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(adresse)}`} target="_blank" rel="noopener"
          onClick={partage}>
          <Icone nom="partager" taille={15} /> Facebook
        </a>
        <button type="button" className={s.partagerBouton} onClick={copier}>
          <Icone nom={copie ? "valide" : "lien"} taille={15} /> {copie ? "Lien copié" : "Copier le lien"}
        </button>
        {natif && (
          <button type="button" className={s.partagerBouton} onClick={() => {
            partage();
            navigator.share({ title: texte, url: adresse }).catch(() => {});
          }}>
            <Icone nom="partager" taille={15} /> Autres…
          </button>
        )}
      </div>
    </div>
  );
}
