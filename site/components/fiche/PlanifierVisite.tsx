"use client";

/*
 * « Planifier une visite », sur la fiche d'un bien (comme la maquette 360-immo-detail-bien.html) : avec ou sans compte.
 *   1. Créneau : un des 7 jours qui suivent, à 9 h, 11 h, 14 h, 16 h ou 18 h (les créneaux déjà confirmés sont grisés)
 *   2. Vos infos : nom, téléphone (pour être rappelé), e-mail et message facultatifs — préremplis avec le profil
 *   3. Envoyée : l'annonceur confirme, propose un autre créneau ou refuse dans Mon Espace → Visites ; avec un compte,
 *      la réponse arrive dans son espace. On peut aussi le prévenir tout de suite sur WhatsApp.
 * Fenêtre centrée sur ordinateur, qui monte du bas de l'écran sur téléphone.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import ChampTelephone from "@/components/ChampTelephone";
import ChoixCreneau from "@/components/ChoixCreneau";
import { ChampTexte } from "@/components/compte/Champs";
import Icone, { IconeWhatsApp } from "@/components/Icone";
import { lireProfil, messageErreur, useCompte } from "@/lib/compte";
import { supabase } from "@/lib/supabase";
import { PAYS_DEFAUT, complet, decomposer, message as messageTelephone, valide } from "@/lib/telephone";
import { creneauDe, creneauxPris, demanderVisite, joursProposes, texteCreneau } from "@/lib/visites";
import { rafraichirNonLus } from "@/lib/messages";
import f from "@/components/compte/Formulaire.module.css";
import s from "./PlanifierVisite.module.css";

type Props = { annonce: string; titre: string; reference: string; nom: string };
type Etape = 1 | 2 | 3;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ETAPES = ["Créneau", "Vos infos", "Envoyée"];

export default function PlanifierVisite({ annonce, titre, reference, nom }: Props) {
  const { etat, utilisateur } = useCompte();
  const boite = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [etape, setEtape] = useState<Etape>(1);
  const [jours, setJours] = useState<string[]>([]);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState<number | null>(null);
  const [pris, setPris] = useState<string[]>([]);
  const [nomDemandeur, setNomDemandeur] = useState("");
  const [tel, setTel] = useState({ iso: PAYS_DEFAUT.iso, valeur: "" });
  const [email, setEmail] = useState("");
  const [mot, setMot] = useState("");
  const [erreurs, setErreurs] = useState<{ nom?: string; tel?: string; email?: string }>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const prerempli = useRef(false);
  const connecte = etat === "connecte" && !!utilisateur;
  const creneau = jour && heure !== null ? creneauDe(jour, heure) : null;

  const ouvrir = () => {
    const j = joursProposes();
    setJours(j);
    if (!j.includes(jour)) setJour(j[0]);
    if (etape === 3) {
      setEtape(1);
      setHeure(null);
      setMot("");
      setWhatsapp(null);
    }
    setErreur("");
    setOuvert(true);
    creneauxPris(annonce).then(setPris, () => setPris([]));
  };

  useEffect(() => {
    if (ouvert && !boite.current?.open) boite.current?.showModal();
  }, [ouvert]);

  // Avec un compte : nom, numéro et e-mail du profil (une seule fois, sans écraser ce qui a été tapé)
  useEffect(() => {
    if (!ouvert || !connecte || prerempli.current) return;
    prerempli.current = true;
    setEmail((e) => e || utilisateur.email || "");
    lireProfil(utilisateur.id).then(
      (p) => {
        setNomDemandeur((n) => n || [p.prenom, p.nom].filter(Boolean).join(" "));
        if (p.telephone) setTel((t) => (t.valeur ? t : decomposer(p.telephone)));
      },
      () => {},
    );
  }, [ouvert, connecte, utilisateur]);

  const continuer = () => creneau && setEtape(2);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!creneau || envoi) return;
    const err = {
      nom: nomDemandeur.trim().length >= 2 ? undefined : "Indiquez votre prénom et votre nom.",
      tel: valide(tel.valeur, tel.iso) ? undefined : messageTelephone(tel.valeur, tel.iso),
      email: !email.trim() || EMAIL.test(email.trim()) ? undefined : "Cette adresse e-mail n'est pas valide.",
    };
    setErreurs(err);
    setErreur("");
    if (err.nom || err.tel || err.email) return;
    setEnvoi(true);
    try {
      await demanderVisite(annonce, { nom: nomDemandeur, telephone: complet(tel.valeur, tel.iso), email, message: mot, creneau });
      setEtape(3);
      if (connecte) rafraichirNonLus();
      void preparerWhatsApp(creneau);
    } catch (ex) {
      setErreur(messageErreur(ex));
    }
    setEnvoi(false);
  };

  // « Prévenir sur WhatsApp » : si l'annonceur a un numéro WhatsApp, message prérempli avec la demande
  const preparerWhatsApp = async (c: string) => {
    const { data } = (await supabase()?.rpc("contact_annonce", { annonce })) ?? {};
    const contact = data as { telephone: string | null; whatsapp: boolean; telephone2: string | null; whatsapp2: boolean } | null;
    const numero = contact?.whatsapp ? contact.telephone : contact?.whatsapp2 ? contact.telephone2 : null;
    if (!numero) return;
    const texte = `Bonjour, je viens de vous envoyer sur 360-Immo.ci une demande de visite pour « ${titre} » (réf. ${reference}) : ${texteCreneau(c)}. ${nomDemandeur.trim()}, ${complet(tel.valeur, tel.iso)}.`;
    setWhatsapp(`https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texte)}`);
  };

  return (
    <>
      <button type="button" className={s.ouvrir} onClick={ouvrir}>
        <Icone nom="calendrier" taille={18} />
        Planifier une visite
      </button>
      {ouvert && (
        <dialog
          ref={boite}
          className={s.boite}
          aria-labelledby={`${id}-titre`}
          onClose={() => setOuvert(false)}
          onClick={(e) => e.target === boite.current && boite.current?.close()}
        >
          <div className={s.contenu}>
            <div className={s.haut}>
              <h2 id={`${id}-titre`} className={s.titre}>Planifier une visite</h2>
              <button type="button" className={s.fermer} onClick={() => boite.current?.close()} aria-label="Fermer">
                <Icone nom="fermer" taille={20} />
              </button>
            </div>
            <p className={s.sousTitre}>{titre} · {nom}</p>

            <ol className={s.etapes} aria-label="Étapes">
              {ETAPES.map((t, i) => {
                const n = i + 1;
                const classe = n < etape ? s.faite : n === etape ? s.active : "";
                return (
                  <li key={t} className={`${s.etape} ${classe}`} aria-current={n === etape ? "step" : undefined}>
                    <span className={s.point} aria-hidden="true">{n < etape ? <Icone nom="valide" taille={14} epaisseur={3} /> : n}</span>
                    <span className={s.etapeNom}>{t}</span>
                  </li>
                );
              })}
            </ol>

            {etape === 1 && (
              <div className={s.corps}>
                <ChoixCreneau jours={jours} jour={jour} heure={heure} onJour={setJour} onHeure={setHeure} pris={pris} />
                {creneau && pris.includes(creneau) && <p className={f.erreur}>Ce créneau vient d&apos;être pris : choisissez-en un autre.</p>}
                <p className={s.note}>
                  <Icone nom="horloge" taille={14} /> Heure d&apos;Abidjan. L&apos;annonceur confirme le rendez-vous ou vous propose un autre créneau.
                </p>
                <button type="button" className={s.principal} disabled={!creneau || pris.includes(creneau)} onClick={continuer}>
                  Continuer <Icone nom="fleche" taille={16} />
                </button>
              </div>
            )}

            {etape === 2 && creneau && (
              <form className={`${s.corps} ${f.formulaire}`} onSubmit={envoyer} noValidate>
                <p className={s.rappel}>
                  <Icone nom="calendrier" taille={15} /> {texteCreneau(creneau)}
                  <button type="button" className={s.modifier} onClick={() => setEtape(1)}>Modifier</button>
                </p>
                <ChampTexte etiquette="Prénom et nom" icone="personne" autoComplete="name" valeur={nomDemandeur}
                  onChange={setNomDemandeur} erreur={erreurs.nom} obligatoire maxLength={80} />
                <div className={f.groupe}>
                  <label htmlFor={`${id}-tel`} className={f.etiquette}>
                    Téléphone<span className={f.obligatoire} aria-hidden="true">*</span>
                  </label>
                  <div className={`${s.telephone} ${erreurs.tel ? s.enErreur : ""}`}>
                    <ChampTelephone id={`${id}-tel`} iso={tel.iso} valeur={tel.valeur} onChange={(iso, valeur) => setTel({ iso, valeur })}
                      invalide={!!erreurs.tel} decrit={erreurs.tel ? `${id}-tel-erreur` : `${id}-tel-aide`} />
                  </div>
                  {erreurs.tel ? (
                    <p id={`${id}-tel-erreur`} className={f.erreur} role="alert">{erreurs.tel}</p>
                  ) : (
                    <p id={`${id}-tel-aide`} className={f.aide}>Pour que l&apos;annonceur puisse vous rappeler.</p>
                  )}
                </div>
                <ChampTexte etiquette="E-mail (facultatif)" icone="email" type="email" autoComplete="email" valeur={email}
                  onChange={setEmail} erreur={erreurs.email} />
                <div className={f.groupe}>
                  <label htmlFor={`${id}-mot`} className={f.etiquette}>Un mot pour l&apos;annonceur (facultatif)</label>
                  <textarea id={`${id}-mot`} className={s.zone} rows={2} maxLength={1000} value={mot} onChange={(e) => setMot(e.target.value)}
                    placeholder="Ex : je viendrai avec mon épouse." />
                </div>
                {erreur && (
                  <p className={`${f.message} ${f.messageErreur}`} role="alert">
                    <Icone nom="calendrier" taille={16} />
                    {erreur}
                  </p>
                )}
                <div className={s.boutons}>
                  <button type="button" className={s.secondaire} onClick={() => setEtape(1)}>Retour</button>
                  <button type="submit" className={s.principal} disabled={envoi}>
                    {envoi ? "Envoi…" : "Envoyer la demande"}
                  </button>
                </div>
              </form>
            )}

            {etape === 3 && creneau && (
              <div className={`${s.corps} ${s.fin}`} role="status">
                <span className={s.rond} aria-hidden="true"><Icone nom="valide" taille={28} /></span>
                <p className={s.finTitre}>Demande envoyée !</p>
                <p className={s.finTexte}>
                  {connecte ? (
                    <>{nom} va confirmer le rendez-vous ou vous proposer un autre créneau. Sa réponse arrivera dans votre espace.</>
                  ) : (
                    <>
                      {nom} va vous rappeler au <span className={s.numero}>{complet(tel.valeur, tel.iso)}</span> pour confirmer le
                      rendez-vous ou vous proposer un autre créneau.
                    </>
                  )}
                </p>
                <span className={s.pilule}><Icone nom="calendrier" taille={14} /> {texteCreneau(creneau)}</span>
                <div className={s.boutonsFin}>
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener" className={s.whatsapp}>
                      <IconeWhatsApp /> Prévenir sur WhatsApp
                    </a>
                  )}
                  {connecte && (
                    <Link href="/mon-espace?section=visites" className={s.principal}>
                      Suivre ma demande
                    </Link>
                  )}
                  <button type="button" className={s.secondaire} onClick={() => boite.current?.close()}>Fermer</button>
                </div>
              </div>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
