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

Ce que voient les visiteurs (étape 5), par des fonctions de la base que le site appelle :
- **`annonces_en_ligne`** : les annonces publiées et pas expirées, avec les noms du lieu et les photos ;
- **`rechercher_annonces`** : la liste filtrée (mêmes critères que la maquette : transaction, location au mois ou à la
  journée, types, lieu, budget ramené au mois, pièces, chambres, surface, salles de bain, caution, meublé, étage,
  commodités, avec photos, récentes, vérifiées), triée (Premium en tête, puis les plus récentes ; ou par prix), par
  pages, avec les nombres par onglet et par type ;
- **`annonce_publique`**, **`annonces_similaires`**, **`chiffres_annonces`** (accueil), **`plan_du_site`** (Google) ;
- **`contact_annonce`** : numéros et e-mail de l'annonceur, **seulement sur demande** (bouton « Afficher le numéro »).
  Un visiteur sans compte ne peut plus lire les numéros ni l'e-mail directement dans la table des annonces ; la
  position exacte (latitude, longitude) n'est jamais montrée. Les comptes connectés, eux, peuvent encore les lire
  annonce par annonce (à revoir si des robots s'inscrivent pour récolter des numéros) ;
- **`compter_vue`** : une vue de plus (par visite du navigateur), sans changer la date de « dernière modification ».

## Les fichiers

| Fichier | Rôle |
|---|---|
| `migrations/…_structure.sql` | Les tables, leurs liens et les règles des biens |
| `migrations/…_droits.sql` | Qui voit et qui modifie quoi |
| `migrations/…_references.sql` | Types de bien, villes, communes, quartiers. **Fichier généré** : `npm run base:references` le réécrit depuis les listes du site |
| `migrations/…_photos.sql` | Le stockage des photos (5 Mo au plus, JPEG, PNG ou WebP) |
| `migrations/…_comptes.sql` | Les comptes (étape 3) : WhatsApp, second numéro, demande d'agence, numéros toujours enregistrés avec l'indicatif |
| `migrations/…_recherche.sql` | La recherche et la fiche d'un bien (étape 5) : annonces en ligne, filtres, tri, pages, biens similaires, nombres de l'accueil, plan du site, contact sur demande, numéros cachés aux visiteurs |
| `migrations/…_vitrines.sql` | La vitrine de chaque annonceur : un code par compte (dans l'adresse /annonceur/…), nom affiché (agence, ou « Prénom I. » pour un particulier), annonceur de chaque annonce en ligne, filtre « annonceur » de la recherche |
| `migrations/…_nom_discret.sql` | Sur les pages publiques, un particulier apparaît sous le nom de sa vitrine (« Awa K. ») ; son nom complet n'est donné qu'avec les numéros (« Afficher le numéro ») |
| `migrations/…_coordonnees_privees.sql` | Nom complet, numéros, e-mail et position exacte d'une annonce : lisibles seulement par son auteur (`mes_annonces()`), même pour un compte connecté ; les visiteurs les obtiennent par « Afficher le numéro » |
| `migrations/…_favoris_messages.sql` | Favoris et messages (étape 6) : cartes des annonces mises de côté, écrire à l'annonceur, conversations avec noms discrets et non lus, messages lus, 20 nouvelles conversations par jour au plus |
| `migrations/…_visites.sql` | Demandes de visite (étape 6) : avec ou sans compte, créneau dans les 60 jours, 5 demandes par jour et par numéro, une seule en cours par bien ; l'annonceur confirme, propose un autre créneau ou refuse, le visiteur accepte ou annule (`repondre_visite`) ; créneaux déjà pris ; messages non lus et visites à traiter (`compteurs`) |
| `migrations/…_alertes_emails.sql` | Alertes de recherche (adresse, jeton du lien « Arrêter », 10 par compte) et e-mails (étape 6) : préférences des comptes, file des e-mails remplie par la base (nouveau message, visites, alertes et rappels de fin préparés chaque matin), lue par le site avec la clé secrète (`notifications_a_envoyer`, `notification_envoyee`) |
| `migrations/…_alertes_souhaits.sql` | Alertes réglées dans la fenêtre « Créer une alerte » : essentiels bloquants (louer ou acheter, type, lieu, budget plafond strict et minimum s'il est donné, pièces au moins, surface au moins pour un terrain, un bureau ou un commerce, titre foncier pour un terrain : `alerte_correspond`) et souhaits non bloquants (meublé, chambres, surface d'un logement, commodités : `alerte_souhaits`) qui classent l'e-mail ; les alertes d'avant gardent leur recherche d'origine |
| `migrations/…_moderation.sql` | Modération (étape 7) : signalements des visiteurs (`signaler_annonce`, avec ou sans compte), décisions de l'équipe (`moderer_annonce` : publier, refuser ou retirer avec un motif ; `traiter_signalements` : retirer ou classer), journal (`moderations`), ce que voit l'équipe (`admin_tableau`, `admin_a_verifier`, `admin_signalements`, `admin_journal`), e-mail à l'annonceur, annonces à traiter dans `compteurs` ; tout est refusé à un compte qui n'est pas « admin » |
| `migrations/…_comptes_agences.sql` | Équipe, comptes et agences (étape 7) : accès administrateur donné ou retiré depuis le site (`changer_acces_admin`, jamais le sien), recherche de comptes, suspension (`suspendre_compte` : annonces retirées, publications, messages, visites, rappels et alertes bloqués ; `reactiver_compte`), demandes d'agence (`valider_agence` : nouvelle agence ou rattachement ; `refuser_agence`), `modifier_agence` (badge « vérifiée »), `agences_partenaires` pour l'accueil, journal des actions (`actions_equipe`), e-mails « compte » |
| `migrations/…_documents.sql` | Vérification par l'équipe (étape 7) : dossiers de stockage `documents` (**privé** : chacun le sien, l'équipe lit tout ; photos et PDF, 10 Mo) et `logos` (public, 2 Mo), demandes (`verifications` : identité, agence, bien ; pièces obligatoires de `pieces_verification` ; une demande en cours à la fois ; `demander_verification`, `mes_verifications`), décisions de l'équipe (`admin_verifications`, `traiter_verification` : badge, ou refus avec un motif ; renvoie les documents à supprimer), badges (`identite_verifiee_le`, `agences.verifiee` et `logo`, `annonces.verifiee`) dans `annonceur_public`, `vitrine`, `logo_annonceur` et `agences_partenaires`, journal, e-mails « compte », documents à vérifier dans `admin_tableau` et `compteurs` |
| `migrations/…_statistiques.sql` | Statistiques de l'annonceur : relevé par annonce et par jour (vues, numéros affichés, appels, WhatsApp, e-mails, partages ; `compter_vue`, `noter_action` ; l'auteur ne compte pas ; table lisible seulement par les fonctions), `statistiques_annonceur(jours)` : totaux et période d'avant, jour par jour, par annonce avec messages, visites, rappels, favoris, envois par les alertes et prix médian des annonces semblables |
| `migrations/…_rappels.sql` | « Être rappelé » (étape 6) : avec ou sans compte, 5 demandes par jour et par numéro, une seule en attente par bien ; l'annonceur marque « rappelé » (`traiter_rappel`), le demandeur annule ; `mes_rappels` ; rappels à faire dans `compteurs` ; e-mail à l'annonceur |
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
nouvelle vérification après un gros changement, 20 photos au plus, recherche (chaque critère, tri, pages,
nombres), fiche d'un bien, biens similaires, contact sur demande et numéros cachés aux visiteurs, vues, messages,
visites, photos, modération, comptes et agences, documents de vérification (dossier privé, pièces obligatoires,
décisions de l'équipe, badges, logo).
Ils tournent avec les autres tests : `npm test`.

## Réglages de connexion (tableau de bord Supabase)

Ils ne sont pas dans le code : ils se font une fois dans Supabase, rubrique **Authentication** (voir
[DEPANNAGE.md](../DEPANNAGE.md), « Réglages Supabase pour les comptes ») :
- confirmation de l'e-mail **désactivée pendant la construction** (à réactiver au lancement, avec un service d'e-mails) ;
- adresse du site (**Site URL**) et adresses autorisées (**Redirect URLs**) pour le lien « mot de passe oublié ».

## À venir

- Étape 6 : favoris, messages, visites, alertes ; rappel par e-mail quelques jours avant la fin des 90 jours (avec le service d'e-mails).
- Étape 7 (faite) : espace Administration pour l'équipe (`/admin` : modération, documents de vérification et badges,
  comptes, agences, équipe). Voir [DEPANNAGE.md](../DEPANNAGE.md), « Vérifier les annonces : l'espace Administration ».
- Étape 8 : paiements Premium.
