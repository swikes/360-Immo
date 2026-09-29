# Base de données de 360-Immo.ci (Supabase)

La base de données garde tout ce que le site doit retenir : annonces, comptes, photos, favoris, messages,
demandes de visite, alertes. Elle est hébergée par **Supabase** (PostgreSQL), en Europe (Paris).

## Le projet Supabase

- Projet **360-immo**, région **West EU (Paris)**, offre gratuite ; le site sur Vercel tourne aussi à Paris.
- Relié au dépôt GitHub `swikes/360-Immo` (réglages Supabase → Integrations → GitHub) : dossier de travail
  **`site`**, **Deploy to production** activé sur la branche **`main`**. À chaque fusion sur `main`, Supabase
  applique les nouvelles migrations ; le tableau de bord du projet affiche la dernière (« Last migration »).
- Le site sur Vercel connaît seulement l'adresse de la base et sa clé publique (réglages de Vercel). Le mot de
  passe de la base et la clé secrète restent chez Supabase, jamais dans le code.
- Limites de l'offre gratuite, mise en pause, erreurs possibles et où regarder : voir
  [DEPANNAGE.md](../DEPANNAGE.md).

## Ce qu'elle contient

| Table | Contenu |
|---|---|
| `villes`, `communes`, `quartiers` | Les lieux de Côte d'Ivoire (mêmes listes que le site : `lib/lieux.ts`) |
| `types_bien` | Les 9 types de bien et ce qui a du sens pour chacun (mêmes règles que `lib/regles-biens.ts`) |
| `profils` | Un profil par compte : prénom, nom, numéro principal et second numéro (avec l'indicatif, « sur WhatsApp » ou non, type du second : mobile, fixe, bureau, autre), rôle (particulier, agence, administrateur), demande d'agence |
| `agences` | Les agences immobilières partenaires |
| `annonces` | Les annonces : transaction, type, prix, lieu (quartier de la liste, ou texte libre s'il n'y est pas), caractéristiques, contact (particulier ou agence, numéros avec WhatsApp, e-mail), statut, fin de validité |
| `photos_annonce` | Les photos de chaque annonce, 20 au plus (fichiers rangés dans le stockage « photos-annonces ») |
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

Un compte **agence** ne se déclare pas soi-même : à l'inscription (ou dans Mon Espace), la personne donne le nom
de son agence ; c'est une **demande**, datée par la base. L'équipe 360-Immo.ci la vérifie puis rattache le compte à
l'agence. En attendant, le compte reste particulier ; la personne peut retirer ou refaire sa demande.

Une annonce passe par ces étapes : **brouillon** → **en attente** (l'auteur la soumet) → **publiée** ou
**refusée** par l'équipe 360-Immo.ci → **archivée** quand le bien est vendu ou loué. L'auteur ne peut pas publier
lui-même, ni se mettre en « Premium », ni se déclarer « vérifié », ni changer le nombre de vues.

Règles de la publication (étape 4), appliquées par la base :
- **90 jours en ligne** à partir de la publication (colonne `expire_le`). Ensuite l'annonce n'est plus visible des
  visiteurs ; son auteur la voit toujours et peut la **renouveler** pour 90 jours (fonction `renouveler_annonce`),
  dans ses 15 derniers jours ou une fois expirée. Seule l'équipe peut changer la date elle-même.
- **Nouvelle vérification** : une annonce en ligne repasse **en attente** si son auteur change la transaction, le
  type de bien, la commune ou le quartier, le prix de plus de 20 %, ou ajoute une photo. Les petites retouches
  (description, prix de moins de 20 %, retrait d'une photo…) restent en ligne.
- **20 photos au plus** par annonce.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `migrations/…_structure.sql` | Les tables, leurs liens et les règles des biens |
| `migrations/…_droits.sql` | Qui voit et qui modifie quoi |
| `migrations/…_references.sql` | Types de bien, villes, communes, quartiers. **Fichier généré** : `npm run base:references` le réécrit depuis les listes du site |
| `migrations/…_photos.sql` | Le stockage des photos (5 Mo au plus, JPEG, PNG ou WebP) |
| `migrations/…_comptes.sql` | Les comptes (étape 3) : WhatsApp, second numéro, demande d'agence, numéros toujours enregistrés avec l'indicatif |
| `migrations/…_publication.sql` | La publication (étape 4) : 90 jours de validité et renouvellement, nouvelle vérification après un gros changement, 20 photos au plus, contact de l'annonce (particulier ou agence, WhatsApp, e-mail), quartier hors liste |
| `references.ts` | Le programme qui écrit les données de référence |
| `config.toml` | Réglage minimal pour l'intégration GitHub de Supabase |

Les migrations s'appliquent dans l'ordre de leur nom, une seule fois chacune, **automatiquement** : l'intégration
GitHub de Supabase (réglée sur le dossier de travail `site`) les envoie à la base à chaque fusion sur `main`. Pour changer la base plus tard,
on **ajoute** une nouvelle migration (on ne modifie jamais une migration déjà appliquée).

## Tests

`tests/base.spec.ts` crée une vraie base PostgreSQL dans l'ordinateur (PGlite, sans installation), y applique
toutes les migrations, puis vérifie : toutes les tables protégées, données de référence à jour, profil créé à
l'inscription (numéros, WhatsApp, demande d'agence qui ne donne pas le rôle d'agence), règles des biens, droits de chacun, publication réservée à l'équipe, validité de 90 jours et renouvellement,
nouvelle vérification après un gros changement, 20 photos au plus, messages, visites, photos.
Ils tournent avec les autres tests : `npm test`.

## Réglages de connexion (tableau de bord Supabase)

Ils ne sont pas dans le code : ils se font une fois dans Supabase, rubrique **Authentication** (voir
[DEPANNAGE.md](../DEPANNAGE.md), « Réglages Supabase pour les comptes ») :
- confirmation de l'e-mail **désactivée pendant la construction** (à réactiver au lancement, avec un service d'e-mails) ;
- adresse du site (**Site URL**) et adresses autorisées (**Redirect URLs**) pour le lien « mot de passe oublié ».

## À venir

- Étape 6 : rappel par e-mail quelques jours avant la fin des 90 jours (avec le service d'e-mails).
- Étape 7 : espace de modération pour l'équipe (publier ou refuser avec un motif), documents. D'ici là, voir
  [DEPANNAGE.md](../DEPANNAGE.md), « Publier une annonce en attendant l'espace de l'équipe ».
- Étape 8 : paiements Premium.
