/*
 * Données de référence de la base : types de bien (et leurs règles), villes, communes, quartiers.
 * Elles viennent des listes du site (lib/regles-biens.ts, lib/lieux.ts) : la base et le site ne
 * peuvent donc pas se contredire.
 *
 *   npm run base:references    réécrit supabase/migrations/20260928120200_references.sql
 *
 * Un test (tests/base.spec.ts) vérifie que ce fichier est à jour.
 * Pour une liste modifiée APRÈS la mise en service de la base (ex. un quartier ajouté), il faudra une
 * nouvelle migration qui ajoute seulement ce qui manque : une migration déjà appliquée ne se rejoue pas.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { QUARTIERS, VILLES_COMMUNES } from "../lib/lieux";
import { TYPES_BIEN, cleType, regles, type UniteLoyer } from "../lib/regles-biens";

export const FICHIER_REFERENCES = path.join(__dirname, "migrations", "20260928120200_references.sql");

const texte = (s: string | null | false) => (s ? `'${s.replace(/'/g, "''")}'` : "null");
const tableau = (liste: string[], type = "text") =>
  liste.length ? `array[${liste.map(texte).join(", ")}]::${type}[]` : `'{}'::${type}[]`;
const UNITE: Record<UniteLoyer, string> = { Nuit: "nuit", Jour: "jour", Mois: "mois", Année: "annee" };

export function sqlReferences(): string {
  const types = TYPES_BIEN.map((nom, i) => {
    const r = regles(nom);
    const meuble = r.meuble === "toujours" ? "toujours" : r.meuble ? "option" : "non";
    const immeuble = r.etage === "toujours" ? "toujours" : r.etage === "option" ? "option" : "non";
    const pieces = r.pieces === "studio" ? "studio" : r.pieces ? "oui" : "non";
    return `  (${[
      texte(cleType(nom)!), texte(nom), i + 1, r.vente, texte(meuble), texte(immeuble), texte(pieces), r.chambres,
      texte(r.sanitaires), tableau(r.loyerPar.map((u) => UNITE[u]), "public.unite_loyer"), r.caution, texte(r.surface),
      tableau(r.commodites),
    ].join(", ")})`;
  });

  const villes = [...new Set(VILLES_COMMUNES.map(([v]) => v))];
  const quartiers = Object.entries(QUARTIERS).flatMap(([v, communes]) =>
    Object.entries(communes).flatMap(([c, qs]) => qs.map((q) => [v, c, q])),
  );

  return `-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — données de référence : types de bien, villes, communes, quartiers
--
-- FICHIER GÉNÉRÉ par supabase/references.ts depuis les listes du site
-- (lib/regles-biens.ts, lib/lieux.ts) : ne pas le modifier à la main.
-- ${TYPES_BIEN.length} types de bien, ${villes.length} villes, ${VILLES_COMMUNES.length} communes, ${quartiers.length} quartiers.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.types_bien
  (cle, nom, ordre, vendable, meuble, immeuble, pieces, chambres, sanitaires, loyer_par, caution, surface, commodites)
values
${types.join(",\n")};

insert into public.villes (nom) values
${villes.map((v) => `  (${texte(v)})`).join(",\n")};

insert into public.communes (ville_id, nom)
select v.id, c.commune
from (values
${VILLES_COMMUNES.map(([v, c]) => `  (${texte(v)}, ${texte(c)})`).join(",\n")}
) as c (ville, commune)
join public.villes v on v.nom = c.ville;

insert into public.quartiers (commune_id, nom)
select co.id, q.quartier
from (values
${quartiers.map(([v, c, q]) => `  (${texte(v)}, ${texte(c)}, ${texte(q)})`).join(",\n")}
) as q (ville, commune, quartier)
join public.villes v on v.nom = q.ville
join public.communes co on co.ville_id = v.id and co.nom = q.commune;
`;
}

// npm run base:references
if (require.main === module) {
  writeFileSync(FICHIER_REFERENCES, sqlReferences());
  console.log("Écrit :", path.relative(process.cwd(), FICHIER_REFERENCES));
}
