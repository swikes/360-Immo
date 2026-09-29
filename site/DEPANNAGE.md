# Vercel et Supabase : rôle, limites et dépannage

Ce guide explique à quoi servent les deux services qui font tourner le nouveau site, ce qu'ils coûtent, ce
qui peut mal se passer, et **où regarder quand quelque chose ne marche pas**. En cas de problème, allez
directement au tableau [Que faire si…](#que-faire-si).

## Qui fait quoi

| Service | Son rôle | Où le trouver |
|---|---|---|
| **GitHub** | Garde le code. Tout part d'ici : une modification est proposée sur une branche, puis fusionnée sur `main`. Lance aussi les tests automatiques. | https://github.com/swikes/360-Immo |
| **Vercel** | Fabrique le site à partir du dossier `site` et le met en ligne, sur des serveurs à Paris. Ne garde **aucune donnée**. | Site : https://360-immo.vercel.app — tableau de bord : https://vercel.com (équipe GADA, projet `360-immo`) |
| **Supabase** | Garde les données : annonces, comptes et connexion, photos, favoris, messages, visites, alertes. Fait respecter les règles (qui voit quoi, pas de pièces pour un terrain…). | https://supabase.com/dashboard (projet `360-immo`, West EU Paris) |

Quand quelqu'un ouvre le site : son téléphone demande la page à **Vercel**, qui va chercher les annonces chez
**Supabase**, puis renvoie la page remplie. Vercel et Supabase sont tous les deux à Paris : un seul long trajet
depuis Abidjan, et un trajet très court entre les deux.

## Ce qui se passe à chaque fusion sur `main`

Trois choses démarrent en même temps, **chacune de son côté** :

1. **GitHub** lance les tests automatiques (5 à 10 minutes) : ✅ ou ❌ à côté du commit.
2. **Vercel** reconstruit le site et le met en ligne (1 à 2 minutes). S'il échoue, **l'ancienne version reste en
   ligne** : le site ne tombe pas.
3. **Supabase** applique les nouvelles modifications de la base (les fichiers de `supabase/migrations`).

> ⚠️ Vercel et Supabase **n'attendent pas** le résultat des tests. **Ne fusionnez que si les tests sont verts ✅.**

Sur chaque pull request, Vercel publie aussi une **adresse d'aperçu** pour essayer les changements avant de
fusionner. Attention : une fois Supabase relié à Vercel, les aperçus utilisent **la même base que le site en
ligne** (des bases séparées par branche sont payantes). Une annonce créée en testant un aperçu est une vraie
annonce.

## Avantages

- **Aucun serveur à gérer** : pas de machine à mettre à jour, à sécuriser ou à redémarrer.
- **Mise en ligne automatique** à chaque fusion, et retour en arrière en un clic.
- **Sécurité dans la base elle-même** : même quelqu'un qui contournerait le site ne peut ni lire les messages des
  autres, ni publier sans validation de l'équipe (voir [supabase/README.md](supabase/README.md)).
- **Gratuit pendant la construction**, et le même code tient la charge quand le site grandit.
- **Pas prisonnier** : Supabase est une base PostgreSQL standard (exportable à tout moment) et un site Next.js
  peut être hébergé ailleurs que chez Vercel.
- **Serveurs à Paris**, le plus près possible d'Abidjan parmi les choix proposés.

## Limites des offres gratuites et coût au lancement

| | Vercel « Hobby » (gratuit) | Supabase « Free » (gratuit) |
|---|---|---|
| Usage | **Non commercial uniquement** | Tous usages |
| Principales limites | 100 Go de trafic par mois ; 1 million d'appels de pages calculées ; 5 000 optimisations d'images par mois | Base : 500 Mo ; photos : 1 Go ; trafic : 5 Go par mois ; 50 000 utilisateurs actifs par mois ; 2 projets |
| Sauvegardes | Sans objet (aucune donnée chez Vercel) | **Aucune** |
| Si on dépasse | Le service concerné est **suspendu jusqu'au mois suivant** | E-mail d'avertissement, puis restrictions |
| Particularité | Retour en arrière limité à la version juste avant | **Mise en pause après 1 semaine sans activité** |
| Offre payante | **Pro : ~20 $/mois** | **Pro : ~25 $/mois** : sauvegarde chaque jour, plus de pause, plafond de dépenses activé par défaut |

**Au lancement public** : passer aux deux offres Pro, soit environ **45 $ par mois** (~25 000 à 30 000 FCFA),
plus un service d'e-mails (offre gratuite suffisante au début) et le nom de domaine.

## Risques et précautions

| Risque | Ce que ça veut dire | Précaution |
|---|---|---|
| Photos | 1 Go se remplit vite : à 5 Mo par photo, environ 200 photos | À l'étape 4, chaque photo sera réduite (~300 Ko) avant l'envoi : plusieurs milliers de photos |
| E-mails | Sans réglage, Supabase n'envoie les e-mails (confirmation, mot de passe oublié) **qu'aux membres de l'équipe Supabase**, et 2 par heure au plus | Suffisant pour tester ; avant le lancement, brancher un service d'e-mails (Brevo, Resend…) |
| SMS | Vérifier les numéros par SMS est payant (quelques centimes par SMS) | Pas de code SMS pour l'instant : le numéro est vérifié dans sa forme selon le pays. À reconsidérer au lancement |
| Clés secrètes | La clé secrète et le mot de passe de la base donnent **tous les droits** | Voir [Les clés et mots de passe](#les-clés-et-mots-de-passe) |
| Compte piraté | Qui prend le compte GitHub peut modifier le site et la base | **Double authentification (2FA)** sur GitHub, Vercel et Supabase |
| Modifier la base à la main | Le Table Editor et le SQL Editor de Supabase permettent de changer la **structure** de la base : elle ne correspondrait plus au code ni aux tests | Corriger des **données** (une annonce, un nom) : oui. Changer la **structure** (tables, colonnes, règles) : toujours par une nouvelle migration dans le code |
| Modification de la base ratée | Une migration en erreur | Les tests l'essaient sur une vraie base avant chaque fusion ; si elle rate quand même, on corrige par une **nouvelle** migration (on ne modifie jamais une migration déjà appliquée) |
| Panne chez Vercel ou Supabase | Rare, hors de notre contrôle | Vérifier https://www.vercel-status.com et https://status.supabase.com, puis attendre |
| Données personnelles hors de Côte d'Ivoire | Les données sont à Paris ; la loi ivoirienne demande en principe une démarche auprès de l'**ARTCI** pour les données envoyées à l'étranger | À faire vérifier par un juriste avant le lancement (étape 9) |

## Les clés et mots de passe

| Élément | Où il se trouve | Danger |
|---|---|---|
| Adresse du projet et **clé publique** (« publishable » ou « anon ») | Dans le site, visibles par tout le monde | **Aucun** : les règles de la base protègent les données |
| **Clé secrète** (« secret » ou « service_role ») | Uniquement chez Supabase ; dans les réglages de Vercel seulement le jour où une fonction du site en aura besoin | **Tous les droits** sur la base |
| **Mot de passe de la base** | Uniquement chez Supabase (et dans votre gestionnaire de mots de passe) | **Tous les droits** sur la base |

- **Jamais** dans le code, ni par chat, e-mail ou capture d'écran.
- **En cas de fuite** : Supabase → Project Settings → API Keys pour créer une nouvelle clé secrète et
  désactiver l'ancienne ; Project Settings → Database pour changer le mot de passe. Si la clé était aussi dans
  les réglages de Vercel, l'y remplacer et remettre le site en ligne.

## Relier Supabase à Vercel

À faire une seule fois (début de l'étape 3) : le site sur Vercel a besoin de **l'adresse de la base** et de sa
**clé publique** pour lui parler. On les copie de Supabase vers les réglages de Vercel, sans passer par le code
ni par le chat.

> ⚠️ Sur la page Supabase du **Vercel Marketplace**, ne cliquez **ni sur « Install »**, **ni sur « ⋯ » → « Deploy
> Template »** : ils créent une **nouvelle** organisation et un **nouveau** projet Supabase (facturés par Vercel),
> et même un nouveau site pour « Deploy Template ». Notre projet existe déjà.

1. **Supabase** → projet `360-immo` → bouton **Connect** (en haut) → onglet **Frameworks** → choisir **Next.js**.
   Deux lignes s'affichent : `NEXT_PUBLIC_SUPABASE_URL=…` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…`.
   Copiez-les.
2. **Vercel** → projet `360-immo` → **Environment Variables** (dans le menu de gauche du projet) →
   **Add Environment Variable**.
3. **Type** : **Config** (valeur non secrète, relisible). Collez les deux lignes dans le champ **Key** : Vercel
   remplit tout seul les deux variables (sinon, ajoutez-les une par une : le nom à gauche du `=` dans **Key**, le
   reste dans **Value**).
4. **Environments** : **Production**, **Preview** et **Development** (« All Environments »), puis **Save**.
5. Vérification : les deux variables apparaissent dans la liste. Elles servent à partir de la mise en ligne
   suivante (le site les lit au moment où Vercel le fabrique).

Ces deux valeurs sont **publiques** (elles finissent dans les pages du site) : elles ne donnent accès qu'à ce
que les règles de la base permettent. **N'ajoutez pas** la clé secrète ni le mot de passe de la base : le site
n'en a pas besoin pour l'instant.

Si ces valeurs changent un jour (nouvelle clé), il faut les remplacer dans Vercel à la main, puis remettre le site
en ligne (**Deployments** → dernière version → **⋯** → **Redeploy**).

## Réglages Supabase pour les comptes

À faire une seule fois, dans Supabase → projet `360-immo` → **Authentication** :

1. **Sign In / Providers** → **Email** : désactivez **Confirm email**, puis **Save**. Sans service d'e-mails,
   Supabase n'envoie les e-mails de confirmation qu'aux membres de l'équipe Supabase (2 par heure) : les autres
   personnes ne pourraient jamais activer leur compte. À réactiver au lancement, avec un service d'e-mails.
2. **URL Configuration** :
   - **Site URL** : `https://360-immo.vercel.app` ;
   - **Redirect URLs** (**Add URL**) : `https://360-immo.vercel.app/**`, `https://360-immo-*-gada7.vercel.app/**`
     (adresses d'aperçu) et `http://localhost:3000/**` (ordinateur). Sans cela, le lien « mot de passe oublié »
     reçu par e-mail mène à une mauvaise adresse.
3. Facultatif : si Supabase propose une **longueur minimale du mot de passe** (même rubrique **Email**), mettez 8,
   comme le formulaire du site.

**Au lancement** : réactiver **Confirm email**, brancher un service d'e-mails (**SMTP Settings**), et remplacer
la **Site URL** par le nom de domaine du site.

## Publier une annonce en attendant l'espace de l'équipe

Une annonce envoyée depuis le site attend la vérification de l'équipe 360-Immo.ci (« En vérification » dans Mon
Espace → Mes annonces). L'espace de modération arrive à l'étape 7 ; d'ici là, on publie depuis Supabase :

1. Supabase → projet `360-immo` → **Table Editor** → table **`annonces`**.
2. **Filter** → `statut` · `equals` · `en_attente` : les annonces à vérifier.
3. Lire la ligne : titre, description, prix, lieu, contact. Les photos sont dans **Storage** → **photos-annonces**
   → le dossier qui porte l'identifiant de l'annonce (colonne `id`).
4. **Publier** : double-clic sur la case `statut` → `publiee` → **Save**. La base remplit seule la date de
   publication (`publiee_le`) et la fin de validité (`expire_le`, 90 jours plus tard).
5. **Refuser** : `statut` → `refusee`, et écrire la raison dans `motif_refus` (par exemple « Photos floues : ajoutez
   des photos nettes du salon et des chambres. »). La personne la voit dans Mes annonces et peut **Corriger**.

Attention : dans le Table Editor, on a tous les droits et il n'y a pas de retour en arrière. Ne changer que
`statut`, `motif_refus` et, au besoin, `expire_le` (pour prolonger une annonce à la main).

Une annonce publiée apparaît « En ligne » dans Mes annonces ; les visiteurs la trouveront dans la recherche du
nouveau site à l'étape 5. Une annonce en ligne dont l'auteur change beaucoup le prix (plus de 20 %), le lieu, le
type ou les photos repasse seule « en attente » : il faut alors la revérifier.

## Que faire si…

| Ce que vous voyez | Où regarder | Quoi faire |
|---|---|---|
| Une croix rouge ❌ à côté d'un commit ou d'une pull request | GitHub → onglet **Actions** → la ligne en rouge ; en bas de la page, le rapport (`rapport-nouveau-site` ou `rapport-tests`) | **Ne pas fusionner.** Envoyer une capture ou le rapport |
| Le site ne s'est pas mis à jour après une fusion | Vercel → projet `360-immo` → **Deployments** → la dernière ligne (« Error ») → **Build Logs** | Envoyer les dernières lignes en rouge. L'ancienne version reste en ligne |
| La mise en ligne d'une fusion est en « Error » après quelques secondes, alors que l'aperçu (Preview) du même changement est « Ready » | Vercel → projet `360-immo` → **Deployments** | Raté de Vercel, pas du code : sur la ligne en erreur, **⋯** → **Redeploy**. Vérifier que la ligne passe « Ready » avec le badge bleu **Production**, puis recharger le site (sur téléphone : fermer l'onglet et le rouvrir). Si ça échoue encore : cliquer sur la ligne et envoyer le message |
| Page blanche, « Application error » ou « 500 » sur le site | Vercel → projet `360-immo` → **Logs** | Pour revenir tout de suite à la version d'avant : **Deployments** → la version précédente → **⋯** → **Instant Rollback**. Puis envoyer les messages des Logs |
| « 404 : NOT_FOUND » sur tout le site | Vercel → **Settings** : Root Directory = `site`, Framework = Next.js | Envoyer une capture de ces réglages |
| Plus aucune annonce, connexion impossible | Page d'accueil du projet Supabase : « **Project paused** » ? | Cliquer **Restore project** : les données sont conservées. Ne pas tarder : au-delà de **90 jours** de pause, il faut télécharger la sauvegarde et recréer un projet |
| Page Connexion : « Les comptes ouvrent bientôt » | Vercel → projet `360-immo` → **Environment Variables** : les deux variables de [Relier Supabase à Vercel](#relier-supabase-à-vercel) | Les ajouter si elles manquent, puis **Deployments** → dernière version → **⋯** → **Redeploy** |
| Le site n'arrive pas à joindre la base (« Invalid API key », « Impossible de joindre le serveur ») | Vercel → **Environment Variables** ; page d'accueil de Supabase (pause ?) | Recopier les deux valeurs depuis Supabase → **Connect**, puis **Redeploy** |
| Après l'inscription : « Vérifiez vos e-mails » au lieu de l'accueil | Supabase → **Authentication** → **Sign In / Providers** → **Email** | **Confirm email** est encore activé : le désactiver (voir [Réglages Supabase pour les comptes](#réglages-supabase-pour-les-comptes)) |
| Le lien « mot de passe oublié » mène à `localhost` ou à une page d'erreur | Supabase → **Authentication** → **URL Configuration** | Corriger **Site URL** et **Redirect URLs** (voir [Réglages Supabase pour les comptes](#réglages-supabase-pour-les-comptes)) |
| « E-mail ou mot de passe incorrect » alors que tout semble juste | Supabase → **Authentication** → **Users** : le compte existe-t-il ? | Utiliser « Mot de passe oublié » ; si le compte n'existe pas, se réinscrire |
| « Trop d'e-mails envoyés pour le moment » | — | Limite d'e-mails de Supabase sans service d'e-mails : réessayer dans une heure |
| Une modification de la base n'est pas arrivée | Page d'accueil du projet Supabase : « **Last migration** » doit porter le nom du dernier fichier de `supabase/migrations` | Envoyer une capture de Supabase → **Integrations → GitHub** |
| Message « row-level security », « permission denied » ou « 401 / 403 » | — | La base refuse un accès : souvent voulu, parfois une règle à ajuster. Envoyer le message exact et ce que vous faisiez |
| Message en français comme « Pas de nombre de pièces pour « Terrain » » | — | Ce sont les règles des biens qui bloquent une saisie incohérente : c'est normal |
| « 20 photos au plus par annonce. » ou « … ne peut pas encore être renouvelée … » | — | Règles de la publication : c'est normal (voir [supabase/README.md](supabase/README.md)) |
| Une photo refusée : « … ne peut pas être lue ici » | Le format du fichier | Souvent une photo d'iPhone (HEIC) envoyée depuis un ordinateur : l'enregistrer en JPEG, ou sur l'iPhone **Réglages** → **Appareil photo** → **Formats** → **Le plus compatible**. Depuis le téléphone lui-même, ça marche |
| Les photos ne partent pas (« Action non autorisée pour ce compte ») | Supabase → « Last migration » ; **Storage** → le compartiment **photos-annonces** existe ? | Envoyer une capture : les règles du stockage des photos ne sont probablement pas installées |
| « relation … does not exist » ou « column … does not exist » | Supabase → « Last migration » | La base n'a pas reçu la dernière migration (voir plus haut) |
| E-mail de mot de passe oublié jamais reçu | Supabase → **Authentication** → **Logs** ; dossier « courriers indésirables » | Sans service d'e-mails, seuls les membres de l'équipe Supabase le reçoivent, 2 par heure (voir [Risques](#risques-et-précautions)) |
| E-mail « usage limit », « will be paused » ou « over quota » | Vercel → **Usage** (équipe GADA) ; Supabase → **Usage** (organisation) | Le transférer : on voit s'il faut réduire l'usage ou passer à l'offre Pro |
| Tout est cassé d'un coup, sans aucun changement de notre côté | https://www.vercel-status.com et https://status.supabase.com | Panne chez eux : attendre |

## Où trouver les journaux (logs)

- **GitHub** : onglet **Actions** → un passage des tests → détail de chaque étape ; rapport téléchargeable en bas
  de page (captures d'écran comprises).
- **Vercel** : **Deployments** → une version → **Build Logs** (fabrication du site) ; **Logs** (erreurs pendant
  les visites) ; **Usage** (consommation du mois).
- **Supabase** : **Logs** (Postgres = la base, Auth = connexions, Storage = photos, API = demandes du site) ;
  **Authentication → Users** (les comptes inscrits) ; **Advisors** (conseils de sécurité et de vitesse) ;
  **Table Editor** (voir les données, dont la table `profils`) ; **Usage**.

## Quoi envoyer quand vous demandez de l'aide

- Une **capture d'écran** de l'erreur et, si possible, le **texte exact** copié-collé.
- **L'adresse** de la page, **l'heure**, et si c'était sur **téléphone ou ordinateur**.
- Ce que vous faisiez juste avant (« je publiais une annonce avec 3 photos… »).
- **Jamais** : mot de passe, clé secrète (« secret », « service_role »), lien contenant « token ».

## Trois réflexes

1. **2FA** sur GitHub, Vercel et Supabase.
2. **Lire les e-mails** de Vercel et de Supabase : ils préviennent avant une pause ou un dépassement.
3. **Fusionner seulement quand les tests sont verts ✅.**

## Pour aller plus loin

- Vercel : [offres et limites](https://vercel.com/pricing), [revenir à une version précédente](https://vercel.com/docs/instant-rollback)
- Supabase : [facturation](https://supabase.com/docs/guides/platform/billing-on-supabase),
  [mise en pause des projets gratuits](https://supabase.com/docs/guides/platform/free-project-pausing),
  [envoi d'e-mails (SMTP)](https://supabase.com/docs/guides/auth/auth-smtp),
  [liste de contrôle avant le lancement](https://supabase.com/docs/guides/deployment/going-into-prod)
