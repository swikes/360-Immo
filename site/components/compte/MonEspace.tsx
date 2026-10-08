"use client";

/*
 * Mon Espace (comme la maquette 360-immo-mon-espace.html) : réservé aux comptes connectés.
 *   Vue d'ensemble · Mes annonces · Statistiques · Mes favoris · Messages · Visites · Rappels · Alertes de recherche · Mon profil (nom, numéros,
 *   demande d'agence) · Paramètres (e-mails souhaités, mot de passe, déconnexion). Vérification : affichée « bientôt ».
 *   /mon-espace?section=profil (ou annonces, statistiques, favoris, messages, visites, rappels, alertes, parametres) ouvre directement cette
 *   partie ;
 *   /mon-espace?section=messages&conversation=… ouvre une conversation.
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
import MesAlertes from "./MesAlertes";
import MesAnnonces from "./MesAnnonces";
import MesFavoris from "./MesFavoris";
import Messages from "./Messages";
import Rappels from "./Rappels";
import Statistiques from "./Statistiques";
import Visites from "./Visites";
import { useFavoris } from "@/lib/favoris";
import { useCompteurs } from "@/lib/messages";
import f from "./Formulaire.module.css";
import p from "./Page.module.css";
import s from "./MonEspace.module.css";

type Section = "apercu" | "annonces" | "statistiques" | "favoris" | "messages" | "visites" | "rappels" | "alertes" | "profil" | "parametres";
const SECTIONS: Section[] = ["apercu", "annonces", "statistiques", "favoris", "messages", "visites", "rappels", "alertes", "profil", "parametres"];

// Ce qui arrive aux étapes suivantes : visible, mais pas encore utilisable
const BIENTOT: { nom: string; icone: NomIcone; texte: string; groupe: string }[] = [
  { nom: "Vérification", icone: "bouclier", texte: "Faire vérifier vos biens par l'équipe 360-Immo.ci.", groupe: "Mes biens" },
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
  return <Espace section={section} conversation={q.get("conversation")} annonce={q.get("annonce")} />;
}

function Espace({ section: sectionInitiale, conversation = null, annonce = null }: {
  section: Section; conversation?: string | null; annonce?: string | null;
}) {
  const { etat, utilisateur } = useCompte();
  const router = useRouter();
  const [section, setSection] = useState<Section>(sectionInitiale);
  /** Statistiques : l'annonce choisie depuis Mes annonces */
  const [annonceStats, setAnnonceStats] = useState<string | null>(annonce);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreurProfil, setErreurProfil] = useState("");
  const deconnexion = useRef(false);
  const id = utilisateur?.id;
  const favoris = useFavoris().ids.length;
  const { messages: nonLus, visites, rappels, moderation } = useCompteurs();

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
  const lienMenu = (x: Section, texte: string, icone: NomIcone, extra?: ReactNode) => (
    <button
      type="button"
      className={`${s.lien} ${section === x ? s.lienActif : ""}`}
      aria-current={section === x ? "page" : undefined}
      onClick={() => setSection(x)}
    >
      <Icone nom={icone} taille={17} />
      {texte}
      {extra}
    </button>
  );
  const bientot = (groupe: string) => (
    <div className={s.bientotGroupe}>
      {BIENTOT.filter((b) => b.groupe === groupe).map((b) => (
        <span key={b.nom} className={`${s.lien} ${s.lienBientot}`} aria-disabled="true">
          <Icone nom={b.icone} taille={17} />
          {b.nom}
          <span className={f.bientot}>Bientôt</span>
        </span>
      ))}
    </div>
  );

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
          <span className={s.groupe}>Mes biens</span>
          {lienMenu("annonces", "Mes annonces", "document")}
          {lienMenu("statistiques", "Statistiques", "statistiques")}
          <Link href="/ma-vitrine" className={s.lien}>
            <Icone nom="maison" taille={17} />
            Ma vitrine
          </Link>
          {lienMenu("favoris", "Mes favoris", "coeur", favoris > 0 && <span className={s.compteur}>{favoris}</span>)}
          {bientot("Mes biens")}
          <span className={s.groupe}>Activité</span>
          {lienMenu("messages", "Messages", "message",
            nonLus > 0 && <span className={s.pastille} aria-label={`${nonLus} non lu${nonLus > 1 ? "s" : ""}`}>{nonLus}</span>)}
          {lienMenu("visites", "Visites", "calendrier",
            visites > 0 && <span className={s.pastille} aria-label={`${visites} à traiter`}>{visites}</span>)}
          {lienMenu("rappels", "Rappels", "telephone",
            rappels > 0 && <span className={s.pastille} aria-label={`${rappels} à faire`}>{rappels}</span>)}
          {lienMenu("alertes", "Alertes de recherche", "cloche")}
          {profil?.role === "admin" && (
            <>
              <span className={s.groupe}>Équipe 360-Immo.ci</span>
              <Link href="/admin" className={s.lien}>
                <Icone nom="bouclier" taille={17} />
                Administration
                {moderation > 0 && <span className={s.pastille} aria-label={`${moderation} à traiter`}>{moderation}</span>}
              </Link>
            </>
          )}
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
        {profil?.suspendu_le && (
          <p className={`${f.message} ${f.messageErreur}`} role="alert">
            <Icone nom="cadenas" taille={16} />
            <span>
              <strong>Votre compte est suspendu</strong> par l&apos;équipe 360-Immo.ci depuis le {dateFr(profil.suspendu_le)}
              {profil.suspension_motif ? ` : ${profil.suspension_motif}` : "."} Vos annonces ne sont plus visibles, et vous ne
              pouvez plus en publier, écrire aux annonceurs ni demander de visite. Si c&apos;est une erreur, répondez à
              l&apos;e-mail reçu.
            </span>
          </p>
        )}
        {section === "apercu" && (
          <Apercu prenom={prenom} profil={profil} favoris={favoris} nonLus={nonLus} visites={visites} rappels={rappels} aller={setSection} />
        )}
        {section === "annonces" && (
          <>
            <Entete surtitre="Mes biens" titre="Mes annonces" texte="Suivez vos annonces : vérification, mise en ligne, 90 jours de validité." />
            <MesAnnonces auteur={utilisateur.id} codeVitrine={profil?.code_vitrine ?? null}
              statistiques={(id) => {
                setAnnonceStats(id);
                setSection("statistiques");
                window.scrollTo(0, 0);
              }} />
          </>
        )}
        {section === "statistiques" && (
          <>
            <Entete surtitre="Mes biens" titre="Statistiques"
              texte="Ce que deviennent vos annonces : vues, contacts, favoris, prix comparé aux annonces semblables, et des conseils." />
            <Statistiques annonce={annonceStats} />
          </>
        )}
        {section === "favoris" && (
          <>
            <Entete surtitre="Mes biens" titre="Mes favoris" texte="Les annonces que vous avez mises de côté, sur tous vos appareils." />
            <MesFavoris />
          </>
        )}
        {section === "messages" && (
          <>
            <Entete surtitre="Activité" titre="Messages" texte="Vos échanges avec les annonceurs et les personnes intéressées par vos annonces." />
            <Messages moi={utilisateur.id} conversation={conversation} />
          </>
        )}
        {section === "visites" && (
          <>
            <Entete surtitre="Activité" titre="Visites" texte="Les demandes de visite reçues pour vos annonces et celles que vous avez envoyées." />
            <Visites />
          </>
        )}
        {section === "rappels" && (
          <>
            <Entete surtitre="Activité" titre="Rappels" texte="Les personnes qui demandent à être rappelées pour vos annonces, et vos propres demandes." />
            <Rappels />
          </>
        )}
        {section === "alertes" && (
          <>
            <Entete surtitre="Activité" titre="Alertes de recherche" texte="Les nouvelles annonces de vos recherches, par e-mail. Créez une alerte depuis la liste des annonces." />
            <MesAlertes email={utilisateur.email ?? ""} />
          </>
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
            {profil && <EmailsSouhaites profil={profil} email={utilisateur.email ?? ""} enregistre={setProfil} />}
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

function Apercu(props: {
  prenom: string; profil: Profil | null; favoris: number; nonLus: number; visites: number; rappels: number; aller: (s: Section) => void;
}) {
  const { prenom, profil, favoris, nonLus, visites, rappels, aller } = props;
  const versProfil = () => aller("profil");
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
        <button type="button" className={s.action} onClick={() => aller("annonces")}>
          <Icone nom="document" taille={20} />
          <span className={s.actionTitre}>Mes annonces</span>
          <span className={s.actionTexte}>Brouillons, annonces en vérification et en ligne.</span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("statistiques")}>
          <Icone nom="statistiques" taille={20} />
          <span className={s.actionTitre}>Statistiques</span>
          <span className={s.actionTexte}>Vues, contacts et conseils pour chacune de vos annonces.</span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("messages")}>
          <Icone nom="message" taille={20} />
          <span className={s.actionTitre}>
            Messages {nonLus > 0 && <span className={s.pastille}>{nonLus}</span>}
          </span>
          <span className={s.actionTexte}>
            {nonLus ? `${nonLus} message${nonLus > 1 ? "s" : ""} non lu${nonLus > 1 ? "s" : ""}.` : "Vos échanges avec les annonceurs et les personnes intéressées."}
          </span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("visites")}>
          <Icone nom="calendrier" taille={20} />
          <span className={s.actionTitre}>
            Visites {visites > 0 && <span className={s.pastille}>{visites}</span>}
          </span>
          <span className={s.actionTexte}>
            {visites ? `${visites} visite${visites > 1 ? "s" : ""} à traiter.` : "Les demandes de visite, reçues et envoyées."}
          </span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("rappels")}>
          <Icone nom="telephone" taille={20} />
          <span className={s.actionTitre}>
            Rappels {rappels > 0 && <span className={s.pastille}>{rappels}</span>}
          </span>
          <span className={s.actionTexte}>
            {rappels ? `${rappels} personne${rappels > 1 ? "s" : ""} à rappeler.` : "Les personnes qui demandent à être rappelées."}
          </span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("alertes")}>
          <Icone nom="cloche" taille={20} />
          <span className={s.actionTitre}>Alertes de recherche</span>
          <span className={s.actionTexte}>Recevez par e-mail les nouvelles annonces de vos recherches.</span>
        </button>
        <button type="button" className={s.action} onClick={() => aller("favoris")}>
          <Icone nom="coeur" taille={20} />
          <span className={s.actionTitre}>Mes favoris</span>
          <span className={s.actionTexte}>
            {favoris ? `${favoris} bien${favoris > 1 ? "s" : ""} mis de côté.` : "Touchez le cœur d'une annonce pour la mettre de côté."}
          </span>
        </button>
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

/** Paramètres → E-mails : ce que le compte veut recevoir (enregistré aussitôt) */
function EmailsSouhaites({ profil, email, enregistre }: { profil: Profil; email: string; enregistre: (p: Profil) => void }) {
  const [envoi, setEnvoi] = useState(false);
  const [etat, setEtat] = useState<"" | "ok" | string>("");
  const choix: { cle: "emails_messages" | "emails_visites" | "emails_annonces"; texte: string; aide: string }[] = [
    { cle: "emails_messages", texte: "Nouveaux messages", aide: "Un e-mail par conversation et par heure au plus, si vous ne l'avez pas déjà lu." },
    { cle: "emails_visites", texte: "Demandes de visite, de rappel et réponses", aide: "Quand on demande à visiter votre bien ou à être rappelé, et quand on répond à vos demandes de visite." },
    { cle: "emails_annonces", texte: "Mes annonces : vérification et fin prochaine", aide: "Annonce mise en ligne ou refusée par l'équipe, et 3 jours avant la fin des 90 jours pour la renouveler." },
  ];
  const changer = async (cle: (typeof choix)[number]["cle"], valeur: boolean) => {
    setEnvoi(true);
    setEtat("");
    try {
      enregistre(await enregistrerProfil(profil.id, { [cle]: valeur }));
      setEtat("ok");
    } catch (e) {
      setEtat(messageErreur(e));
    }
    setEnvoi(false);
  };
  return (
    <section className={s.carte} aria-labelledby="titre-emails">
      <h2 id="titre-emails" className={s.carteTitre}>E-mails</h2>
      <p className={s.carteTexte}>
        Envoyés à <strong>{email}</strong>. Les alertes de recherche se règlent une à une, dans « Alertes de recherche ».
      </p>
      <div className={f.formulaire}>
        {choix.map((c) => (
          <label key={c.cle} className={f.case}>
            <input type="checkbox" checked={profil[c.cle] !== false} disabled={envoi} onChange={(e) => changer(c.cle, e.target.checked)} />
            <span>
              <strong>{c.texte}</strong>
              <br />
              <span className={f.aide}>{c.aide}</span>
            </span>
          </label>
        ))}
      </div>
      {etat === "ok" && (
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="valide" taille={16} />
          Choix enregistré.
        </p>
      )}
      {etat && etat !== "ok" && <p className={`${f.message} ${f.messageErreur}`} role="alert">{etat}</p>}
    </section>
  );
}
