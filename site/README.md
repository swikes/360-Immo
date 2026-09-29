# 360-Immo.ci — nouveau site

Le vrai site 360-Immo.ci, construit avec **Next.js** (React + TypeScript), qui prendra la suite de la
maquette HTML (à la racine du dépôt, en ligne sur https://swikes.github.io/360-Immo/).

La maquette reste en ligne et inchangée pendant la construction : les pages pas encore reconstruites
y renvoient (bouton « Voir sur la maquette », avec la même recherche).

## Plan de construction

| Étape | Contenu | État |
|---|---|---|
| 1. Socle | Styles communs, barre du haut et menu ☰, pied de page, page d'accueil, tests automatiques | ✅ |
| 2. Base de données | Tables, règles des biens et droits d'accès, testés et installés sur Supabase à Paris (`supabase/`) | ✅ |
| 3. Comptes | Inscription (particulier ou agence), connexion, mot de passe oublié, Mon Espace (profil, numéros, demande d'agence) ; téléphone obligatoire, indicatif de tous les pays | ✅ |
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
| `lib/supabase.ts` | Connexion du site à la base (adresse et clé publique lues dans les réglages de Vercel) |
| `lib/compte.ts` | Compte de la personne connectée, son profil, **messages d'erreur en français** |
| `lib/telephone.ts` + `components/ChampTelephone.tsx` | Numéros de **tous les pays** : indicatif avec drapeau, vérification selon le pays (mêmes règles que la maquette, vérifié par les tests) |
| `components/compte/` | Pages des comptes : connexion et inscription, mot de passe oublié, nouveau mot de passe, Mon Espace |
| `lib/regles-biens.ts` | **La liste des types de bien** (la même que sur la maquette, vérifiée par les tests) et **ce qui a du sens pour chaque type** (terrain sans pièces ni « meublé », pas de location à la journée pour un bureau, chambre d'hôtel en location seulement…) |
| `lib/lieux.ts` | Villes, communes et quartiers |
| `lib/choix-lieu.ts` + `components/ChampLieu.tsx` | Champ « ville, commune ou quartier » avec suggestions (mêmes règles que la maquette : sans accents, quartiers en tapant, liste toujours sous le champ) |
| `lib/recherche.ts` | Adresse de la liste des annonces pour une recherche |
| `lib/annonces-demo.ts` | Annonces de démonstration de l'accueil (remplacées par les vraies annonces à l'étape 5) |
| `lib/maquette.ts` | Adresse de la maquette, pour les pages pas encore reconstruites |
| `vercel.json` | Réglages de la mise en ligne sur Vercel (Next.js, serveurs à Paris) |
| `supabase/` | **Base de données** : tables, règles, droits d'accès, données de référence (voir [supabase/README.md](supabase/README.md)) |
| `DEPANNAGE.md` | **Vercel et Supabase** : à quoi ils servent, limites et coûts, **que faire en cas d'erreur** (voir [DEPANNAGE.md](DEPANNAGE.md)) |
| `tests/` | Tests automatiques (Playwright) |

## Travailler sur le site

Il faut [Node.js](https://nodejs.org) version 22.

```bash
cd site
npm install
npm run dev          # site en direct sur http://localhost:3000 (se met à jour à chaque modification)
```

Pour les comptes sur l'ordinateur : créer dans `site/` un fichier `.env.local` avec les deux lignes copiées depuis
Supabase (bouton **Connect** → **Frameworks** → **Next.js**). Ce fichier reste sur l'ordinateur : il n'est jamais
envoyé sur GitHub.

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
- **Comptes** (`tests/compte.spec.ts`) : inscription d'un particulier et d'une agence (second numéro, WhatsApp,
  indicatif reconnu), arrivée sur l'accueil avec un message de bienvenue (ou retour à la page demandée), erreurs
  expliquées, e-mail déjà utilisé, connexion et « Se souvenir de moi », mot de passe
  oublié, lien expiré, nouveau mot de passe, profil modifié, demande d'agence, déconnexion, liste des pays au
  clavier. Le site y parle à une **fausse base Supabase** (`tests/faux-supabase.ts`), jamais à la vraie.
- **Logique** (`tests/logique.spec.ts`) : règles des biens, adresse de recherche, menu, numéros de téléphone ;
  mêmes types de bien, mêmes suggestions de lieux et mêmes règles de téléphone que la maquette.

Sur un ordinateur :

```bash
cd site
npx playwright install chromium   # une seule fois
# le site des tests parle à une fausse base (tests/faux-supabase.ts) :
NEXT_PUBLIC_SUPABASE_URL=http://supabase.test NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build
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

Le site a besoin de deux réglages dans Vercel (**Environment Variables**) pour joindre la base :
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (voir [DEPANNAGE.md](DEPANNAGE.md)). Sans eux,
le site marche, mais les comptes affichent « Les comptes ouvrent bientôt ».

**En cas d'erreur** (site pas à jour, page blanche, base en pause…) : voir [DEPANNAGE.md](DEPANNAGE.md).
