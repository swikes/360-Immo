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

**Deux types de compte, bien séparés** : une agence reste une agence, un particulier reste un particulier.
- Un **compte agence** (rattaché à une agence par l'équipe) publie toutes ses annonces comme « Agence immobilière »,
  au **nom de l'agence enregistré par l'équipe** ; badge « Agence vérifiée » une fois le **RCCM** contrôlé.
- Un **particulier** (y compris pendant une demande d'agence) publie toutes ses annonces comme « Particulier », au
  **nom de son compte** : celui que l'équipe compare à sa pièce d'identité (CNI ou passeport) ; le changer retire le
  badge « Identité vérifiée ». Les visiteurs voient « Awa K. », le nom complet est donné avec les numéros.
- Jamais de nom écrit à la main sur une annonce ; agence validée ou renommée, nom changé : les annonces suivent.

Une annonce passe par ces étapes : **brouillon** → **en attente** (l'auteur la soumet) → **publiée** ou
**refusée** par l'équipe 360-Immo.ci → **archivée** quand le bien est vendu ou loué. L'auteur ne peut pas publier
lui-même, ni se mettre en « Premium », ni se déclarer « vérifié », ni changer le nombre de vues.

Ces règles tiennent **même si quelqu'un appelle la base directement** avec la clé publique (celle qui est dans le
site, visible de tous), sans passer par les pages : chaque table a ses règles d'accès, et les colonnes réservées
(rôle, suspension, badges, statut publié, Premium, vues, dates de création, de publication et d'envoi en
vérification, agence d'une annonce…) sont remises à leur valeur par la base. Le test « Attaque de l'extérieur »
essaie, à chaque fois, de changer **chaque colonne** de ses propres lignes, puis de tout supprimer ou modifier sans
compte : une colonne nouvelle oubliée le fait échouer.

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
| `migrations/…_identite_comptes.sql` | Identité vérifiée utile en cas de plainte (étape 7) : CNI (recto et verso) ou passeport, numéro et date de fin notés par l'équipe (`traiter_verification`), une pièce par compte, badge jusqu'à la date de fin, retiré si le nom change ; pièce validée gardée tant que le compte existe puis 1 an (`conserver_jusqu_au`), autres documents supprimés, ménage du matin (`documents_a_supprimer`, `documents_supprimes` : clé secrète) ; plainte : `admin_pieces_conservees`, `consulter_pieces` (motif au journal ; sans lui, le dossier privé reste fermé à l'équipe pour ces pièces). Un numéro principal et un e-mail par compte (`inscription_possible`, Gmail sans points ni « +… », adresses jetables), numéros partagés et `liberer_numero`. Droits : fonctions internes (e-mails « compte », journal, fiche d'un compte) fermées aux visiteurs et aux comptes |
| `migrations/…_doublons.sql` | Un bien = une seule annonce : empreinte de chaque photo (`photos_annonce.empreinte`, calculée dans le navigateur ; `empreintes_proches`), trace de 30 jours des annonces supprimées (`annonces_effacees`, sans coordonnées), `biens_semblables` (type, transaction, commune et quartier, unité, prix à 10 %, pièces, surface à 15 %, étage), `annonces_semblables` (à l'envoi : ses annonces semblables, jamais celles des autres), `admin_a_verifier` + « doublons » (annonces semblables du même auteur, photos déjà utilisées par un autre annonceur, doublons déjà refusés), refus ou retrait « pour doublon » (`moderer_annonce`, `traiter_signalements` : compté dans `moderations.doublon`, e-mail d'avertissement au 2e) |
| `migrations/…_disponibles.sql` | Plusieurs biens identiques dans une seule annonce (même résidence, même lotissement) : `annonces.disponibles` (1 à 99, 1 d'office ; jamais pour un immeuble entier), lisible de tous, dans `annonces_en_ligne` (cartes, fiche) et `admin_a_verifier` |
| `migrations/…_prix_marche.sql` | Prix du marché, d'après les prix **demandés** dans les annonces (en ligne, ou terminées depuis moins de 6 mois ; jamais brouillon, refusée ou retirée par l'équipe) : `valeur_marche` (loyer au mois, prix total, prix au m² d'un terrain à vendre), `statistiques_prix` (prix du milieu, fourchette du quart le moins cher au quart le plus cher, prix aberrants — 3 fois plus haut ou plus bas — écartés), 5 annonces au moins (`seuil_prix`) ; `estimer_bien` (quartier, sinon commune, sinon ville), `prix_communes` (carte des prix), `prix_commune` (page d'une commune), `communes_avec_prix` (plan du site) ; relevé de chaque mois dans `releves_prix` (`relever_prix`, tâche de 7 h, clé secrète) pour montrer plus tard l'évolution des prix |
| `migrations/…_blog.sql` | **Blog** : table `articles` (brouillon ou publié, un seul « à la une », adresse fixe après la première publication, notes de l'équipe jamais publiées), dossier public `blog` des photos de couverture (ajoutées et supprimées par l'équipe seulement) ; `blog_articles` et `blog_article` (pages publiques : articles publiés seulement, durée de lecture, « À lire aussi »), `admin_articles`, `enregistrer_article`, `publier_article`, `supprimer_article` (équipe : `exiger_admin`) ; journal de l'équipe : article publié, retiré, supprimé |
| `migrations/…_blog_premiers_articles.sql` | **12 premières versions d'articles**, en brouillon (invisibles du public) ; dans les notes de chacun, les points à faire vérifier par un juriste avant publication |
| `migrations/…_pages_contact.sql` | **Pages du site** : table `pages_site` (les 7 pages du pied de page, brouillon ou publiée, notes de l'équipe jamais publiées ; `reste_a_completer` : une page qui contient « [à compléter] » ne peut pas être publiée), `page_site` et `pages_publiees` (public), `admin_pages`, `enregistrer_page`, `publier_page` (équipe) ; **Contact** : table `demandes_contact`, `envoyer_contact` (avec ou sans compte, 5 par jour au plus par adresse ou numéro, e-mail « contact » à chaque administrateur, demandes traitées supprimées après un an), `admin_contacts`, `traiter_contact` ; `admin_tableau` compte les nouvelles demandes ; journal : page publiée, retirée |
| `migrations/…_pages_premieres_versions.sql` | **Premières versions des 7 pages**, en brouillon, avec les points à faire vérifier par un juriste dans leurs notes |
| `migrations/…_audience.sql` | **Audience** (Administration → Audience) : compteurs anonymes, sans cookie ni adresse IP (`audience` : pages vues et visites par jour, heure d'Abidjan, page, origine et appareil ; `campagnes` ; `recherches` : transaction, type, lieu, tranche de budget, sans résultat ; `introuvables`), écrits par `noter_page`, `noter_recherche`, `noter_introuvable` (visiteurs compris) ; `annonces.envoyee_le` et `moderations.envoyee_le` pour le délai de vérification ; `admin_audience(jours)` (équipe : fréquentation, origine, gestes, classements, recherches, demande et offre par commune, budgets, vérification, annonces sans contact, réactivité, comptes actifs, pages introuvables) ; pages Cookies et Confidentialité mises à jour |
| `migrations/…_index.sql` | Audit (M1) : index des colonnes lues souvent (messages, visites, rappels, favoris, journal de l'équipe…) : les mêmes recherches restent rapides quand les tables grossissent ; seulement des ajouts |
| `migrations/…_menage_emails.sql` | Audit (M7) : `effacer_vieux_emails` (clé secrète, tâche du matin) efface les e-mails préparés il y a plus de 6 mois ; la politique de confidentialité l'annonce |
| `migrations/…_regles_acces.sql` | Audit (M2) : dans les règles d'accès, `auth.uid()` et `est_admin()` entourés d'un `select` : calculés une fois par requête au lieu d'une fois par ligne (règles identiques, plus rapides) |
| `migrations/…_double_authentification.sql` | Étape 9e (E5) : `compte_admin()` exige, en plus du rôle « admin », une connexion confirmée par le code de l'application du téléphone (`aal2`) ; sans ce code, tout ce qui est réservé à l'équipe est refusé |
| `migrations/…_contact_serveur.sql` | Étape 9e : `envoyer_contact(demande, auteur)` n'est plus appelable depuis le navigateur, seulement par le serveur du site (`app/api/contact`, clé secrète), après le contrôle anti-robot ; mêmes règles qu'avant |
| `migrations/…_surveillance.sql` | Étape 9e (E6) : table `taches_programmees` (passage de la tâche du matin, noté par `noter_tache`) et `etat_surveillance` (dernier passage, e-mails en attente depuis plus de 26 heures) pour l'adresse de contrôle `app/api/sante` ; clé secrète seulement |
| `migrations/…_offres.sql` | Étape 8a : table `offres` (prix modifiables), `paiements` (commencés par l'annonceur : `commencer_paiement` ; confirmés ou refusés par le serveur du site seulement : `confirmer_paiement`, `echec_paiement`), remontées (`annonces.remontee_le`, une par 24 heures ; « Plus récentes » : Premium d'abord, puis publication ou remontée la plus récente ; journal `remontees`), remontées payées d'avance et automatiques, jours Premium gardés (bien vendu, loué, retiré ou annonce arrivée à sa fin), 30 photos en Premium, « À la une » des alertes, `mes_offres`, `taches_offres` (tâche du matin), `admin_paiements`, `rembourser_paiement` ; e-mails reçu et fin du Premium |
| `migrations/…_abonnements_bien_visite.sql` | Étape 8b : offres `remontee_sup`, `agence_20/60/200`, `bien_visite(_plus)` ; `abonnements` (un mois par paiement, remontées incluses ; `prendre_remontee` : celles de l'abonnement d'abord), programmation tous les 1 à 30 jours, rappel 3 jours avant la fin ; équité dans `rechercher_annonces` (3 annonces au plus d'un même annonceur dans les 10 premières, colonne `groupe` de la vue) ; `statistiques_sources` (vues par source, `compter_vue(annonce, source)`), `statistiques_detaillees`, `suivi_contacts` ; Bien visité : `visites_agent`, `annonces.bien_visite_le`, `photos_annonce.par_agent`, badge retiré si le bien change, `admin_biens_visites`, `planifier_visite_agent`, `noter_visite_agent` ; e-mails (fin d'abonnement, demande à l'équipe, rendez-vous, visite faite ou impossible) |
| `migrations/…_chiffres_accueil.sql` | Étape 9 : `chiffres_annonces` donne aussi le nombre d'annonceurs, d'agences vérifiées et de villes qui ont des annonces en ligne (bandeau des chiffres de l'accueil, à partir de 100 annonces) |
| `migrations/…_colonnes_verrouillees.sql` | Colonnes que personne ne change soi-même : dates de création (heure du serveur, puis fixes), date d'envoi en vérification, agence d'une annonce (celle du compte de l'auteur) ; deux demandes de visite ou de rappel envoyées au même instant (double clic, deux onglets) passent l'une après l'autre, la seconde est refusée |
| `migrations/…_vendeur_agence.sql` | « Agence immobilière » réservé aux comptes agence : nom de l'agence enregistré par l'équipe (ou de la demande en cours) sur l'annonce, la fiche et après « Afficher le numéro » ; badge « Agence vérifiée » seulement avec le RCCM contrôlé ; demande retirée ou refusée : annonces repassées « Particulier » ; agence renommée : nom mis à jour |
| `migrations/…_types_de_compte.sql` | Deux types de compte séparés : une agence publie toujours au nom de l'agence, un particulier (même avec une demande d'agence en cours) toujours au nom de son compte (comparé à sa pièce d'identité) ; plus de nom écrit à la main ; les annonces suivent quand l'agence est validée ou que le nom change |
| `migrations/…_limite_numeros.sql` | « Afficher le numéro » limité contre les robots : `afficher_numero` (compte : 40 en 10 minutes, 200 par jour ; visiteur sans compte, seulement par le serveur du site qui donne son adresse IP : 20 et 100), compteurs `numeros_affiches` effacés après 2 jours ; `contact_annonce` n'est plus appelable depuis le site |
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
décisions de l'équipe, badges, logo), identité (CNI ou passeport, numéro, date de fin, conservation, plainte, compte
supprimé), un compte par numéro et par e-mail, la liste exacte des fonctions que le site peut appeler, et
l'« attaque de l'extérieur » (chaque colonne essayée par un compte ordinaire, puis par un visiteur et un inconnu).
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
- Étape 8 : paiements Premium. Règles à suivre pour l'argent (Mobile Money, carte) :
  - le **prix** est calculé par la base, jamais repris de ce qu'envoie le navigateur ;
  - chaque paiement a une **clé unique** créée avant l'envoi : un double clic, une page rechargée ou un réseau qui
    coupe ne débitent jamais deux fois (la même clé renvoie le même paiement) ;
  - le Premium n'est donné qu'à la **confirmation du prestataire** (son avis signé, vérifié côté serveur), pas au
    retour sur le site ; un même avis reçu deux fois ne compte qu'une fois ;
  - chaque paiement garde son état (créé, en cours, payé, échoué, remboursé) et un relevé quotidien compare avec le
    prestataire : un paiement « en cours » trop longtemps est revérifié, jamais laissé à moitié.

Pour changer la base sans couper le site : on **ajoute** d'abord (nouvelle colonne, nouvelle fonction), le site
s'en sert, puis on retire l'ancienne dans une migration suivante ; jamais de renommage ni de suppression d'un coup.
