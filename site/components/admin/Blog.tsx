"use client";

/*
 * Administration → Blog : les articles du « Guide & Blog » (supabase/migrations/…_blog.sql).
 *   Liste       brouillons (vus de l'équipe seulement) puis articles publiés ; Nouvel article, Modifier, Voir
 *   Éditeur     titre, catégorie, résumé, photo de couverture (réduite avant l'envoi), texte avec des boutons de mise en
 *               forme (titres, gras, listes, liens, encadrés : lib/blog.ts), auteur, « à la une », adresse de la page,
 *               notes de l'équipe (jamais publiées) ; Aperçu tel que les visiteurs le verront ; Publier, Retirer du blog,
 *               Supprimer. Un article qui a des notes (ex. relecture par un juriste) demande confirmation avant publication.
 * Après chaque changement, les pages du blog sont rafraîchies aussitôt (app/api/blog/route.ts).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Couverture from "@/components/blog/Couverture";
import TexteArticle from "@/components/blog/TexteArticle";
import Icone, { type NomIcone } from "@/components/Icone";
import {
  AUTEUR_PAR_DEFAUT, CATEGORIES, dateArticle, dureeLecture, LISTE_CATEGORIES, lienArticle, lienSur, lireTexte, RESUME_MAX,
  type ArticleAdmin,
} from "@/lib/blog";
import {
  articlesAdmin, enregistrerArticle, envoyerCouverture, publierArticle, rafraichirBlog, supprimerArticle, supprimerCouverture,
  type ArticleAEnregistrer,
} from "@/lib/blog-admin";
import { messageErreur } from "@/lib/compte";
import { dateHeure } from "./outils";
import s from "./Admin.module.css";
import b from "./Blog.module.css";

export default function Blog() {
  const [articles, setArticles] = useState<ArticleAdmin[] | null>(null);
  const [ouvert, setOuvert] = useState<ArticleAdmin | "nouveau" | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => articlesAdmin().then(setArticles, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    articlesAdmin().then((a) => actif && setArticles(a), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);

  if (ouvert) {
    return (
      <Editeur key={ouvert === "nouveau" ? "nouveau" : ouvert.id} article={ouvert === "nouveau" ? null : ouvert}
        fermer={(texte) => {
          setOuvert(null);
          setFait(texte);
          void charger();
          window.scrollTo({ top: 0 });
        }} />
    );
  }
  if (erreur) return <p className={s.erreur} role="alert">{erreur}</p>;
  if (!articles) return <p className={s.attente}>Chargement des articles…</p>;
  const brouillons = articles.filter((a) => a.statut === "brouillon");
  const publies = articles.filter((a) => a.statut === "publie");
  return (
    <div className={s.liste}>
      <p className={s.info} role="status">{fait}</p>
      <div className={b.barre}>
        <button type="button" className={s.boutonPlein} onClick={() => { setFait(""); setOuvert("nouveau"); }}>
          <Icone nom="plus" taille={16} epaisseur={2.5} /> Nouvel article
        </button>
        <Link href="/blog" className={s.boutonContour} target="_blank"><Icone nom="voir" taille={16} /> Voir le blog</Link>
      </div>
      <p className={s.aide}>
        Les brouillons ne sont visibles que de l&apos;équipe. Faites relire par un juriste les articles qui parlent de documents,
        de contrats ou de lois avant de les publier : notez les points à vérifier dans les « Notes de l&apos;équipe » de l&apos;article.
      </p>
      <Groupe id="blog-brouillons" titre={`Brouillons (${brouillons.length})`} articles={brouillons} ouvrir={setOuvert}
        vide="Aucun brouillon." />
      <Groupe id="blog-publies" titre={`Publiés (${publies.length})`} articles={publies} ouvrir={setOuvert}
        vide="Aucun article publié pour l'instant : la page Guide & Blog annonce « Les premiers articles arrivent bientôt »." />
    </div>
  );
}

function Groupe({ id, titre, articles, ouvrir, vide }: {
  id: string; titre: string; articles: ArticleAdmin[]; ouvrir: (a: ArticleAdmin) => void; vide: string;
}) {
  return (
    <section aria-labelledby={id} className={s.liste}>
      <h2 id={id} className={s.groupeTitre}>{titre}</h2>
      {articles.length === 0 ? <p className={s.aide}>{vide}</p> : (
        <ul className={s.cartes}>
          {articles.map((a) => (
            <li key={a.id} className={s.carte} aria-labelledby={`article-${a.id}`}>
              <div className={s.badges}>
                <span className={s.badge}>{CATEGORIES[a.categorie].nom}</span>
                {a.a_la_une && <span className={`${s.badge} ${s.badgeOk}`}>À la une</span>}
                {a.notes && <span className={`${s.badge} ${s.badgeInfo}`}>Notes de l&apos;équipe</span>}
              </div>
              <h3 id={`article-${a.id}`} className={s.carteTitre}>{a.titre}</h3>
              <p className={s.meta}>
                {a.statut === "publie" && a.publie_le ? <>Publié le {dateArticle(a.publie_le)} · </> : null}
                Modifié le {dateHeure(a.modifie_le)}{a.modifie_par ? ` par ${a.modifie_par}` : ""} · {dureeLecture(a.minutes)}
                {" "}· par {a.auteur_nom}
              </p>
              <div className={s.actions}>
                <button type="button" className={s.boutonContour} onClick={() => ouvrir(a)}>
                  <Icone nom="document" taille={16} /> Modifier
                </button>
                {a.statut === "publie" && (
                  <Link href={lienArticle(a.slug)} className={s.boutonContour} target="_blank">
                    <Icone nom="voir" taille={16} /> Voir l&apos;article
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const vide: ArticleAEnregistrer = {
  titre: "", resume: "", categorie: "acheteur", contenu: "", couverture: null, auteur_nom: AUTEUR_PAR_DEFAUT, auteur_fonction: "",
  a_la_une: false, notes: "",
};

const champsDe = (a: ArticleAdmin): ArticleAEnregistrer => ({
  id: a.id, titre: a.titre, resume: a.resume, categorie: a.categorie, contenu: a.contenu, couverture: a.couverture,
  auteur_nom: a.auteur_nom, auteur_fonction: a.auteur_fonction ?? "", a_la_une: a.a_la_une, notes: a.notes ?? "", slug: a.slug,
});

type Outil = { texte: string; icone?: NomIcone; aide: string; faire: "ligne" | "autour" | "lien"; avant: string; apres?: string; exemple: string };

const OUTILS: Outil[] = [
  { texte: "Titre de partie", aide: "## Titre de partie", faire: "ligne", avant: "## ", exemple: "Titre de partie" },
  { texte: "Sous-titre", aide: "### Sous-titre", faire: "ligne", avant: "### ", exemple: "Sous-titre" },
  { texte: "Gras", aide: "**mot important**", faire: "autour", avant: "**", apres: "**", exemple: "mot important" },
  { texte: "Liste", aide: "- élément", faire: "ligne", avant: "- ", exemple: "élément de la liste" },
  { texte: "Liste numérotée", aide: "1. étape", faire: "ligne", avant: "1. ", exemple: "première étape" },
  { texte: "Lien", icone: "lien", aide: "[texte](adresse)", faire: "lien", avant: "", exemple: "texte du lien" },
  { texte: "À retenir", aide: "> encadré vert", faire: "ligne", avant: "> ", exemple: "Le point essentiel à retenir." },
  { texte: "Attention", aide: "!> encadré orange", faire: "ligne", avant: "!> ", exemple: "Le piège à éviter." },
];

// préfixe de ligne déjà présent (remplacé quand on en choisit un autre)
const PREFIXE = /^(#{1,3}\s+|[-*•]\s+|\d{1,3}[.)]\s+|!?>\s?)/;

function Editeur({ article, fermer }: { article: ArticleAdmin | null; fermer: (texte: string) => void }) {
  const id = useId();
  const [actuel, setActuel] = useState<ArticleAdmin | null>(article);
  const [champs, setChamps] = useState<ArticleAEnregistrer>(article ? champsDe(article) : vide);
  const [enregistre, setEnregistre] = useState(() => JSON.stringify(article ? champsDe(article) : vide));
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [confirmer, setConfirmer] = useState<"" | "publier" | "supprimer" | "fermer">("");
  const zone = useRef<HTMLTextAreaElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const modifie = JSON.stringify(champs) !== enregistre;
  const publie = actuel?.statut === "publie";
  const changer = (x: Partial<ArticleAEnregistrer>) => {
    setChamps((c) => ({ ...c, ...x }));
    setInfo("");
  };

  /** Enregistre les champs (et la couverture donnée) ; renvoie l'article enregistré, ou null en cas d'erreur */
  const sauver = async (x: Partial<ArticleAEnregistrer> = {}): Promise<ArticleAdmin | null> => {
    const aEnvoyer = { ...champs, ...x, slug: actuel && !actuel.publie_le ? champs.slug : undefined };
    if (aEnvoyer.titre.trim().length < 5) {
      setErreur("Donnez un titre à l'article (5 caractères au moins).");
      return null;
    }
    try {
      const a = await enregistrerArticle(aEnvoyer);
      setActuel(a);
      const normalises = champsDe(a);
      setChamps(normalises);
      setEnregistre(JSON.stringify(normalises));
      if (a.statut === "publie") void rafraichirBlog([a.slug]);
      return a;
    } catch (e) {
      setErreur(messageErreur(e));
      return null;
    }
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

  const enregistrer = () => action(async () => ((await sauver()) ? "Article enregistré." : undefined));

  const publier = (oui: boolean) => action(async () => {
    const a = await sauver();
    if (!a) return;
    const apres = await publierArticle(a.id, oui);
    setActuel(apres);
    void rafraichirBlog([apres.slug]);
    return oui ? "Article publié : il est visible de tous sur le blog." : "Article retiré du blog : il redevient un brouillon.";
  });

  const supprimer = () => action(async () => {
    if (!actuel) return fermer("");
    await supprimerArticle(actuel.id);
    void rafraichirBlog([actuel.slug]);
    fermer(`Article « ${actuel.titre} » supprimé.`);
  });

  const choisirCouverture = (f: File | undefined) => action(async () => {
    if (!f) return;
    // un nouvel article s'enregistre d'abord : la photo se range sous son identifiant
    const a = actuel ?? (await sauver());
    if (!a) return;
    const ancienne = champs.couverture;
    const chemin = await envoyerCouverture(f, a.id);
    if (!(await sauver({ id: a.id, couverture: chemin }))) {
      await supprimerCouverture(chemin);
      return;
    }
    if (ancienne) await supprimerCouverture(ancienne);
    return "Photo de couverture enregistrée.";
  });

  const retirerCouverture = () => action(async () => {
    const ancienne = champs.couverture;
    if (!ancienne || !(await sauver({ couverture: null }))) return;
    await supprimerCouverture(ancienne);
    return "Photo de couverture retirée.";
  });

  /** Bouton de mise en forme : préfixe de ligne, texte entouré, ou lien */
  const outil = (o: Outil) => {
    const z = zone.current;
    if (!z) return;
    const v = champs.contenu;
    const d = z.selectionStart, f = z.selectionEnd;
    let texte: string, debutSelection: number, finSelection: number;
    if (o.faire === "ligne") {
      const debut = v.lastIndexOf("\n", d - 1) + 1;
      let fin = v.indexOf("\n", Math.max(f, d) - (f > d && v[f - 1] === "\n" ? 1 : 0));
      if (fin < 0) fin = v.length;
      const bloc = v.slice(debut, fin);
      const lignes = bloc.trim() ? bloc.split("\n") : [o.exemple];
      const nouveau = lignes.map((l, i) => (l.trim() ? (o.avant === "1. " ? `${i + 1}. ` : o.avant) + l.replace(PREFIXE, "") : l)).join("\n");
      texte = v.slice(0, debut) + nouveau + v.slice(fin);
      debutSelection = debut;
      finSelection = debut + nouveau.length;
    } else {
      const choisi = v.slice(d, f) || o.exemple;
      let avant = o.avant, apres = o.apres ?? "";
      if (o.faire === "lien") {
        const url = window.prompt("Adresse du lien : une page du site (ex. /estimation) ou une adresse complète (https://…)", "/");
        if (!url) return;
        if (!lienSur(url.trim())) {
          setErreur("Ce lien n'est pas accepté : une page du site commence par « / », une autre adresse par « https:// ».");
          return;
        }
        avant = "[";
        apres = `](${url.trim()})`;
      }
      texte = v.slice(0, d) + avant + choisi + apres + v.slice(f);
      debutSelection = d + avant.length;
      finSelection = debutSelection + choisi.length;
    }
    setErreur("");
    changer({ contenu: texte });
    requestAnimationFrame(() => {
      z.focus();
      z.setSelectionRange(debutSelection, finSelection);
    });
  };

  const blocs = apercu ? lireTexte(champs.contenu) : [];
  return (
    <div className={s.liste}>
      <div className={b.barre}>
        <button type="button" className={s.lien} onClick={() => (modifie ? setConfirmer("fermer") : fermer(""))}>
          <Icone nom="retour" taille={15} /> Tous les articles
        </button>
        <span className={`${s.badge} ${publie ? s.badgeOk : ""}`}>{publie ? "Publié" : "Brouillon"}</span>
        {modifie && <span className={`${s.badge} ${s.badgeInfo}`}>Modifications non enregistrées</span>}
      </div>
      <h2 className={s.titre}>{actuel ? "Modifier l'article" : "Nouvel article"}</h2>
      {confirmer === "fermer" && (
        <div className={s.refus} role="group" aria-label="Fermer sans enregistrer">
          <p className={s.meta}><strong>Fermer sans enregistrer ?</strong> Vos dernières modifications seront perdues.</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} onClick={() => fermer("")}>Fermer sans enregistrer</button>
            <button type="button" className={s.boutonContour} onClick={() => setConfirmer("")}>Continuer l&apos;écriture</button>
          </div>
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
        <section className={b.apercu} aria-label="Aperçu de l'article">
          <span className={b.apercuCategorie}>{CATEGORIES[champs.categorie].nom}</span>
          <h1 className={b.apercuTitre}>{champs.titre || "Titre de l'article"}</h1>
          {champs.resume && <p className={b.apercuChapo}>{champs.resume}</p>}
          <p className={s.meta}>
            Par <strong>{champs.auteur_nom || AUTEUR_PAR_DEFAUT}</strong>{champs.auteur_fonction ? `, ${champs.auteur_fonction}` : ""}
          </p>
          {champs.couverture && <Couverture chemin={champs.couverture} categorie={champs.categorie} className={b.apercuCouverture} />}
          {blocs.length ? <TexteArticle blocs={blocs} /> : <p className={s.aide}>Le texte de l&apos;article apparaîtra ici.</p>}
        </section>
      ) : (
        <div className={`${s.carte} ${b.formulaire}`}>
          <label className={b.champ}>
            <span className={s.etiquette}>Titre</span>
            <input type="text" className={s.champ} value={champs.titre} maxLength={120} required
              placeholder="Ex : Acheter un terrain : les vérifications à faire avant de payer"
              onChange={(e) => changer({ titre: e.target.value })} />
          </label>
          <div className={b.deux}>
            <label className={b.champ}>
              <span className={s.etiquette}>Catégorie</span>
              <select className={s.champ} value={champs.categorie} onChange={(e) => changer({ categorie: e.target.value as ArticleAEnregistrer["categorie"] })}>
                {LISTE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIES[c].nom}</option>)}
              </select>
            </label>
            <label className={`${s.case} ${b.une}`}>
              <input type="checkbox" checked={champs.a_la_une} onChange={(e) => changer({ a_la_une: e.target.checked })} />
              <span>À la une (en grand en haut du blog ; un seul article à la fois)</span>
            </label>
          </div>
          <label className={b.champ}>
            <span className={s.etiquette}>Résumé <span className={b.compte}>{champs.resume.length} / {RESUME_MAX}</span></span>
            <textarea className={s.zone} rows={3} maxLength={RESUME_MAX} value={champs.resume}
              placeholder="Deux phrases qui donnent envie de lire : elles s'affichent sous le titre, dans la liste du blog et dans Google."
              onChange={(e) => changer({ resume: e.target.value })} />
          </label>

          <div className={b.champ}>
            <span className={s.etiquette} id={`${id}-couverture`}>Photo de couverture (facultative)</span>
            <div className={b.couverture}>
              <Couverture chemin={champs.couverture} categorie={champs.categorie} className={b.vignette} />
              <div className={b.couvertureTexte}>
                <p className={s.aide}>
                  Une photo prise par vous, ou dont vous avez les droits. Sans photo, un fond aux couleurs de la catégorie
                  s&apos;affiche.
                </p>
                <div className={s.actions}>
                  <button type="button" className={s.boutonContour} disabled={envoi} aria-describedby={`${id}-couverture`}
                    onClick={() => fichier.current?.click()}>
                    <Icone nom="photo" taille={16} /> {champs.couverture ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  {champs.couverture && (
                    <button type="button" className={s.boutonContour} disabled={envoi} onClick={retirerCouverture}>Retirer la photo</button>
                  )}
                </div>
                <input ref={fichier} type="file" accept="image/*" hidden aria-label="Photo de couverture"
                  onChange={(e) => {
                    void choisirCouverture(e.target.files?.[0]);
                    e.target.value = "";
                  }} />
              </div>
            </div>
          </div>

          <div className={b.champ}>
            <label htmlFor={`${id}-texte`} className={s.etiquette}>Texte de l&apos;article</label>
            <div className={b.outils} role="toolbar" aria-label="Mise en forme du texte">
              {OUTILS.map((o) => (
                <button key={o.texte} type="button" className={b.outil} title={o.aide} onClick={() => outil(o)}>
                  {o.icone && <Icone nom={o.icone} taille={14} />}{o.texte}
                </button>
              ))}
            </div>
            <textarea id={`${id}-texte`} ref={zone} className={`${s.zone} ${b.texte}`} rows={22} value={champs.contenu}
              placeholder={"## Titre de partie\n\nUn paragraphe. Laissez une ligne vide entre deux paragraphes.\n\n- Un élément de liste\n- Un autre"}
              onChange={(e) => changer({ contenu: e.target.value })} />
            <p className={s.aide}>
              Sélectionnez du texte puis touchez un bouton, ou écrivez directement : « ## » titre de partie, « - » liste,
              « **mot** » gras, « &gt; » encadré À retenir, « !&gt; » encadré Attention. Vérifiez le résultat avec l&apos;Aperçu.
            </p>
          </div>

          <div className={b.deux}>
            <label className={b.champ}>
              <span className={s.etiquette}>Auteur</span>
              <input type="text" className={s.champ} value={champs.auteur_nom} maxLength={80}
                onChange={(e) => changer({ auteur_nom: e.target.value })} />
            </label>
            <label className={b.champ}>
              <span className={s.etiquette}>Fonction de l&apos;auteur (facultative)</span>
              <input type="text" className={s.champ} value={champs.auteur_fonction} maxLength={80} placeholder="Ex : Juriste, Notaire, Agent immobilier"
                onChange={(e) => changer({ auteur_fonction: e.target.value })} />
            </label>
          </div>

          {actuel && (
            <label className={b.champ}>
              <span className={s.etiquette}>Adresse de la page</span>
              {actuel.publie_le ? (
                <span className={s.meta}>
                  <Link href={lienArticle(actuel.slug)} target="_blank">{lienArticle(actuel.slug)}</Link> · fixe depuis la
                  première publication (les liens déjà partagés continuent de marcher)
                </span>
              ) : (
                <span className={b.adresse}>
                  <span className={s.meta}>/blog/</span>
                  <input type="text" className={s.champ} value={champs.slug ?? ""} maxLength={80}
                    onChange={(e) => changer({ slug: e.target.value })} />
                </span>
              )}
            </label>
          )}

          <label className={b.champ}>
            <span className={s.etiquette}>Notes de l&apos;équipe (jamais publiées)</span>
            <textarea className={`${s.zone} ${b.notes}`} rows={4} maxLength={10000} value={champs.notes}
              placeholder="Ex : points à faire vérifier par un juriste, sources, idées à ajouter…"
              onChange={(e) => changer({ notes: e.target.value })} />
          </label>
        </div>
      )}

      <p className={s.info} role="status">{info}</p>
      {erreur && <p className={s.erreur} role="alert">{erreur}</p>}
      {confirmer === "publier" && (
        <div className={s.refus} role="group" aria-label="Publier malgré les notes">
          <p className={s.meta}><strong>Cet article a des notes de l&apos;équipe.</strong> Les points à vérifier sont-ils réglés ?</p>
          <p className={b.rappel}>{champs.notes}</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonPlein} disabled={envoi} onClick={() => publier(true)}>Publier quand même</button>
            <button type="button" className={s.boutonContour} onClick={() => setConfirmer("")}>Annuler</button>
          </div>
        </div>
      )}
      {confirmer === "supprimer" && (
        <div className={s.refus} role="group" aria-label="Supprimer l'article">
          <p className={s.meta}><strong>Supprimer définitivement cet article ?</strong>{publie ? " Il disparaîtra du blog." : ""} Ce n&apos;est pas réversible.</p>
          <div className={s.actions}>
            <button type="button" className={s.boutonDanger} disabled={envoi} onClick={supprimer}>Supprimer l&apos;article</button>
            <button type="button" className={s.boutonContour} onClick={() => setConfirmer("")}>Annuler</button>
          </div>
        </div>
      )}
      <div className={`${s.actions} ${b.boutons}`}>
        <button type="button" className={s.boutonPlein} disabled={envoi} onClick={enregistrer}>
          <Icone nom="valide" taille={16} /> Enregistrer
        </button>
        {publie ? (
          <>
            <Link href={lienArticle(actuel!.slug)} className={s.boutonContour} target="_blank"><Icone nom="voir" taille={16} /> Voir l&apos;article</Link>
            <button type="button" className={s.boutonContour} disabled={envoi} onClick={() => publier(false)}>Retirer du blog</button>
          </>
        ) : (
          <button type="button" className={s.boutonContour} disabled={envoi}
            onClick={() => (champs.notes.trim() ? setConfirmer("publier") : publier(true))}>
            <Icone nom="envoyer" taille={16} /> Publier
          </button>
        )}
        {actuel && (
          <button type="button" className={`${s.boutonContour} ${b.supprimer}`} disabled={envoi} onClick={() => setConfirmer("supprimer")}>
            <Icone nom="fermer" taille={16} /> Supprimer…
          </button>
        )}
      </div>
      {actuel?.modifie_par && (
        <p className={s.meta}>Dernière modification le {dateHeure(actuel.modifie_le)} par {actuel.modifie_par}.</p>
      )}
    </div>
  );
}
