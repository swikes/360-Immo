"use client";

/*
 * Mon Espace (comme la maquette 360-immo-mon-espace.html) : réservé aux comptes connectés.
 *   Vue d'ensemble · Mon profil (nom, numéros, demande d'agence) · Paramètres (mot de passe, déconnexion)
 *   Annonces, favoris, messages, alertes, documents : affichés « bientôt » (étapes suivantes du plan).
 *   /mon-espace?section=profil ouvre directement le profil.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import {
  enregistrerProfil, initiales, lireProfil, messageErreur, prenomDe, seDeconnecter, useCompte, type Profil,
} from "@/lib/compte";
import BlocTelephones, { champsTelephones, erreurTelephones, telephonesDuProfil, type Telephones } from "./BlocTelephones";
import { ChampTexte } from "./Champs";
import f from "./Formulaire.module.css";
import p from "./Page.module.css";
import s from "./MonEspace.module.css";

type Section = "apercu" | "profil" | "parametres";
const SECTIONS: Section[] = ["apercu", "profil", "parametres"];

// Ce qui arrive aux étapes suivantes : visible, mais pas encore utilisable
const BIENTOT: { nom: string; icone: NomIcone; texte: string; groupe: string }[] = [
  { nom: "Mes annonces", icone: "document", texte: "Vos annonces, leurs vues et leurs contacts.", groupe: "Mes biens" },
  { nom: "Mes favoris", icone: "coeur", texte: "Les biens que vous avez mis de côté.", groupe: "Mes biens" },
  { nom: "Vérification", icone: "bouclier", texte: "Faire vérifier vos biens par l'équipe 360-Immo.ci.", groupe: "Mes biens" },
  { nom: "Messages", icone: "message", texte: "Vos échanges avec les personnes intéressées.", groupe: "Activité" },
  { nom: "Alertes de recherche", icone: "cloche", texte: "Être prévenu des nouvelles annonces qui vous intéressent.", groupe: "Activité" },
];

export default function MonEspace() {
  return (
    <Suspense fallback={<Espace section="apercu" />}>
      <EspaceAvecAdresse />
    </Suspense>
  );
}

function EspaceAvecAdresse() {
  const q = useSearchParams();
  const section = SECTIONS.find((x) => x === q.get("section")) ?? "apercu";
  return <Espace section={section} />;
}

function Espace({ section: sectionInitiale }: { section: Section }) {
  const { etat, utilisateur } = useCompte();
  const router = useRouter();
  const [section, setSection] = useState<Section>(sectionInitiale);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreurProfil, setErreurProfil] = useState("");
  const deconnexion = useRef(false);
  const id = utilisateur?.id;

  // Pas connecté : direction la connexion, avec retour ici ensuite
  useEffect(() => {
    if (etat === "anonyme" && !deconnexion.current) router.replace("/connexion?suite=/mon-espace");
  }, [etat, router]);

  useEffect(() => {
    if (!id) return;
    let actif = true;
    lireProfil(id).then(
      (pr) => actif && setProfil(pr),
      (e) => actif && setErreurProfil(messageErreur(e)),
    );
    return () => {
      actif = false;
    };
  }, [id]);

  const sortir = async () => {
    deconnexion.current = true;
    await seDeconnecter();
    router.replace("/");
  };

  if (etat !== "connecte" || !utilisateur) {
    return (
      <section className={p.page}>
        <div className={p.carte}>
          <h1 className={p.titre}>Mon espace</h1>
          {etat === "indisponible" ? (
            <p className={`${f.message} ${f.messageInfo}`}>
              <Icone nom="horloge" taille={16} />
              Les comptes ouvrent bientôt sur le nouveau site.
            </p>
          ) : etat === "anonyme" ? (
            <>
              <p className={p.attente}>Connectez-vous pour accéder à votre espace.</p>
              <Link href="/connexion?suite=/mon-espace" className={f.bouton}>
                Se connecter
              </Link>
            </>
          ) : (
            <p className={p.attente}>Chargement de votre espace…</p>
          )}
        </div>
      </section>
    );
  }

  const prenom = prenomDe(utilisateur, profil);
  const nom = profil?.nom ?? (utilisateur.user_metadata?.nom as string | undefined) ?? "";
  const lienMenu = (x: Section, texte: string, icone: NomIcone) => (
    <button
      type="button"
      className={`${s.lien} ${section === x ? s.lienActif : ""}`}
      aria-current={section === x ? "page" : undefined}
      onClick={() => setSection(x)}
    >
      <Icone nom={icone} taille={17} />
      {texte}
    </button>
  );
  const groupes = [...new Set(BIENTOT.map((b) => b.groupe))];

  return (
    <div className={s.espace}>
      <aside className={s.cote}>
        <div className={s.identite}>
          <span className={s.avatar} aria-hidden="true">
            {initiales(prenom, nom)}
          </span>
          <div className={s.identiteTexte}>
            <span className={s.nom}>{[prenom, nom].filter(Boolean).join(" ") || utilisateur.email}</span>
            <Statut profil={profil} />
          </div>
        </div>
        <nav className={s.menu} aria-label="Mon espace">
          <span className={s.groupe}>Tableau de bord</span>
          {lienMenu("apercu", "Vue d'ensemble", "grille")}
          {groupes.map((g) => (
            <div key={g} className={s.bientotGroupe}>
              <span className={s.groupe}>{g}</span>
              {BIENTOT.filter((b) => b.groupe === g).map((b) => (
                <span key={b.nom} className={`${s.lien} ${s.lienBientot}`} aria-disabled="true">
                  <Icone nom={b.icone} taille={17} />
                  {b.nom}
                  <span className={f.bientot}>Bientôt</span>
                </span>
              ))}
            </div>
          ))}
          <span className={s.groupe}>Compte</span>
          {lienMenu("profil", "Mon profil", "personne")}
          {lienMenu("parametres", "Paramètres", "cadenas")}
          <button type="button" className={`${s.lien} ${s.sortie}`} onClick={sortir}>
            <Icone nom="sortie" taille={17} />
            Se déconnecter
          </button>
        </nav>
      </aside>

      <div className={s.contenu}>
        {erreurProfil && (
          <p className={`${f.message} ${f.messageErreur}`} role="alert">
            <Icone nom="personne" taille={16} />
            Votre profil n&apos;a pas pu être chargé : {erreurProfil}
          </p>
        )}
        {section === "apercu" && (
          <Apercu prenom={prenom} profil={profil} versProfil={() => setSection("profil")} />
        )}
        {section === "profil" &&
          (profil ? (
            <>
              <Entete surtitre="Compte" titre="Mon profil" texte="Ces informations aident les visiteurs à vous contacter." />
              <FormulaireProfil profil={profil} email={utilisateur.email ?? ""} enregistre={setProfil} />
              <DemandeAgence profil={profil} enregistre={setProfil} />
            </>
          ) : (
            !erreurProfil && <p className={p.attente}>Chargement du profil…</p>
          ))}
        {section === "parametres" && (
          <>
            <Entete surtitre="Compte" titre="Paramètres" />
            <div className={s.carte}>
              <h2 className={s.carteTitre}>Connexion</h2>
              <p className={s.carteTexte}>
                E-mail du compte : <strong>{utilisateur.email}</strong>
              </p>
              <div className={s.boutons}>
                <Link href="/mot-de-passe" className={f.boutonContour}>
                  <Icone nom="cadenas" taille={15} />
                  Changer mon mot de passe
                </Link>
                <button type="button" className={f.boutonContour} onClick={sortir}>
                  <Icone nom="sortie" taille={15} />
                  Se déconnecter
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Entete({ surtitre, titre, texte }: { surtitre: string; titre: ReactNode; texte?: string }) {
  return (
    <div className={s.entete}>
      <span className={s.surtitre}>{surtitre}</span>
      <h1 className={s.titre}>{titre}</h1>
      {texte && <p className={s.sousTitre}>{texte}</p>}
    </div>
  );
}

function Statut({ profil }: { profil: Profil | null }) {
  if (!profil) return null;
  const [texte, classe] =
    profil.role === "admin" ? ["Équipe 360-Immo.ci", s.statutEquipe]
    : profil.role === "agence" ? ["Agence", s.statutAgence]
    : profil.demande_agence ? ["Agence en attente", s.statutAttente]
    : ["Particulier", ""];
  return <span className={`${s.statut} ${classe}`}>{texte}</span>;
}

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function Apercu({ prenom, profil, versProfil }: { prenom: string; profil: Profil | null; versProfil: () => void }) {
  return (
    <>
      <Entete surtitre="Tableau de bord" titre={`Bonjour${prenom ? ", " + prenom : ""} 👋`} texte="Bienvenue dans votre espace 360-Immo.ci." />
      {profil && !profil.telephone && (
        <p className={`${f.message} ${f.messageInfo}`}>
          <Icone nom="telephone" taille={16} />
          <span>
            Ajoutez votre numéro de téléphone : les visiteurs en ont besoin pour vous contacter.{" "}
            <button type="button" className={f.lien} onClick={versProfil}>
              Compléter mon profil
            </button>
          </span>
        </p>
      )}
      {profil?.demande_agence && profil.role === "particulier" && (
        <p className={`${f.message} ${f.messageInfo}`}>
          <Icone nom="horloge" taille={16} />
          Votre demande de compte agence pour « {profil.demande_agence} » est en cours de vérification par l&apos;équipe
          360-Immo.ci.
        </p>
      )}
      <div className={s.cartes}>
        <Link href="/publier" className={`${s.action} ${s.actionPrincipale}`}>
          <Icone nom="plus" taille={20} epaisseur={2.5} />
          <span className={s.actionTitre}>Publier une annonce</span>
          <span className={s.actionTexte}>Vente ou location : quelques minutes suffisent.</span>
        </Link>
        <button type="button" className={s.action} onClick={versProfil}>
          <Icone nom="personne" taille={20} />
          <span className={s.actionTitre}>Mon profil</span>
          <span className={s.actionTexte}>Nom, numéros de téléphone et WhatsApp.</span>
        </button>
        {BIENTOT.map((b) => (
          <div key={b.nom} className={`${s.action} ${s.actionBientot}`}>
            <Icone nom={b.icone} taille={20} />
            <span className={s.actionTitre}>
              {b.nom} <span className={f.bientot}>Bientôt</span>
            </span>
            <span className={s.actionTexte}>{b.texte}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function FormulaireProfil({ profil, email, enregistre }: { profil: Profil; email: string; enregistre: (p: Profil) => void }) {
  const [prenom, setPrenom] = useState(profil.prenom);
  const [nom, setNom] = useState(profil.nom);
  const [tels, setTels] = useState<Telephones>(() => telephonesDuProfil(profil));
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({});
  const [erreur, setErreur] = useState("");
  const [reussi, setReussi] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const err = {
      prenom: prenom.trim() ? undefined : "Indiquez votre prénom.",
      nom: nom.trim() ? undefined : "Indiquez votre nom.",
      tels: erreurTelephones(tels) || undefined,
    };
    setErreurs(err);
    setErreur("");
    setReussi(false);
    if (err.prenom || err.nom || err.tels) return;
    setEnvoi(true);
    try {
      enregistre(await enregistrerProfil(profil.id, { prenom: prenom.trim(), nom: nom.trim(), ...champsTelephones(tels) }));
      setReussi(true);
    } catch (ex) {
      setErreur(messageErreur(ex));
    }
    setEnvoi(false);
  };

  return (
    <form className={`${s.carte} ${f.formulaire}`} onSubmit={envoyer} noValidate>
      <div className={f.deuxColonnes}>
        <ChampTexte etiquette="Prénom" icone="personne" autoComplete="given-name" valeur={prenom} onChange={setPrenom} erreur={erreurs.prenom} obligatoire />
        <ChampTexte etiquette="Nom" icone="personne" autoComplete="family-name" valeur={nom} onChange={setNom} erreur={erreurs.nom} obligatoire />
      </div>
      <ChampTexte etiquette="E-mail" icone="email" valeur={email} onChange={() => {}} readOnly aide="L'e-mail sert à vous connecter ; il n'est pas affiché sur vos annonces." />
      <BlocTelephones
        valeur={tels}
        onChange={(t) => {
          setTels(t);
          setReussi(false);
        }}
        erreur={erreurs.tels}
      />
      {erreur && (
        <p className={`${f.message} ${f.messageErreur}`} role="alert">
          <Icone nom="personne" taille={16} />
          {erreur}
        </p>
      )}
      {reussi && (
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="valide" taille={16} />
          Profil enregistré.
        </p>
      )}
      <button type="submit" className={f.bouton} disabled={envoi}>
        {envoi ? "Enregistrement…" : "Enregistrer mon profil"}
      </button>
    </form>
  );
}

function DemandeAgence({ profil, enregistre }: { profil: Profil; enregistre: (p: Profil) => void }) {
  const [nomAgence, setNomAgence] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  if (profil.role !== "particulier") return null;

  const changer = async (demande: string | null) => {
    if (demande !== null && demande.trim().length < 2) return setErreur("Indiquez le nom de votre agence.");
    setEnvoi(true);
    setErreur("");
    try {
      enregistre(await enregistrerProfil(profil.id, { demande_agence: demande?.trim() ?? null }));
      setNomAgence("");
    } catch (ex) {
      setErreur(messageErreur(ex));
    }
    setEnvoi(false);
  };

  return (
    <section className={s.carte} aria-labelledby="titre-agence">
      <h2 id="titre-agence" className={s.carteTitre}>
        Compte agence
      </h2>
      {profil.demande_agence ? (
        <>
          <p className={s.carteTexte}>
            Demande envoyée pour <strong>« {profil.demande_agence} »</strong>
            {profil.demande_agence_le && <> le {dateFr(profil.demande_agence_le)}</>}. L&apos;équipe 360-Immo.ci la
            vérifie et vous contactera.
          </p>
          <div className={s.boutons}>
            <button type="button" className={f.boutonContour} disabled={envoi} onClick={() => changer(null)}>
              Retirer ma demande
            </button>
          </div>
        </>
      ) : (
        <form
          className={f.formulaire}
          onSubmit={(e) => {
            e.preventDefault();
            changer(nomAgence);
          }}
          noValidate
        >
          <p className={s.carteTexte}>
            Vous êtes une agence immobilière ? Donnez son nom : l&apos;équipe 360-Immo.ci la vérifie avant de
            l&apos;afficher comme telle.
          </p>
          <ChampTexte etiquette="Nom de l'agence" icone="maison" autoComplete="organization" placeholder="Ex : Kamika Immobilier" valeur={nomAgence} onChange={setNomAgence} erreur={erreur} />
          <div className={s.boutons}>
            <button type="submit" className={f.boutonContour} disabled={envoi}>
              <Icone nom="maison" taille={15} />
              Demander un compte agence
            </button>
          </div>
        </form>
      )}
      {erreur && profil.demande_agence && <p className={f.erreur}>{erreur}</p>}
    </section>
  );
}
