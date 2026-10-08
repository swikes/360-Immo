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
| 6. Échanges | Favoris (cœur des cartes et de la fiche, Mon Espace → Mes favoris, sur tous les appareils), messages (« Envoyer un message » sur la fiche, Mon Espace → Messages, non lus dans la barre du haut, noms discrets, 20 nouvelles conversations par jour au plus), demandes de visite (« Planifier une visite » sur la fiche, avec ou sans compte : un des 7 jours suivants à 9 h, 11 h, 14 h, 16 h ou 18 h ; l'annonceur confirme, propose un autre créneau ou refuse dans Mon Espace → Visites ; 5 demandes par jour et par numéro au plus), alertes de recherche (« Créer une alerte » sur la liste des annonces et sur la fiche : fenêtre remplie d'après la recherche, plan propre à chaque type de bien, essentiels bloquants — budget plafond, pièces au moins, superficie et titre foncier d'un terrain — et souhaits non bloquants — meublé, chambres, commodités — qui classent l'e-mail ; Mon Espace → Alertes de recherche : modifier, chaque jour ou chaque semaine, pause, suppression ; lien « Arrêter cette alerte »), e-mails par Brevo (nouveau message, demande de visite et réponses, nouvelles annonces des alertes chaque matin, rappel avant la fin d'une annonce ; choix dans Mon Espace → Paramètres ; réglages : [DEPANNAGE.md](DEPANNAGE.md#envoi-des-e-mails-brevo)). « Être rappelé » (sur la fiche, avec ou sans compte : nom, numéro, moment souhaité ; Mon Espace → Rappels : appeler, WhatsApp, « Marquer comme rappelé » ; 5 demandes par jour et par numéro au plus). Statistiques de l'annonceur (Mon Espace → Statistiques : 7, 30 ou 90 jours comparés aux jours d'avant, vues, contacts, favoris, envois par les alertes, vues par jour, gestes des visiteurs ; par annonce : prix comparé aux annonces semblables et conseils) | ✅ |
| 7. Contrôle | Espace Administration (`/admin`, comptes « admin ») : annonces à vérifier (photos, détails, contact, compte de l'auteur ; publier, refuser avec un motif ; « Doublon possible » côte à côte, refus pour doublon comptés : avertissement au 2e, suspension au 3e), un bien = une seule annonce (à l'envoi, l'annonceur est prévenu de ses annonces semblables : caractéristiques ou empreinte des photos, annonces supprimées depuis moins de 30 jours comprises), signalements des visiteurs (« Signaler cette annonce » sur la fiche ; retirer ou classer), documents de vérification (Mon Espace → Vérification : CNI recto et verso ou passeport, et photo de soi ; RCCM et logo d'une agence ; titre de propriété ou mandat d'un bien ; dans un dossier privé ; l'équipe valide — numéro et date de fin de la pièce — ou refuse avec un motif ; pièce d'identité gardée compte + 1 an pour les plaintes, ouverte seulement avec un motif noté au journal ; autres documents supprimés), badges « Identité vérifiée » (jusqu'à la fin de la pièce ; retiré si le nom change), « Agence vérifiée » (avec le logo sur les annonces, la vitrine et l'accueil) et « Bien vérifié », « Annonceur non vérifié » sinon, un numéro et un e-mail par compte (Gmail sans points ni « +… », adresses jetables refusées ; numéros partagés signalés, l'équipe libère un numéro ; pas de code par SMS pour l'instant), agences (valider ou refuser les demandes, nouvelle agence ou rattachement, agences vérifiées sur l'accueil), comptes (chercher, suspendre avec un motif, réactiver), équipe (donner ou retirer l'accès administrateur, jamais le sien), tableau de bord, journal, e-mails | ✅ |
| 8. Revenus | Offres payantes des annonceurs (« Remonter mon annonce », Premium, abonnements agences, badge « Bien vérifié ») par Mobile Money (Orange, MTN, Moov, Wave) | à venir |
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
| `components/compte/` | Pages des comptes : connexion et inscription, mot de passe oublié, nouveau mot de passe, Mon Espace (dont **Mes annonces**, **Mes favoris**, **Messages**, **Visites**) |
| `components/publication/` | Page **Publier une annonce** : formulaire en 8 rubriques, photos, aperçu, boutons « Envoyer pour vérification » et « Enregistrer le brouillon » |
| `lib/favoris.ts` + `lib/messages.ts` | Favoris du compte (partagés par tous les cœurs de la page) ; messages : écrire à l'annonceur, conversations, lecture, nombre de non lus |
| `lib/visites.ts` + `components/fiche/PlanifierVisite.tsx` + `components/ChoixCreneau.tsx` | **Demandes de visite** : créneaux proposés (heure d'Abidjan), envoi avec ou sans compte, réponses de l'annonceur et du visiteur ; fenêtre « Planifier une visite » de la fiche (3 étapes, monte du bas sur téléphone) |
| `lib/rappels.ts` + `components/fiche/EtreRappele.tsx` + `components/compte/Rappels.tsx` | **« Être rappelé »** : fenêtre de la fiche (avec ou sans compte), Mon Espace → Rappels (à rappeler, déjà traitées, demandes envoyées) |
| `lib/admin.ts` + `components/admin/` + `app/admin/` + `components/fiche/Signaler.tsx` | **Espace Administration** (équipe) : à vérifier, signalements, documents, agences, comptes, équipe, tableau de bord, journal ; « Signaler cette annonce » sur la fiche |
| `lib/regles-biens.ts` (`disponiblesTexte`) | **Biens identiques disponibles** (même résidence, même lotissement) : compteur dans Publier (sauf immeuble), « 5 disponibles » sur la carte, « 5 lots identiques disponibles » sur la fiche et pour l'équipe |
| `components/publication/FenetreDoublons.tsx` + `lib/photos.ts` (`empreinteImage`) | **Un bien = une seule annonce** : empreinte de chaque photo à l'envoi ; avant d'envoyer une annonce, fenêtre « Vous avez déjà une annonce qui ressemble à celle-ci » (modifier, renouveler ou remettre en ligne l'existante, ou « C'est un autre bien : envoyer ») |
| `lib/verifications.ts` + `components/compte/Verification.tsx` + `components/admin/Documents.tsx` | **Vérification** : documents demandés (identité : CNI ou passeport ; agence ; bien), photos réduites (PDF tels quels) envoyées dans le dossier privé, Mon Espace → Vérification (état de chaque demande, motif d'un refus, date de fin de la pièce) ; onglet Documents de l'équipe (liens de 10 minutes, valider avec le numéro et la date de fin de la pièce, refuser ; pièces conservées pour les plaintes, ouvertes avec un motif) |
| `lib/menage-documents.ts` | **Ménage du matin** du dossier privé (tâche de 7 h) : documents qui ont fait leur temps (compte supprimé ou pièce remplacée depuis un an, demandes traitées) |
| `lib/statistiques.ts` + `components/compte/Statistiques.tsx` | **Statistiques de l'annonceur** : gestes notés sur la fiche (numéro affiché, appel, WhatsApp, e-mail, partage ; une fois par visite), Mon Espace → Statistiques (en bref, vues par jour, gestes, par annonce : prix comparé et conseils) |
| `lib/alertes.ts` + `components/BoutonAlerte.tsx` + `components/FenetreAlerte.tsx` + `components/compte/MesAlertes.tsx` | **Alertes de recherche** : « Créer une alerte » (liste des annonces, fiche) ouvre la fenêtre de l'alerte (plan par type de bien : `planAlerte` ; essentiels et souhaits ; sans compte : connexion puis création), Mon Espace → Alertes de recherche (modifier dans la même fenêtre), page « Arrêter cette alerte » (`app/alertes/arreter`) |
| `lib/emails.ts` + `lib/envoi-notifications.ts` + `app/api/notifications/route.ts` | **E-mails** : leur texte (HTML et texte seul), l'envoi par Brevo de la file de la base ; tâche de 7 h (`vercel.json`) et envoi juste après un message ou une visite |
| `components/DemandeConnexion.tsx` | Fenêtre « Connectez-vous » (cœur ou message sans compte) ; ce qui était demandé est fait au retour |
| `lib/annonces.ts` | Annonces d'un compte (lues par la fonction `mes_annonces` de la base, seule à donner leurs coordonnées) : enregistrer, photos, vendu / loué, renouveler, supprimer |
| `lib/photos.ts` | **Photos réduites dans le navigateur** avant l'envoi (1600 pixels au plus, format WebP : environ 200 à 400 Ko au lieu de 3 à 8 Mo), remises dans le bon sens ; 20 au plus par annonce |
| `components/PhotoCadree.tsx` | **Affichage d'une photo de bien** dans un cadre de taille fixe : photo entière, même prise en hauteur au téléphone, bords remplis par la même photo floutée (aperçu, vignettes, Mes annonces, et plus tard la recherche et la fiche du bien) |
| `lib/regles-biens.ts` | **La liste des types de bien** (la même que sur la maquette, vérifiée par les tests) et **ce qui a du sens pour chaque type** (terrain sans pièces ni « meublé », pas de location à la journée pour un bureau, chambre d'hôtel en location seulement…) |
| `lib/lieux.ts` | Villes, communes et quartiers |
| `lib/choix-lieu.ts` + `components/ChampLieu.tsx` | Champ « ville, commune ou quartier » avec suggestions (mêmes règles que la maquette : sans accents, quartiers en tapant, liste toujours sous le champ) |
| `lib/recherche.ts` | **La recherche** : adresse de la liste (/annonces?tx=location&type=appartement&q=Cocody…), titre (« Appartements à louer à Cocody »), critères envoyés à la base |
| `lib/annonces-en-ligne.ts` + `lib/annonces-serveur.ts` | Annonces en ligne : types, adresse de la fiche, photo, prix, lieu ; lecture dans la base côté serveur (pages déjà remplies, rapides en 3G, lisibles par Google) |
| `components/annonces/` | Liste des annonces : recherche d'un lieu, onglets, filtres (colonne sur ordinateur, panneau sur téléphone), tri |
| `components/fiche/` | Fiche d'un bien : galerie (plein écran), contact (numéro après un clic, WhatsApp, « Envoyer un message »), partage, description, compteur de vues |
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
  l'équipe 360-Immo.ci, messages, visites, photos, vitrines (code propre à chaque compte, nom affiché), coordonnées
  des annonces réservées à leur auteur (même pour un autre compte connecté), favoris (cartes, annonce expirée) et
  messages (conversation ouverte au premier message, noms discrets, non lus, limite contre le démarchage), demandes
  de visite (sans compte, créneau à venir, 5 par jour et par numéro, une seule en cours par bien, réponses de
  l'annonceur et du visiteur, créneaux déjà pris, visites à traiter), alertes et e-mails (file des e-mails réservée à la clé
  secrète, un e-mail par conversation et par heure, réponses aux visiteurs sans compte, alertes chaque jour ou chaque
  semaine, recherche illisible sans blocage, 10 alertes, lien « Arrêter », rappels de fin ; alertes réglées dans la
  fenêtre : budget plafond et minimum, pièces au moins, superficie et titre foncier d'un terrain, souhaits non bloquants
  qui classent l'e-mail), statistiques de l'annonceur (vues et gestes par jour, l'auteur ne compte pas, relevés
  illisibles directement, contacts, favoris, alertes, période d'avant, prix médian des annonces semblables), modération
  (réservée à l'équipe, file à vérifier, publier, refuser avec un motif, revérification qui garde ses dates, signaler
  avec ou sans compte, classer, retirer, journal, e-mails à l'annonceur), équipe et comptes (accès administrateur
  donné ou retiré, jamais le sien ; recherche ; suspension qui retire les annonces et bloque publications, messages,
  rappels et alertes ; réactivation), agences (demandes, nouvelle agence ou rattachement, refus, modification, badge,
  agences de l'accueil), « Être rappelé » (sans
  compte, contrôles, rappel fait ou annulé, compteurs, e-mail à l'annonceur).
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
  formulaire ; champs selon le type de bien (terrain, chambre d'hôtel, appartement) ; surface facultative sauf pour un
  terrain (superficie obligatoire) ; champs manquants signalés ;
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
- **Favoris et messages** (`tests/favoris-messages.spec.ts`) : cœur sans compte (connexion puis ajout), cœur de la fiche
  et des cartes, Mes favoris (annonce plus en ligne), message depuis la fiche sans compte (gardé pendant la connexion
  puis envoyé), conversation dans Mon Espace, côté annonceur : non lus (barre du haut, menu), lecture, réponse,
  téléphone (liste ou fil).
- **Visites** (`tests/visites.spec.ts`) : demande sans compte (créneau déjà pris grisé, coordonnées vérifiées, WhatsApp
  prérempli pour prévenir l'annonceur, seconde demande refusée) ; avec un compte (préremplie, suivie dans Mon Espace,
  créneau proposé accepté, visite annulée) ; côté annonceur (visites à traiter dans la barre du haut et le tableau de
  bord, appeler ou écrire au visiteur, confirmer, proposer un autre créneau, confirmer un créneau convenu par
  téléphone, refuser).
- **Être rappelé** (`tests/rappels.spec.ts`) : sans compte (nom et numéro vérifiés, moment choisi, e-mail demandé
  aussitôt, pas deux fois pour le même bien) ; avec un compte (prérempli, suivi et annulé dans Mon Espace) ; côté
  annonceur (rappels à faire dans la barre du haut et le tableau de bord, appeler, WhatsApp, marquer comme rappelé).
- **Administration** (`tests/admin.spec.ts`) : réservée à l'équipe (sans compte : connexion ; autre compte : refusé),
  à vérifier (photos, caractéristiques, contact, compte de l'auteur, revérification), publier, refuser avec un motif
  (choix rapides), journal, lien depuis Mon Espace ; signalements (retirer avec un motif, classer), tableau de bord ;
  fiche : signaler une annonce sans compte ; agences (nouvelle, rattachement, refus, modifier, badge « Vérifiée »),
  comptes (chercher, suspendre, réactiver), équipe (donner et retirer l'accès), compte suspendu dans Mon Espace,
  agences vérifiées de l'accueil vers leur vitrine ; « Doublon possible » (annonces côte à côte, photo reprise par un
  autre annonceur), refus pour doublon et suspension au 3e. Publication (`tests/publication.spec.ts`) : fenêtre des
  annonces semblables à l'envoi (empreintes de la même photo en grand et en petit presque identiques, « Annuler
  l'envoi », « C'est un autre bien : envoyer »).
- **Vérification** (`tests/verification.spec.ts`) : Mon Espace → Vérification (document manquant, fichier qui n'est ni
  photo ni PDF, photos réduites rangées dans son propre dossier, titre de propriété en PDF, demandes en cours) ;
  Administration → Documents (documents ouverts par un lien temporaire, refus avec un motif, validation d'une agence
  avec son logo, documents supprimés, journal, tableau de bord) ; après la décision (motif et nouvel envoi, identité et
  agence vérifiées) ; logo et badge « Agence vérifiée » sur la vitrine, la fiche et l'accueil, « Annonceur non vérifié » sinon ;
  passeport validé avec son numéro et sa date de fin, pièce conservée puis ouverte pour une plainte (motif au journal) ;
  inscription refusée clairement (numéro déjà pris, adresse jetable, Gmail écrit autrement), numéros partagés et
  « Libérer le numéro ».
- **Statistiques** (`tests/statistiques.spec.ts`) : Mon Espace → Statistiques (en bref et écarts avec la période d'avant,
  vues par jour au clavier, chiffres jour par jour, gestes des visiteurs, par annonce : prix comparé et conseils,
  annonce retirée, 7 jours), depuis Mes annonces, sans annonce publiée ; fiche : numéro affiché, WhatsApp et partage notés
  une fois par visite.
- **Alertes** (`tests/alertes.spec.ts`) : fenêtre remplie d'après la recherche et réglée (budget, pièces au moins,
  souhaits), sans compte (connexion puis création au retour), déjà créée, il faut au moins un critère, plan par type
  (terrain : superficie et titre foncier ; chambre d'hôtel : à la nuit), depuis une fiche, pas sur une vitrine ;
  Mon Espace → Alertes de recherche (essentiels et souhaits en clair, modifier, chaque jour ou chaque semaine, pause,
  suppression) ; Paramètres → E-mails ; lien « Arrêter cette alerte » ;
  envoi des e-mails demandé juste après une demande de visite.
- **E-mails** (`tests/emails.spec.ts`) : texte de chaque e-mail (message, visites, alerte avec souhaits ✓ / ✗, fin d'annonce, modération, compte, vérification), contenu
  protégé, liens ; envoi à Brevo imité (expéditeur, « List-Unsubscribe », clé refusée) ; file (erreurs, arrêt) ;
  site sans réglages.
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
