-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 9 : premières versions des articles du blog, en brouillon
--
-- Visibles seulement de l'équipe (Administration → Blog) jusqu'à leur publication. Chaque article a, dans ses
-- « Notes de l'équipe », les points à faire vérifier par un juriste avant publication (document Word « Articles du
-- blog — premières versions à relire »). Un article déjà présent (même adresse) n'est pas touché.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.articles (slug, titre, resume, categorie, contenu, a_la_une, notes) values
(
  'acheter-un-terrain-les-verifications-avant-de-payer',
  'Acheter un terrain : les vérifications à faire avant de payer',
  'Un terrain se paie souvent comptant, et les litiges fonciers sont fréquents. Voici, étape par étape, ce qu''il faut vérifier avant de verser le moindre franc.',
  'acheteur',
  $texte$Acheter un terrain est souvent le projet d'une vie. C'est aussi l'achat où les mauvaises surprises sont les plus fréquentes : terrain vendu deux fois, papiers qui ne correspondent pas au lot, lotissement jamais approuvé… La bonne nouvelle : la plupart de ces pièges se repèrent avant de payer, si l'on prend le temps de vérifier.

## 1. Demandez les documents du terrain, et lisez-les

Avant toute discussion sur le prix, demandez au vendeur une copie des documents du terrain :

- le **titre foncier** ou l'**ACD** (arrêté de concession définitive), si le terrain en a un ;
- à défaut, les documents qui montrent où en est la procédure (demande d'ACD, lettre d'attribution…) ;
- le **plan du lot** (extrait topographique), avec son numéro, le nom du lotissement et la surface ;
- la pièce d'identité du vendeur.

Vérifiez que le nom sur les documents est bien celui du vendeur. S'il vend pour quelqu'un d'autre (un parent, une famille, une société), il doit pouvoir montrer un mandat ou une procuration écrite.

> Un terrain avec un titre foncier ou un ACD est beaucoup plus sûr qu'un terrain qui n'a qu'une attestation villageoise ou une lettre d'attribution. Son prix est en général plus élevé, et c'est normal. Pour comprendre chaque document, lisez [Titre foncier, ACD, lettre d'attribution : quels documents pour un terrain ?](/blog/titre-foncier-acd-lettre-d-attribution-quels-documents)

## 2. Vérifiez à la source, pas seulement sur papier

Une photocopie peut être fausse ou dépassée. Faites vous-même les vérifications auprès de l'administration :

- pour un terrain titré, demandez un **état foncier** à la Conservation foncière : il indique le propriétaire inscrit et ce qui pèse sur le terrain (hypothèque, inscriptions) ;
- pour un ACD ou une procédure en cours, renseignez-vous auprès du ministère chargé de la Construction et de l'Urbanisme ;
- vérifiez auprès de la mairie ou des services de l'urbanisme que le lotissement est **approuvé**, et que le terrain n'est pas sur une zone réservée (voie prévue, zone non constructible, servitude).

Un notaire peut faire ces vérifications pour vous : c'est son métier, et c'est souvent l'argent le mieux dépensé de tout l'achat.

## 3. Allez sur place, avec un géomètre

Visitez le terrain plusieurs fois, à des moments différents, et si possible en saison des pluies pour voir s'il est inondable. Sur place :

- vérifiez que les **bornes** existent et correspondent au plan ; au moindre doute, faites appel à un **géomètre expert** ;
- parlez aux voisins : ils savent souvent si le terrain a déjà été vendu, s'il y a un litige familial, ou si quelqu'un d'autre s'en dit propriétaire ;
- regardez l'accès (voie praticable en saison des pluies), et l'arrivée de l'eau et de l'électricité.

## 4. Méfiez-vous de l'urgence

« Il y a un autre acheteur, il faut payer aujourd'hui. » C'est la phrase qui précède beaucoup d'arnaques. Un vendeur honnête comprend que vous preniez quelques jours pour vérifier. Ne versez jamais d'argent :

- avant d'avoir vu le terrain et fait vérifier les documents ;
- en espèces sans reçu signé ;
- sur le compte d'une personne qui n'est pas le propriétaire inscrit.

!> Si le vendeur refuse que vous fassiez vérifier les documents, ou s'il change d'histoire à chaque question, arrêtez-vous là. Aucune « bonne affaire » ne vaut le risque de perdre votre argent.

## 5. Signez chez un notaire

Une fois les vérifications faites, la vente se conclut chez un **notaire**. Il rédige l'acte, s'assure que le vendeur a bien le droit de vendre, et s'occupe des formalités pour que le terrain passe à votre nom. Demandez-lui dès le départ la liste des frais et taxes à prévoir, pour les inclure dans votre budget.

Gardez précieusement tous les documents : reçus, actes, plans, échanges écrits.

## En résumé

1. Demandez les documents et vérifiez le nom du propriétaire.
2. Vérifiez à la Conservation foncière et auprès de l'urbanisme.
3. Allez sur place, faites borner, parlez aux voisins.
4. Ne payez rien sous la pression, et jamais sans reçu.
5. Concluez la vente chez un notaire.

Vous cherchez un terrain ? Consultez les [terrains à vendre](/annonces?tx=achat&type=terrain) sur 360-Immo.ci : chaque annonce est vérifiée par notre équipe avant d'être publiée. La [carte des prix](/carte-des-prix?tx=achat&type=terrain) vous donne aussi le prix demandé au mètre carré, commune par commune.$texte$,
  true,
  'Première version, à relire avant publication.
À vérifier :
- L''« état foncier » délivré par la Conservation foncière : nom exact du document, service qui le délivre, délai et coût.
- Le service à qui s''adresser aujourd''hui pour vérifier un ACD ou une procédure en cours (ministère chargé de la Construction, guichet unique…).
- La vente d''un terrain titré ou avec ACD doit-elle obligatoirement être faite par acte notarié ?
- Le terme « mutation » et la démarche pour mettre le terrain au nom de l''acheteur.
- Le service qui confirme qu''un lotissement est approuvé (mairie, ministère).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'titre-foncier-acd-lettre-d-attribution-quels-documents',
  'Titre foncier, ACD, lettre d''attribution : quels documents pour un terrain ?',
  'Titre foncier, ACD, lettre d''attribution, attestation villageoise, certificat foncier : ces documents n''ont pas la même valeur. Ce qu''il faut savoir avant d''acheter.',
  'juridique',
  $texte$Quand on achète un terrain en Côte d'Ivoire, on entend parler de nombreux documents. Ils n'ont pas tous la même valeur : certains prouvent la propriété, d'autres seulement une étape de la procédure, d'autres encore aucun droit reconnu par l'État. Voici comment s'y retrouver.

## Le titre foncier : la propriété la plus sûre

Le **titre foncier** (TF) est le document qui prouve la propriété d'un terrain. Il est inscrit au **Livre foncier**, tenu par la Conservation foncière, sous un numéro unique. Tout ce qui concerne le terrain y est noté : propriétaire, ventes successives, hypothèques.

C'est la situation la plus sûre : le titre foncier est définitif, et la propriété qu'il constate s'impose à tous. Avant d'acheter, demandez un **état foncier** à la Conservation foncière pour connaître le propriétaire inscrit et ce qui pèse sur le terrain.

## L'ACD : la propriété d'un terrain en ville

L'**arrêté de concession définitive** (ACD) est l'acte par lequel l'État accorde la propriété d'un terrain urbain. Depuis la réforme du foncier urbain de 2013, c'est l'acte qui permet de devenir propriétaire d'un terrain en ville ; il permet ensuite d'établir le titre foncier au nom du propriétaire.

> Si l'on vous présente un ACD, faites vérifier qu'il est authentique et qu'il porte bien sur le lot que l'on vous vend (numéro du lot, lotissement, surface).

## La lettre d'attribution : une étape, pas une propriété

La **lettre d'attribution** est un document plus ancien, par lequel l'administration attribuait un lot à une personne. Seule, elle ne fait pas de son détenteur un propriétaire : la situation doit être régularisée par un ACD. On en rencontre encore sur le marché.

Acheter un terrain qui n'a qu'une lettre d'attribution, c'est acheter une démarche à terminer, avec ses incertitudes : le lot a-t-il été attribué à quelqu'un d'autre entre-temps ? La régularisation est-elle possible ? Faites-vous conseiller avant de vous engager.

## L'attestation villageoise : aucune garantie

L'**attestation villageoise** (ou attestation coutumière) est délivrée par un village ou une autorité coutumière. Elle peut montrer qu'une famille occupe ou exploite une terre, mais elle **ne prouve pas la propriété** aux yeux de l'État. Beaucoup de litiges viennent de terrains vendus sur cette seule base, parfois à plusieurs personnes.

!> Un terrain vendu avec une simple attestation villageoise, dans un lotissement non approuvé, est l'achat le plus risqué. Si vous l'envisagez malgré tout, faites-vous accompagner par un notaire ou un avocat.

## Le certificat foncier : pour les terres rurales

En zone rurale, le **certificat foncier** constate les droits d'une personne ou d'un groupe (une famille, une communauté) sur une terre, en application de la loi sur le domaine foncier rural. Il doit ensuite conduire à un titre foncier. Une terre rurale qui n'a qu'un certificat foncier ne s'achète pas comme un terrain titré : les règles sont particulières, faites-vous conseiller.

## Et les autres documents ?

- Le **plan du lot** (extrait topographique) situe le terrain et donne sa surface. Utile, mais il ne prouve pas la propriété.
- Le **reçu** ou la **convention de vente** entre particuliers prouve qu'un paiement a eu lieu, pas que le vendeur avait le droit de vendre.
- Le **permis de construire** autorise une construction ; il ne remplace pas le titre de propriété.

## Ce qu'il faut retenir

- **Titre foncier** : la propriété, inscrite au Livre foncier. Le plus sûr.
- **ACD** : la propriété d'un terrain en ville, qui conduit au titre foncier.
- **Lettre d'attribution** : une étape ancienne, à régulariser.
- **Attestation villageoise** : aucune propriété reconnue par l'État.
- **Certificat foncier** : des droits sur une terre rurale, qui doivent conduire au titre foncier.

Dans tous les cas, faites vérifier les documents à la source avant de payer. Notre guide [Acheter un terrain : les vérifications à faire avant de payer](/blog/acheter-un-terrain-les-verifications-avant-de-payer) vous accompagne étape par étape.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- « Depuis la réforme du foncier urbain de 2013, l''ACD est l''acte qui permet de devenir propriétaire d''un terrain en ville » (ordonnance n° 2013-481 du 2 juillet 2013 ?) : formulation exacte et textes modifiés depuis.
- Le titre foncier « définitif, qui s''impose à tous » : formulation juste ?
- Statut actuel des lettres d''attribution : régularisation obligatoire, délai, valeur aujourd''hui.
- Certificat foncier (loi n° 98-750 du 23 décembre 1998 sur le domaine foncier rural, modifiée) : délai pour obtenir le titre foncier, règles de vente, certificat collectif.
- Le service à qui s''adresser pour vérifier un ACD.
- Le glossaire de la page Blog reprend ces définitions : à relire en même temps (fichier lib/glossaire.ts).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'caution-avance-frais-d-agence-ce-que-vous-payez',
  'Caution, avance, frais d''agence : ce que vous payez en entrant dans une location',
  'Avant de recevoir les clés, on vous demandera plusieurs sommes. À quoi sert chacune, ce que dit la loi, et comment éviter les mauvaises surprises.',
  'locataire',
  $texte$Trouver le bon logement est une chose ; réunir l'argent pour y entrer en est une autre. L'entrée dans une location demande souvent plusieurs mois de loyer d'un coup. Voici à quoi correspondent ces sommes, pour savoir ce que vous payez et ce que vous pourrez récupérer.

## La caution (dépôt de garantie)

La **caution** est une somme que vous versez au propriétaire en garantie. Elle sert à couvrir d'éventuels loyers impayés ou des dégâts constatés à votre départ. **Elle vous est rendue** quand vous quittez le logement, moins ce qui est justifié par l'état des lieux de sortie ou les sommes restant dues.

Sur 360-Immo.ci, le nombre de mois de caution est indiqué dans les annonces de location : vous le connaissez souvent avant même de visiter.

## L'avance sur loyer

L'**avance** correspond à des mois de loyer payés d'avance. Contrairement à la caution, **elle n'est pas rendue** : elle couvre vos premiers mois dans le logement. Si vous versez deux mois d'avance en entrant le 1er mars, vous avez payé mars et avril.

> La loi n° 2018-575 du 13 juin 2018 relative au bail à usage d'habitation encadre ces sommes : la caution et l'avance sont chacune limitées à deux mois de loyer. Si l'on vous demande davantage, vous pouvez le faire remarquer, et en garder une trace écrite.

## Les frais d'agence

Si vous passez par une agence ou un intermédiaire, il vous demandera des **frais d'agence** (ou commission) pour vous avoir trouvé le logement. Ils ne sont pas rendus. Pour éviter les malentendus :

- demandez leur montant **avant la visite**, par écrit (un message suffit) ;
- ne payez qu'une fois le bail signé, ou au moins le logement réservé par écrit ;
- exigez un **reçu** au nom de l'agence.

!> Des « démarcheurs » demandent parfois des frais de visite, ou de l'argent pour « réserver » un logement qu'ils ne gèrent pas. Ne payez jamais pour une visite, et ne versez rien à quelqu'un qui ne peut pas prouver qu'il agit pour le propriétaire. Lire aussi : [Arnaques immobilières : les signes qui doivent alerter](/blog/arnaques-immobilieres-les-signes-qui-doivent-alerter)

## Les autres frais à prévoir

Selon le logement, d'autres dépenses arrivent au moment de l'entrée :

- l'ouverture ou le transfert des compteurs d'eau et d'électricité à votre nom ;
- les frais d'enregistrement du bail, s'ils sont à votre charge ;
- les éventuelles charges (gardiennage, entretien des parties communes) si le logement est dans une résidence.

Demandez la liste complète avant de vous engager, pour faire votre budget sans surprise.

## Calculer la somme à réunir

Additionnez tout ce qui est demandé à l'entrée. Par exemple, avec 2 mois de caution, 2 mois d'avance et des frais d'agence égaux à un mois de loyer, il faut réunir **5 fois le loyer** avant d'entrer. Faites ce calcul pour chaque logement qui vous intéresse : deux logements au même loyer peuvent demander des sommes de départ très différentes.

## Récupérer sa caution au départ

La caution se récupère d'autant mieux que tout a été écrit à l'entrée :

1. faites un **état des lieux d'entrée** détaillé, pièce par pièce, signé par vous et le propriétaire, avec des photos datées ;
2. payez votre loyer par des moyens qui laissent une trace (virement, mobile money, reçus signés) ;
3. respectez le préavis prévu par le bail ;
4. faites l'**état des lieux de sortie** avec le propriétaire, et comparez-le avec celui d'entrée.

Seuls les dégâts constatés (au-delà de l'usure normale) et les sommes réellement dues peuvent être retenus.

Vous cherchez un logement ? Les [annonces de location](/annonces?tx=location) de 360-Immo.ci indiquent le loyer et, le plus souvent, le nombre de mois de caution demandés.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Loi n° 2018-575 du 13 juin 2018 relative au bail à usage d''habitation : la caution et l''avance sont-elles bien limitées chacune à deux mois de loyer ? Article exact et sanctions prévues.
- Les frais d''agence sont-ils encadrés par un texte (montant, qui les paie) ?
- Délai légal de restitution de la caution après le départ.
- Enregistrement du bail : obligatoire ? Délai, coût, à la charge de qui ?
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'contrat-de-bail-ce-qu-il-doit-contenir',
  'Le contrat de bail : ce qu''il doit contenir',
  'Un bail écrit protège le locataire comme le propriétaire. Les mentions à vérifier avant de signer, et les clauses à lire attentivement.',
  'juridique',
  $texte$Le bail est le contrat qui lie le locataire et le propriétaire. Beaucoup de locations se font encore « sur parole », avec de simples reçus. C'est risqué pour les deux : en cas de désaccord, rien ne prouve ce qui avait été convenu. Un bail écrit, clair et signé évite la plupart des conflits.

## Les mentions essentielles

Avant de signer, vérifiez que le bail indique au moins :

- **les parties** : le nom complet du propriétaire (ou de son mandataire) et du locataire, avec leurs coordonnées ;
- **le logement** : l'adresse précise, la description (nombre de pièces, équipements) et ce qui est inclus (parking, dépendances) ;
- **la durée** du bail et sa date de début ;
- **le loyer**, la date et le moyen de paiement ;
- **la caution** et l'**avance**, avec leurs montants ;
- **les charges** éventuelles et qui paie quoi (eau, électricité, gardiennage, ordures) ;
- **le préavis** à respecter pour partir, d'un côté comme de l'autre ;
- **l'usage** du logement : habitation seulement, ou aussi activité professionnelle ;
- la date et **la signature** des deux parties, sur chaque page si possible.

> Gardez un exemplaire original signé. Une photo du bail sur votre téléphone ne remplace pas l'original, mais c'est une bonne sauvegarde.

## L'état des lieux, joint au bail

L'**état des lieux d'entrée** décrit le logement pièce par pièce : murs, sols, portes, fenêtres, robinets, prises, équipements. Il est signé par les deux parties et joint au bail. C'est lui qui permettra, au départ, de distinguer les dégâts de l'usure normale.

Prenez des photos datées le jour de l'entrée, et notez tout ce qui ne fonctionne pas, même un détail.

## Les clauses à lire attentivement

Certains points méritent une lecture attentive, et parfois une discussion avant de signer :

- **la révision du loyer** : quand et comment le loyer peut-il augmenter ?
- **les réparations** : qui paie quoi ? Voir [Réparations et charges : qui paie quoi entre locataire et propriétaire ?](/blog/reparations-et-charges-qui-paie-quoi)
- **la sous-location** : est-elle interdite, ou permise avec l'accord du propriétaire ?
- **les travaux** : pouvez-vous peindre, poser un climatiseur, aménager la cuisine ?
- **la résiliation** : dans quels cas le bail peut-il être rompu avant la fin ?

!> Méfiez-vous d'une clause qui vous ferait renoncer à récupérer la caution, ou qui permettrait au propriétaire d'entrer chez vous sans prévenir. Si une clause vous semble abusive, demandez conseil avant de signer.

## Ce que prévoit la loi

En Côte d'Ivoire, la loi n° 2018-575 du 13 juin 2018 relative au bail à usage d'habitation fixe des règles qui s'appliquent même si le bail ne les reprend pas : elle prévoit notamment un bail écrit et un état des lieux, et elle encadre la caution et l'avance. Les clauses contraires à la loi ne peuvent pas être imposées au locataire.

Le bail doit aussi, en principe, être **enregistré** auprès de l'administration fiscale. Renseignez-vous sur la démarche et sur qui en supporte le coût.

## En pratique

1. Demandez le projet de bail quelques jours avant la signature, pour le lire au calme.
2. Comparez-le avec ce qui a été annoncé (loyer, caution, équipements).
3. Faites corriger ce qui ne correspond pas, avant de signer.
4. Faites l'état des lieux le jour de la remise des clés.
5. Gardez tous vos reçus de loyer.

Un bail bien fait, c'est la tranquillité pour toute la durée de la location. Avant de signer, relisez aussi [Caution, avance, frais d'agence : ce que vous payez en entrant dans une location](/blog/caution-avance-frais-d-agence-ce-que-vous-payez).$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Loi n° 2018-575 du 13 juin 2018 : le bail écrit est-il obligatoire ? Quelles mentions sont obligatoires ?
- L''état des lieux d''entrée et de sortie est-il obligatoire ?
- Durées de préavis prévues par la loi (côté locataire et côté propriétaire).
- Règles de révision du loyer (fréquence, plafond).
- Enregistrement du bail auprès de l''administration fiscale : obligation, délai, coût, à la charge de qui ?
- « Les clauses contraires à la loi ne peuvent pas être imposées au locataire » : formulation juste ?
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'arnaques-immobilieres-les-signes-qui-doivent-alerter',
  'Arnaques immobilières : les signes qui doivent alerter',
  'Faux propriétaires, faux logements, terrains vendus deux fois : les arnaques suivent souvent les mêmes schémas. Les signes à connaître pour ne pas se faire piéger.',
  'locataire',
  $texte$Les arnaques immobilières font des victimes chaque année : des locataires qui paient une caution pour un logement qui n'existe pas, des acheteurs qui découvrent que leur terrain appartenait à quelqu'un d'autre. Les escrocs comptent sur l'urgence et sur la confiance. Connaître leurs méthodes est la meilleure protection.

## Les arnaques les plus courantes

### Le faux logement à louer

Une annonce attirante (bien situé, loyer bas), un « propriétaire » qui vit loin ou « à l'étranger », et une demande d'argent pour « réserver » avant la visite. Une fois l'argent envoyé, plus personne ne répond.

### Le faux propriétaire ou le faux intermédiaire

Une personne fait visiter un logement qu'elle ne possède pas : un ancien locataire, un gardien, un voisin qui a les clés. Elle encaisse caution et avance auprès de plusieurs personnes, puis disparaît.

### Le terrain vendu plusieurs fois

Un même lot est vendu à plusieurs acheteurs, avec des papiers qui semblent en règle, ou sur la seule base d'une attestation villageoise. Au final, un seul acheteur peut obtenir le terrain ; les autres perdent leur argent.

### Les faux documents

Faux ACD, faux titres fonciers, faux reçus, faux plans : la photocopie d'un document ne prouve rien tant qu'elle n'a pas été vérifiée auprès du service qui l'a délivré.

## Les signes qui doivent vous alerter

- On vous demande de **payer avant d'avoir visité**, ou des « frais de visite ».
- On vous **presse** : « d'autres personnes sont intéressées, décidez aujourd'hui ».
- Le prix est **nettement plus bas** que celui des biens semblables du quartier. Comparez avec la [carte des prix](/carte-des-prix).
- La personne refuse de montrer une **pièce d'identité** ou les documents du bien, ou refuse que vous les fassiez vérifier.
- Le paiement doit aller sur un compte ou un numéro de **mobile money** au nom de quelqu'un d'autre que le propriétaire.
- Les photos de l'annonce se retrouvent dans d'autres annonces, sous un autre nom ou dans une autre ville.
- La personne ne peut pas vous faire visiter « pour l'instant », mais demande quand même de l'argent.

> Règle d'or : pas de visite, pas d'argent. Et pas de reçu, pas d'argent.

## Les bons réflexes

1. **Visitez toujours** le bien, en vrai, avant de payer quoi que ce soit.
2. **Demandez une pièce d'identité** et un document qui prouve le droit de louer ou de vendre (titre, mandat écrit du propriétaire).
3. **Faites vérifier les documents à la source** pour un achat : voir [Acheter un terrain : les vérifications à faire avant de payer](/blog/acheter-un-terrain-les-verifications-avant-de-payer).
4. **Payez avec une trace** : virement, mobile money au nom du propriétaire, reçu signé.
5. **Prenez votre temps** : un vrai propriétaire comprend que vous vérifiiez.
6. **Faites-vous accompagner** pour un achat important : notaire, avocat, agent immobilier.

## Ce que fait 360-Immo.ci

Sur 360-Immo.ci, chaque annonce est vérifiée par notre équipe avant d'être publiée, et les photos déjà utilisées dans d'autres annonces sont repérées. Les annonceurs peuvent faire vérifier leur identité et leurs biens : leurs annonces portent alors un badge « vérifié ».

Ces contrôles réduisent les risques, mais ne remplacent pas votre vigilance : gardez toujours les bons réflexes ci-dessus.

!> Un doute sur une annonce ? Touchez « Signaler cette annonce » sur sa page : notre équipe l'examine. Si vous avez été victime d'une escroquerie, déposez plainte auprès de la police ou de la gendarmerie avec toutes les preuves (messages, reçus, numéros). Pour une arnaque sur Internet, vous pouvez aussi vous adresser à la Plateforme de lutte contre la cybercriminalité (PLCC).$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Mention de la Plateforme de lutte contre la cybercriminalité (PLCC) pour les arnaques en ligne : nom et rôle à jour ?
- Relecture générale (conseils de prudence).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'visiter-un-logement-la-liste-de-controle',
  'Visiter un logement : la liste de contrôle',
  'Une visite de vingt minutes engage souvent pour des années. Les points à vérifier, pièce par pièce, et les questions à poser avant de dire oui.',
  'locataire',
  $texte$Une visite passe vite, et l'on a tendance à ne regarder que la taille des pièces et la peinture. Pourtant, ce sont souvent des détails invisibles au premier coup d'œil qui gâchent une location : une fuite, des coupures d'eau fréquentes, une rue inondée en saison des pluies. Voici une liste à garder sur votre téléphone pendant la visite.

## Avant la visite

- Relisez l'annonce et notez vos questions.
- Demandez à visiter **de jour**, et si possible une deuxième fois à un autre moment (le soir, ou après une pluie).
- Venez accompagné si vous le pouvez : deux paires d'yeux voient plus de choses.
- Ne versez **aucune somme** pour la visite.

## L'extérieur et le quartier

- L'accès : la voie est-elle praticable en saison des pluies ? Le secteur est-il inondable ?
- Le bruit : maquis, lieu de culte, garage, route passante à proximité ?
- La sécurité : éclairage de la rue, gardien, portail, voisinage.
- Les services : transport, marché, école, centre de santé.

Pour aller plus loin : [Choisir son quartier : les bonnes questions avant de s'installer](/blog/choisir-son-quartier-les-bonnes-questions).

## L'eau et l'électricité

- Ouvrez les robinets : la pression est-elle suffisante ? L'eau est-elle claire ?
- Demandez si l'eau est souvent coupée, et s'il y a une réserve (citerne, surpresseur).
- Le compteur d'électricité est-il individuel ? Est-il à prépaiement ?
- Vérifiez les prises, les interrupteurs et l'état du tableau électrique.
- Demandez à voir une facture récente pour avoir une idée de la consommation.

## Pièce par pièce

- **Murs et plafonds** : traces d'humidité, moisissures, fissures, peinture qui cloque.
- **Toiture** : traces de fuites au plafond, surtout dans les angles.
- **Fenêtres et portes** : ferment-elles bien ? Les serrures fonctionnent-elles ? Y a-t-il des moustiquaires ?
- **Salle de bain et WC** : chasse d'eau, écoulement de la douche, odeurs.
- **Cuisine** : évier, évacuation, place pour la bouteille de gaz, aération.
- **Climatisation** : si elle est annoncée, faites-la fonctionner.
- **Rangements** et placards.

> Prenez des photos et des notes pendant la visite. Après plusieurs visites, les logements se confondent vite.

## Les questions à poser

- Quel est le loyer, et que comprend-il exactement ?
- Combien de mois de caution et d'avance ? Y a-t-il des frais d'agence ?
- Qui est le propriétaire ? La personne qui fait visiter agit-elle pour lui ?
- Pourquoi le précédent locataire est-il parti ?
- Quels travaux sont prévus avant l'entrée, et qui les paie ?
- Le bail sera-t-il écrit ? Un état des lieux sera-t-il fait ?

## Après la visite

Si le logement vous plaît, demandez que les engagements pris pendant la visite (travaux, réparations, équipements) soient **écrits** dans le bail ou dans un message. Ne payez rien avant d'avoir le bail en main, et relisez [Caution, avance, frais d'agence : ce que vous payez en entrant dans une location](/blog/caution-avance-frais-d-agence-ce-que-vous-payez).

Sur 360-Immo.ci, vous pouvez demander une visite directement depuis l'annonce, en choisissant un créneau : l'annonceur confirme, ou vous en propose un autre.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Pas de point juridique : relecture générale (conseils pratiques).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'negocier-le-prix-d-un-bien',
  'Négocier le prix d''un bien : la méthode',
  'Le prix affiché n''est pas toujours le prix final. Comment préparer une négociation honnête et efficace, que vous achetiez ou que vous louiez.',
  'acheteur',
  $texte$Dans l'immobilier, le prix demandé dans une annonce est un point de départ. Il se discute souvent, surtout pour un bien en vente depuis longtemps ou qui demande des travaux. Mais une négociation réussie se prépare : elle repose sur des faits, pas sur l'intuition.

## 1. Connaître le marché

Avant de proposer un prix, renseignez-vous sur les prix des biens semblables dans le même secteur :

- consultez la [carte des prix](/carte-des-prix) de 360-Immo.ci, qui donne le prix demandé habituel commune par commune ;
- utilisez l'[estimation gratuite](/estimation) pour un bien précis (type, lieu, nombre de pièces) ;
- regardez les annonces semblables, et depuis combien de temps elles sont en ligne.

> Les prix des annonces sont des prix **demandés**, pas des prix de vente. Le prix final se négocie souvent un peu en dessous : c'est justement l'espace de votre négociation.

## 2. Repérer les arguments objectifs

Un vendeur accepte plus facilement une baisse quand elle est justifiée. Notez pendant la visite :

- les **travaux** à prévoir (toiture, plomberie, électricité, peinture), et faites-en estimer le coût ;
- ce qui manque par rapport aux biens comparables (parking, eau courante, accès) ;
- pour un terrain : l'état des documents (une procédure à terminer coûte de l'argent et du temps), l'accès, le relief, le risque d'inondation ;
- depuis combien de temps le bien est en vente.

## 3. Comprendre le vendeur

Pourquoi vend-il ? Un départ, une succession, un besoin d'argent rapide ? Un vendeur pressé sera plus ouvert à une offre raisonnable, surtout si vous pouvez conclure vite. À l'inverse, un vendeur qui n'est pas pressé préférera attendre le bon acheteur.

## 4. Faire une offre sérieuse

- Proposez un prix **argumenté**, en expliquant sur quoi il repose (prix du secteur, travaux).
- Restez **courtois** : un vendeur vexé ne baisse pas son prix.
- Montrez que vous êtes **sérieux** : financement prêt, accord de principe de votre banque, capacité à signer rapidement.
- Mettez votre offre **par écrit**, avec une durée de validité.

!> N'avancez jamais d'argent pour « bloquer » un prix sans un document écrit et signé qui précise le bien, le prix, et ce qui se passe si la vente ne se fait pas. Pour un achat, faites rédiger ce document par un notaire.

## 5. Négocier autre chose que le prix

Si le vendeur ne veut pas baisser, d'autres points peuvent se discuter :

- des **travaux** faits par le vendeur avant la vente ;
- le **mobilier** ou les équipements laissés sur place ;
- le **calendrier** de paiement ;
- pour une location : des travaux faits avant l'entrée, ou un bail plus long contre un loyer stable.

## Et pour une location ?

Le loyer se négocie aussi, surtout pour un logement libre depuis plusieurs semaines. Un locataire sérieux (revenus stables, paiement régulier, bail long) est un argument. Vérifiez aussi que les mois de caution et d'avance demandés respectent la loi : voir [Caution, avance, frais d'agence : ce que vous payez en entrant dans une location](/blog/caution-avance-frais-d-agence-ce-que-vous-payez).

## En résumé

Comparez, argumentez, restez courtois, et mettez tout par écrit. Une bonne négociation est celle où l'acheteur et le vendeur repartent tous les deux satisfaits.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Sommes versées pour « réserver » un bien (acompte, arrhes, avant-contrat) : les conséquences diffèrent ; la formulation prudente retenue est-elle juste ?
- Plafonds de caution et d''avance rappelés pour la location (voir l''article sur la caution).
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'credit-immobilier-preparer-son-dossier',
  'Crédit immobilier : préparer son dossier',
  'Acheter avec un prêt demande de la préparation. Les documents que les banques demandent souvent, l''apport, et les questions à poser avant de signer.',
  'acheteur',
  $texte$Un crédit immobilier permet d'acheter sans avoir toute la somme. Mais obtenir un prêt demande un dossier solide, et comparer les offres demande un peu de méthode. Voici comment vous préparer.

## Faire le point sur votre budget

Avant même de chercher un bien, calculez ce que vous pouvez rembourser chaque mois sans vous mettre en difficulté. Les banques regardent votre **capacité de remboursement** : la part de vos revenus que vous pouvez consacrer au crédit, une fois vos charges payées. Chaque banque a ses propres règles : demandez-les.

Pensez aussi à tous les frais autour du prix : notaire et enregistrement, frais de dossier de la banque, assurance, éventuels travaux.

## L'apport personnel

La plupart des banques demandent un **apport** : une partie du prix payée avec votre propre argent. Plus l'apport est important, plus le dossier est solide, et plus vous pouvez négocier les conditions. Commencez à épargner tôt, et gardez les traces de cette épargne.

## Les documents souvent demandés

Chaque banque a sa liste, mais on retrouve généralement :

- une **pièce d'identité** en cours de validité ;
- un **justificatif de domicile** ;
- pour un salarié : une **attestation de travail** et les **derniers bulletins de salaire** ;
- pour un indépendant ou un commerçant : les documents de l'activité (registre du commerce, bilans, déclarations) ;
- les **relevés bancaires** des derniers mois ;
- la liste des crédits en cours ;
- pour le bien : les **documents de propriété** (titre foncier ou ACD), le projet de contrat de vente, et pour une construction, le permis de construire et les devis.

> Un bien avec un titre foncier est plus facile à financer : la banque prend en général une **hypothèque** sur le bien, inscrite sur le titre foncier, en garantie du prêt.

## Comparer les offres

Ne vous arrêtez pas à la première banque. Comparez :

- le **taux** du crédit, fixe ou variable ;
- la **durée** du prêt et le montant des mensualités ;
- le **coût total** du crédit (intérêts, frais, assurance) ;
- les conditions de **remboursement anticipé** ;
- l'**assurance** demandée (décès, invalidité) et son coût.

Demandez chaque offre par écrit, pour comparer les mêmes éléments.

## Les questions à poser à votre banque

- Quel apport minimum demandez-vous ?
- Quelle part de mes revenus puis-je consacrer au remboursement ?
- Combien de temps prend l'étude du dossier ?
- Quels frais de dossier et quelles garanties demandez-vous ?
- Puis-je rembourser plus vite sans pénalité ?

!> Ne vous engagez pas définitivement dans l'achat avant d'avoir l'accord écrit de la banque. Pour vous protéger, demandez au notaire de prévoir dans l'avant-contrat que la vente ne se fera que si le prêt est accordé.

## Les autres solutions

Certains employeurs, mutuelles ou caisses proposent des aides ou des prêts au logement à leurs membres. Renseignez-vous : ces solutions peuvent compléter un crédit bancaire.

## Bien choisir le bien à financer

Un dossier solide, c'est aussi un bien au juste prix. Avant de présenter votre projet à la banque, vérifiez que le prix demandé correspond au marché avec l'[estimation gratuite](/estimation) et la [carte des prix](/carte-des-prix).$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Clause rendant la vente dépendante de l''obtention du prêt (condition suspensive) : pratique et validité en Côte d''Ivoire.
- Hypothèque inscrite sur le titre foncier en garantie du prêt : formulation juste ?
- Faut-il citer des organismes publics d''aide au financement du logement ? (à compléter si utile)
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'vendre-ou-louer-vite-reussir-son-annonce',
  'Vendre ou louer vite : réussir son annonce',
  'Une bonne annonce attire les bons contacts et fait gagner des semaines. Prix, photos, description : les conseils pour que votre bien se démarque.',
  'vendeur',
  $texte$Les acheteurs et les locataires comparent des dizaines d'annonces sur leur téléphone. En quelques secondes, ils décident d'ouvrir la vôtre ou de passer à la suivante. Une annonce soignée, au bon prix, avec de bonnes photos, se loue ou se vend plus vite, et attire des contacts plus sérieux.

## 1. Fixer le bon prix dès le départ

Un prix trop élevé fait fuir les visiteurs, et une annonce qui reste longtemps en ligne finit par inquiéter. Avant de publier :

- faites une [estimation gratuite](/estimation) de votre bien, d'après les annonces semblables de votre secteur ;
- regardez la [carte des prix](/carte-des-prix) de votre commune ;
- tenez compte de l'état de votre bien et de ses atouts (parking, eau, sécurité, vue).

> Gardez une petite marge de négociation, mais restez dans les prix du secteur : c'est le meilleur moyen d'avoir des visites rapidement.

## 2. Soigner les photos

Les photos sont la première chose regardée. Quelques règles simples :

- **photographiez de jour**, fenêtres ouvertes, lumières allumées ;
- **rangez et nettoyez** avant : un lit fait, une cuisine dégagée, une salle de bain propre ;
- **tenez le téléphone à l'horizontale**, et prenez chaque pièce depuis un angle pour montrer l'espace ;
- montrez **toutes les pièces**, mais aussi l'extérieur, la cour, la vue, l'accès ;
- pour un terrain : des photos du terrain, des bornes, de la voie d'accès et des environs ;
- n'utilisez **que vos propres photos** : les photos prises ailleurs trompent les visiteurs, et notre équipe les repère.

Sur 360-Immo.ci, vous pouvez mettre jusqu'à 20 photos par annonce. La première est celle qui s'affiche dans les listes : choisissez la plus belle.

## 3. Écrire un titre et une description utiles

Le titre doit dire l'essentiel : le type de bien, la taille et le lieu. Par exemple : « Appartement 3 pièces avec parking, Riviera 2 ».

Dans la description, répondez aux questions que les visiteurs se posent :

- la surface, le nombre de pièces, de chambres et de salles de bain ;
- l'eau, l'électricité, la climatisation, le parking, la sécurité ;
- l'étage, pour un appartement ;
- les documents du bien, pour une vente (titre foncier, ACD…) ;
- la caution, l'avance et la date de disponibilité, pour une location ;
- ce qu'il y a autour : transport, écoles, commerces.

Soyez **honnête** : un défaut caché sera découvert à la visite, et tout le monde aura perdu son temps.

## 4. Être joignable et réactif

Un visiteur intéressé contacte souvent plusieurs annonceurs en même temps : le premier qui répond a toutes ses chances. Répondez vite aux messages et aux appels, et proposez des créneaux de visite. Sur 360-Immo.ci, les messages, les demandes de visite et les demandes de rappel arrivent dans votre espace, et un e-mail vous prévient.

## 5. Faire vérifier votre bien

Les annonces qui portent le badge « Bien vérifié » inspirent confiance : le visiteur sait que notre équipe a vu le document de propriété ou le mandat. Envoyez-le depuis Mon Espace → Vérification.

## 6. Suivre et ajuster

Regardez les statistiques de votre annonce (vues, contacts, favoris). Beaucoup de vues mais peu de contacts ? Le prix ou les photos sont peut-être en cause. Peu de vues ? Revoyez le titre et la première photo.

!> Ne demandez jamais d'argent avant une visite, et méfiez-vous des « acheteurs » qui proposent de payer plus que le prix ou de vous envoyer un chèque. Lire aussi : [Arnaques immobilières : les signes qui doivent alerter](/blog/arnaques-immobilieres-les-signes-qui-doivent-alerter)

Prêt ? [Publiez votre annonce](/publier) : notre équipe la vérifie avant sa mise en ligne.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Pas de point juridique : relecture générale.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'connaitre-le-juste-prix-d-un-bien',
  'Connaître le juste prix d''un bien',
  'Prix demandé, prix final, prix au mètre carré : comment lire les prix de l''immobilier, et utiliser la carte des prix et l''estimation de 360-Immo.ci.',
  'marche',
  $texte$« Combien vaut ce bien ? » C'est la question que se posent vendeurs, acheteurs, propriétaires et locataires. Il n'existe pas de prix officiel : le juste prix est celui auquel des biens semblables se louent ou se vendent dans le même secteur. Voici comment l'approcher.

## Prix demandé et prix final

Le prix affiché dans une annonce est le prix **demandé** par le vendeur ou le propriétaire. Le prix final, après négociation, est souvent un peu plus bas. Gardez cette différence en tête quand vous comparez.

## Comparer ce qui est comparable

Deux biens ne se comparent que s'ils se ressemblent :

- **le même type** : un appartement ne se compare pas à une villa, ni un terrain à une maison ;
- **le même lieu** : les prix changent beaucoup d'une commune à l'autre, et même d'un quartier à l'autre ;
- **la même taille** : le nombre de pièces pour un logement, la surface pour un terrain ou un bureau ;
- **les mêmes conditions** : meublé ou non, location au mois ou à la journée.

Pour les terrains, on compare le **prix au mètre carré** (le prix divisé par la surface) : c'est la seule façon de comparer deux lots de tailles différentes.

## Ce que montre la carte des prix

La [carte des prix](/carte-des-prix) de 360-Immo.ci montre, pour un type de bien, le prix demandé habituel commune par commune. Elle repose sur les annonces de 360-Immo.ci des 6 derniers mois :

- le prix affiché est le **prix du milieu** : la moitié des annonces sont moins chères, l'autre moitié plus chères ;
- la **fourchette** va du quart le moins cher au quart le plus cher ;
- les prix **anormaux** (beaucoup trop bas ou beaucoup trop hauts) sont écartés ;
- un prix ne s'affiche qu'à partir de **5 annonces semblables**, pour éviter les conclusions hâtives.

> Ces chiffres viennent uniquement des annonces publiées sur le site : nous n'inventons aucun prix. Le site étant récent, certaines communes n'ont pas encore assez d'annonces ; leurs prix apparaîtront au fil des publications.

## Estimer un bien précis

L'[estimation gratuite](/estimation) va plus loin : vous décrivez votre bien (type, lieu, taille, meublé ou non), et elle cherche les annonces semblables, d'abord dans votre quartier, puis plus largement s'il n'y en a pas assez. Elle vous donne une fourchette de prix et vous montre les annonces sur lesquelles elle s'appuie.

Une estimation reste une indication. Ajustez-la selon ce qui rend votre bien différent :

- **à la hausse** : état neuf ou rénové, parking, groupe électrogène, réserve d'eau, sécurité, vue ;
- **à la baisse** : travaux à prévoir, accès difficile, secteur inondable, documents incomplets pour un terrain.

## Pour aller plus loin

Pour une vente importante, une succession ou un prêt, faites appel à un professionnel (expert immobilier, notaire, agent immobilier) : il visite le bien et tient compte de ce qu'aucune annonce ne montre.

Vous connaissez maintenant votre prix ? [Publiez votre annonce](/publier), ou consultez les [annonces](/annonces) pour comparer. Et pour la discussion qui suit : [Négocier le prix d'un bien : la méthode](/blog/negocier-le-prix-d-un-bien).$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Pas de point juridique. Vérifier que les explications correspondent toujours au fonctionnement de la carte des prix et de l''estimation.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'reparations-et-charges-qui-paie-quoi',
  'Réparations et charges : qui paie quoi entre locataire et propriétaire ?',
  'Une fuite, une panne de climatiseur, une serrure cassée : qui doit payer ? Les grands principes, et comment éviter les disputes.',
  'juridique',
  $texte$C'est l'une des premières sources de conflit entre locataires et propriétaires : une réparation à faire, et chacun pense que c'est à l'autre de payer. Le bail et la loi donnent des repères. Voici les grands principes, à adapter à ce que prévoit votre contrat.

## Le principe général

- Le **propriétaire** doit fournir un logement en bon état et y faire les **grosses réparations** : celles qui touchent la structure du bâtiment (toiture, murs, gros œuvre), et le remplacement des équipements usés par le temps.
- Le **locataire** doit utiliser le logement avec soin (« en bon père de famille », dit la loi) et faire l'**entretien courant** et les **petites réparations** liées à l'usage quotidien.

> Ce que dit votre bail compte : lisez la clause sur les réparations avant de signer, et faites préciser les points flous. Voir aussi [Le contrat de bail : ce qu'il doit contenir](/blog/contrat-de-bail-ce-qu-il-doit-contenir)

## Des exemples pour se repérer

Le plus souvent, sont à la charge du **locataire** :

- le remplacement des ampoules, des joints, des petites pièces de robinetterie ;
- le débouchage des évacuations bouchées par l'usage ;
- l'entretien courant de la climatisation (nettoyage des filtres) ;
- la réparation des dégâts causés par lui ou ses visiteurs ;
- l'entretien de la cour ou du jardin, s'il en a l'usage.

Le plus souvent, sont à la charge du **propriétaire** :

- les fuites de toiture et les infiltrations venant de l'extérieur ;
- les problèmes de structure (fissures importantes, murs, dalles) ;
- le remplacement d'un équipement fourni avec le logement et usé par le temps (chauffe-eau, climatiseur, pompe) ;
- la remise en état de l'installation électrique ou de la plomberie défectueuse ;
- selon les cas, les réparations après un événement extérieur (inondation, tempête).

## Les charges : eau, électricité, entretien

- Les consommations d'**eau** et d'**électricité** sont en principe payées par le locataire, surtout avec des compteurs individuels.
- Dans une résidence, des **charges communes** (gardiennage, entretien des parties communes, ordures) peuvent être demandées : leur montant et leur répartition doivent être écrits dans le bail.

!> Avec un compteur commun à plusieurs logements, les disputes sur le partage des factures sont fréquentes. Mettez par écrit la règle de partage dès l'entrée, ou demandez un compteur individuel.

## Comment éviter les conflits

1. **Prévenez par écrit** dès qu'un problème apparaît (message, lettre), avec des photos. Un problème signalé tard peut s'aggraver, et l'on pourrait vous le reprocher.
2. **Laissez le propriétaire intervenir** : ne faites pas faire de grosses réparations à sa place sans son accord écrit, sauf urgence.
3. **Gardez les factures** des réparations que vous payez.
4. **Ne retenez pas le loyer** de vous-même pour vous rembourser : c'est une source de conflit grave. Cherchez d'abord un accord écrit.
5. En cas de désaccord qui dure, demandez conseil (association de consommateurs, avocat, huissier de justice pour faire constater l'état du logement).

Un état des lieux précis à l'entrée et une bonne communication règlent la plupart des situations.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Répartition des réparations entre propriétaire et locataire selon la loi n° 2018-575 et le Code civil applicable (grosses réparations, réparations locatives) : les exemples donnés sont-ils justes ?
- L''expression « en bon père de famille » est-elle toujours celle du droit ivoirien ?
- Le locataire ne doit pas retenir le loyer de lui-même : formulation prudente juste ?
- « Huissier de justice » : dénomination actuelle en Côte d''Ivoire ?
- Organismes à citer en cas de désaccord (associations de consommateurs, conciliation) ?
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
),
(
  'choisir-son-quartier-les-bonnes-questions',
  'Choisir son quartier : les bonnes questions avant de s''installer',
  'Le bon logement dans le mauvais quartier, ce sont des heures dans les embouteillages ou les pieds dans l''eau. Les questions à se poser avant de choisir où habiter.',
  'quartiers',
  $texte$On choisit souvent un logement pour ses pièces, son prix ou sa peinture neuve. Mais au quotidien, c'est le quartier qui compte : le temps de trajet, la sécurité, l'eau, le bruit, les écoles. Avant de vous engager, prenez le temps de répondre à ces questions.

## Combien de temps pour aller au travail ?

À Abidjan comme dans les autres grandes villes, un trajet peut prendre bien plus de temps aux heures de pointe qu'en milieu de journée. Faites le trajet **aux heures où vous le ferez vraiment**, en voiture ou en transport en commun. Regardez les transports proches : gbaka, wôrô-wôrô, bus, bateau-bus, taxi.

> Un loyer un peu plus élevé près de votre travail peut revenir moins cher, au final, qu'un loyer bas avec deux heures de trajet et des frais de transport chaque jour.

## Le secteur est-il inondable ?

Pendant la saison des pluies, certaines zones sont régulièrement inondées, et des voies deviennent impraticables. Pour le savoir :

- visitez **après une forte pluie** si possible ;
- regardez les traces sur les murs et les clôtures, les caniveaux, la pente de la rue ;
- **demandez aux voisins** et aux commerçants : ils savent.

!> Méfiez-vous des constructions au pied d'une pente instable, ou au bord d'un cours d'eau ou d'un canal : en saison des pluies, ces zones peuvent présenter des risques d'éboulement ou d'inondation.

## L'eau et l'électricité arrivent-elles bien ?

Selon les secteurs, les coupures d'eau ou d'électricité sont plus ou moins fréquentes. Demandez aux voisins comment cela se passe, et regardez si les maisons voisines ont des citernes ou des groupes électrogènes : c'est un bon indice.

## Quels services à proximité ?

Selon votre situation, vérifiez la distance jusqu'aux :

- écoles et crèches ;
- centres de santé et pharmacies ;
- marchés, supermarchés, boutiques ;
- banques et points de mobile money ;
- lieux de culte, terrains de sport, espaces verts.

## Calme ou animé ?

Un quartier animé est pratique, mais il peut être bruyant le soir et le week-end (maquis, lieux de culte, événements, circulation). Passez-y **le soir et le week-end** pour vous faire une idée. À l'inverse, un quartier très calme peut être loin des commerces et des transports.

## La sécurité

Regardez l'éclairage des rues, la présence de gardiens dans les résidences, l'état des clôtures. Parlez aux habitants et aux commerçants. Une résidence fermée offre souvent plus de sécurité, avec des charges en contrepartie.

## Et le prix ?

Les prix varient fortement d'une commune à l'autre. Pour savoir ce que coûte un logement semblable dans chaque commune, consultez la [carte des prix](/carte-des-prix), puis la page de prix de chaque commune.

## Notre conseil

Avant de signer, passez une heure dans le quartier, à pied, à différents moments. Rien ne remplace ce que l'on voit et ce que l'on entend sur place. Et pour la visite elle-même : [Visiter un logement : la liste de contrôle](/blog/visiter-un-logement-la-liste-de-controle).

Prêt à chercher ? Consultez les [annonces de location](/annonces?tx=location) et les [biens à vendre](/annonces?tx=achat), avec un filtre par commune et par quartier.$texte$,
  false,
  'Première version, à relire avant publication.
À vérifier :
- Pas de point juridique. Ne citer aucun quartier « inondable » ou « dangereux » sans source officielle.
Une fois ces points vérifiés et le texte corrigé, videz ces notes.'
)
on conflict (slug) do nothing;
