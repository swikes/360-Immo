"use client";

/*
 * Administration → Pages du site : les pages du pied de page (à propos, aide, devenir partenaire, mentions légales, CGU,
 * confidentialité, cookies ; supabase/migrations/…_pages_contact.sql).
 *   Liste       état de chaque page (publiée, brouillon, passages « [à compléter] », notes) ; Modifier, Voir la page
 *   Éditeur     titre, résumé (affiché sous le titre et dans Google), texte avec les boutons de mise en forme, notes de
 *               l'équipe (jamais publiées) ; Aperçu ; Publier, Retirer du site. Une page qui contient encore
 *               « [à compléter] » ne peut pas être publiée ; s'il reste des notes, la publication demande confirmation.
 * Page Aide : chaque sous-titre (###) devient une question qui s'ouvre au toucher.
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import TexteArticle from "@/components/blog/TexteArticle";
import Icone from "@/components/Icone";
import { lireTexte, RESUME_MAX } from "@/lib/blog";
import { messageErreur } from "@/lib/compte";
import { enregistrerPage, pagesAdmin, publierPage, type PageAEnregistrer } from "@/lib/pages-admin";
import { PAGES_SITE, lienPage, resteACompleter, type PageAdmin } from "@/lib/pages-site";
import { rafraichirPages } from "@/lib/rafraichir";
import { dateHeure } from "./outils";
import ZoneTexte from "./ZoneTexte";
import s from "./Admin.module.css";
import b from "./Blog.module.css";

export default function PagesSite() {
  const [pages, setPages] = useState<PageAdmin[] | null>(null);
  const [ouverte, setOuverte] = useState<PageAdmin | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(() => pagesAdmin().then(setPages, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    pagesAdmin().then((p) => actif && setPages(p), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  if (ouverte) {
    return (
      <EditeurPage key={ouverte.slug} page={ouverte} fermer={() => {
        setOuverte(null);
        void charger();
        window.scrollTo({ top: 0 });
      }} />
    );
  }
  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!pages) return <p className={s.attente}>Chargement des pages…</p>;
  return (
    <div className={s.liste}>
      <p className={s.aide}>
        Les pages du pied de page. Tant qu&apos;une page n&apos;est pas publiée, son lien affiche « Page bientôt disponible ».
        Les pages légales sont à faire valider par un juriste ; remplacez chaque « [à compléter] » (nom de la société,
        adresse…) avant de les publier.
      </p>
      <ul className={s.cartes}>
        {pages.map((p) => (
          <li key={p.slug} className={s.carte} aria-labelledby={`page-${p.slug}`}>
            <div className={s.badges}>
              <span className={`${s.badge} ${p.statut === "publie" ? s.badgeOk : ""}`}>{p.statut === "publie" ? "Publiée" : "Brouillon"}</span>
              {PAGES_SITE[p.slug].legale && <span className={s.badge}>Page légale</span>}
              {p.a_completer && <span className={`${s.badge} ${s.badgeAlerte}`}>Passages à compléter</span>}
              {p.notes && <span className={`${s.badge} ${s.badgeInfo}`}>Notes de l&apos;équipe</span>}
            </div>
            <h3 id={`page-${p.slug}`} className={s.carteTitre}>{p.titre}</h3>
            <p className={s.meta}>
              {lienPage(p.slug)} · Modifiée le {dateHeure(p.modifie_le)}{p.modifie_par ? ` par ${p.modifie_par}` : ""}
            </p>
            <div className={s.actions}>
              <button type="button" className={s.boutonContour} onClick={() => setOuverte(p)}>
                <Icone nom="document" taille={16} /> Modifier
              </button>
              {p.statut === "publie" && (
                <Link href={lienPage(p.slug)} className={s.boutonContour} target="_blank"><Icone nom="voir" taille={16} /> Voir la page</Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const champsDe = (p: PageAdmin): PageAEnregistrer => ({ slug: p.slug, titre: p.titre, resume: p.resume, contenu: p.contenu, notes: p.notes ?? "" });

/** Les lignes qui contiennent encore « [à compléter] » */
const aCompleter = (c: PageAEnregistrer) =>
  [c.titre, c.resume, ...c.contenu.split("\n")].map((l) => l.trim()).filter(resteACompleter);

function EditeurPage({ page, fermer }: { page: PageAdmin; fermer: () => void }) {
  const id = useId();
  const [actuelle, setActuelle] = useState(page);
  const [champs, setChamps] = useState(() => champsDe(page));
  const [enregistre, setEnregistre] = useState(() => JSON.stringify(champsDe(page)));
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [confirmer, setConfirmer] = useState<"" | "publier" | "fermer">("");
  const modifie = JSON.stringify(champs) !== enregistre;
  const publiee = actuelle.statut === "publie";
  const manques = aCompleter(champs);
  const changer = (x: Partial<PageAEnregistrer>) => {
    setChamps((c) => ({ ...c, ...x }));
    setInfo("");
  };

  const action = async (faire: () => Promise<string | void>) => {
    setEnvoi(true);
    setErreur("");
    setInfo("");
    setConfirmer("");
    try {
      const texte = await faire();
      if (texte) setInfo(texte);
    } catch (e) {
      setErreur(messageErreur(e));
    }
    setEnvoi(false);
  };

  const sauver = async () => {
    const p = await enregistrerPage(champs);
    setActuelle(p);
    const normalises = champsDe(p);
    setChamps(normalises);
    setEnregistre(JSON.stringify(normalises));
    if (p.statut === "publie") void rafraichirPages({ pages: [p.slug] });
    return p;
  };

  const enregistrer = () => action(async () => {
    await sauver();
    return "Page enregistrée.";
  });

  const publier = (oui: boolean) => action(async () => {
    const p = await sauver();
    const apres = await publierPage(p.slug, oui);
    setActuelle(apres);
    void rafraichirPages({ pages: [apres.slug] });
    return oui ? "Page publiée : elle est visible de tous." : "Page retirée du site : son lien affiche « Page bientôt disponible ».";
  });

  return (
    <div className={s.liste}>
      <div className={b.barre}>
        <button type="button" className={s.lien} onClick={() => (modifie ? setConfirmer("fermer") : fermer())}>
          <Icone nom="retour" taille={15} /> Toutes les pages
        </button>
        <span className={`${s.badge} ${publiee ? s.badgeOk : ""}`}>{publiee ? "Publiée" : "Brouillon"}</span>
        {modifie && <span className={`${s.badge} ${s.badgeInfo}`}>Modifications non enregistrées</span>}
      </div>
      <h2 className={s.titre}>{PAGES_SITE[page.slug].nom}</h2>
      <p className={s.meta}>Adresse : {lienPage(page.slug)}{page.slug === "aide" ? " · chaque sous-titre (###) devient une question qui s'ouvre au toucher" : ""}</p>
      {confirmer === "fermer" && (
        <div className={s.refus} role="group" aria-label="Fermer sans enregistrer">
          <p className={s.meta}><strong>Fermer sans enregistrer ?</strong> Vos dernières modifications seront perdues.</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} onClick={fermer}>Fermer sans enregistrer</button>
            <button type="button" className={s.boutonContour} onClick={() => setConfirmer("")}>Continuer l&apos;écriture</button>
          </div>
        </div>
      )}
      {manques.length > 0 && (
        <div className={b.manques} role="note" aria-label="Passages à compléter">
          <p><strong>{manques.length} passage{manques.length > 1 ? "s" : ""} à compléter</strong> avant de pouvoir publier cette page :</p>
          <ul>{manques.slice(0, 12).map((m, i) => <li key={i}>{m.length > 140 ? `${m.slice(0, 140)}…` : m}</li>)}</ul>
        </div>
      )}

      <div className={b.onglets} role="group" aria-label="Affichage">
        <button type="button" className={`${b.ongletEditeur} ${!apercu ? b.ongletActif : ""}`} aria-pressed={!apercu} onClick={() => setApercu(false)}>
          <Icone nom="document" taille={15} /> Écrire
        </button>
        <button type="button" className={`${b.ongletEditeur} ${apercu ? b.ongletActif : ""}`} aria-pressed={apercu} onClick={() => setApercu(true)}>
          <Icone nom="voir" taille={15} /> Aperçu
        </button>
      </div>

      {apercu ? (
        <section className={b.apercu} aria-label="Aperçu de la page">
          <h1 className={b.apercuTitre}>{champs.titre}</h1>
          {champs.resume && <p className={b.apercuChapo}>{champs.resume}</p>}
          <TexteArticle blocs={lireTexte(champs.contenu)} questions={page.slug === "aide"} />
        </section>
      ) : (
        <div className={`${s.carte} ${b.formulaire}`}>
          <label className={b.champ}>
            <span className={s.etiquette}>Titre</span>
            <input type="text" className={s.champ} value={champs.titre} maxLength={120} onChange={(e) => changer({ titre: e.target.value })} />
          </label>
          <label className={b.champ}>
            <span className={s.etiquette}>Résumé <span className={b.compte}>{champs.resume.length} / {RESUME_MAX}</span></span>
            <textarea className={s.zone} rows={2} maxLength={RESUME_MAX} value={champs.resume}
              placeholder="Une ou deux phrases : elles s'affichent sous le titre et dans Google."
              onChange={(e) => changer({ resume: e.target.value })} />
          </label>
          <ZoneTexte id={`${id}-texte`} etiquette="Texte de la page" valeur={champs.contenu} onChange={(contenu) => changer({ contenu })}
            onErreur={setErreur} aide="Écrivez « [à compléter : …] » pour ce qui manque encore : la page ne pourra pas être publiée tant qu'il en reste." />
          <label className={b.champ}>
            <span className={s.etiquette}>Notes de l&apos;équipe (jamais publiées)</span>
            <textarea className={`${s.zone} ${b.notes}`} rows={4} maxLength={10000} value={champs.notes}
              placeholder="Ex : points à faire vérifier par un juriste…" onChange={(e) => changer({ notes: e.target.value })} />
          </label>
        </div>
      )}

      <p className={s.info} role="status">{info}</p>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      {confirmer === "publier" && (
        <div className={s.refus} role="group" aria-label="Publier malgré les notes">
          <p className={s.meta}><strong>Cette page a des notes de l&apos;équipe.</strong> Les points à vérifier sont-ils réglés ?</p>
          <p className={b.rappel}>{champs.notes}</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => publier(true)}>Publier quand même</button>
            <button type="button" className={s.boutonContour} onClick={() => setConfirmer("")}>Annuler</button>
          </div>
        </div>
      )}
      <div className={`${s.actions} ${b.boutons}`}>
        <button type="button" className={s.boutonPlein} disabled={envoi} onClick={enregistrer}>
          <Icone nom="valide" taille={16} /> Enregistrer
        </button>
        {publiee ? (
          <>
            <Link href={lienPage(page.slug)} className={s.boutonContour} target="_blank"><Icone nom="voir" taille={16} /> Voir la page</Link>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => publier(false)}>Retirer du site</button>
          </>
        ) : (
          <button type="button" className={s.boutonContour} disabled={envoi || manques.length > 0}
            title={manques.length ? "Remplacez d'abord les passages « [à compléter] »" : undefined}
            onClick={() => (champs.notes.trim() ? setConfirmer("publier") : publier(true))}>
            <Icone nom="envoyer" taille={16} /> Publier
          </button>
        )}
      </div>
      {actuelle.modifie_par && <p className={s.meta}>Dernière modification le {dateHeure(actuelle.modifie_le)} par {actuelle.modifie_par}.</p>}
    </div>
  );
}
