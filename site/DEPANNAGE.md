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
| SMS | Vérifier les numéros par SMS est payant (quelques centimes par SMS) | À décider à l'étape 3 |
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
| **Clé secrète** (« secret » ou « service_role ») | Uniquement dans les réglages de Vercel (variables d'environnement) | **Tous les droits** sur la base |
| **Mot de passe de la base** | Uniquement chez Supabase et dans les réglages de Vercel | **Tous les droits** sur la base |

- **Jamais** dans le code, ni par chat, e-mail ou capture d'écran.
- **En cas de fuite** : Supabase → Project Settings → API Keys pour créer une nouvelle clé secrète et
  désactiver l'ancienne ; Project Settings → Database pour changer le mot de passe. Il faut ensuite mettre à
  jour les réglages de Vercel et remettre le site en ligne.

## Relier Supabase à Vercel

À faire une seule fois (début de l'étape 3) : Vercel reçoit alors automatiquement l'adresse de la base et ses
clés, sans qu'elles passent par le code ni par le chat.

> ⚠️ Sur la page Supabase du **Vercel Marketplace**, **ne cliquez pas sur « Install »** : ce bouton crée une
> **nouvelle** organisation et un **nouveau** projet Supabase, facturés par Vercel. Notre projet existe déjà.

1. Sur cette même page, cliquez sur **« ⋯ »** (à droite des boutons), puis **« Connect Account »** (lier un
   compte existant).
2. Choisissez l'équipe Vercel **GADA**, puis, côté Supabase, l'organisation qui contient le projet `360-immo`.
3. Reliez le projet Supabase **`360-immo`** au projet Vercel **`360-immo`**.
4. Vérification : Vercel → projet `360-immo` → **Settings → Environment Variables** : des variables commençant
   par `NEXT_PUBLIC_SUPABASE_`, `SUPABASE_` et `POSTGRES_` sont apparues.

On peut aussi partir de Supabase : tableau de bord de l'organisation → **Integrations** → **Vercel**.

**Arrêtez-vous et envoyez une capture** si un écran propose de **créer** un projet, de choisir une **région** ou
une **offre payante** : ce n'est pas le bon chemin.

## Que faire si…

| Ce que vous voyez | Où regarder | Quoi faire |
|---|---|---|
| Une croix rouge ❌ à côté d'un commit ou d'une pull request | GitHub → onglet **Actions** → la ligne en rouge ; en bas de la page, le rapport (`rapport-nouveau-site` ou `rapport-tests`) | **Ne pas fusionner.** Envoyer une capture ou le rapport |
| Le site ne s'est pas mis à jour après une fusion | Vercel → projet `360-immo` → **Deployments** → la dernière ligne (« Error ») → **Build Logs** | Envoyer les dernières lignes en rouge. L'ancienne version reste en ligne |
| Page blanche, « Application error » ou « 500 » sur le site | Vercel → projet `360-immo` → **Logs** | Pour revenir tout de suite à la version d'avant : **Deployments** → la version précédente → **⋯** → **Instant Rollback**. Puis envoyer les messages des Logs |
| « 404 : NOT_FOUND » sur tout le site | Vercel → **Settings** : Root Directory = `site`, Framework = Next.js | Envoyer une capture de ces réglages |
| Plus aucune annonce, connexion impossible | Page d'accueil du projet Supabase : « **Project paused** » ? | Cliquer **Restore project** : les données sont conservées. Ne pas tarder : au-delà de **90 jours** de pause, il faut télécharger la sauvegarde et recréer un projet |
| Une modification de la base n'est pas arrivée | Page d'accueil du projet Supabase : « **Last migration** » doit porter le nom du dernier fichier de `supabase/migrations` | Envoyer une capture de Supabase → **Integrations → GitHub** |
| Message « row-level security », « permission denied » ou « 401 / 403 » | — | La base refuse un accès : souvent voulu, parfois une règle à ajuster. Envoyer le message exact et ce que vous faisiez |
| Message en français comme « Pas de nombre de pièces pour « Terrain » » | — | Ce sont les règles des biens qui bloquent une saisie incohérente : c'est normal |
| « relation … does not exist » ou « column … does not exist » | Supabase → « Last migration » | La base n'a pas reçu la dernière migration (voir plus haut) |
| E-mail d'inscription ou de mot de passe oublié jamais reçu | Supabase → **Authentication** → **Logs** | Probablement la limite d'e-mails (voir [Risques](#risques-et-précautions)) |
| E-mail « usage limit », « will be paused » ou « over quota » | Vercel → **Usage** (équipe GADA) ; Supabase → **Usage** (organisation) | Le transférer : on voit s'il faut réduire l'usage ou passer à l'offre Pro |
| Tout est cassé d'un coup, sans aucun changement de notre côté | https://www.vercel-status.com et https://status.supabase.com | Panne chez eux : attendre |

## Où trouver les journaux (logs)

- **GitHub** : onglet **Actions** → un passage des tests → détail de chaque étape ; rapport téléchargeable en bas
  de page (captures d'écran comprises).
- **Vercel** : **Deployments** → une version → **Build Logs** (fabrication du site) ; **Logs** (erreurs pendant
  les visites) ; **Usage** (consommation du mois).
- **Supabase** : **Logs** (Postgres = la base, Auth = connexions, Storage = photos, API = demandes du site) ;
  **Advisors** (conseils de sécurité et de vitesse) ; **Table Editor** (voir les données) ; **Usage**.

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
