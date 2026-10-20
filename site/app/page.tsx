/*
 * Page d'accueil (reprise de 360-immo-accueil.html de la maquette).
 * Tout ce qui est chiffré est vrai, lu dans la base (mis à jour chaque minute) : annonces récentes, nombre d'annonces
 * par ville, bandeau des chiffres (annonces, agences vérifiées, villes, annonceurs ; affiché à partir de 100 annonces
 * en ligne : lib/annonces-en-ligne.ts), agences vérifiées qui ont des annonces en ligne (étape 7) ; tant qu'il n'y en a
 * pas, une invitation aux agences. Les chiffres de la maquette (3 842 annonces, 48 agences…) ne sont plus affichés.
 */
import type { Metadata } from "next";
import Link from "next/link";
import AnnoncesRecentes from "@/components/accueil/AnnoncesRecentes";
import Compteur from "@/components/accueil/Compteur";
import MessageBienvenue from "@/components/accueil/MessageBienvenue";
import Recherche from "@/components/accueil/Recherche";
import Icone, { type NomIcone } from "@/components/Icone";
import { RESULTATS_VIDES, bandeauChiffres, lienVitrine, urlLogo } from "@/lib/annonces-en-ligne";
import { agencesPartenaires, chiffres, rechercher } from "@/lib/annonces-serveur";
import { formaterPrix, initialesNom } from "@/lib/format";
import s from "./page.module.css";

// Page préparée à l'avance, puis refaite au plus une fois par minute : rapide, et à jour
export const revalidate = 60;
export const metadata: Metadata = { alternates: { canonical: "/" } };

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
  { nom: "Abidjan", fond: "linear-gradient(135deg, #113b27 0%, #1e5e3f 50%, #39a26f 100%)" },
  { nom: "Yamoussoukro", fond: "linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 100%)" },
  { nom: "Bouaké", fond: "linear-gradient(135deg, #4a2a0f 0%, #7a4a1a 100%)" },
  { nom: "San-Pédro", fond: "linear-gradient(135deg, #0a3a4a 0%, #1a6a7a 100%)" },
  { nom: "Daloa", fond: "linear-gradient(135deg, #2a1a4a 0%, #5a3a8a 100%)" },
];

const nombreAnnonces = (n: number) => (n ? `${formaterPrix(n)} annonce${n > 1 ? "s" : ""}` : "Bientôt des annonces");

const COULEURS = ["var(--green)", "var(--gold)", "var(--green-dark)", "#d85a30", "#534ab7"];

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
  const [recentes, nombres, partenaires] = await Promise.all([
    rechercher({ par_page: 12 }).catch(() => RESULTATS_VIDES),
    chiffres().catch(() => null),
    agencesPartenaires().catch(() => []),
  ]);
  const parVille = nombres?.par_ville ?? {};
  const bandeau = bandeauChiffres(nombres);
  const agences = partenaires.map((a) => ({
    nom: a.nom, annonces: a.annonces, lien: a.vitrine ? lienVitrine(a.vitrine) : null, logo: a.logo ? urlLogo(a.logo) : null,
  }));
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
            Chaque annonce vérifiée avant publication
          </div>
          <h1 className={s.heroTitre}>
            Trouvez votre <em>bien idéal</em>
            <br />
            en <span className={s.dore}>Côte d&apos;Ivoire</span>
          </h1>
          <p className={s.heroTexte}>
            Appartements, villas, maisons et terrains à vendre et à louer partout en Côte d&apos;Ivoire, publiés par des
            particuliers et des agences.
          </p>
        </div>
        <Recherche />
      </section>

      {/* ── Chiffres (les vrais, à partir d'assez d'annonces) ── */}
      {bandeau.length > 0 && (
        <div className={s.chiffres} role="list" aria-label="360-Immo.ci en chiffres">
          {bandeau.map((c) => (
            <div key={c.texte} className={s.chiffre} role="listitem">
              <div className={s.chiffreValeur}>
                <Compteur valeur={c.valeur} />
              </div>
              <div className={s.chiffreTexte}>{c.texte}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Annonces ── */}
      <section className={`${s.section} ${s.apparait}`} id="annonces">
        <EnTete
          surtitre="Biens sélectionnés"
          titre="Annonces récentes & populaires"
          texte="Les dernières annonces publiées, vérifiées par l'équipe 360-Immo.ci."
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
          texte="Des agences dont 360-Immo.ci a vérifié les documents (RCCM) : badge « Agence vérifiée » sur leurs annonces."
        />
        {agences.length === 0 && (
          <div className={s.invitation}>
            <p>
              <strong>Vous êtes une agence immobilière ?</strong> Publiez vos annonces gratuitement, faites vérifier votre agence et
              affichez votre logo ici, parmi les agences de confiance.
            </p>
            <Link href="/connexion?mode=inscription" className={s.invitationBouton}>Créer le compte de mon agence</Link>
          </div>
        )}
        <ul className={s.agences}>
          {agences.map((a, i) => {
            const contenu = (
              <>
                {a.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logo} alt="" className={`${s.agenceLogo} ${s.agenceLogoImage}`} width={60} height={60} loading="lazy" />
                ) : (
                  <div className={s.agenceLogo} style={{ background: COULEURS[i % COULEURS.length] }} aria-hidden="true">
                    {initialesNom(a.nom, "A")}
                  </div>
                )}
                <div className={s.agenceNom}>{a.nom}</div>
                <div className={s.agenceAnnonces}>{a.annonces} annonce{a.annonces > 1 ? "s" : ""}</div>
              </>
            );
            return (
              <li key={a.nom} className={s.agence}>
                {a.lien ? <Link href={a.lien} className={s.agenceLien}>{contenu}</Link> : contenu}
              </li>
            );
          })}
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
            Publiez votre annonce gratuitement sur 360-Immo.ci : vérifiée par notre équipe, elle arrive chez les acheteurs
            et les locataires qui cherchent un bien comme le vôtre.
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
