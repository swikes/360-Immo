"use client";

/*
 * Barre du haut de toutes les pages : logo, liens du menu (lib/menu.ts), « Mon espace », « Publier ».
 * « Mon espace » mène à la connexion ; une fois connecté, il affiche les initiales de la personne et mène à
 * Mon Espace (sur téléphone : les initiales seules, dans la barre). Le menu ☰ affiche le nom, « Ma vitrine » et
 * « Se déconnecter ».
 * Sur téléphone et tablette, les liens passent dans le panneau ☰ qui glisse depuis la gauche.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { initiales, prenomDe, seDeconnecter, useCompte } from "@/lib/compte";
import { useSuiviCompteurs } from "@/lib/messages";
import { MENU_SITE, estActif, type LienMenu } from "@/lib/menu";
import Icone from "./Icone";
import s from "./BarreDuHaut.module.css";

export default function BarreDuHaut() {
  // Le choix Acheter / Louer (?tx=…) n'est connu qu'une fois la page ouverte : en attendant,
  // la barre s'affiche déjà, seul le lien actif de la liste des annonces attend.
  return (
    <Suspense fallback={<Barre tx={null} />}>
      <BarreAvecTransaction />
    </Suspense>
  );
}

function BarreAvecTransaction() {
  return <Barre tx={useSearchParams().get("tx")} />;
}

const LIEN_ACCUEIL: LienMenu = { texte: "Accueil", lien: "/" };

function Barre({ tx }: { tx: string | null }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLElement>(null);
  const fermerBtn = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { etat, utilisateur } = useCompte();
  const connecte = etat === "connecte";
  const { messages: nonLus, visites } = useSuiviCompteurs();
  const textesNonLus = connecte
    ? (nonLus > 0 ? `, ${nonLus} message${nonLus > 1 ? "s" : ""} non lu${nonLus > 1 ? "s" : ""}` : "") +
      (visites > 0 ? `, ${visites} visite${visites > 1 ? "s" : ""} à traiter` : "")
    : "";
  const total = nonLus + visites;
  const pastille = textesNonLus && <span className={s.pastille} aria-hidden="true">{total > 9 ? "9+" : total}</span>;
  const espace = connecte ? "/mon-espace" : "/connexion";
  const prenom = prenomDe(utilisateur);
  const nomComplet = [prenom, utilisateur?.user_metadata?.nom as string | undefined].filter(Boolean).join(" ");
  const avatar = connecte && (
    <span className={s.avatar} aria-hidden="true">
      {initiales(prenom || utilisateur?.email || "", (utilisateur?.user_metadata?.nom as string | undefined) ?? "")}
    </span>
  );
  const sortir = async () => {
    setOuvert(false);
    await seDeconnecter();
    router.push("/");
  };

  const fermer = useCallback(() => {
    setOuvert(false);
    if (panneau.current?.contains(document.activeElement)) bouton.current?.focus({ preventScroll: true });
  }, []);

  // Panneau ouvert : la page derrière ne défile plus ; Échap ou écran agrandi le referment
  useEffect(() => {
    if (!ouvert) return;
    fermerBtn.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    const touche = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    const ecran = window.matchMedia("(max-width: 900px)");
    const agrandi = () => !ecran.matches && fermer();
    document.addEventListener("keydown", touche);
    ecran.addEventListener("change", agrandi);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", touche);
      ecran.removeEventListener("change", agrandi);
    };
  }, [ouvert, fermer]);

  const lien = (entree: LienMenu, classe: string) => {
    const actif = estActif(entree.lien, chemin, tx);
    return (
      <Link
        key={entree.lien}
        href={entree.lien}
        className={[classe, entree.dore && s.dore, actif && s.actif].filter(Boolean).join(" ")}
        aria-current={actif ? "page" : undefined}
        onClick={() => setOuvert(false)}
      >
        {entree.texte}
      </Link>
    );
  };

  return (
    <>
      <nav className={s.barre} aria-label="Menu principal">
        <button
          ref={bouton}
          type="button"
          className={s.boutonMenu}
          aria-label="Ouvrir le menu"
          aria-controls="menuSite"
          aria-expanded={ouvert}
          onClick={() => setOuvert(true)}
        >
          <Icone nom="menu" taille={18} epaisseur={2.2} strokeLinecap="round" />
        </button>
        <Link href="/" className={`logo ${s.logo}`}>
          360<span>-Immo</span>.ci
        </Link>
        <ul className={s.liens}>
          {MENU_SITE.map((entree) => (
            <li key={entree.lien}>{lien(entree, s.lien)}</li>
          ))}
        </ul>
        <div className={s.boutons}>
          <Link
            href={espace}
            className={`${s.btnContour} ${s.monEspace} ${connecte ? s.connecte : ""}`}
            aria-current={chemin === espace ? "page" : undefined}
            title={connecte ? `Connecté : ${nomComplet || utilisateur?.email}` : undefined}
            aria-label={connecte ? `Mon espace (connecté : ${nomComplet || utilisateur?.email})${textesNonLus}` : undefined}
          >
            {avatar}
            <span className={s.texteEspace}>Mon espace</span>
            {pastille}
          </Link>
          <Link href="/publier" className={s.btnPlein} aria-current={chemin === "/publier" ? "page" : undefined}>
            <Icone nom="plus" taille={14} epaisseur={2.5} />
            <span>
              Publier<span className={s.long}> une annonce</span>
            </span>
          </Link>
        </div>
      </nav>

      {/* ── Panneau ☰ (téléphone et tablette) ── */}
      <div className={`${s.fond} ${ouvert ? s.ouvert : ""}`} onClick={fermer} aria-hidden="true" />
      <aside ref={panneau} id="menuSite" className={`${s.panneau} ${ouvert ? s.ouvert : ""}`} aria-label="Menu du site">
        <div className={s.panneauHaut}>
          <Link href="/" className="logo" onClick={() => setOuvert(false)}>
            360<span>-Immo</span>.ci
          </Link>
          <button ref={fermerBtn} type="button" className={s.fermer} aria-label="Fermer le menu" onClick={fermer}>
            &#215;
          </button>
        </div>
        <div className={s.panneauLiens}>{[LIEN_ACCUEIL, ...MENU_SITE].map((e) => lien(e, s.panneauLien))}</div>
        <div className={s.panneauBoutons}>
          {connecte && (
            <div className={s.identite}>
              {avatar}
              <span className={s.identiteTexte}>
                <span className={s.identiteEtat}>Connecté</span>
                <span className={s.identiteNom}>{nomComplet || utilisateur?.email}</span>
              </span>
            </div>
          )}
          <Link href={espace} className={`${s.btnContour} ${s.espacePanneau}`} onClick={() => setOuvert(false)}
            aria-label={textesNonLus ? `Mon espace${textesNonLus}` : undefined}>
            Mon espace
            {pastille}
          </Link>
          <Link href="/publier" className={s.btnPlein} onClick={() => setOuvert(false)}>
            Publier une annonce
          </Link>
          {connecte && (
            <Link href="/ma-vitrine" className={s.lienVitrine} onClick={() => setOuvert(false)}>
              <Icone nom="maison" taille={15} /> Ma vitrine
            </Link>
          )}
          {connecte && (
            <button type="button" className={s.deconnexion} onClick={sortir}>
              <Icone nom="sortie" taille={15} />
              Se déconnecter
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
