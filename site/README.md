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
| 4. Publication | Formulaire « Publier une annonce » (champs selon le type de bien, jusqu'à 20 photos réduites automatiquement, brouillon), vérification par l'équipe avant la mise en ligne, Mon Espace → Mes annonces (modifier, vendu / loué, renouveler, supprimer) ; 90 jours en ligne, renouvelables | ✅ |
| 5. Recherche et fiche d'un bien | Liste des vraies annonces (onglets, filtres de la maquette, tri, pages ; sur téléphone, « Filtres » reste à portée de main), fiche d'un bien (photos en grand, caractéristiques, quartier avec lien Google Maps, numéro affiché après un clic, WhatsApp, partage, biens similaires), accueil avec les vraies annonces, plan du site pour Google | ✅ |
| 5 bis. Vitrine de chaque annonceur | Une page par annonceur (particulier : « Awa K. » ; agence : son nom) avec toutes ses annonces en ligne, la recherche et les filtres ; « Partager cette recherche » (WhatsApp, lien) sur la vitrine et la liste ; « Toutes les annonces de … » sur la fiche ; un particulier apparaît partout sous la forme « Awa K. » (son nom complet vient avec le numéro, après un clic) ; Mon Espace → Mes annonces : encadré « Ma vitrine » et partage de chaque annonce ; menu ☰ « Ma vitrine » | ✅ |
| 6. Échanges | Favoris, messages, demandes de visite, alertes | à venir |
| 7. Contrôle | Modération des annonces, administration, documents | à venir |
| 8. Paiements | Annonces Premium par Mobile Money (Orange, MTN, Moov, Wave) | à venir |
| 9. Lancement | Estimation, carte des prix, blog, pages légales (ARTCI), référencement, nom de domaine | à venir |

## Contenu

| Dossier / fichier | Rôle |
|---|---|
| `app/` | Les pages : `page.tsx` = accueil, `annonces/` (liste) et `annonces/[annonce]/` (fiche d'un bien), `annonceur/[vitrine]/` (vitrine d'un annonceur), `ma-vitrine/` (raccourci vers la sienne), `publier/`… ; `sitemap.ts` et `robots.ts` = plan du site pour Google ; `layout.tsx` = cadre commun (polices, barre du haut, pied de page) ; `globals.css` = couleurs et styles communs à tout le site ; `not-found.tsx` = adresse inconnue |
| `components/` | Les morceaux réutilisés : barre du haut, pied de page, carte d'annonce, icônes… Chacun a ses styles dans un fichier `.module.css` à côté de lui |
| `lib/menu.ts` | **Liens du menu** sur tout le site |
| `lib/supabase.ts` | Connexion du site à la base (adresse et clé publique lues dans les réglages de Vercel) |
| `lib/compte.ts` | Compte de la personne connectée, son profil, **messages d'erreur en français** |
| `lib/telephone.ts` + `components/ChampTelephone.tsx` | Numéros de **tous les pays** : indicatif avec drapeau, vérification selon le pays (mêmes règles que la maquette, vérifié par les tests) |
| `components/compte/` | Pages des comptes : connexion et inscription, mot de passe oublié, nouveau mot de passe, Mon Espace (dont **Mes annonces**) |
| `components/publication/` | Page **Publier une annonce** : formulaire en 8 rubriques, photos, aperçu, boutons « Envoyer pour vérification » et « Enregistrer le brouillon » |
| `lib/annonces.ts` | Annonces d'un compte : enregistrer, photos, vendu / loué, renouveler, supprimer |
| `lib/photos.ts` | **Photos réduites dans le navigateur** avant l'envoi (1600 pixels au plus, format WebP : environ 200 à 400 Ko au lieu de 3 à 8 Mo), remises dans le bon sens ; 20 au plus par annonce |
| `components/PhotoCadree.tsx` | **Affichage d'une photo de bien** dans un cadre de taille fixe : photo entière, même prise en hauteur au téléphone, bords remplis par la même photo floutée (aperçu, vignettes, Mes annonces, et plus tard la recherche et la fiche du bien) |
| `lib/regles-biens.ts` | **La liste des types de bien** (la même que sur la maquette, vérifiée par les tests) et **ce qui a du sens pour chaque type** (terrain sans pièces ni « meublé », pas de location à la journée pour un bureau, chambre d'hôtel en location seulement…) |
| `lib/lieux.ts` | Villes, communes et quartiers |
| `lib/choix-lieu.ts` + `components/ChampLieu.tsx` | Champ « ville, commune ou quartier » avec suggestions (mêmes règles que la maquette : sans accents, quartiers en tapant, liste toujours sous le champ) |
| `lib/recherche.ts` | **La recherche** : adresse de la liste (/annonces?tx=location&type=appartement&q=Cocody…), titre (« Appartements à louer à Cocody »), critères envoyés à la base |
| `lib/annonces-en-ligne.ts` + `lib/annonces-serveur.ts` | Annonces en ligne : types, adresse de la fiche, photo, prix, lieu ; lecture dans la base côté serveur (pages déjà remplies, rapides en 3G, lisibles par Google) |
| `components/annonces/` | Liste des annonces : recherche d'un lieu, onglets, filtres (colonne sur ordinateur, panneau sur téléphone), tri |
| `components/fiche/` | Fiche d'un bien : galerie (plein écran), contact (numéro après un clic, WhatsApp), partage, description, compteur de vues |
| `components/vitrine/` | Vitrine d'un annonceur : présentation (particulier ou agence vérifiée, nombre d'annonces), bandeau « C'est votre vitrine » pour l'annonceur connecté |
| `components/BoutonPartage.tsx` | Bouton « Partager » et son menu (WhatsApp, copier le lien, partage du téléphone) : recherche, vitrine, annonce |
| `components/CarteAnnonce.tsx` | Carte d'une annonce (liste, accueil, biens similaires) : toute la carte mène à la fiche |
| `lib/site.ts` | Adresse publique du site (liens partagés, plan du site) ; au lancement, le nom de domaine (réglage `NEXT_PUBLIC_SITE_URL` dans Vercel) |
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
  adaptés au type de bien et transmis à la liste des annonces, « Publier » mène à la publication, tri des annonces,
  favoris, WhatsApp, chiffres.
- **Base de données** (`tests/base.spec.ts`) : sur une vraie base PostgreSQL créée pendant le test (PGlite) :
  tables protégées, données de référence à jour, règles des biens, droits de chacun, publication réservée à
  l'équipe 360-Immo.ci, messages, visites, photos, vitrines (code propre à chaque compte, nom affiché).
- **Comptes** (`tests/compte.spec.ts`) : inscription d'un particulier et d'une agence (second numéro, WhatsApp,
  indicatif reconnu), arrivée sur l'accueil avec un message de bienvenue (ou retour à la page demandée), erreurs
  expliquées, e-mail déjà utilisé, connexion et « Se souvenir de moi », mot de passe
  oublié, lien expiré, nouveau mot de passe, profil modifié, demande d'agence, déconnexion, liste des pays au
  clavier. Le site y parle à une **fausse base Supabase** (`tests/faux-supabase.ts`), jamais à la vraie.
- **Fausse base des tests** (`tests/base/serveur.mjs`) : la vraie base (PGlite, toutes les migrations) avec des
  **annonces d'exemple** (`tests/base/annonces-exemple.json` : 16 en ligne, une expirée, un brouillon ; un compte par annonceur, dont
  l'agence Kamika Immobilier) ; le site
  construit pour les tests lit ses annonces là (liste, fiche, accueil).
- **Publication** (`tests/publication.spec.ts`) : sans compte, on propose de se connecter puis on revient au
  formulaire ; champs selon le type de bien (terrain, chambre d'hôtel, appartement) ; champs manquants signalés ;
  publication complète avec 2 photos (ce qui est enregistré, photos réduites et dans l'ordre) ; photo prise en
  hauteur montrée en entier sans agrandir l'aperçu ; brouillon hors
  d'Abidjan avec un quartier hors liste, repris puis envoyé ; annonce en ligne retouchée (gros changement de prix →
  nouvelle vérification) ; annonce d'un autre compte refusée ; Mes annonces (renouveler, vendu, remettre en ligne,
  motif de refus, supprimer).
- **Annonces** (`tests/annonces.spec.ts`) : liste (onglets et leurs nombres, pages, filtres écrits dans l'adresse,
  « Tout effacer », critères selon le type de bien, tri par prix, lieu, aucun résultat) ; fiche d'un bien (adresse de
  référence, prix, caution, caractéristiques, quartier et lien Google Maps, **numéro absent de la page avant le clic**,
  WhatsApp prérempli avec la référence, partage, biens similaires, aperçu du lien pour WhatsApp et Facebook, photos en
  grand, une seule vue comptée par visite) ; annonce expirée ou brouillon introuvable ; plan du site.
- **Vitrines** (`tests/vitrine.spec.ts`) : vitrine d'une agence (ses annonces seulement, onglets et filtres qui restent
  sur la vitrine, adresse de référence) ; « Partager cette recherche » (message WhatsApp avec les critères et le lien,
  copier le lien) ; particulier affiché « Awa K. » ; vitrine inconnue ; lien depuis la fiche ; Mes annonces (encadré
  « Ma vitrine », partage de chaque annonce en ligne) ; /ma-vitrine après la connexion, menu, bandeau « C'est votre
  vitrine ».
- **Logique** (`tests/logique.spec.ts`) : règles des biens, adresse de recherche, menu, numéros de téléphone ;
  mêmes types de bien, mêmes suggestions de lieux et mêmes règles de téléphone que la maquette.

Sur un ordinateur :

```bash
cd site
npx playwright install chromium   # une seule fois
# le site des tests parle à une fausse base (tests/base/serveur.mjs, avec des annonces d'exemple), à lancer d'abord :
node tests/base/serveur.mjs &
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build
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
