# Base de données de 360-Immo.ci (Supabase)

La base de données garde tout ce que le site doit retenir : annonces, comptes, photos, favoris, messages,
demandes de visite, alertes. Elle est hébergée par **Supabase** (PostgreSQL), en Europe (Paris).

## Ce qu'elle contient

| Table | Contenu |
|---|---|
| `villes`, `communes`, `quartiers` | Les lieux de Côte d'Ivoire (mêmes listes que le site : `lib/lieux.ts`) |
| `types_bien` | Les 9 types de bien et ce qui a du sens pour chacun (mêmes règles que `lib/regles-biens.ts`) |
| `profils` | Un profil par compte : prénom, nom, téléphone, rôle (particulier, agence, administrateur) |
| `agences` | Les agences immobilières partenaires |
| `annonces` | Les annonces : transaction, type, prix, lieu, caractéristiques, contact, statut |
| `photos_annonce` | Les photos de chaque annonce (fichiers rangés dans le stockage « photos-annonces ») |
| `favoris` | Les annonces mises de côté par chaque compte |
| `conversations`, `messages` | Les échanges entre une personne intéressée et l'annonceur |
| `visites` | Les demandes de visite (possibles sans compte) |
| `alertes` | Les recherches enregistrées, pour être prévenu des nouvelles annonces |

## Les règles, vérifiées par la base elle-même

Même si quelqu'un contournait le site, la base refuse ce qui n'a pas de sens, avec un message clair :
terrain « déjà meublé » ou avec des pièces, chambre d'hôtel à vendre, loyer « par mois » sur une vente,
3 pièces et 3 chambres (le séjour compte pour une pièce), villa à un étage d'immeuble, piscine sur un terrain,
quartier qui n'est pas dans la commune choisie…

## Qui voit et qui modifie quoi

- **Tout le monde, même sans compte** : les lieux, les types de bien, les agences, les annonces **publiées** et
  leurs photos ; demander une visite.
- **Chaque compte** : son profil, ses annonces (même en brouillon), ses favoris, ses conversations, ses alertes,
  les demandes de visite de ses annonces. Jamais celles des autres.
- **L'équipe 360-Immo.ci (administrateurs)** : tout.

Une annonce passe par ces étapes : **brouillon** → **en attente** (l'auteur la soumet) → **publiée** ou
**refusée** par l'équipe 360-Immo.ci → **archivée** quand le bien est vendu ou loué. L'auteur ne peut pas publier
lui-même, ni se mettre en « Premium », ni se déclarer « vérifié », ni changer le nombre de vues.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `migrations/…_structure.sql` | Les tables, leurs liens et les règles des biens |
| `migrations/…_droits.sql` | Qui voit et qui modifie quoi |
| `migrations/…_references.sql` | Types de bien, villes, communes, quartiers. **Fichier généré** : `npm run base:references` le réécrit depuis les listes du site |
| `migrations/…_photos.sql` | Le stockage des photos (5 Mo au plus, JPEG, PNG ou WebP) |
| `references.ts` | Le programme qui écrit les données de référence |

Les migrations s'appliquent dans l'ordre de leur nom, une seule fois chacune. Pour changer la base plus tard,
on **ajoute** une nouvelle migration (on ne modifie jamais une migration déjà appliquée).

## Tests

`tests/base.spec.ts` crée une vraie base PostgreSQL dans l'ordinateur (PGlite, sans installation), y applique
toutes les migrations, puis vérifie : toutes les tables protégées, données de référence à jour, profil créé à
l'inscription, règles des biens, droits de chacun, publication réservée à l'équipe, messages, visites, photos.
Ils tournent avec les autres tests : `npm test`.

## À venir

- Brancher le site sur la base (étape 3 : comptes et connexion ; étape 4 : publication avec photos).
- Plus tard : modération détaillée et documents (étape 7), paiements Premium (étape 8).
