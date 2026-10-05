"use client";

/*
 * Mon Espace → Messages : les conversations (une par annonce et par personne intéressée), la plus récente d'abord,
 * avec leurs messages non lus ; à droite (sur téléphone : à la place de la liste) le fil et la réponse.
 * La personne intéressée et l'annonceur y écrivent tous les deux ; les noms restent discrets (« Awa K. »).
 * La liste est relue toutes les 30 secondes, le fil ouvert toutes les 10 secondes, tant que la page est affichée.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "@/components/Icone";
import PhotoCadree from "@/components/PhotoCadree";
import { urlPhoto } from "@/lib/annonces";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import {
  LONGUEUR_MAX, entreeEnvoie, lireMessages, marquerLus, mesConversations, quand, repondre, type Conversation, type Message,
} from "@/lib/messages";
import f from "./Formulaire.module.css";
import s from "./Messages.module.css";

const initiales = (nom: string) =>
  nom.split(/\s+/).filter((m) => /^\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "?";

/** Relance une lecture à intervalle régulier, seulement quand la page est affichée */
function useReleve(lire: () => void, ms: number) {
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && lire(), ms);
    return () => window.clearInterval(t);
  }, [lire, ms]);
}

export default function Messages({ moi, conversation }: { moi: string; conversation: string | null }) {
  const [liste, setListe] = useState<Conversation[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(conversation);

  const charger = useCallback(() => {
    mesConversations().then(
      (l) => {
        setListe(l);
        setErreur("");
      },
      (e) => setErreur(messageErreur(e)),
    );
  }, []);
  useEffect(charger, [charger]);
  useReleve(charger, 30_000);

  if (!liste) return erreur ? <p className={`${f.message} ${f.messageErreur}`} role="alert">{erreur}</p> : <p className={s.attente}>Chargement de vos messages…</p>;
  if (!liste.length) {
    return (
      <div className={s.vide}>
        <Icone nom="message" taille={28} />
        <p>
          Aucun message pour l&apos;instant. Écrivez à un annonceur depuis la fiche d&apos;un bien (« Envoyer un message ») :
          la conversation apparaîtra ici, et les messages reçus sur vos annonces aussi.
        </p>
        <Link href="/annonces" className={f.bouton}>Voir les annonces</Link>
      </div>
    );
  }

  const c = liste.find((x) => x.id === ouverte) ?? null;
  return (
    <div className={`${s.cadre} ${c ? s.avecFil : ""}`}>
      <ul className={s.liste} aria-label="Conversations">
        {liste.map((x) => (
          <li key={x.id}>
            <button type="button" className={`${s.conversation} ${x.id === ouverte ? s.active : ""} ${x.non_lus ? s.nonLue : ""}`}
              aria-current={x.id === ouverte || undefined} onClick={() => setOuverte(x.id)}>
              <span className={s.avatar} aria-hidden="true">{initiales(x.autre)}</span>
              <span className={s.resume}>
                <span className={s.ligne}>
                  <span className={s.nom}>{x.autre}</span>
                  {x.dernier && <span className={s.heure}>{quand(x.dernier.cree_le)}</span>}
                </span>
                <span className={s.bien}>{x.role === "annonceur" ? "Votre annonce : " : ""}{x.annonce.titre}</span>
                <span className={s.ligne}>
                  <span className={s.extrait}>{x.dernier ? `${x.dernier.de_moi ? "Vous : " : ""}${x.dernier.contenu}` : ""}</span>
                  {x.non_lus > 0 && <span className={s.pastille} aria-label={`${x.non_lus} non lu${x.non_lus > 1 ? "s" : ""}`}>{x.non_lus}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <section className={s.fil} aria-label={c ? `Conversation avec ${c.autre}` : "Conversation"}>
        {c ? (
          <Fil key={c.id} c={c} moi={moi} retour={() => setOuverte(null)} change={charger} />
        ) : (
          <p className={s.choisir}><Icone nom="message" taille={22} /> Choisissez une conversation.</p>
        )}
      </section>
    </div>
  );
}

function Fil({ c, moi, retour, change }: { c: Conversation; moi: string; retour: () => void; change: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const bulles = useRef<HTMLDivElement>(null);
  const haut = useRef<HTMLElement>(null);

  // Téléphone : le fil prend la place de la liste ; on l'amène à l'écran, sous la barre du haut (réponse comprise)
  useEffect(() => {
    const fil = haut.current?.closest("section");
    if (!fil || !window.matchMedia("(max-width: 760px)").matches) return;
    const marge = parseFloat(getComputedStyle(fil).scrollMarginTop) || 0;
    window.scrollTo({ top: fil.getBoundingClientRect().top + window.scrollY - marge, behavior: "instant" });
  }, []);

  const lire = useCallback(() => {
    lireMessages(c.id).then(
      async (m) => {
        setMessages((avant) => (avant && avant.length === m.length && avant.every((x, i) => x.lu_le === m[i].lu_le) ? avant : m));
        // messages reçus non lus : lus, puis la liste et la pastille se mettent à jour
        if (m.some((x) => x.auteur_id !== moi && !x.lu_le)) {
          await marquerLus(c.id).catch(() => {});
          change();
        }
      },
      (e) => setErreur(messageErreur(e)),
    );
  }, [c.id, moi, change]);
  useEffect(lire, [lire]);
  useReleve(lire, 10_000);

  // Toujours le dernier message en vue (seule la zone des messages défile, pas la page)
  useEffect(() => {
    const b = bulles.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [messages]);

  const envoyer = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!texte.trim() || envoi) return;
    setEnvoi(true);
    setErreur("");
    try {
      await repondre(c.id, texte);
      setTexte("");
      lire();
      change();
    } catch (er) {
      setErreur(messageErreur(er));
    }
    setEnvoi(false);
  };

  const dernierLu = messages?.filter((m) => m.auteur_id === moi).at(-1);
  return (
    <>
      <header className={s.filHaut} ref={haut}>
        <button type="button" className={s.retour} onClick={retour} aria-label="Retour aux conversations">
          <Icone nom="retour" taille={18} />
        </button>
        <span className={s.avatar} aria-hidden="true">{initiales(c.autre)}</span>
        <span className={s.filTitre}>
          <span className={s.nom}>{c.autre}</span>
          {c.annonce.en_ligne ? (
            <Link href={lienAnnonce(c.annonce)} className={s.lienBien}>
              <Icone nom="maison" taille={12} /> {c.annonce.titre}
            </Link>
          ) : (
            <span className={s.bien}><Icone nom="maison" taille={12} /> {c.annonce.titre} · plus en ligne</span>
          )}
        </span>
        {c.annonce.photo && (
          <span className={s.vignette} aria-hidden="true"><PhotoCadree src={urlPhoto(c.annonce.photo)} /></span>
        )}
      </header>
      <div className={s.bulles} ref={bulles} aria-live="polite">
        {!messages && <p className={s.attente}>Chargement…</p>}
        {messages?.map((m) => {
          const deMoi = m.auteur_id === moi;
          return (
            <div key={m.id} className={`${s.bulle} ${deMoi ? s.moi : s.lui}`}>
              <p className={s.contenu}>{m.contenu}</p>
              <span className={s.heureBulle}>
                {quand(m.cree_le)}
                {deMoi && m.id === dernierLu?.id && m.lu_le ? " · Lu" : ""}
              </span>
            </div>
          );
        })}
      </div>
      {erreur && <p className={`${f.message} ${f.messageErreur} ${s.erreur}`} role="alert">{erreur}</p>}
      <form className={s.saisie} onSubmit={envoyer}>
        <label htmlFor="reponse" className={s.cache}>Votre message à {c.autre}</label>
        <textarea id="reponse" className={s.zone} rows={2} maxLength={LONGUEUR_MAX} placeholder="Écrire un message…"
          value={texte} onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && entreeEnvoie()) {
              e.preventDefault();
              void envoyer();
            }
          }} />
        <button type="submit" className={s.envoyer} disabled={!texte.trim() || envoi} aria-label="Envoyer">
          <Icone nom="envoyer" taille={18} />
        </button>
      </form>
    </>
  );
}
