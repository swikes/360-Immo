-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 9 : premières versions des pages du site (à propos, aide, devenir partenaire, pages légales)
--
-- En brouillon : le lien de chaque page affiche « Page bientôt disponible » jusqu'à sa publication (Administration →
-- Pages du site). Les pages légales contiennent des « [à compléter] » (nom de la société, RCCM, adresse…) : elles ne
-- peuvent pas être publiées tant qu'il en reste. Les points à faire vérifier par un juriste sont dans les notes de
-- chaque page (et dans le document Word « Pages du site — premières versions à relire »).
-- Une page déjà écrite dans l'Administration n'est pas touchée.
-- ════════════════════════════════════════════════════════════════════════════

update public.pages_site set
  titre = 'À propos de 360-Immo.ci',
  resume = '360-Immo.ci est un site d''annonces immobilières pour la Côte d''Ivoire : louer, acheter ou vendre, avec des annonces vérifiées et des outils gratuits.',
  contenu = $texte$360-Immo.ci aide chacun à **louer, acheter ou vendre un bien immobilier en Côte d'Ivoire** : appartements, maisons, villas, terrains, bureaux et commerces. Notre objectif : des annonces plus fiables, et des informations claires pour décider en confiance.

## Notre mission

Chercher un logement ou un terrain prend du temps, et les mauvaises surprises sont fréquentes : bien déjà loué, prix différent de celui annoncé, faux propriétaire. 360-Immo.ci veut rendre la recherche plus simple et plus sûre, pour les particuliers comme pour les professionnels.

## Ce qui fait la différence

### Des annonces vérifiées avant publication

Chaque annonce est relue par notre équipe avant d'être mise en ligne. Les annonces en double et les photos déjà utilisées ailleurs sont repérées. Une annonce reste en ligne 90 jours ; son auteur doit ensuite la renouveler, ce qui limite les biens qui ne sont plus disponibles.

### Des annonceurs identifiés

Chaque compte est lié à un numéro de téléphone et à une adresse e-mail. Les annonceurs peuvent faire vérifier leur identité, leur agence ou leur bien : leurs annonces portent alors un badge « vérifié ».

### Des outils gratuits

- l'[estimation](/estimation) d'un bien, d'après les annonces semblables de son quartier ;
- la [carte des prix](/carte-des-prix), commune par commune ;
- les alertes par e-mail, pour être prévenu des nouvelles annonces ;
- le [Guide & Blog](/blog), pour comprendre les démarches.

### Un contact direct

Vous joignez l'annonceur directement : appel, WhatsApp, message, demande de visite ou de rappel. 360-Immo.ci ne prend aucune commission sur les locations ni sur les ventes.

## Gratuit pour chercher et pour publier

Chercher, contacter un annonceur et publier une annonce sont gratuits. Des services payants pourront être proposés plus tard aux annonceurs qui souhaitent plus de visibilité ; ils resteront facultatifs.

## Qui sommes-nous ?

360-Immo.ci est édité par [à compléter : nom de la société]. [à compléter : quelques mots sur l'équipe, son histoire et ses valeurs.]

## Nous écrire

Une question, une suggestion, un partenariat ? [Écrivez-nous](/contact) : notre équipe vous répond.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Remplacer les « [à compléter] » : nom de la société qui édite le site, quelques mots sur l''équipe et son histoire.
- « 360-Immo.ci ne prend aucune commission sur les locations ni sur les ventes » : est-ce bien votre choix durable ?
- « Publier une annonce est gratuit ; des services payants facultatifs viendront plus tard » : à confirmer.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'a-propos' and contenu = '';

update public.pages_site set
  titre = 'Aide & questions fréquentes',
  resume = 'Chercher un bien, publier une annonce, gérer son compte : les réponses aux questions les plus fréquentes sur 360-Immo.ci.',
  contenu = $texte$## Chercher un bien

### Faut-il un compte pour chercher et contacter un annonceur ?

Non. Sans compte, vous pouvez chercher, consulter les annonces, afficher le numéro de l'annonceur, demander une visite ou demander à être rappelé. Un compte gratuit vous permet en plus de garder des favoris, d'écrire à l'annonceur depuis le site et de créer des alertes.

### Comment être prévenu des nouvelles annonces ?

Faites une recherche, puis touchez « Créer une alerte ». Vous recevez par e-mail les nouvelles annonces qui correspondent, chaque jour ou chaque semaine. Vous gérez vos alertes dans Mon Espace → Alertes de recherche, et chaque e-mail contient un lien pour arrêter l'alerte.

### Que veulent dire les badges « vérifié » ?

- **Identité vérifiée** : notre équipe a contrôlé la pièce d'identité de l'annonceur.
- **Agence vérifiée** : l'agence a fourni son registre du commerce (RCCM).
- **Bien vérifié** : l'annonceur nous a montré un document de propriété ou un mandat pour ce bien.

Un badge ne remplace pas vos propres vérifications : visitez toujours le bien avant de payer quoi que ce soit.

### Comment visiter un bien ?

Sur la page de l'annonce, touchez « Planifier une visite » et choisissez un créneau : l'annonceur confirme, vous propose un autre moment ou refuse. Vous pouvez aussi l'appeler, lui écrire sur WhatsApp ou demander à être rappelé.

### Une annonce me semble suspecte : que faire ?

Ne payez rien avant d'avoir visité le bien, et touchez « Signaler cette annonce » sur sa page : notre équipe examine chaque signalement et retire les annonces trompeuses. Nos conseils pour éviter les pièges sont dans le [Guide & Blog](/blog).

### 360-Immo.ci prend-il une commission ?

Non. 360-Immo.ci ne prend aucune commission sur les locations ni sur les ventes. Les éventuels frais d'agence se règlent directement avec l'agence : demandez leur montant avant la visite.

### Comment sont calculés les prix de l'estimation et de la carte des prix ?

D'après les prix demandés dans les annonces semblables des 6 derniers mois (même type de bien, même taille), dans votre quartier, sinon dans votre commune ou votre ville. Il faut au moins 5 annonces semblables pour afficher un prix. Ce sont des prix demandés, pas des prix de vente : le prix final se négocie souvent un peu en dessous.

## Publier une annonce

### Combien coûte une annonce ?

La publication d'une annonce est gratuite. Des options payantes pour plus de visibilité pourront être proposées plus tard ; elles resteront facultatives.

### Comment publier une annonce ?

Créez votre compte gratuit, puis touchez « Publier une annonce » : type de bien, lieu, prix, caractéristiques et jusqu'à 20 photos. Vous pouvez enregistrer un brouillon et y revenir. Quand l'annonce est prête, envoyez-la : notre équipe la vérifie avant sa mise en ligne, et vous êtes prévenu par e-mail.

### Pourquoi mon annonce a-t-elle été refusée ?

Le motif est indiqué dans Mon Espace → Mes annonces et dans l'e-mail reçu. Corrigez l'annonce puis renvoyez-la : elle repasse par la vérification. Les raisons les plus fréquentes : photos floues ou absentes, prix incohérent, description trop courte, numéro injoignable, annonce en double.

### Combien de temps mon annonce reste-t-elle en ligne ?

90 jours. Quelques jours avant la fin, vous recevez un e-mail : renouvelez l'annonce en un clic si le bien est toujours disponible, ou indiquez qu'il est vendu ou loué.

### Je modifie une annonce déjà en ligne : que se passe-t-il ?

Les petites corrections sont visibles aussitôt. Un changement important (type de bien, lieu, prix modifié de plus de 20 %, nouvelles photos) fait repasser l'annonce par la vérification de l'équipe : elle n'est plus visible jusqu'à la nouvelle validation.

### J'ai plusieurs biens identiques : faut-il une annonce pour chacun ?

Non. Pour des biens identiques (même résidence, même lotissement), une seule annonce suffit : indiquez le nombre de biens disponibles. En revanche, un même bien ne doit être publié qu'une fois : les annonces en double sont refusées, et des refus répétés pour doublon peuvent conduire à la suspension du compte.

### Comment savoir si mon annonce intéresse ?

Mon Espace → Statistiques : vues, contacts, favoris, comparaison de votre prix avec les annonces semblables, et des conseils pour améliorer l'annonce.

### Comment obtenir le badge « Bien vérifié » ?

Dans Mon Espace → Vérification, envoyez le document de propriété (titre foncier, ACD…) ou le mandat qui vous autorise à louer ou à vendre le bien. Notre équipe le contrôle ; le document est ensuite supprimé.

## Mon compte

### J'ai oublié mon mot de passe

Sur la page de connexion, touchez « Mot de passe oublié ? » : vous recevez un e-mail pour en choisir un nouveau.

### Pourquoi mon numéro est-il refusé à l'inscription ?

Un numéro de téléphone et une adresse e-mail ne peuvent servir qu'à un seul compte. Si votre numéro est déjà utilisé par quelqu'un d'autre, [écrivez-nous](/contact?sujet=compte) : notre équipe vérifie et peut libérer le numéro.

### Comment obtenir un compte agence ?

Dans Mon Espace → Mon profil, demandez un compte agence. Notre équipe valide la demande ; envoyez ensuite votre RCCM (et votre logo) depuis Mon Espace → Vérification pour obtenir le badge « Agence vérifiée ». Voir aussi [Devenir partenaire](/devenir-partenaire).

### Je ne reçois pas les e-mails

Regardez dans le dossier « Courrier indésirable » (spam) de votre messagerie, et vérifiez vos choix dans Mon Espace → Paramètres.

### Comment supprimer mon compte ?

[Écrivez-nous](/contact?sujet=donnees) depuis l'adresse e-mail de votre compte, avec le sujet « Mes données personnelles » : notre équipe supprime votre compte et vos annonces. Si votre identité a été vérifiée, la pièce d'identité est conservée un an de plus, comme expliqué dans la [politique de confidentialité](/confidentialite).

## Une autre question ?

[Écrivez-nous](/contact) : notre équipe vous répond.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- « Aucune commission sur les locations ni sur les ventes » et « publication gratuite » : à confirmer (même point que la page À propos).
- Suppression d''un compte : délai de traitement que l''équipe s''engage à respecter (à préciser éventuellement).
- Relecture générale : les réponses décrivent le fonctionnement actuel du site.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'aide' and contenu = '';

update public.pages_site set
  titre = 'Devenir partenaire',
  resume = 'Agences, promoteurs et professionnels de l''immobilier : publiez vos biens sur 360-Immo.ci et travaillons ensemble.',
  contenu = $texte$360-Immo.ci rassemble des personnes qui cherchent à louer, acheter ou vendre en Côte d'Ivoire. Agences, promoteurs et professionnels de l'immobilier : voici comment travailler avec nous.

## Agences immobilières

Publiez vos biens avec un **compte agence** :

- votre **vitrine** : une page avec toutes vos annonces, à partager sur WhatsApp et les réseaux sociaux ;
- le badge **« Agence vérifiée »** et votre **logo** sur vos annonces, une fois votre RCCM contrôlé par notre équipe ;
- les agences vérifiées qui ont des annonces en ligne apparaissent sur la **page d'accueil** ;
- vos **statistiques** : vues, contacts, favoris, et vos prix comparés aux annonces semblables ;
- les **messages**, les **demandes de visite** et les **demandes de rappel** de vos clients, au même endroit.

### Comment faire ?

1. Créez votre compte gratuit sur 360-Immo.ci.
2. Dans Mon Espace → Mon profil, demandez un compte agence.
3. Notre équipe valide la demande, puis envoyez votre RCCM (et votre logo) depuis Mon Espace → Vérification.

> Des offres pour donner plus de visibilité aux annonces des agences sont en préparation. [Écrivez-nous](/contact?sujet=partenariat) pour être informé de leur lancement.

## Promoteurs immobiliers

Vous lancez un programme (appartements, villas, lotissement) ? Nous pouvons le présenter aux visiteurs de 360-Immo.ci. [Parlons-en](/contact?sujet=partenariat).

## Professionnels de l'immobilier

Notaires, géomètres experts, banques et organismes de crédit, assureurs, déménageurs, artisans : les acheteurs et les locataires ont besoin de professionnels de confiance. Nous préparons un espace pour les présenter. [Écrivez-nous](/contact?sujet=partenariat) pour en faire partie.

## Nous contacter

Choisissez le sujet « Agence, promoteur ou partenariat » dans le [formulaire de contact](/contact?sujet=partenariat) : notre équipe vous répond.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Offres pour les agences « en préparation » et espace des professionnels « en préparation » : à confirmer avant publication (ou retirer ces phrases).
- Relecture générale.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'devenir-partenaire' and contenu = '';

update public.pages_site set
  titre = 'Mentions légales',
  resume = 'Qui édite le site 360-Immo.ci, qui l''héberge, et comment nous joindre.',
  contenu = $texte$## Éditeur du site

Le site 360-Immo.ci ([à compléter : adresse définitive du site, par exemple https://360-immo.ci]) est édité par :

- **[à compléter : nom de la société]**, [à compléter : forme juridique] au capital de [à compléter] FCFA ;
- siège social : [à compléter : adresse complète], Côte d'Ivoire ;
- registre du commerce et du crédit mobilier (RCCM) : [à compléter] ;
- numéro de compte contribuable : [à compléter] ;
- téléphone : [à compléter] ; e-mail : [à compléter].

**Directeur de la publication** : [à compléter : nom et fonction].

## Hébergement

- **Le site** est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com). Les pages sont servies depuis des serveurs situés à Paris (France).
- **Les données** (comptes, annonces, photos, messages) sont hébergées par Supabase Inc. ([à compléter : adresse de Supabase Inc.]), sur des serveurs situés à Paris (France).
- **Les e-mails** sont envoyés par Brevo (Sendinblue SAS), 106 boulevard Haussmann, 75008 Paris, France (brevo.com).

## Données personnelles

360-Immo.ci traite des données personnelles pour faire fonctionner le site : ce que nous gardons, pourquoi, combien de temps et vos droits sont expliqués dans la [politique de confidentialité](/confidentialite).

Déclaration auprès de l'Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI) : [à compléter : référence de la déclaration ou de l'autorisation].

## Propriété intellectuelle

Le nom et le logo 360-Immo.ci, la présentation du site, ses textes (guides, articles, aide) et ses outils appartiennent à [à compléter : nom de la société]. Toute reproduction sans autorisation écrite est interdite.

Les annonces et leurs photos restent la propriété de leurs auteurs, qui autorisent 360-Immo.ci à les afficher dans les conditions prévues par les [conditions générales d'utilisation](/cgu).

## Signaler un contenu

Une annonce ou un contenu vous semble illicite ou trompeur ? Touchez « Signaler cette annonce » sur sa page, ou [écrivez-nous](/contact). Notre équipe l'examine et le retire s'il ne respecte pas les règles du site.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Remplacer chaque « [à compléter] » : société, forme juridique, capital, siège, RCCM, compte contribuable, téléphone, e-mail, directeur de la publication, adresse définitive du site, référence de la déclaration ARTCI, adresse de Supabase Inc.
- Mentions obligatoires d''un site édité en Côte d''Ivoire (loi n° 2013-546 du 30 juillet 2013 relative aux transactions électroniques ?) : liste complète à vérifier.
- Adresses des hébergeurs à vérifier dans leurs conditions à jour : Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, États-Unis), Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'mentions-legales' and contenu = '';

update public.pages_site set
  titre = 'Conditions générales d''utilisation',
  resume = 'Les règles d''utilisation de 360-Immo.ci : compte, publication des annonces, comportement, vérifications, responsabilités.',
  contenu = $texte$Les présentes conditions générales d'utilisation (les « conditions ») fixent les règles d'utilisation du site 360-Immo.ci, édité par [à compléter : nom de la société] (« 360-Immo.ci », « nous »). En créant un compte, vous les acceptez. Les personnes qui consultent le site sans compte s'engagent aussi à respecter les règles qui les concernent (articles 5 et 8).

## 1. Le service

360-Immo.ci permet de publier et de consulter des annonces immobilières en Côte d'Ivoire (location et vente d'appartements, maisons, villas, terrains, bureaux, commerces…), de contacter les annonceurs, de demander des visites, et d'utiliser des outils gratuits (estimation, carte des prix, alertes, guides).

Chercher, contacter un annonceur et publier une annonce sont gratuits.

## 2. Le rôle de 360-Immo.ci

360-Immo.ci **héberge les annonces** publiées par ses utilisateurs et les met en relation. Nous ne sommes **ni propriétaire, ni vendeur, ni bailleur, ni agent immobilier** des biens présentés, et nous ne sommes pas partie aux locations ou aux ventes conclues entre utilisateurs. Nous ne prenons aucune commission sur ces opérations.

Il revient à chacun de vérifier, avant de s'engager ou de payer, l'existence du bien, son état, les documents de propriété et l'identité de la personne avec qui il traite.

## 3. Votre compte

- Le compte est **personnel**. Vous donnez des informations exactes (nom, numéro de téléphone, adresse e-mail) et les tenez à jour.
- Un numéro de téléphone et une adresse e-mail ne peuvent servir qu'à **un seul compte**. Les adresses e-mail jetables ne sont pas acceptées.
- Vous gardez votre mot de passe secret ; ce qui est fait depuis votre compte est sous votre responsabilité. Prévenez-nous en cas d'utilisation par quelqu'un d'autre.
- Un **compte agence** est réservé aux professionnels de l'immobilier ; il est validé par notre équipe.
- Vous pouvez demander la suppression de votre compte à tout moment depuis la page [Contact](/contact).

## 4. Publier une annonce

En publiant une annonce, vous vous engagez à ce que :

- le bien **existe**, soit **disponible** et que vous ayez **le droit** de le louer ou de le vendre (propriétaire, ou mandat du propriétaire) ;
- la description, le lieu, le prix et les conditions (caution, avance, frais) soient **exacts**, sans frais cachés ;
- les **photos** montrent le bien lui-même, et que vous ayez le droit de les utiliser ;
- chaque bien ne soit publié **qu'une fois** : pour plusieurs biens identiques (même résidence, même lotissement), une seule annonce indique le nombre de biens disponibles ;
- l'annonce ne contienne rien d'illégal, de trompeur, d'injurieux ou de discriminatoire.

Chaque annonce est **vérifiée par notre équipe avant sa mise en ligne** ; elle peut être refusée avec un motif, que vous pouvez corriger. Une annonce reste en ligne **90 jours**, renouvelables. Une modification importante (type de bien, lieu, prix, photos) la fait repasser par la vérification.

Vous restez propriétaire de vos textes et de vos photos. Vous autorisez 360-Immo.ci, gratuitement et pendant la durée de publication, à les afficher sur le site, à les adapter à l'affichage (taille, format) et à les partager pour faire connaître l'annonce.

## 5. Règles de bonne conduite

Sur 360-Immo.ci, il est interdit :

- de publier de fausses annonces, de demander de l'argent pour un bien que l'on ne peut pas louer ou vendre, ou de demander un paiement avant toute visite ;
- d'utiliser les coordonnées des autres utilisateurs pour autre chose que l'annonce concernée (prospection, revente, harcèlement) ;
- d'envoyer des messages en masse, d'usurper l'identité d'une autre personne ou d'une agence ;
- de copier les annonces ou le contenu du site par des moyens automatiques ;
- de porter atteinte au bon fonctionnement du site.

Des limites protègent les utilisateurs (par exemple un nombre maximal de nouvelles conversations ou de demandes par jour).

## 6. Vérifications et badges

Les annonceurs peuvent faire vérifier leur **identité**, leur **agence** (registre du commerce) ou leur **bien** (document de propriété ou mandat). Un badge indique que notre équipe a contrôlé un document à une date donnée : **il ne garantit pas** la transaction, et ne remplace pas vos propres vérifications.

## 7. Modération et sanctions

Notre équipe peut refuser ou retirer une annonce qui ne respecte pas ces conditions, après un signalement ou de sa propre initiative, en indiquant le motif. En cas de manquements graves ou répétés (fausse annonce, arnaque, annonces en double refusées à plusieurs reprises : un avertissement au deuxième refus, la suspension au troisième), le compte peut être **suspendu**. Vous êtes prévenu par e-mail et pouvez nous [écrire](/contact) pour contester la décision.

## 8. Responsabilité

Les annonces sont rédigées sous la seule responsabilité de leurs auteurs. Nous agissons rapidement pour retirer un contenu illicite qui nous est signalé, mais nous ne pouvons pas garantir l'exactitude de toutes les annonces.

L'estimation et la carte des prix donnent des **indications** calculées d'après les prix demandés dans les annonces ; ce ne sont pas des expertises. Les guides du blog donnent des informations générales, qui ne remplacent pas l'avis d'un professionnel.

Nous faisons notre possible pour que le site soit accessible en permanence, sans pouvoir le garantir (maintenance, panne, problème de réseau).

## 9. Services payants

Des services payants facultatifs pourront être proposés aux annonceurs (plus de visibilité, par exemple). Leurs prix et leurs conditions seront présentés avant tout paiement.

## 10. Données personnelles

Ce que nous faisons de vos données et vos droits sont expliqués dans la [politique de confidentialité](/confidentialite).

## 11. Propriété intellectuelle

Le nom, le logo, la présentation, les textes et les outils de 360-Immo.ci sont protégés : ils ne peuvent pas être reproduits sans notre autorisation écrite.

## 12. Modification des conditions

Nous pouvons modifier ces conditions, notamment pour suivre l'évolution du site ou de la loi. La date de mise à jour figure en haut de cette page ; en cas de changement important, les utilisateurs inscrits en sont informés.

## 13. Droit applicable et litiges

Ces conditions sont soumises au droit ivoirien. En cas de désaccord, [écrivez-nous](/contact) d'abord : nous cherchons une solution amiable. À défaut, les tribunaux d'Abidjan sont compétents.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Remplacer les « [à compléter] » (nom de la société).
- Article 2 : 360-Immo.ci se présente comme hébergeur d''annonces, sans être partie aux locations et ventes ni intermédiaire rémunéré. Qualification juridique et limites de responsabilité à valider.
- Article 4 : autorisation donnée par l''annonceur sur ses textes et photos (étendue, durée, usage pour la promotion du site) à valider.
- Article 7 : sanctions (refus, retrait, suspension ; suspension au 3e refus pour doublon) et recours à valider.
- Article 9 : services payants futurs : conditions particulières à prévoir le moment venu.
- Âge minimum pour créer un compte (18 ans ?) à confirmer.
- Article 13 : droit ivoirien et tribunaux d''Abidjan compétents : à valider.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'cgu' and contenu = '';

update public.pages_site set
  titre = 'Politique de confidentialité',
  resume = 'Les données que 360-Immo.ci garde, pourquoi, qui peut les voir, combien de temps, et comment exercer vos droits.',
  contenu = $texte$Cette politique explique quelles données personnelles 360-Immo.ci garde, pourquoi, qui peut les voir, combien de temps, et comment exercer vos droits. Elle s'applique au site 360-Immo.ci, avec ou sans compte.

## Qui est responsable de vos données ?

Le responsable du traitement est [à compléter : nom de la société, adresse du siège]. Pour toute question sur vos données : le [formulaire de contact](/contact?sujet=donnees), sujet « Mes données personnelles ».

## Les données que nous gardons

### Votre compte

Prénom, nom, adresse e-mail, numéro(s) de téléphone (et s'ils sont joignables sur WhatsApp), mot de passe (jamais gardé en clair), nom de l'agence pour un compte agence, vos choix d'e-mails.

### Vos annonces

Description, prix, lieu (ville, commune, quartier, adresse si vous l'indiquez), photos, et les coordonnées de contact de l'annonce. Pour repérer les annonces en double, nous calculons une « empreinte » de chaque photo.

### Vos échanges

Messages envoyés aux annonceurs ; demandes de visite (nom, téléphone, e-mail si vous l'indiquez, créneau) ; demandes de rappel (nom, téléphone, moment souhaité, message) ; signalements d'annonces ; messages du formulaire de contact. Ces demandes peuvent être faites sans compte.

### Vos favoris et vos alertes

Les annonces que vous gardez en favori, et les critères de vos alertes de recherche.

### Les documents de vérification

Si vous demandez une vérification : pièce d'identité (carte nationale d'identité ou passeport), photo de vous tenant la pièce, numéro et date de fin de la pièce ; registre du commerce (RCCM) et logo d'une agence ; document de propriété ou mandat d'un bien. Ils sont rangés dans un dossier privé, que seuls vous et notre équipe pouvez ouvrir.

### Les statistiques

Pour chaque annonce, nous comptons chaque jour les vues et les gestes des visiteurs (numéro affiché, appel, WhatsApp, partage). Ce sont des nombres : ils ne permettent pas de savoir qui a fait quoi.

### Les données techniques

Nos hébergeurs gardent des journaux techniques (adresse IP, date, page demandée) pour la sécurité et le bon fonctionnement du site.

## Pourquoi nous les utilisons

- **Faire fonctionner le service** que vous utilisez : votre compte, vos annonces, la mise en relation avec les annonceurs, les visites, les alertes.
- **Protéger les utilisateurs** : vérifier les annonces, repérer les doublons et les arnaques, traiter les signalements et les plaintes.
- **Vous écrire** : messages reçus, demandes de visite, alertes, fin d'une annonce, décisions de l'équipe. Vous choisissez les e-mails que vous recevez dans Mon Espace → Paramètres.
- **Calculer les prix du marché** (estimation, carte des prix), à partir des prix des annonces, sans aucune donnée personnelle.

Vos données ne sont **jamais vendues**, et ne servent à aucune publicité ciblée.

## Qui peut les voir ?

- **Les visiteurs** voient les annonces publiées : description, photos, prix, lieu. Le nom d'un particulier apparaît sous une forme courte (« Awa K. ») ; son numéro et son nom complet n'apparaissent qu'après un clic sur « Afficher le numéro ».
- **L'annonceur** voit les demandes et les messages qui concernent ses annonces (nom, téléphone, e-mail de la personne).
- **L'équipe 360-Immo.ci** voit ce qui est nécessaire pour vérifier les annonces et les documents, traiter les signalements et répondre aux demandes. Une pièce d'identité conservée n'est ouverte qu'en cas de plainte, avec un motif noté au journal de l'équipe.
- **Nos prestataires**, chacun pour son rôle : Supabase (hébergement des données, à Paris), Vercel (hébergement du site, serveurs à Paris), Brevo (envoi des e-mails, en France).
- **OpenStreetMap** : la carte des prix charge son fond de carte depuis leurs serveurs, qui reçoivent alors votre adresse IP.

Les liens WhatsApp, Google Maps ou e-mail ouvrent ces services, qui appliquent leurs propres règles.

## Où sont vos données ?

Les données sont hébergées en France (Union européenne). Ce transfert hors de Côte d'Ivoire fait l'objet de [à compléter : référence de la déclaration ou de l'autorisation de l'ARTCI].

## Combien de temps nous les gardons

- **Compte** : tant qu'il existe. Vous pouvez demander sa suppression à tout moment.
- **Annonces** : jusqu'à leur suppression par leur auteur. Une trace (caractéristiques du bien et empreintes des photos, sans coordonnées) est gardée 30 jours pour repérer une annonce publiée de nouveau en double. Les prix des annonces terminées servent au calcul des prix du marché pendant 6 mois.
- **Messages, demandes de visite et de rappel** : jusqu'à la suppression de l'annonce concernée, ou du compte.
- **Pièce d'identité vérifiée** (avec la photo de vous et le numéro de la pièce) : tant que le compte existe, puis un an, pour pouvoir répondre à une plainte.
- **Autres documents de vérification** (RCCM, document de propriété, mandat, demandes refusées) : supprimés après la décision de l'équipe.
- **Messages du formulaire de contact** : supprimés un an après avoir été traités.

## Comment nous les protégeons

Les échanges avec le site sont chiffrés (https). Chaque donnée n'est accessible qu'aux personnes autorisées, selon des règles vérifiées par la base de données elle-même. Les mots de passe ne sont jamais gardés en clair. Les documents de vérification sont rangés dans un dossier privé, ouvert par des liens valables quelques minutes.

## Vos droits

Conformément à la loi ivoirienne sur la protection des données à caractère personnel (loi n° 2013-450 du 19 juin 2013), vous pouvez :

- **accéder** à vos données et en obtenir une copie ;
- les faire **corriger** : la plupart se modifient directement dans Mon Espace → Mon profil ;
- demander leur **suppression**, ou vous **opposer** à certains usages ;
- choisir les **e-mails** que vous recevez (Mon Espace → Paramètres), et arrêter une alerte d'un clic.

Pour exercer ces droits, utilisez le [formulaire de contact](/contact?sujet=donnees), sujet « Mes données personnelles », de préférence depuis l'adresse e-mail de votre compte. Vous pouvez aussi adresser une réclamation à l'ARTCI.

## Cookies

360-Immo.ci n'utilise pas de cookies publicitaires ni de mesure d'audience : voir la page [Cookies](/cookies).

## Modifications

Cette politique peut évoluer avec le site ou la loi. La date de mise à jour figure en haut de cette page.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Remplacer les « [à compléter] » : société responsable du traitement, adresse, référence ARTCI du transfert des données hors de Côte d''Ivoire.
- Conformité à la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel : formalités auprès de l''ARTCI (déclaration ou autorisation), transfert des données vers la France (Union européenne) et vers une société américaine (Vercel) : à valider.
- Pièces d''identité (données sensibles) : conservation tant que le compte existe, puis 1 an, ouverture seulement sur plainte avec un motif noté au journal : durée et justification à valider.
- Délai de réponse aux demandes (accès, correction, suppression) : à fixer (la loi prévoit-elle un délai ?).
- Durée de conservation des journaux techniques des hébergeurs : à vérifier auprès de Vercel et Supabase.
- Âge minimum : à confirmer (même point que les CGU).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'confidentialite' and contenu = '';

update public.pages_site set
  titre = 'Cookies et stockage sur votre appareil',
  resume = '360-Immo.ci n''utilise ni cookies publicitaires ni mesure d''audience : seulement ce qu''il faut pour que le site fonctionne.',
  contenu = $texte$360-Immo.ci **n'utilise pas de cookies publicitaires ni d'outil de mesure d'audience**. C'est pourquoi aucun bandeau ne vous demande d'accepter des cookies.

## Ce que le site garde sur votre appareil

Le site enregistre quelques informations dans la mémoire de votre navigateur, uniquement pour fonctionner :

- **votre connexion**, pour rester connecté : si vous décochez « Se souvenir de moi », elle s'efface quand vous fermez le navigateur ;
- **une action en attente** : un favori ou une alerte demandés avant de vous connecter, faits à votre retour ;
- **un message en cours d'écriture** à un annonceur, pour ne pas le perdre si vous changez de page ;
- **les annonces déjà vues pendant votre visite**, pour ne compter qu'une vue par visite dans les statistiques des annonceurs.

Ces trois dernières informations s'effacent quand vous fermez l'onglet. Rien de tout cela ne sert à la publicité ni n'est partagé.

## Les services extérieurs

- La [carte des prix](/carte-des-prix) affiche un fond de carte OpenStreetMap : votre navigateur le charge depuis les serveurs d'OpenStreetMap.
- Les liens WhatsApp, Google Maps ou e-mail ouvrent ces services, qui appliquent leurs propres règles.

## Mesure d'audience

Si nous ajoutons un jour un outil de mesure d'audience, cette page sera mise à jour et, si la loi le demande, votre accord vous sera demandé d'abord.

## Effacer ces informations

Vous pouvez les effacer dans les réglages de votre navigateur (« données de navigation » ou « données des sites ») : vous serez alors déconnecté.$texte$,
  notes = 'Première version, à relire avant publication.
À vérifier :
- Page à mettre à jour si un outil de mesure d''audience est ajouté (accord des visiteurs à demander selon la loi ?).
- Absence de bandeau de consentement : à valider (le site ne dépose que ce qui est nécessaire à son fonctionnement).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
where slug = 'cookies' and contenu = '';
