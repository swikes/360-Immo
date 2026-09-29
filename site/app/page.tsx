/*
 * Page d'accueil (reprise de 360-immo-accueil.html de la maquette).
 * Annonces récentes et nombre d'annonces par ville : les vrais, lus dans la base (mis à jour chaque minute).
 * Chiffres du bandeau et agences : ceux de la maquette, en attendant les agences partenaires (étape 7).
 */
import Link from "next/link";
import AnnoncesRecentes from "@/components/accueil/AnnoncesRecentes";
import Compteur from "@/components/accueil/Compteur";
import MessageBienvenue from "@/components/accueil/MessageBienvenue";
import Recherche from "@/components/accueil/Recherche";
import Icone, { type NomIcone } from "@/components/Icone";
import { RESULTATS_VIDES } from "@/lib/annonces-en-ligne";
import { chiffres, rechercher } from "@/lib/annonces-serveur";
import { formaterPrix } from "@/lib/format";
import s from "./page.module.css";

// Page préparée à l'avance, puis refaite au plus une fois par minute : rapide, et à jour
export const revalidate = 60;

const CHIFFRES = [
  { valeur: 3842, suffixe: "+", texte: "Annonces actives" },
  { valeur: 48, suffixe: "+", texte: "Agences partenaires" },
  { valeur: 32, suffixe: "", texte: "Villes couvertes" },
  { valeur: 12500, suffixe: "+", texte: "Clients satisfaits" },
];

const ETAPES: { icone: NomIcone; couleur: string; titre: string; texte: string }[] = [
  {
    icone: "recherche", couleur: "var(--green)", titre: "Cherchez votre bien",
    texte: "Utilisez nos filtres avancés pour trouver le bien qui correspond à vos besoins et votre budget.",
  },
  {
    icone: "voir", couleur: "var(--gold)", titre: "Consultez les annonces",
    texte: "Parcourez les photos, les détails du bien et les informations de l'agence ou du particulier.",
  },
  {
    icone: "telephone", couleur: "var(--green-mid)", titre: "Contactez l'annonceur",
    texte: "Envoyez un message directement via la plateforme ou demandez à être rappelé.",
  },
  {
    icone: "valide", couleur: "var(--green-dark)", titre: "Finalisez la transaction",
    texte: "Visitez le bien, négociez et finalisez votre location ou votre achat en toute sérénité.",
  },
];

const VILLES = [
  { nom: "Abidjan", fond: "linear-gradient(135deg, #0f4530 0%, #1a6b4a 50%, #2faf78 100%)" },
  { nom: "Yamoussoukro", fond: "linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 100%)" },
  { nom: "Bouaké", fond: "linear-gradient(135deg, #4a2a0f 0%, #7a4a1a 100%)" },
  { nom: "San-Pédro", fond: "linear-gradient(135deg, #0a3a4a 0%, #1a6a7a 100%)" },
  { nom: "Daloa", fond: "linear-gradient(135deg, #2a1a4a 0%, #5a3a8a 100%)" },
];

const nombreAnnonces = (n: number) => (n ? `${formaterPrix(n)} annonce${n > 1 ? "s" : ""}` : "Bientôt des annonces");

const AGENCES = [
  { initiales: "KI", nom: "Kamika Immobilier", annonces: 142, couleur: "var(--green)" },
  { initiales: "AI", nom: "Abidjan Invest", annonces: 98, couleur: "var(--gold)" },
  { initiales: "CI", nom: "CI Bureau Pro", annonces: 76, couleur: "var(--green-dark)" },
  { initiales: "TI", nom: "Terra Invest CI", annonces: 63, couleur: "#d85a30" },
  { initiales: "MP", nom: "Maison Plus CI", annonces: 55, couleur: "#534ab7" },
];

function EnTete({ surtitre, titre, texte }: { surtitre: string; titre: string; texte: string }) {
  return (
    <div className={s.enTete}>
      <span className={s.surtitre}>{surtitre}</span>
      <h2 className={s.titreSection}>{titre}</h2>
      <p className={s.sousTitre}>{texte}</p>
    </div>
  );
}

export default async function Accueil() {
  // Si la base ne répond pas, l'accueil s'affiche quand même (sans annonces)
  const [recentes, parVille] = await Promise.all([
    rechercher({ par_page: 12 }).catch(() => RESULTATS_VIDES),
    chiffres().then((c) => c.par_ville, () => ({}) as Record<string, number>),
  ]);
  return (
    <>
      {/* Juste après la connexion ou l'inscription : « Vous êtes connecté… » */}
      <MessageBienvenue />

      {/* ── Haut de page et recherche ── */}
      <section className={s.hero}>
        <div className={s.decor} aria-hidden="true">
          <div className={s.heroFond} />
          <div className={s.bulle1} />
          <div className={s.bulle2} />
        </div>
        <div className={s.heroContenu}>
          <div className={s.badge}>
            <span className={s.badgePoint} />
            N°1 de l&apos;immobilier en Côte d&apos;Ivoire
          </div>
          <h1 className={s.heroTitre}>
            Trouvez votre <em>bien idéal</em>
            <br />
            en <span className={s.dore}>Côte d&apos;Ivoire</span>
          </h1>
          <p className={s.heroTexte}>
            Des milliers d&apos;appartements, villas, maisons et terrains disponibles à la vente et à la location
            partout en Côte d&apos;Ivoire.
          </p>
        </div>
        <Recherche />
      </section>

      {/* ── Chiffres ── */}
      <div className={s.chiffres}>
        {CHIFFRES.map((c) => (
          <div key={c.texte} className={s.chiffre}>
            <div className={s.chiffreValeur}>
              <Compteur valeur={c.valeur} suffixe={c.suffixe} />
            </div>
            <div className={s.chiffreTexte}>{c.texte}</div>
          </div>
        ))}
      </div>

      {/* ── Annonces ── */}
      <section className={`${s.section} ${s.apparait}`} id="annonces">
        <EnTete
          surtitre="Biens sélectionnés"
          titre="Annonces récentes & populaires"
          texte="Découvrez nos meilleures offres mises en avant par nos agences partenaires."
        />
        <AnnoncesRecentes annonces={recentes.annonces} />
      </section>

      {/* ── Comment ça marche ── */}
      <section className={`${s.section} ${s.blanc} ${s.apparait}`} id="comment-ca-marche">
        <EnTete
          surtitre="Comment ça marche"
          titre="Simple, rapide et efficace"
          texte="Que vous cherchiez à louer, acheter ou vendre, 360-Immo.ci vous accompagne à chaque étape."
        />
        <ol className={s.etapes}>
          {ETAPES.map((e, i) => (
            <li key={e.titre} className={s.etape}>
              <span className={s.etapeNumero} aria-hidden="true">
                {i + 1}
              </span>
              <div className={s.etapeIcone} style={{ background: e.couleur }}>
                <Icone nom={e.icone} taille={30} epaisseur={1.8} />
              </div>
              <h3 className={s.etapeTitre}>{e.titre}</h3>
              <p className={s.etapeTexte}>{e.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Villes ── */}
      <section className={`${s.section} ${s.apparait}`}>
        <EnTete
          surtitre="Recherche par ville"
          titre="Explorez nos destinations"
          texte="Des annonces dans toutes les grandes villes et communes de Côte d'Ivoire."
        />
        <div className={s.villes}>
          {VILLES.map((v) => (
            <Link
              key={v.nom}
              href={"/annonces?q=" + encodeURIComponent(v.nom)}
              className={s.ville}
              style={{ background: v.fond }}
            >
              <span className={s.villeInfo}>
                <span className={s.villeNom}>{v.nom}</span>
                <span className={s.villeAnnonces}>{nombreAnnonces(parVille[v.nom] ?? 0)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Agences ── */}
      <section className={`${s.section} ${s.blanc} ${s.apparait}`} id="agences">
        <EnTete
          surtitre="Nos partenaires"
          titre="Agences immobilières de confiance"
          texte="Des professionnels vérifiés et certifiés par 360-Immo.ci pour vous garantir les meilleures offres."
        />
        <ul className={s.agences}>
          {AGENCES.map((a) => (
            <li key={a.nom} className={s.agence}>
              <div className={s.agenceLogo} style={{ background: a.couleur }} aria-hidden="true">
                {a.initiales}
              </div>
              <div className={s.agenceNom}>{a.nom}</div>
              <div className={s.agenceAnnonces}>{a.annonces} annonces</div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Appel à publier ── */}
      <section className={s.appel} id="vendre">
        <div className={s.appelMotif} />
        <div className={s.appelContenu}>
          <h2 className={s.appelTitre}>
            Vous avez un bien à <em>vendre ou à louer</em> ?
          </h2>
          <p className={s.appelTexte}>
            Publiez votre annonce gratuitement sur 360-Immo.ci et touchez des milliers d&apos;acheteurs et de
            locataires potentiels chaque jour.
          </p>
          <div className={s.appelBoutons}>
            <Link href="/publier" className={s.appelPlein}>
              Publier une annonce gratuite
            </Link>
            <a href="#comment-ca-marche" className={s.appelContour}>
              En savoir plus
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
