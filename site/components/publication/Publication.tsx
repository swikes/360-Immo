"use client";

/*
 * Page /publier : publier une annonce (compte obligatoire).
 *   /publier                → nouvelle annonce
 *   /publier?annonce=<id>   → modifier une de ses annonces (depuis Mon Espace → Mes annonces)
 * Sans compte : on explique et on propose de se connecter ou de s'inscrire, avec retour ici ensuite.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Icone from "@/components/Icone";
import { lireAnnonce, type Annonce } from "@/lib/annonces";
import { lireProfil, messageErreur, useCompte, type Profil } from "@/lib/compte";
import Formulaire from "./Formulaire";
import p from "@/components/compte/Page.module.css";
import f from "@/components/compte/Formulaire.module.css";

export default function Publication() {
  return (
    <Suspense fallback={<Page annonceId={null} />}>
      <PageAvecAdresse />
    </Suspense>
  );
}

function PageAvecAdresse() {
  return <Page annonceId={useSearchParams().get("annonce")} />;
}

function Carte({ children }: { children: ReactNode }) {
  return (
    <section className={p.page}>
      <div className={p.carte}>{children}</div>
    </section>
  );
}

function Page({ annonceId }: { annonceId: string | null }) {
  const { etat, utilisateur } = useCompte();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoyee, setEnvoyee] = useState<Annonce | null>(null);
  const [cle, setCle] = useState(0); // « Publier une autre annonce » : formulaire vide
  // Annonce que le formulaire affiché vient d'enregistrer : l'adresse passe à ?annonce=<id>, rien à recharger
  const [dejaLa, setDejaLa] = useState<string | null>(null);
  const id = utilisateur?.id;

  useEffect(() => {
    if (!id) return;
    let actif = true;
    lireProfil(id).then((pr) => actif && setProfil(pr), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !annonceId || annonceId === dejaLa) return;
    let actif = true;
    lireAnnonce(annonceId).then(
      (a) => {
        if (!actif) return;
        if (!a || a.auteur_id !== id) setErreur("Cette annonce n'est pas à vous.");
        else setAnnonce(a);
      },
      (e) => actif && setErreur(messageErreur(e)),
    );
    return () => {
      actif = false;
    };
  }, [id, annonceId, dejaLa]);

  // Annonce envoyée : le message remplace le formulaire, on le montre depuis le haut (bouton tout en bas sur téléphone)
  useEffect(() => {
    if (envoyee) window.scrollTo({ top: 0, behavior: "instant" });
  }, [envoyee]);

  const suite = encodeURIComponent(annonceId ? `/publier?annonce=${annonceId}` : "/publier");

  if (etat === "indisponible" || etat === "anonyme") {
    return (
      <Carte>
        <span className={p.surtitre}>Vente ou location</span>
        <h1 className={p.titre}>Publier une annonce</h1>
        {etat === "indisponible" ? (
          <p className={`${f.message} ${f.messageInfo}`}>
            <Icone nom="horloge" taille={16} /> La publication ouvre bientôt sur le nouveau site.
          </p>
        ) : (
          <>
            <p className={p.attente}>
              Pour publier une annonce, connectez-vous ou créez votre compte gratuitement : vous suivrez ensuite vos
              annonces et les contacts reçus depuis Mon Espace.
            </p>
            <Link href={`/connexion?suite=${suite}`} className={f.bouton}>
              <Icone nom="entree" taille={17} /> Se connecter
            </Link>
            <Link href={`/connexion?mode=inscription&suite=${suite}`} className={f.boutonContour}>
              Créer un compte gratuitement
            </Link>
          </>
        )}
      </Carte>
    );
  }

  if (erreur) {
    return (
      <Carte>
        <h1 className={p.titre}>Publier une annonce</h1>
        <p className={`${f.message} ${f.messageErreur}`} role="alert">
          <Icone nom="cadenas" taille={16} /> {erreur}
        </p>
        <Link href="/mon-espace?section=annonces" className={f.boutonContour}>Mes annonces</Link>
      </Carte>
    );
  }

  if (envoyee) {
    return (
      <Carte>
        <span className={p.surtitre}>Réf. {envoyee.reference}</span>
        <h1 className={p.titre}>Annonce envoyée !</h1>
        <p className={`${f.message} ${f.messageSucces}`} role="status">
          <Icone nom="valide" taille={16} />
          <span>
            L&apos;équipe 360-Immo.ci vérifie votre annonce « {envoyee.titre} » avant de la publier. Vous la suivez
            dans Mon Espace → Mes annonces. Une fois publiée, elle reste en ligne 90 jours, renouvelables.
          </span>
        </p>
        <Link href="/mon-espace?section=annonces" className={f.bouton}>Voir mes annonces</Link>
        <button type="button" className={f.boutonContour} onClick={() => {
          setEnvoyee(null);
          setAnnonce(null);
          setDejaLa(null);
          setCle((c) => c + 1);
          window.history.replaceState(null, "", "/publier");
        }}>
          Publier une autre annonce
        </button>
      </Carte>
    );
  }

  if (etat !== "connecte" || !utilisateur || !profil || (annonceId && annonceId !== dejaLa && !annonce)) {
    return (
      <Carte>
        <h1 className={p.titre}>Publier une annonce</h1>
        <p className={p.attente}>Chargement…</p>
      </Carte>
    );
  }

  return (
    <Formulaire
      key={`${annonce?.id ?? "nouvelle"}-${cle}`}
      profil={profil}
      email={utilisateur.email ?? ""}
      annonce={annonce ?? undefined}
      enregistree={setDejaLa}
      envoyee={setEnvoyee}
    />
  );
}
