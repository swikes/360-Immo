"use client";

/*
 * Lien « Arrêter cette alerte » des e-mails (/alertes/arreter?jeton=…) : sans connexion. On confirme d'un bouton
 * (les messageries qui ouvrent les liens toutes seules n'arrêtent ainsi rien par erreur). L'alerte reste dans
 * Mon Espace → Alertes de recherche, en pause : on peut la réactiver.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Icone from "@/components/Icone";
import { alerteParJeton, arreterAlerte } from "@/lib/alertes";
import { messageErreur } from "@/lib/compte";
import f from "./Formulaire.module.css";
import p from "./Page.module.css";

type Etat = { etape: "lecture" } | { etape: "inconnue" } | { etape: "erreur"; texte: string }
  | { etape: "question" | "arretee" | "deja"; nom: string };

export default function ArreterAlerte() {
  return (
    <section className={p.page}>
      <div className={p.carte}>
        <span className={p.surtitre}>Alertes de recherche</span>
        <h1 className={p.titre}>Arrêter une alerte</h1>
        <Suspense fallback={<p className={p.attente}>Un instant…</p>}>
          <Contenu />
        </Suspense>
      </div>
    </section>
  );
}

function Contenu() {
  const jeton = useSearchParams().get("jeton") ?? "";
  const [etat, setEtat] = useState<Etat>({ etape: "lecture" });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    const lecture = jeton ? alerteParJeton(jeton) : Promise.resolve(null);
    lecture.then(
      (a) => actif && setEtat(!a ? { etape: "inconnue" } : { etape: a.active ? "question" : "deja", nom: a.nom }),
      (e) => actif && setEtat({ etape: "erreur", texte: messageErreur(e) }),
    );
    return () => {
      actif = false;
    };
  }, [jeton]);

  const arreter = async (nom: string) => {
    setEnvoi(true);
    try {
      setEtat((await arreterAlerte(jeton)) ? { etape: "arretee", nom } : { etape: "inconnue" });
    } catch (e) {
      setEtat({ etape: "erreur", texte: messageErreur(e) });
    }
    setEnvoi(false);
  };

  const gerer = (
    <Link href="/mon-espace?section=alertes" className={f.boutonContour}>
      <Icone nom="cloche" taille={15} /> Gérer mes alertes
    </Link>
  );
  switch (etat.etape) {
    case "lecture":
      return <p className={p.attente}>Un instant…</p>;
    case "inconnue":
      return (
        <>
          <p className={`${f.message} ${f.messageInfo}`}>
            <Icone nom="cloche" taille={16} />
            Ce lien n&apos;est plus valable : l&apos;alerte a peut-être été supprimée.
          </p>
          {gerer}
        </>
      );
    case "erreur":
      return (
        <p className={`${f.message} ${f.messageErreur}`} role="alert">
          <Icone nom="cloche" taille={16} />
          {etat.texte}
        </p>
      );
    case "question":
      return (
        <>
          <p className={p.attente}>
            Vous ne recevrez plus d&apos;e-mails pour l&apos;alerte <strong>« {etat.nom} »</strong>. Vous pourrez la réactiver
            depuis votre espace.
          </p>
          <button type="button" className={f.bouton} disabled={envoi} onClick={() => arreter(etat.nom)}>
            {envoi ? "Un instant…" : "Arrêter cette alerte"}
          </button>
        </>
      );
    default:
      return (
        <>
          <p className={`${f.message} ${f.messageSucces}`} role="status">
            <Icone nom="valide" taille={16} />
            {etat.etape === "deja" ? `L'alerte « ${etat.nom} » est déjà arrêtée.` : `C'est fait : l'alerte « ${etat.nom} » est arrêtée.`}
          </p>
          {gerer}
        </>
      );
  }
}
