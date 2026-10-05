"use client";

/*
 * Contacter l'annonceur, sur la fiche d'un bien. Le numéro n'est pas écrit dans la page (contre les robots qui
 * récoltent les numéros) : « Afficher le numéro » le demande à la base (fonction contact_annonce), puis propose
 * Appeler, WhatsApp (message prérempli avec la référence de l'annonce) et l'e-mail s'il y en a un.
 * Un particulier apparaît d'abord sous le nom discret de sa vitrine (« Awa K. ») : son nom complet vient avec
 * les numéros.
 * Lien vers la vitrine de l'annonceur (toutes ses annonces en ligne). « Envoyer un message » (compte nécessaire) :
 * la conversation continue dans Mon Espace → Messages. « Planifier une visite » (avec ou sans compte) : l'annonceur
 * répond dans Mon Espace → Visites. « Être rappelé » : bientôt.
 */
import Link from "next/link";
import { useState } from "react";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { supabase } from "@/lib/supabase";
import EcrireMessage from "./EcrireMessage";
import PlanifierVisite from "./PlanifierVisite";
import s from "./Fiche.module.css";

type Coordonnees = {
  /** nom complet du contact, écrit dans l'annonce */
  nom: string | null;
  telephone: string | null;
  whatsapp: boolean;
  telephone2: string | null;
  whatsapp2: boolean;
  email: string | null;
};

type Props = {
  id: string;
  reference: string;
  titre: string;
  adresse: string;
  nom: string;
  agence: boolean;
  /** agence vérifiée par 360-Immo.ci */
  verifiee: boolean;
  /** adresse et nom affiché de sa vitrine */
  vitrine: { lien: string; nom: string } | null;
  prix: string;
  complement: string | null;
};

const chiffres = (t: string) => t.replace(/\D/g, "");

export default function Contact({ id, reference, titre, adresse, nom, agence, verifiee, vitrine, prix, complement }: Props) {
  const [contact, setContact] = useState<Coordonnees | null>(null);
  const [etat, setEtat] = useState<"" | "attente" | "erreur" | "hors-ligne">("");
  const message = `Bonjour, je suis intéressé(e) par votre annonce « ${titre} » (réf. ${reference}) vue sur 360-Immo.ci : ${adresse}`;

  const afficher = async () => {
    const sb = supabase();
    if (!sb) return setEtat("erreur");
    setEtat("attente");
    const { data, error } = await sb.rpc("contact_annonce", { annonce: id });
    if (error) return setEtat("erreur");
    if (!data) return setEtat("hors-ligne");
    setContact(data as Coordonnees);
    setEtat("");
  };

  const nomAffiche = contact?.nom?.trim() || nom;

  const numero = (tel: string, whatsapp: boolean, second: boolean) => (
    <div className={s.numero} key={tel}>
      <a href={`tel:${tel.replace(/\s/g, "")}`} className={s.appeler}>
        <Icone nom="telephone" taille={17} />
        <span>
          {tel}
          {second && <small> · second numéro</small>}
        </span>
      </a>
      {whatsapp && (
        <a href={`https://wa.me/${chiffres(tel)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener" className={s.whatsapp}>
          <IconeWhatsApp /> WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <div className={s.contact} id="contact">
      <div className={s.annonceur}>
        <span className={s.annonceurAvatar} aria-hidden="true">
          {nomAffiche.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "?"}
        </span>
        <span className={s.annonceurNom}>
          {nomAffiche}
          <small>
            {agence ? "Agence immobilière" : "Particulier"}
            {verifiee && <span className={s.verifiee}><Icone nom="bouclier" taille={11} /> Vérifiée</span>}
          </small>
        </span>
      </div>
      {vitrine && (
        <Link href={vitrine.lien} className={s.lienVitrine}>
          Toutes les annonces de {vitrine.nom} <Icone nom="fleche" taille={14} />
        </Link>
      )}
      <div className={s.contactPrix}>
        <span className={s.contactMontant}>{prix}</span>
        {complement && <span className={s.contactComplement}>{complement}</span>}
      </div>

      {contact ? (
        <div className={s.numeros}>
          {contact.telephone && numero(contact.telephone, contact.whatsapp, false)}
          {contact.telephone2 && numero(contact.telephone2, contact.whatsapp2, true)}
          {contact.email && (
            <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Annonce ${reference} — ${titre}`)}&body=${encodeURIComponent(message)}`} className={s.email}>
              <Icone nom="email" taille={16} /> {contact.email}
            </a>
          )}
          <p className={s.prudence}>
            <Icone nom="bouclier" taille={14} /> Ne versez jamais d&apos;argent avant d&apos;avoir visité le bien et vérifié les documents.
          </p>
        </div>
      ) : (
        <button type="button" className={s.afficher} onClick={afficher} disabled={etat === "attente"}>
          <Icone nom="telephone" taille={18} /> {etat === "attente" ? "Un instant…" : "Afficher le numéro"}
        </button>
      )}
      {etat === "erreur" && <p className={s.erreur} role="alert">Le numéro ne peut pas être affiché pour l&apos;instant. Réessayez dans un moment.</p>}
      {etat === "hors-ligne" && <p className={s.erreur} role="alert">Cette annonce n&apos;est plus en ligne.</p>}

      <EcrireMessage annonce={id} titre={titre} reference={reference} nom={nomAffiche} />

      <PlanifierVisite annonce={id} titre={titre} reference={reference} nom={nomAffiche} />

      <button type="button" className={s.bientotAction} disabled title="Bientôt disponible">
        <Icone nom="telephone" taille={16} />
        Être rappelé
        <span className={s.bientot}>Bientôt</span>
      </button>
    </div>
  );
}
