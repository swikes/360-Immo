"use client";

/*
 * Avant l'espace Administration : le code à 6 chiffres de l'application du téléphone (double authentification,
 * lib/double-auth.ts). La première fois, on l'active en scannant un QR code ; ensuite, il est demandé à chaque nouvelle
 * connexion. La base refuse les droits de l'équipe sans ce code : cet écran ne fait qu'aider à le donner.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Icone from "@/components/Icone";
import { messageErreur } from "@/lib/compte";
import { commencerActivation, donnerCode, etatCode, type Activation, type EtatCode } from "@/lib/double-auth";
import a from "./Admin.module.css";
import s from "./DoubleAuthentification.module.css";

export default function DoubleAuthentification({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatCode | null>(null);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    etatCode().then((e) => actif && setEtat(e), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  if (etat?.etat === "valide") return <>{children}</>;
  if (!etat) {
    return (
      <Cadre>
        {erreur
          ? <p className={a.erreur} role="alert">La double authentification n&apos;a pas pu être vérifiée : {erreur}</p>
          : <p className={a.attente}>Vérification de la double authentification…</p>}
      </Cadre>
    );
  }

  const activer = async () => {
    setErreur("");
    try {
      setActivation(await commencerActivation());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };

  if (etat.etat === "a_activer" && !activation) {
    return (
      <Cadre>
        <section className={s.carte} aria-labelledby="titre-code">
          <Icone nom="cadenas" taille={28} className={s.icone} />
          <h1 id="titre-code" className={a.titre}>Activez la double authentification</h1>
          <p className={s.texte}>
            L&apos;espace Administration ouvre les pièces d&apos;identité, les comptes et la publication des annonces. En plus de
            votre mot de passe, un code à 6 chiffres affiché par votre téléphone vous sera demandé : un mot de passe volé
            ne suffira pas.
          </p>
          <ol className={s.etapes}>
            <li>Installez une application d&apos;authentification sur votre téléphone : Google Authenticator ou Microsoft Authenticator (gratuites).</li>
            <li>Appuyez sur « Afficher le QR code », puis scannez-le avec l&apos;application.</li>
            <li>Tapez ici le code à 6 chiffres qu&apos;elle affiche.</li>
          </ol>
          {erreur && <p className={a.erreur} role="alert">{erreur}</p>}
          <button type="button" className={a.boutonPlein} onClick={activer}>Afficher le QR code</button>
        </section>
      </Cadre>
    );
  }

  const facteur = activation?.facteur ?? (etat.etat === "a_saisir" ? etat.facteur : "");
  return (
    <Cadre>
      <section className={s.carte} aria-labelledby="titre-code">
        <Icone nom="cadenas" taille={28} className={s.icone} />
        {activation ? (
          <>
            <h1 id="titre-code" className={a.titre}>Scannez ce QR code</h1>
            <p className={s.texte}>Avec Google Authenticator ou Microsoft Authenticator : « Ajouter un compte », puis « Scanner un QR code ».</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code donné par Supabase (image SVG dans l'adresse) */}
            <img src={activation.qr} alt="QR code à scanner avec l'application d'authentification" className={s.qr} />
            <p className={s.texte}>Pas d&apos;appareil photo ? Tapez cette clé dans l&apos;application : <span className={s.cle}>{activation.cle}</span></p>
            <p className={s.conseil}>
              Notez cette clé et gardez-la en lieu sûr : elle permet de remettre le code sur un nouveau téléphone. Sans elle,
              un téléphone perdu bloque l&apos;accès à l&apos;Administration (procédure dans le guide de dépannage).
            </p>
          </>
        ) : (
          <>
            <h1 id="titre-code" className={a.titre}>Code de votre application</h1>
            <p className={s.texte}>Ouvrez votre application d&apos;authentification et tapez le code à 6 chiffres affiché pour 360-Immo.ci.</p>
          </>
        )}
        <FormulaireCode facteur={facteur} valider={() => setEtat({ etat: "valide" })} libelle={activation ? "Activer" : "Valider"} />
      </section>
    </Cadre>
  );
}

function Cadre({ children }: { children: ReactNode }) {
  return <div className={a.page}><div className={a.contenu}>{children}</div></div>;
}

function FormulaireCode({ facteur, valider, libelle }: { facteur: string; valider: () => void; libelle: string }) {
  const [code, setCode] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErreur("Le code a 6 chiffres.");
    setEnvoi(true);
    setErreur("");
    try {
      await donnerCode(facteur, code);
      valider();
    } catch (x) {
      setErreur(messageErreur(x));
      setCode("");
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <form className={s.formulaire} onSubmit={envoyer} noValidate>
      <label>
        Code à 6 chiffres
        <input className={s.code} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-describedby={erreur ? "erreur-code" : undefined} />
      </label>
      <button type="submit" className={a.boutonPlein} disabled={envoi}>{envoi ? "Vérification…" : libelle}</button>
      {erreur && <p id="erreur-code" className={a.erreur} role="alert">{erreur}</p>}
    </form>
  );
}
