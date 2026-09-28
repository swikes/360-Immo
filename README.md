# 360-Immo.ci

Maquette du site d'annonces immobilières **360-Immo.ci** (location et vente en Côte d'Ivoire).

Site en ligne : https://swikes.github.io/360-Immo/

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Point d'entrée : redirige vers l'accueil |
| `360-immo-*.html` | Les 10 pages du site (accueil, résultats, fiche du bien, publication, estimation, connexion, Mon Espace, documents, carte des prix, blog) |
| `css/commun.css` | Styles communs à toutes les pages : couleurs, ombres, arrondis, barre du haut, petits messages. Pour changer une couleur ou la hauteur de la barre du haut partout, c'est ici |
| `js/commun.js` | Fonctions communes à toutes les pages (petit message en bas de l'écran : `showToast`) |
| `js/villes-communes.js` | Liste des villes, communes et quartiers (un seul endroit à modifier) |
| `js/choix-lieu.js` | Liste déroulante avec recherche pour choisir une ville, une commune ou un quartier |
| `js/verif-formulaire.js` | Vérification des formulaires (champs obligatoires, email, téléphone…) |
| `tests/` | Tests automatiques |

## Tests automatiques

À chaque envoi sur GitHub, les pages sont ouvertes dans un navigateur, **sur ordinateur et sur
téléphone**, et vérifiées :

- **Pages** (`tests/pages.spec.js`) : chargement sans erreur ; barre du haut identique sur toutes les pages,
  sur une ligne à toutes les largeurs (de 320 à 1366 px) ; petits messages.
- **Liens** (`tests/liens.spec.js`) : aucun lien vers une page ou un script qui n'existe pas.
- **Largeur sur téléphone** (`tests/largeur-mobile.spec.js`) : aucune page (ni étape, fenêtre ou section)
  plus large que l'écran, à 320 et 390 px.
- **Parcours** (`tests/parcours.spec.js`) : recherche, filtres, visite, publication, estimation,
  connexion, inscription, documents, menu et favoris de Mon Espace, messages.
- **Formulaires** (`tests/formulaires.spec.js`) : un envoi incomplet ou invalide est refusé avec un message.
- **Villes et communes** (`tests/villes-communes.spec.js`) : recherche tolérante, champs liés.

### Voir les résultats sur GitHub

- Sur une pull request ou un commit : ✅ tous les tests passent, ❌ au moins un échoue.
- Détail : onglet **Actions** → dernier passage de « Tests automatiques ». En bas de la page, le
  **rapport** (`rapport-tests`) se télécharge ; il contient, pour chaque échec, une capture d'écran.

### Lancer les tests sur un ordinateur

Il faut [Node.js](https://nodejs.org) (version 18 ou plus) et Python 3.

```bash
npm install
npx playwright install chromium
npm test                   # tous les tests (ordinateur + téléphone)
npm run test:telephone     # seulement la version téléphone
npm run rapport            # ouvrir le rapport détaillé
```
