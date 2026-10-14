/*
 * Blog « Guide & Blog » : catégories, articles (supabase/migrations/…_blog.sql) et mise en page de leur texte.
 *
 * Le texte d'un article s'écrit en Markdown simple, avec les boutons de l'éditeur (Administration → Blog) :
 *   ## Titre de partie                ### Sous-titre
 *   - élément de liste                1. élément de liste numérotée
 *   **gras**                          [texte du lien](/estimation) ou [texte](https://…)
 *   > À retenir (encadré vert)        !> Attention (encadré orange)
 * Une ligne vide sépare les paragraphes ; un simple retour à la ligne reste un retour à la ligne.
 * Rien d'autre n'est interprété (pas de HTML) : le texte est affiché tel quel, sans risque pour les visiteurs.
 * Utilisable partout (pages du serveur, éditeur dans le navigateur).
 */

export type Categorie = "acheteur" | "locataire" | "marche" | "juridique" | "vendeur" | "quartiers";

export const CATEGORIES: Record<Categorie, { nom: string; description: string }> = {
  acheteur: { nom: "Guide acheteur", description: "Acheter un terrain, une maison ou un appartement sans mauvaise surprise." },
  locataire: { nom: "Guide locataire", description: "Trouver un logement, signer le bail, vivre sa location sereinement." },
  marche: { nom: "Marché & Prix", description: "Comprendre les prix et estimer un bien d'après les annonces." },
  juridique: { nom: "Juridique & Administratif", description: "Titres, contrats et démarches, expliqués simplement." },
  vendeur: { nom: "Conseils vendeurs", description: "Vendre ou louer son bien plus vite, au bon prix." },
  quartiers: { nom: "Vie des quartiers", description: "Choisir où habiter : les bonnes questions à se poser." },
};

export const LISTE_CATEGORIES = Object.keys(CATEGORIES) as Categorie[];

export const estCategorie = (x: unknown): x is Categorie => typeof x === "string" && x in CATEGORIES;

/** Ce que les listes d'articles montrent (sans le texte) */
export type ResumeArticle = {
  id: string; slug: string; titre: string; resume: string; categorie: Categorie; couverture: string | null;
  auteur_nom: string; auteur_fonction: string | null; a_la_une: boolean; publie_le: string; modifie_le: string; minutes: number;
};

/** Un article publié, tel que sa page le montre */
export type Article = ResumeArticle & { contenu: string; a_lire_aussi: ResumeArticle[] };

/** Un article tel que l'équipe le voit (onglet « Blog » de l'Administration) */
export type ArticleAdmin = Omit<ResumeArticle, "publie_le"> & {
  contenu: string; notes: string | null; statut: "brouillon" | "publie"; publie_le: string | null; cree_le: string;
  modifie_par: string | null;
};

export const AUTEUR_PAR_DEFAUT = "L'équipe 360-Immo.ci";
export const RESUME_MAX = 300;

/** Adresse de la page d'un article */
export const lienArticle = (slug: string) => `/blog/${slug}`;

/** Adresse de la liste des articles d'une catégorie */
export const lienCategorie = (c: Categorie | null) => (c ? `/blog?categorie=${c}` : "/blog");

/** Adresse publique d'une photo de couverture (dossier « blog ») */
export const urlCouverture = (chemin: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/blog/${chemin}`;

/** « 14 octobre 2026 » */
export const dateArticle = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

export const dureeLecture = (minutes: number) => `${minutes} min de lecture`;


// ══ Mise en page du texte ══

export type Morceau =
  | { type: "texte"; texte: string }
  | { type: "gras"; contenu: Morceau[] }
  | { type: "lien"; url: string; contenu: Morceau[] };

export type Bloc =
  | { type: "titre"; niveau: 2 | 3; texte: string; id: string }
  | { type: "paragraphe"; lignes: Morceau[][] }
  | { type: "liste"; numerotee: boolean; debut: number; elements: Morceau[][] }
  | { type: "encadre"; genre: "retenir" | "attention"; blocs: Bloc[] };

/** Lien accepté : une page du site (/…), une adresse web (https://…) ou une adresse e-mail (mailto:…) ; sinon null */
export function lienSur(url: string): string | null {
  if (/^\/(?![/\\])[^\s\\]*$/.test(url)) return url;
  if (/^https?:\/\/[^\s/\\]+[^\s\\]*$/i.test(url)) return url;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  return null;
}

const MOTIF_LIGNE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Une ligne : texte, **gras** et [liens](…) ; un lien refusé reste du texte */
export function lireLigne(t: string): Morceau[] {
  const r: Morceau[] = [];
  let i = 0;
  for (const m of t.matchAll(MOTIF_LIGNE)) {
    if (m.index > i) r.push({ type: "texte", texte: t.slice(i, m.index) });
    if (m[1] !== undefined) {
      r.push({ type: "gras", contenu: lireLigne(m[1]) });
    } else {
      const url = lienSur(m[3]);
      r.push(url ? { type: "lien", url, contenu: lireLigne(m[2]) } : { type: "texte", texte: m[0] });
    }
    i = m.index + m[0].length;
  }
  if (i < t.length) r.push({ type: "texte", texte: t.slice(i) });
  return r;
}

/** Texte sans mise en forme : « **Attention** aux [faux](/x) » → « Attention aux faux » */
export const texteSeul = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");

/** Identifiant d'un titre (pour le sommaire) : « Le bail, c'est quoi ? » → le-bail-c-est-quoi */
export const idTitre = (texte: string) =>
  texte.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[œŒ]/g, "oe").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-+$/, "") || "partie";

const LISTE = /^[-*•]\s+(.*)$/;
const LISTE_NUMEROTEE = /^(\d{1,3})[.)]\s+(.*)$/;
const TITRE = /^(#{1,3})\s+(.+)$/;   // « # » seul compte comme « ## » (le titre de l'article est au-dessus)
const ENCADRE = /^(!?)>\s?(.*)$/;

const debutDeBloc = (t: string) => TITRE.test(t) || LISTE.test(t) || LISTE_NUMEROTEE.test(t) || ENCADRE.test(t);

/** Le texte d'un article → ses blocs (titres, paragraphes, listes, encadrés) */
export function lireTexte(contenu: string, ids = new Set<string>()): Bloc[] {
  const lignes = contenu.replace(/\r\n?/g, "\n").split("\n");
  const blocs: Bloc[] = [];
  let i = 0;
  const prochaine = (depuis: number) => {
    let j = depuis;
    while (j < lignes.length && !lignes[j].trim()) j++;
    return j;
  };
  while (i < lignes.length) {
    const t = lignes[i].trim();
    if (!t) {
      i++;
      continue;
    }
    const titre = t.match(TITRE);
    if (titre) {
      const texte = texteSeul(titre[2].trim());
      let id = idTitre(texte);
      for (let n = 2; ids.has(id); n++) id = `${idTitre(texte)}-${n}`;
      ids.add(id);
      blocs.push({ type: "titre", niveau: titre[1].length === 3 ? 3 : 2, texte, id });
      i++;
      continue;
    }
    const encadre = t.match(ENCADRE);
    if (encadre) {
      const genre = encadre[1] ? "attention" : "retenir";
      const dedans: string[] = [];
      for (let m; i < lignes.length && (m = lignes[i].trim().match(ENCADRE)) && (m[1] ? "attention" : "retenir") === genre; i++) {
        dedans.push(m[2]);
      }
      blocs.push({ type: "encadre", genre, blocs: lireTexte(dedans.join("\n"), ids) });
      continue;
    }
    const numero = t.match(LISTE_NUMEROTEE);
    if (numero || LISTE.test(t)) {
      const motif = numero ? LISTE_NUMEROTEE : LISTE;
      const elements: Morceau[][] = [];
      // une ligne vide entre deux éléments ne coupe pas la liste
      for (let m; i < lignes.length; ) {
        if (!lignes[i].trim()) {
          const j = prochaine(i);
          if (j < lignes.length && motif.test(lignes[j].trim())) i = j;
          else break;
        }
        if (!(m = lignes[i].trim().match(motif))) break;
        elements.push(lireLigne((numero ? m[2] : m[1]).trim()));
        i++;
      }
      blocs.push({ type: "liste", numerotee: !!numero, debut: numero ? Number(numero[1]) : 1, elements });
      continue;
    }
    const paragraphe: Morceau[][] = [];
    while (i < lignes.length && lignes[i].trim() && (paragraphe.length === 0 || !debutDeBloc(lignes[i].trim()))) {
      paragraphe.push(lireLigne(lignes[i].trim()));
      i++;
    }
    blocs.push({ type: "paragraphe", lignes: paragraphe });
  }
  return blocs;
}

/** Les titres de partie (##) : le sommaire de l'article */
export const sommaire = (blocs: Bloc[]) =>
  blocs.filter((b): b is Extract<Bloc, { type: "titre" }> => b.type === "titre" && b.niveau === 2);

/** Texte seul d'une ligne mise en forme */
export const texteMorceaux = (m: Morceau[]): string =>
  m.map((x) => (x.type === "texte" ? x.texte : texteMorceaux(x.contenu))).join("");

/** Texte seul de blocs (réponses de la FAQ pour Google) */
export const texteDeBlocs = (blocs: Bloc[]): string =>
  blocs.map((b) => {
    switch (b.type) {
      case "titre": return b.texte;
      case "paragraphe": return b.lignes.map(texteMorceaux).join(" ");
      case "liste": return b.elements.map(texteMorceaux).join(" ; ");
      case "encadre": return texteDeBlocs(b.blocs);
    }
  }).join("\n");

export type Question = { type: "question"; titre: string; id: string; blocs: Bloc[] };

/**
 * Page « questions fréquentes » (Aide) : chaque sous-titre (###) devient une question, avec pour réponse tout ce qui
 * le suit jusqu'au titre suivant ; les titres de partie (##) restent des rubriques.
 */
export function enQuestions(blocs: Bloc[]): (Bloc | Question)[] {
  const r: (Bloc | Question)[] = [];
  for (const b of blocs) {
    const derniere = r[r.length - 1];
    if (b.type === "titre" && b.niveau === 3) r.push({ type: "question", titre: b.texte, id: b.id, blocs: [] });
    else if (b.type !== "titre" && derniere?.type === "question") derniere.blocs.push(b);
    else r.push(b);
  }
  return r;
}
