"use client";

/*
 * Page « Connexion » : onglets Se connecter / S'inscrire (comme la maquette 360-immo-login.html).
 *   /connexion                     → se connecter
 *   /connexion?mode=inscription    → créer un compte
 *   /connexion?suite=/publier      → après la connexion, retour à la page demandée (Mon Espace sinon)
 *   /connexion?oubli=1             → fenêtre « Mot de passe oublié » ouverte
 * Connexion par e-mail et mot de passe ; Google, Facebook et WhatsApp : bientôt.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Icone, { IconeFacebook, IconeGoogle, IconeWhatsApp } from "@/components/Icone";
import { messageErreur, useCompte } from "@/lib/compte";
import { seSouvenir, supabase } from "@/lib/supabase";
import BlocTelephones, { TELEPHONES_VIDES, champsTelephones, erreurTelephones, type Telephones } from "./BlocTelephones";
import { ChampMotDePasse, ChampTexte, emailValide } from "./Champs";
import MotDePasseOublie from "./MotDePasseOublie";
import f from "./Formulaire.module.css";
import s from "./Connexion.module.css";

type Mode = "connexion" | "inscription";

export default function Connexion() {
  // Onglet et page de retour lus dans l'adresse : en attendant, la page s'affiche déjà sur « Se connecter »
  return (
    <Suspense fallback={<Page mode="connexion" suite="/mon-espace" oubli={false} />}>
      <PageAvecAdresse />
    </Suspense>
  );
}

function PageAvecAdresse() {
  const p = useSearchParams();
  const suite = p.get("suite") ?? "";
  // Seulement une page du site (« /publier »), jamais une autre adresse (« //site.com », « /\site.com »…)
  const suiteSure = /^\/(?![/\\])[^\s\\]*$/.test(suite) ? suite : "/mon-espace";
  return (
    <Page mode={p.get("mode") === "inscription" ? "inscription" : "connexion"} suite={suiteSure} oubli={p.get("oubli") === "1"} />
  );
}

function Page({ mode: modeInitial, suite, oubli }: { mode: Mode; suite: string; oubli: boolean }) {
  const [mode, setMode] = useState<Mode>(modeInitial);
  const { etat } = useCompte();
  const router = useRouter();
  const destination = useRef<string | null>(null);

  // Déjà connecté (ou tout juste connecté) : direction Mon Espace, ou la page demandée
  useEffect(() => {
    if (etat === "connecte") router.replace(destination.current ?? suite);
  }, [etat, router, suite]);

  const onglet = (m: Mode, texte: string) => (
    <button
      type="button"
      role="tab"
      id={`onglet-${m}`}
      aria-selected={mode === m}
      aria-controls={`panneau-${m}`}
      className={`${s.onglet} ${mode === m ? s.ongletActif : ""}`}
      onClick={() => setMode(m)}
    >
      {texte}
    </button>
  );

  return (
    <section className={s.page}>
      <aside className={s.presentation} aria-hidden="true">
        <div className={s.decor} />
        <h2 className={s.slogan}>
          Votre prochain chez-vous commence <em>ici</em>
        </h2>
        <p className={s.texte}>
          Rejoignez les Ivoiriens qui trouvent, louent et vendent leurs biens immobiliers sur 360-Immo.ci.
        </p>
        <ul className={s.atouts}>
          <li>
            <Icone nom="maison" taille={17} /> Publiez vos annonces gratuitement
          </li>
          <li>
            <IconeWhatsApp taille={16} /> Soyez contacté directement, par téléphone ou WhatsApp
          </li>
          <li>
            <Icone nom="coeur" taille={17} /> Gardez vos biens favoris et vos recherches
          </li>
          <li>
            <Icone nom="bouclier" taille={17} /> Annonces vérifiées par l&apos;équipe 360-Immo.ci
          </li>
        </ul>
      </aside>

      <div className={s.colonne}>
        <div className={s.formulaires}>
          <div className={s.onglets} role="tablist" aria-label="Connexion ou inscription">
            {onglet("connexion", "Se connecter")}
            {onglet("inscription", "S'inscrire")}
          </div>

          {etat === "indisponible" && (
            <p className={`${f.message} ${f.messageInfo}`}>
              <Icone nom="horloge" taille={16} />
              Les comptes ouvrent bientôt sur le nouveau site : l&apos;inscription et la connexion ne sont pas encore
              possibles.
            </p>
          )}
          {etat === "connecte" && (
            <p className={`${f.message} ${f.messageSucces}`} role="status">
              <Icone nom="valide" taille={16} />
              Vous êtes connecté. Ouverture de votre espace…
            </p>
          )}

          <div id="panneau-connexion" role="tabpanel" aria-labelledby="onglet-connexion" hidden={mode !== "connexion"}>
            <FormulaireConnexion actif={mode === "connexion"} versInscription={() => setMode("inscription")} oubliOuvert={oubli} />
          </div>
          <div id="panneau-inscription" role="tabpanel" aria-labelledby="onglet-inscription" hidden={mode !== "inscription"}>
            <FormulaireInscription
              actif={mode === "inscription"}
              versConnexion={() => setMode("connexion")}
              destination={(adresse) => (destination.current = adresse)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Google, Facebook, WhatsApp : bientôt ──
function BoutonsSociaux({ texte }: { texte: string }) {
  const [info, setInfo] = useState("");
  const bouton = (nom: string, icone: ReactNode, couleur?: string) => (
    <button
      type="button"
      className={f.social}
      style={couleur ? { color: couleur } : undefined}
      onClick={() => setInfo(`${texte} ${nom} arrive bientôt. En attendant, utilisez votre e-mail et un mot de passe.`)}
    >
      {icone}
      {nom}
      <span className={f.bientot}>Bientôt</span>
    </button>
  );
  return (
    <>
      <div className={f.separateur}>ou continuer avec</div>
      <div className={f.sociaux}>
        {bouton("Google", <IconeGoogle />)}
        {bouton("Facebook", <IconeFacebook />, "#1877F2")}
        {bouton("WhatsApp", <IconeWhatsApp taille={16} />, "#128C4B")}
      </div>
      {info && (
        <p className={`${f.message} ${f.messageInfo}`} role="status">
          <Icone nom="horloge" taille={16} />
          {info}
        </p>
      )}
    </>
  );
}

// ── Se connecter ──
type PropsConnexion = { actif: boolean; versInscription: () => void; oubliOuvert: boolean };

function FormulaireConnexion({ actif, versInscription, oubliOuvert }: PropsConnexion) {
  const Titre = actif ? "h1" : "h2"; // un seul titre principal : celui de l'onglet ouvert
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [souvenir, setSouvenir] = useState(true);
  const [erreurs, setErreurs] = useState<{ email?: string; mdp?: string }>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [oubli, setOubli] = useState(oubliOuvert);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const err = {
      email: emailValide(email) ? undefined : "Veuillez saisir un e-mail valide.",
      mdp: mdp ? undefined : "Veuillez saisir votre mot de passe.",
    };
    setErreurs(err);
    setErreur("");
    if (err.email || err.mdp) return;
    const sb = supabase();
    if (!sb) return setErreur(messageErreur(new Error("indisponible")));
    setEnvoi(true);
    seSouvenir(souvenir);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setEnvoi(false);
    if (error) setErreur(messageErreur(error));
  };

  return (
    <>
    <form className={f.formulaire} onSubmit={envoyer} noValidate>
      <div className={s.entete}>
        <span className={s.surtitre}>Bon retour</span>
        <Titre className={s.titre}>Connectez-vous</Titre>
        <p className={s.sousTitre}>
          Pas encore de compte ?{" "}
          <button type="button" className={f.lien} onClick={versInscription}>
            Créer un compte gratuitement
          </button>
        </p>
      </div>
      <ChampTexte
        etiquette="E-mail"
        icone="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="votre@email.com"
        valeur={email}
        onChange={setEmail}
        erreur={erreurs.email}
      />
      <ChampMotDePasse
        etiquette="Mot de passe"
        autoComplete="current-password"
        placeholder="Votre mot de passe"
        valeur={mdp}
        onChange={setMdp}
        erreur={erreurs.mdp}
      />
      <div className={s.ligneOptions}>
        <label className={f.case}>
          <input type="checkbox" checked={souvenir} onChange={(e) => setSouvenir(e.target.checked)} />
          Se souvenir de moi
        </label>
        <button type="button" className={f.lien} onClick={() => setOubli(true)}>
          Mot de passe oublié ?
        </button>
      </div>
      {erreur && (
        <p className={`${f.message} ${f.messageErreur}`} role="alert">
          <Icone nom="cadenas" taille={16} />
          {erreur}
        </p>
      )}
      <button type="submit" className={f.bouton} disabled={envoi}>
        <Icone nom="entree" taille={17} />
        {envoi ? "Connexion…" : "Se connecter"}
      </button>
      <BoutonsSociaux texte="La connexion avec" />
    </form>
    {oubli && <MotDePasseOublie fermer={() => setOubli(false)} emailInitial={email} />}
    </>
  );
}

// ── Créer un compte ──
// destination : page ouverte une fois connecté (Supabase annonce la connexion avant la fin de l'envoi)
type PropsInscription = { actif: boolean; versConnexion: () => void; destination: (adresse: string | null) => void };

function FormulaireInscription({ actif, versConnexion, destination }: PropsInscription) {
  const Titre = actif ? "h1" : "h2";
  const [agence, setAgence] = useState(false);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [nomAgence, setNomAgence] = useState("");
  const [email, setEmail] = useState("");
  const [tels, setTels] = useState<Telephones>(TELEPHONES_VIDES);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [conditions, setConditions] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aConfirmer, setAConfirmer] = useState("");

  // Le message d'erreur des numéros disparaît dès qu'on les corrige
  const changerTels = (t: Telephones) => {
    setTels(t);
    if (erreurs.tels) setErreurs({ ...erreurs, tels: undefined });
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string | undefined> = {
      prenom: prenom.trim() ? undefined : "Indiquez votre prénom.",
      nom: nom.trim() ? undefined : "Indiquez votre nom.",
      agence: !agence || nomAgence.trim().length >= 2 ? undefined : "Indiquez le nom de votre agence.",
      email: emailValide(email) ? undefined : "E-mail invalide.",
      tels: erreurTelephones(tels) || undefined,
      mdp: mdp.length >= 8 ? undefined : "Au moins 8 caractères.",
      confirmation: confirmation === mdp ? undefined : "Les mots de passe ne correspondent pas.",
    };
    setErreurs(err);
    setErreur(conditions ? "" : "Veuillez accepter les conditions d'utilisation pour continuer.");
    const premiere = Object.keys(err).find((k) => err[k]);
    if (premiere || !conditions) return;

    const sb = supabase();
    if (!sb) return setErreur(messageErreur(new Error("indisponible")));
    setEnvoi(true);
    seSouvenir(true);
    destination("/mon-espace?bienvenue=1");
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: mdp,
      options: {
        // Ce que la base range dans le profil (supabase/migrations : creer_profil)
        data: {
          prenom: prenom.trim(),
          nom: nom.trim(),
          ...champsTelephonesPourInscription(tels),
          ...(agence ? { agence: nomAgence.trim() } : {}),
        },
        emailRedirectTo: `${window.location.origin}/mon-espace`,
      },
    });
    setEnvoi(false);
    if (data.session) return; // connecté tout de suite : direction Mon Espace
    destination(null);
    if (error) setErreur(messageErreur(error));
    else setAConfirmer(email.trim()); // confirmation de l'e-mail demandée par Supabase
  };

  if (aConfirmer) {
    return (
      <div className={f.formulaire}>
        <div className={s.entete}>
          <span className={s.surtitre}>Presque terminé</span>
          <Titre className={s.titre}>Vérifiez vos e-mails</Titre>
        </div>
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="email" taille={16} />
          <span>
            Un lien de confirmation a été envoyé à <strong>{aConfirmer}</strong>. Ouvrez-le pour activer votre compte,
            puis connectez-vous.
          </span>
        </p>
        <button type="button" className={f.bouton} onClick={versConnexion}>
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <form className={f.formulaire} onSubmit={envoyer} noValidate>
      <div className={s.entete}>
        <span className={s.surtitre}>Bienvenue</span>
        <Titre className={s.titre}>Créer un compte</Titre>
        <p className={s.sousTitre}>
          Déjà inscrit ?{" "}
          <button type="button" className={f.lien} onClick={versConnexion}>
            Se connecter
          </button>
        </p>
      </div>

      <fieldset className={f.groupe}>
        <legend className={f.etiquette}>Je suis</legend>
        <div className={s.typesCompte}>
          {[
            { oui: false, titre: "Particulier", texte: "Je cherche, loue ou vends", icone: "personne" as const },
            { oui: true, titre: "Agence", texte: "Je publie des biens", icone: "maison" as const },
          ].map((t) => (
            <label key={t.titre} className={`${s.typeCompte} ${agence === t.oui ? s.typeChoisi : ""}`}>
              <input
                type="radio"
                name="type-compte"
                className="lecteur-ecran"
                checked={agence === t.oui}
                onChange={() => setAgence(t.oui)}
              />
              <span className={s.typeIcone}>
                <Icone nom={t.icone} taille={18} />
              </span>
              <span className={s.typeTitre}>{t.titre}</span>
              <span className={s.typeTexte}>{t.texte}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={f.deuxColonnes}>
        <ChampTexte etiquette="Prénom" icone="personne" autoComplete="given-name" placeholder="Kouamé" valeur={prenom} onChange={setPrenom} erreur={erreurs.prenom} obligatoire />
        <ChampTexte etiquette="Nom" icone="personne" autoComplete="family-name" placeholder="Assouan" valeur={nom} onChange={setNom} erreur={erreurs.nom} obligatoire />
      </div>
      {agence && (
        <ChampTexte
          etiquette="Nom de l'agence"
          icone="maison"
          autoComplete="organization"
          placeholder="Ex : Kamika Immobilier"
          valeur={nomAgence}
          onChange={setNomAgence}
          erreur={erreurs.agence}
          aide="L'équipe 360-Immo.ci vérifie chaque agence avant de l'afficher comme telle. En attendant, vous utilisez le site comme un particulier."
          obligatoire
        />
      )}
      <ChampTexte etiquette="E-mail" icone="email" type="email" autoComplete="email" inputMode="email" placeholder="votre@email.com" valeur={email} onChange={setEmail} erreur={erreurs.email} obligatoire />
      <BlocTelephones valeur={tels} onChange={changerTels} erreur={erreurs.tels} />
      <ChampMotDePasse etiquette="Mot de passe" autoComplete="new-password" placeholder="Min. 8 caractères" valeur={mdp} onChange={setMdp} erreur={erreurs.mdp} avecForce obligatoire />
      <ChampMotDePasse etiquette="Confirmer le mot de passe" autoComplete="new-password" placeholder="Répétez le mot de passe" valeur={confirmation} onChange={setConfirmation} erreur={erreurs.confirmation} obligatoire />

      <label className={f.case}>
        <input type="checkbox" checked={conditions} onChange={(e) => setConditions(e.target.checked)} />
        <span>
          J&apos;accepte les <strong>Conditions générales d&apos;utilisation</strong> et la{" "}
          <strong>Politique de confidentialité</strong> de 360-Immo.ci
        </span>
      </label>
      {erreur && (
        <p className={`${f.message} ${f.messageErreur}`} role="alert">
          <Icone nom="personne" taille={16} />
          {erreur}
        </p>
      )}
      <button type="submit" className={f.bouton} disabled={envoi}>
        <Icone nom="valide" taille={17} />
        {envoi ? "Création du compte…" : "Créer mon compte"}
      </button>
      <BoutonsSociaux texte="L'inscription avec" />
    </form>
  );
}

/** Numéros pour l'inscription (clés lues par la base : telephone, whatsapp, telephone2, whatsapp2, telephone2_type) */
function champsTelephonesPourInscription(t: Telephones) {
  const c = champsTelephones(t);
  return {
    telephone: c.telephone,
    whatsapp: c.telephone_whatsapp,
    ...(c.telephone2 ? { telephone2: c.telephone2, whatsapp2: c.telephone2_whatsapp, telephone2_type: c.telephone2_type } : {}),
  };
}

