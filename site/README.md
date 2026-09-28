# 360-Immo.ci — nouveau site

Le vrai site 360-Immo.ci, construit avec **Next.js** (React + TypeScript), qui prendra la suite de la
maquette HTML (à la racine du dépôt, en ligne sur https://swikes.github.io/360-Immo/).

La maquette reste en ligne et inchangée pendant la construction : les pages pas encore reconstruites
y renvoient (bouton « Voir sur la maquette », avec la même recherche).

## Plan de construction

| Étape | Contenu | État |
|---|---|---|
| 1. Socle | Styles communs, barre du haut et menu ☰, pied de page, page d'accueil, tests automatiques | ✅ |
| 2. Base de données | Tables, règles des biens et droits d'accès, prêts et testés (`supabase/`) ; à installer sur Supabase | en cours |
| 3. Comptes | Inscription, connexion, Mon Espace (téléphone obligatoire, indicatif de tous les pays) | à venir |
| 4. Publication | Formulaire « Publier une annonce » avec photos, règles des biens | à venir |
| 5. Recherche et filtres | Liste des annonces, critères avancés, fiche d'un bien | à venir |
| 6. Échanges | Favoris, messages, demandes de visite, alertes | à venir |
| 7. Contrôle | Modération des annonces, administration, documents | à venir |
| 8. Paiements | Annonces Premium par Mobile Money (Orange, MTN, Moov, Wave) | à venir |
| 9. Lancement | Estimation, carte des prix, blog, pages légales (ARTCI), référencement, nom de domaine | à venir |

## Contenu

| Dossier / fichier | Rôle |
|---|---|
| `app/` | Les pages : `page.tsx` = accueil, `annonces/`, `publier/`… ; `layout.tsx` = cadre commun (polices, barre du haut, pied de page) ; `globals.css` = couleurs et styles communs à tout le site ; `not-found.tsx` = adresse inconnue |
| `components/` | Les morceaux réutilisés : barre du haut, pied de page, carte d'annonce, icônes… Chacun a ses styles dans un fichier `.module.css` à côté de lui |
| `lib/menu.ts` | **Liens du menu** sur tout le site |
| `lib/regles-biens.ts` | **La liste des types de bien** (la même que sur la maquette, vérifiée par les tests) et **ce qui a du sens pour chaque type** (terrain sans pièces ni « meublé », pas de location à la journée pour un bureau, chambre d'hôtel en location seulement…) |
| `lib/lieux.ts` | Villes, communes et quartiers |
| `lib/choix-lieu.ts` + `components/ChampLieu.tsx` | Champ « ville, commune ou quartier » avec suggestions (mêmes règles que la maquette : sans accents, quartiers en tapant, liste toujours sous le champ) |
| `lib/recherche.ts` | Adresse de la liste des annonces pour une recherche |
| `lib/annonces-demo.ts` | Annonces de démonstration de l'accueil (remplacées à l'étape 2) |
| `lib/maquette.ts` | Adresse de la maquette, pour les pages pas encore reconstruites |
| `vercel.json` | Réglages de la mise en ligne sur Vercel (Next.js, serveurs à Paris) |
| `supabase/` | **Base de données** : tables, règles, droits d'accès, données de référence (voir [supabase/README.md](supabase/README.md)) |
| `tests/` | Tests automatiques (Playwright) |

## Travailler sur le site

Il faut [Node.js](https://nodejs.org) version 22.

```bash
cd site
npm install
npm run dev          # site en direct sur http://localhost:3000 (se met à jour à chaque modification)
```

## Tests automatiques

À chaque envoi sur GitHub, le site est vérifié (`npm run lint`), construit (`npm run build`), puis ouvert
dans un navigateur sur ordinateur et sur téléphone :

- **Pages** (`tests/pages.spec.ts`) : chaque page s'ouvre sans erreur ; barre du haut sur une ligne de 320
  à 1366 px ; lien de la page en cours mis en avant ; menu ☰ ; aucune page plus large qu'un téléphone ;
  adresse inconnue.
- **Accueil** (`tests/accueil.spec.ts`) : la recherche transmet ses critères, location à la journée
  seulement pour un logement, lieu (quartiers, clavier, téléphone clavier ouvert), « Plus de critères »
  adaptés au type de bien et transmis à la liste des annonces, Vendre mène à la publication, tri des annonces,
  favoris, WhatsApp, chiffres.
- **Base de données** (`tests/base.spec.ts`) : sur une vraie base PostgreSQL créée pendant le test (PGlite) :
  tables protégées, données de référence à jour, règles des biens, droits de chacun, publication réservée à
  l'équipe 360-Immo.ci, messages, visites, photos.
- **Logique** (`tests/logique.spec.ts`) : règles des biens, adresse de recherche, menu ; mêmes types de bien et
  mêmes suggestions de lieux que la maquette.

Sur un ordinateur :

```bash
cd site
npx playwright install chromium   # une seule fois
npm run build
npm test                          # ordinateur + téléphone
npm run rapport                   # rapport détaillé
```

## Mise en ligne (Vercel)

1. Créer un compte sur https://vercel.com avec le compte GitHub (« Continue with GitHub »).
2. **Add New… → Project**, choisir le dépôt `360-Immo`.
3. Dans **Root Directory**, choisir le dossier **`site`** (important : le reste du dépôt est la maquette).
4. **Deploy**. Vercel donne une adresse du type `https://360-immo.vercel.app`.

Le fichier `vercel.json` indique à Vercel qu'il s'agit d'un site **Next.js** (sans lui, Vercel peut chercher
un dossier `public` et échouer) et fait tourner les pages calculées à la demande à **Paris** (`cdg1`),
le plus près d'Abidjan et de la base de données.

Ensuite, chaque fusion sur `main` met le site à jour tout seul, et chaque pull request reçoit sa propre
adresse d'aperçu pour tester avant de fusionner.

À savoir : l'offre gratuite de Vercel (« Hobby ») est réservée aux projets non commerciaux ; au lancement
public du site, passer à l'offre « Pro ».
