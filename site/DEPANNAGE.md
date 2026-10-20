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

**Fond de la carte des prix** : les rues viennent d'OpenStreetMap, gratuit et sans compte, à condition de rester un
usage modéré et de citer OpenStreetMap (c'est fait, en bas de la carte). Si la carte devient très consultée (des
dizaines de milliers de visites par jour), passer à un fournisseur de fonds de carte (MapTiler ou Stadia Maps : offre
gratuite puis quelques dollars par mois) : une seule adresse à changer, dans `components/prix/CartePrix.tsx`. Sans
fond de carte, les pastilles des communes et la liste des prix restent affichées.

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
| Pièces d'identité et titres de propriété | Documents très sensibles (vérification par l'équipe) | Rangés dans un dossier **privé** de Supabase (`documents`), ouverts seulement par la personne et l'équipe, par un lien valable 10 minutes. La **pièce d'identité validée est gardée tant que le compte existe, puis 1 an** (en cas de plainte) ; l'équipe ne l'ouvre qu'avec un motif, noté au journal. Les autres documents sont **supprimés dès la décision**. Ne jamais rendre ce dossier public dans Supabase → **Storage**, ni enregistrer ces documents ailleurs. À écrire dans la politique de confidentialité et la démarche auprès de l'ARTCI (étape 9) |
| Plusieurs comptes pour une même personne | Contourner une règle ou une offre payante | Un numéro principal et un e-mail par compte (Gmail sans ses points ni « +… », adresses jetables refusées) ; une pièce d'identité ne vérifie qu'un compte. **Sans code par SMS**, quelqu'un peut prendre le numéro d'une autre personne : l'équipe le libère sur réclamation (onglet **Comptes**). Code par SMS : à reconsidérer plus tard |

## Les clés et mots de passe

| Élément | Où il se trouve | Danger |
|---|---|---|
| Adresse du projet et **clé publique** (« publishable » ou « anon ») | Dans le site, visibles par tout le monde | **Aucun** : les règles de la base protègent les données |
| **Clé secrète** (« secret » ou « service_role ») | Chez Supabase, et dans les réglages de Vercel (`SUPABASE_SECRET_KEY`) pour l'envoi des e-mails | **Tous les droits** sur la base |
| **Clé de Brevo** (« API key ») | Chez Brevo, et dans les réglages de Vercel (`BREVO_API_KEY`) | Envoyer des e-mails en votre nom |
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

**Au lancement** : réactiver **Confirm email** avec un service d'e-mails (voir
[Lancement public : sécurité](#lancement-public--sécurité-étape-9e)), et remplacer la **Site URL** par le nom de
domaine du site (voir [Le jour du nom de domaine](#le-jour-du-nom-de-domaine-étape-9)).

## Envoi des e-mails (Brevo)

Le site envoie des e-mails : nouveau message, demande de visite et réponses, nouvelles annonces des alertes (chaque
matin à 7 h, heure d'Abidjan), rappel 3 jours avant la fin d'une annonce. Ils passent par **Brevo** (offre gratuite :
300 e-mails par jour). Tant que les réglages ci-dessous ne sont pas faits, rien ne part : les e-mails attendent
dans la base (3 jours au plus), sans gêner le reste du site. À faire une seule fois :

1. **Brevo → l'adresse d'envoi** : menu en haut à droite → **Senders, Domains & Dedicated IPs** → **Senders** →
   **Add a sender** : nom `360-Immo.ci`, et votre adresse e-mail. Brevo envoie un code à cette adresse : le saisir.
   En attendant le nom de domaine, une adresse Gmail convient, mais certains e-mails iront dans les courriers
   indésirables.
2. **Brevo → la clé** : menu en haut à droite → **SMTP & API** → onglet **API Keys** → **Generate a new API key**,
   nom `360-immo-vercel`. Copiez-la tout de suite (elle ne s'affiche qu'une fois) ; **ne l'envoyez à personne**.
3. **Supabase → la clé secrète** : projet `360-immo` → **Project Settings** → **API Keys** → **Secret keys** →
   **Add new secret key**, nom `vercel-emails` → copiez-la (elle commence par `sb_secret_`). Une clé à part pour
   le site : on peut la remplacer sans toucher au reste.
4. **Vercel → les réglages** : projet `360-immo` → **Settings** → **Environment Variables** → **Add** (cocher
   **Production**) :

   | Nom | Valeur |
   |---|---|
   | `BREVO_API_KEY` | la clé de Brevo (étape 2) |
   | `EMAIL_EXPEDITEUR` | l'adresse validée dans Brevo (étape 1) |
   | `SUPABASE_SECRET_KEY` | la clé secrète de Supabase (étape 3) ; sert aussi à « Afficher le numéro » pour les visiteurs sans compte (cocher **Production** et **Preview**) |
   | `CRON_SECRET` *(conseillé)* | une longue suite de lettres et de chiffres au hasard, que vous inventez |

   Puis **Deployments** → la dernière ligne → **⋯** → **Redeploy**.
5. **Vérifier** : ouvrez `https://360-immo.vercel.app/api/notifications`. `"regle":true` : c'est prêt.
   `"regle":false` : la liste `"manque"` donne les réglages qui manquent.
6. **Essayer** : depuis un second compte, envoyez un message à l'une de vos annonces ; l'e-mail arrive en une
   minute environ. Brevo → **Transactional** → **Logs** montre chaque e-mail envoyé.

La tâche de 7 h se voit dans Vercel → **Settings** → **Cron Jobs** (bouton **Run** pour la lancer à la main).
Chaque matin, elle efface aussi les e-mails préparés il y a plus de 6 mois (copie gardée pour suivre les envois ;
la politique de confidentialité l'annonce).
Au lancement, avec le nom de domaine : Brevo → **Domains** → ajouter `360-immo.ci` et suivre ses instructions
(DKIM, DMARC), puis remplacer `EMAIL_EXPEDITEUR` par `contact@360-immo.ci` et **Redeploy**.

## Lancement public : sécurité (étape 9e)

Le code est prêt ; ces réglages sont à faire par vous, dans l'ordre, juste avant d'annoncer le site au public.

**1. Supabase Pro (sauvegarde chaque jour)** : Supabase → l'organisation → **Billing** → **Upgrade** → **Pro**.
Laissez le **Spend Cap** activé : la facture ne dépasse pas l'offre. Les sauvegardes apparaissent ensuite dans le
projet → **Database** → **Backups**.

**2. Les e-mails des comptes envoyés par Brevo** (confirmation de l'inscription, mot de passe oublié). Sans cela,
Supabase n'en envoie que très peu. Il faut d'abord l'adresse d'envoi validée dans Brevo (étape 1 de
[Envoi des e-mails](#envoi-des-e-mails-brevo)).

1. Brevo → menu en haut à droite → **SMTP & API** → onglet **SMTP** : notez le **Login** (une adresse
   `…@smtp-brevo.com`), puis **Generate a new SMTP key**, nom `supabase`. Copiez la clé tout de suite ; **ne
   l'envoyez à personne** (c'est une autre clé que celle de Vercel).
2. Supabase → projet `360-immo` → **Authentication** → **Emails** → **SMTP Settings** → **Enable Custom SMTP** :

   | Champ | Valeur |
   |---|---|
   | Sender email | l'adresse validée dans Brevo |
   | Sender name | `360-Immo.ci` |
   | Host | `smtp-relay.brevo.com` |
   | Port number | `587` |
   | Username | le **Login** de l'étape 1 |
   | Password | la clé SMTP de l'étape 1 |

   **Save**. Essai : « Mot de passe oublié » sur le site avec votre adresse ; l'e-mail arrive en une minute
   environ (Brevo → **Transactional** → **Logs** le montre).
3. Même page, onglet **Templates**, les e-mails en français (copier-coller, **Save** après chacun) :
   - **Confirm signup** — Subject : `Confirmez votre adresse e-mail – 360-Immo.ci` ; Body :

     ```html
     <h2>Bienvenue sur 360-Immo.ci</h2>
     <p>Pour activer votre compte, confirmez votre adresse e-mail :</p>
     <p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse e-mail</a></p>
     <p>Vous n'avez pas créé de compte sur 360-Immo.ci ? Ignorez simplement cet e-mail.</p>
     ```
   - **Reset Password** — Subject : `Choisissez un nouveau mot de passe – 360-Immo.ci` ; Body :

     ```html
     <h2>Nouveau mot de passe</h2>
     <p>Pour choisir un nouveau mot de passe sur 360-Immo.ci, ouvrez ce lien :</p>
     <p><a href="{{ .ConfirmationURL }}">Choisir un nouveau mot de passe</a></p>
     <p>Vous n'avez rien demandé ? Ignorez cet e-mail : votre mot de passe ne change pas.</p>
     ```

**3. Confirmation de l'e-mail à l'inscription** : Supabase → **Authentication** → **Sign In / Providers** →
**Email** → activez **Confirm email** → **Save**. Ce que voit alors une personne qui s'inscrit : « Vérifiez vos
e-mails » ; le lien reçu l'amène, connectée, sur l'accueil (« Votre compte est créé »). Si elle essaie de se
connecter avant : « Votre e-mail n'est pas encore confirmé », avec **Recevoir un nouveau lien de confirmation**.
Lien expiré ou déjà utilisé : l'accueil le dit et l'envoie vers la connexion. Les comptes déjà créés restent
actifs. Essai : inscrivez-vous avec une seconde adresse à vous. Même rubrique **Email**, si Supabase le propose :
**Minimum password length** → `8`, comme le formulaire du site.

**4. Contrôle anti-robot (CAPTCHA Cloudflare Turnstile)** sur l'inscription, la connexion, « mot de passe oublié »
et le formulaire Contact. Gratuit. Le plus souvent invisible : une case « Je suis humain » n'apparaît qu'en cas de
doute. Dans cet ordre (sinon plus personne ne peut se connecter) :

1. **Cloudflare** (créer un compte gratuit sur `dash.cloudflare.com` si besoin) → **Turnstile** → **Add widget** :
   nom `360-Immo.ci` ; **Hostnames** : `360-immo.vercel.app` (plus tard aussi `360-immo.ci`) ; **Widget Mode** :
   **Managed** ; pre-clearance : **No** → **Create**. Cloudflare affiche deux clés : la **Site Key** (publique) et
   la **Secret Key** (**ne l'envoyez à personne**).
2. **Vercel** → **Settings** → **Environment Variables** → **Add** (cocher **Production**) :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | la Site Key |
   | `TURNSTILE_SECRET_KEY` | la Secret Key |

   Puis **Deployments** → la dernière ligne → **⋯** → **Redeploy**. Essai : envoyez un message depuis la page
   **Contact** (il arrive dans Administration → Contact) et connectez-vous : tout marche comme avant.
3. **Supabase** → **Authentication** → **Attack Protection** → **Enable Captcha protection** → fournisseur
   **Turnstile by Cloudflare** → **Captcha secret** : la Secret Key → **Save**.
4. Essai : déconnectez-vous puis reconnectez-vous ; « Mot de passe oublié » ; une inscription avec une seconde
   adresse. Si « La vérification anti-robot a échoué » s'affiche : désactivez d'abord **Captcha protection** dans
   Supabase (tout remarche aussitôt), puis voir [Que faire si…](#que-faire-si).

Les adresses d'aperçu de Vercel (Preview) ne sont pas dans la liste de Cloudflare : une fois l'étape 3 faite, on ne
peut plus s'y connecter. C'est voulu ; les essais se font sur l'adresse principale.

**5. Surveillance (UptimeRobot, gratuit)** : un e-mail vous prévient si le site tombe, si la base ne répond plus, si
la tâche du matin ne passe plus ou si les e-mails ne partent plus. Le site a une adresse de contrôle :
`https://360-immo.vercel.app/api/sante` (ouvrez-la : `"ok":true` quand tout va bien, sinon la liste `"problemes"`).

1. Créer un compte gratuit sur `uptimerobot.com` (avec l'adresse e-mail qui doit recevoir les alertes).
2. **New monitor** → type **HTTP(s)** → URL `https://360-immo.vercel.app/api/sante` → nom `360-Immo.ci contrôle` →
   intervalle **5 minutes** → cocher votre e-mail dans les contacts d'alerte → **Create monitor**.
3. Un second, pareil, pour l'accueil : URL `https://360-immo.vercel.app/`, nom `360-Immo.ci accueil`.
4. Essai de l'alerte : un troisième, pareil, avec l'URL `https://360-immo.vercel.app/api/sante-essai` (qui n'existe
   pas) : l'e-mail « Monitor is DOWN » arrive en quelques minutes. Supprimez ensuite ce troisième.

En cas d'alerte : ouvrez l'adresse de contrôle, lisez `"problemes"`, puis [Que faire si…](#que-faire-si). Un e-mail
« Monitor is UP » annonce le retour à la normale.

**6. Double authentification de l'équipe** (déjà en place dès la fusion) : à la première visite de
`/admin`, chaque membre de l'équipe active le code de son téléphone (voir
[Sécurité : réglages et réflexes](#sécurité--réglages-et-réflexes)).

**7. En cas d'attaque** : le mode **Attack Challenge** de Vercel (voir
[Sécurité : réglages et réflexes](#sécurité--réglages-et-réflexes)).

## Le jour du nom de domaine (étape 9)

Le code est prêt : un seul réglage dans Vercel fait passer tout le site sur le nom de domaine (liens partagés,
aperçus WhatsApp et Facebook, e-mails, plan du site pour Google). L'ancienne adresse `360-immo.vercel.app` renvoie
alors chaque page vers la même page du nom de domaine : les liens déjà partagés continuent de marcher, et Google ne
voit qu'un seul site (deux copies identiques se partageraient le classement). Ci-dessous, `360-immo.ci` est un
exemple : mettez le nom de domaine acheté. **Faites les étapes dans l'ordre** : régler l'étape 6 avant que le nom
de domaine marche enverrait les visiteurs vers une adresse morte.

**1. Acheter le nom de domaine** auprès d'un bureau d'enregistrement agréé pour les `.ci` (liste sur `nic.ci`).
Demandez à pouvoir modifier vous-même ses **enregistrements DNS** (sa « zone DNS ») : il en faut pour Vercel, Brevo
et Google.

**2. Vercel → le nom de domaine** : projet `360-immo` → **Settings** → **Domains** → **Add Domain** →
`360-immo.ci`. Acceptez la proposition d'ajouter aussi `www.360-immo.ci`, renvoyé vers `360-immo.ci`. Vercel
affiche alors les enregistrements à créer (le plus souvent un **A** pour `360-immo.ci` et un **CNAME** pour `www`) :
recopiez **exactement** les valeurs affichées par Vercel.

**3. Chez le bureau d'enregistrement** : zone DNS → ajoutez ces enregistrements. Attendez que Vercel affiche
**Valid Configuration** à côté des deux adresses (de quelques minutes à 48 heures). Le cadenas (HTTPS) est fourni
par Vercel, sans rien faire. **Vérifier** : `https://360-immo.ci` ouvre le site. Ne passez à la suite qu'à ce
moment-là.

**4. Supabase → les adresses de retour des e-mails** (confirmation d'inscription, mot de passe oublié) : projet
`360-immo` → **Authentication** → **URL Configuration** :
- **Site URL** : `https://360-immo.ci` ;
- **Redirect URLs** → **Add URL** : `https://360-immo.ci/**` (gardez celles de `vercel.app`). **Save**.

**5. Cloudflare → Turnstile** (si le contrôle anti-robot est réglé) → le widget `360-Immo.ci` → **Hostnames** →
ajoutez `360-immo.ci` et `www.360-immo.ci` → **Save**. Sans cela, plus personne ne peut se connecter sur le nom de
domaine.

**6. Vercel → le réglage qui fait tout basculer** : **Settings** → **Environment Variables** → **Add** (cocher
**Production**) : `NEXT_PUBLIC_SITE_URL` = `https://360-immo.ci` (sans `/` à la fin). Puis **Deployments** → la
dernière ligne → **⋯** → **Redeploy**. **Vérifier**, deux minutes plus tard :
- `https://360-immo.vercel.app/annonces` arrive sur `https://360-immo.ci/annonces` ;
- `https://360-immo.ci/sitemap.xml` ne contient que des adresses en `https://360-immo.ci/…` ;
- `https://360-immo.ci/api/sante` répond `"ok":true`.

Les personnes connectées sur l'ancienne adresse se reconnectent une fois sur la nouvelle (une connexion vaut pour
une adresse) ; leurs annonces, messages et favoris sont intacts. Retour en arrière si besoin : supprimer
`NEXT_PUBLIC_SITE_URL` puis **Redeploy** (les navigateurs déjà passés par la redirection la gardent en mémoire :
c'est pourquoi l'étape 3 vérifie d'abord que le nom de domaine marche).

**7. Brevo → e-mails envoyés au nom du domaine** : voir la fin de
[Envoi des e-mails](#envoi-des-e-mails-brevo) (DKIM, DMARC, puis `EMAIL_EXPEDITEUR` = `contact@360-immo.ci` et
**Redeploy**). Si les e-mails des comptes passent par Brevo (étape 2 de
[Lancement public](#lancement-public--sécurité-étape-9e)), mettez la même adresse dans Supabase → **SMTP Settings**
→ **Sender email**.

**8. Google Search Console** (gratuit, `search.google.com/search-console`, avec un compte Google de l'entreprise) :
1. **Ajouter une propriété** → type **Domaine** → `360-immo.ci` → **Continuer**. Google donne un enregistrement
   **TXT** (`google-site-verification=…`) : ajoutez-le dans la zone DNS (étape 3), puis **Valider** (si Google ne
   le voit pas encore, réessayer quelques heures plus tard).
   *Autre méthode*, si la zone DNS ne permet pas les TXT : type **Préfixe de l'URL** → `https://360-immo.ci` →
   méthode **Balise HTML** → copiez seulement le code entre les guillemets de `content="…"` → Vercel →
   **Environment Variables** → `GOOGLE_SITE_VERIFICATION` = ce code → **Redeploy** → **Valider**.
2. Menu **Sitemaps** → saisir `sitemap.xml` → **Envoyer**. Google y trouve chaque annonce en ligne, les pages des
   prix par commune et les articles du blog ; les premières pages apparaissent dans ses résultats en quelques
   jours à quelques semaines.
3. Ensuite, une fois par mois : **Pages** (pages non indexées et pourquoi) et **Performances** (recherches qui
   amènent des visiteurs).

**9. Ce qui reste à mettre à jour** :
- Administration → **Pages du site** → **Mentions légales** : remplacer « [à compléter : adresse définitive du
  site…] » par `https://360-immo.ci` ;
- UptimeRobot (étape 5 de [Lancement public](#lancement-public--sécurité-étape-9e)) : remplacer
  `360-immo.vercel.app` par `360-immo.ci` dans les deux contrôles ;
- les liens du site dans vos profils (Facebook, WhatsApp Business, cartes de visite).

## Offres payantes des annonceurs (étapes 8a et 8b)

Construites et testées, mais **pas encore visibles** sur le site : elles attendent l'agrégateur de paiement Mobile
Money (Orange Money, MTN MoMo, Moov Money, Wave). Ce que les annonceurs pourront acheter, depuis Mon Espace → Mes
annonces → **Faire voir mon annonce** : remonter une annonce (1 000 FCFA), un pack de 3 remontées (2 000 FCFA), le
Premium 30 jours (5 000 FCFA), **Bien visité** (10 000 FCFA, ou 25 000 FCFA pour un terrain, une villa, un immeuble
ou un bien hors d'Abidjan) ; et, pour les agences, depuis Mon Espace → **Abonnement agence** : 15 000, 35 000 ou
75 000 FCFA par mois (jusqu'à 20, 60 ou 200 annonces en ligne ; autant de remontées incluses par mois ; 500 FCFA la
remontée au-delà). Règles : document « Offre commerciale » et page `/offres` du site.

**Pour les ouvrir, dans l'ordre** :

1. Choisir l'agrégateur (CinetPay, PayDunya, FedaPay…) et ouvrir le **compte marchand** (entreprise enregistrée,
   RCCM : souvent quelques semaines).
2. Passer à **Vercel Pro** : l'offre gratuite de Vercel interdit l'usage commercial.
3. Me dire quel agrégateur : je branche sa page de paiement et sa confirmation (le reste est prêt). Vous rangez
   vous-même ses clés dans Vercel (**ne me les envoyez jamais**).
4. Vercel → **Environment Variables** → `NEXT_PUBLIC_PAIEMENTS` = le nom de l'agrégateur (cocher **Production**),
   puis **Redeploy** : les boutons, la page `/offres`, Mon Espace → **Paiements** et l'onglet **Paiements** de
   l'Administration apparaissent.

Ne mettez **jamais** `NEXT_PUBLIC_PAIEMENTS` = `simulation` dans Vercel : c'est le paiement imité des tests
automatiques (le site le refuse sur Vercel, sinon chacun aurait les offres gratuitement).

**Au quotidien** :

- **Changer un prix** : Supabase → **Table Editor** → table **`offres`** → colonne `prix` (en FCFA) → **Save**. La
  page `/offres` suit dans les 10 minutes, les boutons tout de suite.
- **Rembourser** : rendre l'argent depuis l'espace de l'agrégateur, puis Administration → **Paiements** → le
  paiement → **Noter un remboursement…** avec le motif (ce qui reste de l'offre est retiré ; l'action va au journal).
- Chaque matin, la tâche de 7 h fait les remontées automatiques (packs et abonnements), arrête les Premium terminés,
  garde les jours Premium d'une annonce arrivée à sa fin et prévient 3 jours avant la fin d'un Premium ou d'un mois
  d'abonnement (si le mois suivant n'est pas déjà payé).
- **Abonnements des agences** : jamais prélevés automatiquement ; l'agence paie chaque mois depuis Mon Espace →
  Abonnement agence (le mois suivant peut se payer d'avance). Un compte n'y a accès que s'il est rattaché à une
  agence (Administration → Agences). Les remontées incluses ne se reportent pas. Rembourser un mois : comme les autres
  paiements (un mois pas commencé est annulé, un mois en cours s'arrête aussitôt).
- **Équité** : dans « Plus récentes », une même agence (ou un même particulier) n'a jamais plus de 3 annonces dans les
  10 premières ; ses autres annonces passent juste après. Le tri par prix et les vitrines ne changent pas.

**Bien visité (Administration → Biens visités)** : chaque visite payée arrive dans **À planifier** (l'équipe reçoit
aussi un e-mail).

1. Appelez l'annonceur (son numéro est sur la carte), convenez du jour et de l'heure, puis **Fixer le rendez-vous** :
   date, heure et nom de l'agent. L'annonceur reçoit le rendez-vous par e-mail.
2. Après la visite : **Noter la visite** → **Ajouter des photos** (celles de l'agent : elles vont sur l'annonce, en plus
   des 20 de l'annonceur), cochez les papiers dont l'agent a vu **l'original** (ACD, lettre d'attribution…), un compte
   rendu si besoin, puis **Poser le badge « Bien visité »**. L'annonceur reçoit un e-mail.
3. Visite impossible (bien introuvable, papiers absents, annonceur injoignable) : **Visite impossible** avec la raison
   (l'annonceur la lit par e-mail) ; s'il faut rembourser, onglet **Paiements**.

Le badge tombe tout seul si l'annonceur change le type, le lieu, l'adresse ou la surface du bien, ou supprime une photo
de l'agent : il peut alors redemander une visite.

## Vérifier les annonces : l'espace Administration

Une annonce envoyée depuis le site attend la vérification de l'équipe 360-Immo.ci (« En vérification » dans Mon
Espace → Mes annonces). L'équipe la vérifie dans l'espace **Administration** : `https://360-immo.vercel.app/admin`
(ou Mon Espace → **Administration**, avec le nombre d'annonces à traiter).

**Le tout premier administrateur (une seule fois, dans Supabase)** — il faut déjà être administrateur pour donner ce
droit depuis le site. Créez d'abord votre compte sur le site, puis :

1. Supabase → projet `360-immo` → **Table Editor** → table **`profils`**.
2. Trouver sa ligne (colonnes `prenom` et `nom`).
3. Double-clic sur la case **`role`** → choisir `admin` → **Save**.
4. Sur le site : se déconnecter puis se reconnecter. Mon Espace montre « Équipe 360-Immo.ci » et le lien
   **Administration**, qui demande d'abord d'activer le code du téléphone (double authentification).

**Les autres membres de l'équipe : depuis le site**, onglet **Équipe** de l'espace Administration. La personne crée
d'abord son compte ; cherchez-la par son e-mail ou son nom → **Donner l'accès administrateur** → **Oui, confirmer**.
Elle reçoit un e-mail. Pour retirer l'accès : même onglet, **Retirer l'accès**. Personne ne peut changer son propre
accès : l'équipe n'est donc jamais sans administrateur.

**Dans l'espace Administration :**

- **À vérifier** : les annonces envoyées, les plus anciennes d'abord, avec les photos (touchez une photo pour la voir
  en grand), le prix, le lieu, la description, le contact affiché et le compte de l'auteur (e-mail, téléphone,
  annonces en ligne, refus passés). « Revérification » : une annonce déjà en ligne que son auteur a beaucoup modifiée
  (prix de plus de 20 %, lieu, type ou photos) ; une fois republiée, elle garde ses dates.
  - **Publier** : l'annonce est en ligne pour 90 jours ; l'annonceur reçoit un e-mail.
  - **Refuser…** : choisir un motif courant ou l'écrire (l'annonceur le lit dans Mes annonces et le reçoit par
    e-mail), puis **Refuser l'annonce**. Il peut la corriger et la renvoyer.
  - **Doublon possible** (un bien = une seule annonce) : l'annonce ressemble à une autre du même annonceur (même type,
    lieu, prix à 10 % près, pièces, surface, étage ; ou mêmes photos), en ligne, en vérification, refusée, retirée ou
    supprimée depuis moins de 30 jours ; les deux sont montrées côte à côte. « Photo déjà utilisée par un autre
    annonceur » : souvent une photo volée (arnaque) ou un second compte. L'annonceur a déjà été prévenu à l'envoi et a
    confirmé que c'est un autre bien : comparez, appelez-le en cas de doute. Plusieurs logements identiques (même
    résidence, même lotissement) : une seule annonce, avec le nombre « identiques disponibles » (caractéristiques).
  - **Refus pour doublon** : le motif rapide « Annonce en double » coche « Refus pour annonce en double », compté sur
    le compte (le compte de l'auteur affiche le nombre déjà refusé). 1er : l'e-mail explique la règle ; 2e : il avertit
    qu'au prochain, le compte sera suspendu ; 3e : la case **Suspendre aussi le compte** est cochée d'office
    (**Refuser et suspendre le compte**). Dans **Signalements**, « Retirer l'annonce » a la même case (cochée si la
    raison la plus citée est « Annonce en double »).
- **Documents** : les demandes de vérification envoyées depuis Mon Espace → **Vérification** (facultative : sans elle,
  les annonces indiquent « Annonceur non vérifié » et un conseil de prudence) :
  - **Identité** : **CNI (recto et verso) ou passeport** (page photo), et photo de la personne tenant la pièce → badge
    vert « Identité vérifiée » sur les annonces et la vitrine d'un particulier, **jusqu'à la date de fin de la pièce**.
    Pour valider, notez le **numéro** et la **date de fin** de la pièce (une pièce ne vérifie qu'un compte). Si la
    personne change de prénom ou de nom, le badge est retiré : elle renvoie sa pièce ;
  - **Agence** : RCCM et logo → badge « Agence vérifiée », logo sur les annonces, la vitrine et l'accueil ;
  - **Bien** : titre de propriété (ACD, lettre d'attribution…) ou mandat du propriétaire → badge « Bien vérifié »
    sur l'annonce (et le filtre « Biens vérifiés » de la recherche).

  Touchez un document pour l'ouvrir en grand (PDF : **Ouvrir le PDF**) ; comparez-le au compte (nom, photo, validité
  de la pièce, nom de l'agence, lieu et superficie du bien). **Valider…** donne le badge ; **Refuser…** demande un
  motif (choix rapides), envoyé par e-mail : la personne peut renvoyer de nouveaux documents. La pièce d'identité
  validée est **gardée** (compte + 1 an) ; tous les autres documents sont **supprimés** aussitôt (le logo d'une agence
  validée reste, puisqu'il s'affiche sur le site).
  - **En cas de plainte** contre un annonceur : en bas de l'onglet, **Pièces d'identité conservées** → chercher par
    nom, e-mail, téléphone ou numéro de la pièce (même un compte supprimé depuis moins d'un an) → **Ouvrir pour une
    plainte…** → écrire le motif (par exemple « Plainte de M. Traoré du 12 octobre ») → **Ouvrir la pièce**. L'ouverture
    est notée au **Journal** avec votre nom ; les liens marchent une heure.
- **Signalements** : les annonces signalées par les visiteurs (« Signaler cette annonce » sur la fiche, avec ou sans
  compte), avec chaque raison et message. **Retirer l'annonce…** (motif lu par l'annonceur) ou **Rien à reprocher :
  classer…** (note pour l'équipe, facultative).
- **Agences** : les **demandes d'agence** (faites depuis Mon Espace → Mon profil). **Valider…** crée l'agence (nom
  modifiable) ou rattache le compte à une agence existante au nom proche ; **Refuser…** avec un motif envoyé par e-mail.
  Puis la liste des agences : **Modifier…** (nom, téléphone avec l'indicatif, e-mail) et la case **Agence vérifiée**
  (en général donnée depuis l'onglet **Documents**, une fois le RCCM contrôlé). Les agences vérifiées qui ont des
  annonces en ligne apparaissent sur l'accueil (« Agences immobilières de confiance ») avec leur logo, et leurs
  annonces portent le badge « Agence vérifiée ».
- **Comptes** : en haut, les **numéros partagés par plusieurs comptes** (inscrits avant la règle « un numéro par
  compte », ou numéro pris par quelqu'un d'autre) : appelez le numéro, puis **Libérer le numéro…** sur le compte qui
  n'est pas le sien (motif envoyé par e-mail ; la personne ajoute son propre numéro). Chercher un compte (e-mail, nom ou
  téléphone) ; badge « Identité vérifiée » et sa date de fin ; **Suspendre…** avec un motif : ses annonces sont
  retirées et il ne peut plus publier, écrire aux annonceurs, demander une visite ou un rappel ; la personne reçoit un
  e-mail et voit le motif dans Mon Espace. **Réactiver le compte** : ses annonces retirées restent à corriger et à
  renvoyer. Un membre de l'équipe ne se suspend qu'après avoir perdu son accès (onglet Équipe).
- **Équipe** : les administrateurs ; donner ou retirer l'accès (voir plus haut).
- **Tableau de bord** : annonces à vérifier, signalées, en ligne, expirées, biens vérifiés, documents à vérifier,
  comptes (dont suspendus), identités vérifiées, agences (dont vérifiées), demandes d'agence, membres de l'équipe,
  activité de la semaine.
- **Journal** : les dernières décisions sur les annonces, les vérifications et les actions sur les comptes et les
  agences, avec leur auteur.

En cas de doute sur une annonce, appelez l'annonceur avant de décider. Le **Table Editor** de Supabase reste possible
en secours (table `annonces`, colonnes `statut` et `motif_refus`), mais sans e-mail à l'annonceur ni journal.

## Que faire si…

| Ce que vous voyez | Où regarder | Quoi faire |
|---|---|---|
| Une croix rouge ❌ à côté d'un commit ou d'une pull request | GitHub → onglet **Actions** → la ligne en rouge ; en bas de la page, le rapport (`rapport-nouveau-site` ou `rapport-tests`) | **Ne pas fusionner.** Envoyer une capture ou le rapport |
| Le site ne s'est pas mis à jour après une fusion | Vercel → projet `360-immo` → **Deployments** → la dernière ligne (« Error ») → **Build Logs** | Envoyer les dernières lignes en rouge. L'ancienne version reste en ligne |
| Après le passage au nom de domaine : connexion impossible, ou le lien « mot de passe oublié » ne marche pas | Cloudflare → **Turnstile** → le widget → **Hostnames** ; Supabase → **Authentication** → **URL Configuration** | Ajouter le nom de domaine dans les Hostnames de Cloudflare, et `https://360-immo.ci/**` dans les **Redirect URLs** de Supabase (étapes 4 et 5 de [Le jour du nom de domaine](#le-jour-du-nom-de-domaine-étape-9)) |
| Alerte UptimeRobot « 360-Immo.ci accueil » | https://www.vercel-status.com ; Vercel → **Deployments** | Site en panne : voir les lignes « Page blanche » et « 404 » ci-dessous |
| Alerte « 360-Immo.ci contrôle » : « La base de données ne répond pas ou refuse la clé secrète » | Page d'accueil du projet Supabase (« Project paused » ?) ; https://status.supabase.com ; Vercel → **Environment Variables** : `SUPABASE_SECRET_KEY` | **Restore project** si en pause ; si la clé secrète a été changée dans Supabase, la recopier dans Vercel puis **Redeploy** |
| Alerte « contrôle » : « La tâche du matin n'est pas passée depuis plus de 26 heures » | Vercel → **Settings** → **Cron Jobs** ; Vercel → **Logs** (adresse `/api/notifications`) | La tâche est-elle listée et activée ? Bouton **Run** pour la lancer : l'alerte s'arrête au contrôle suivant. Si `CRON_SECRET` a été changé, **Redeploy** |
| Alerte « contrôle » : « e-mail(s) en attente depuis plus de 26 heures » | Comme « Les e-mails du site n'arrivent pas » plus bas | Corriger les réglages de Brevo ; les e-mails de plus de 3 jours ne partent plus (périmés) et cessent de compter |
| Alerte « contrôle » : « Clé secrète de Supabase absente » | Vercel → **Environment Variables** | Ajouter `SUPABASE_SECRET_KEY` (voir [Envoi des e-mails](#envoi-des-e-mails-brevo), étape 3), puis **Redeploy** |
| « La vérification anti-robot a échoué » à la connexion, pour tout le monde | Supabase → **Authentication** → **Attack Protection** ; Vercel → **Environment Variables** ; Cloudflare → **Turnstile** → le widget → **Hostnames** | D'abord désactiver **Captcha protection** dans Supabase (tout remarche aussitôt). Puis vérifier : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` présente dans Vercel (et **Redeploy** fait) ; la Site Key et la Secret Key viennent du **même** widget ; l'adresse du site est dans ses Hostnames |
| « La vérification anti-robot n'a pas abouti » | — | Le contrôle de Cloudflare n'a pas répondu (connexion lente, bloqueur de publicité) : cocher la case si elle s'affiche, sinon recharger la page. Si cela touche tout le monde : Cloudflare → **Turnstile** (le widget existe-t-il encore ?) |
| Contact : « Votre message ne peut pas être envoyé pour l'instant » | Vercel → **Environment Variables** : `SUPABASE_SECRET_KEY` ; Vercel → **Logs** (lignes « Contact : » ou « Anti-robot : ») | Ajouter la clé si elle manque (Production et Preview), puis **Redeploy**. « Cloudflare injoignable » : panne passagère chez Cloudflare, réessayer plus tard |
| Un annonceur a payé mais ne voit pas son offre | Administration → **Paiements** : le paiement, et la ligne « ce qui a été appliqué » | « créditée » ou « gardés » : l'offre n'a pas pu s'appliquer (annonce plus en ligne, déjà remontée dans les 24 heures) et l'attend dans Mon Espace → Paiements → « Payé d'avance ». Paiement absent ou « En attente » : vérifier chez l'agrégateur, puis m'envoyer la référence (PAY-…) |
| Code de l'Administration perdu (téléphone perdu ou changé, sans la clé notée) | Supabase → **SQL Editor** | Coller `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'adresse@du-compte');` (avec la bonne adresse), **Run**. À la connexion suivante, l'Administration propose d'activer un nouveau code |
| La fabrication a échoué avec « Error occurred prerendering page » (`/cookies`, `/aide`…) | Supabase répondait-il à ce moment ? (supabase.com → **Status**) | Si Supabase avait un incident : attendre qu'il soit réglé, puis **Redeploy**. Exprès : le site ne met pas en ligne des pages vides ; l'ancienne version reste en ligne |
| La mise en ligne d'une fusion est en « Error » après quelques secondes, alors que l'aperçu (Preview) du même changement est « Ready » | Vercel → projet `360-immo` → **Deployments** | Raté de Vercel, pas du code : sur la ligne en erreur, **⋯** → **Redeploy**. Vérifier que la ligne passe « Ready » avec le badge bleu **Production**, puis recharger le site (sur téléphone : fermer l'onglet et le rouvrir). Si ça échoue encore : cliquer sur la ligne et envoyer le message |
| Page blanche, « Application error » ou « 500 » sur le site | Vercel → projet `360-immo` → **Logs** | Pour revenir tout de suite à la version d'avant : **Deployments** → la version précédente → **⋯** → **Instant Rollback**. Puis envoyer les messages des Logs |
| « 404 : NOT_FOUND » sur tout le site | Vercel → **Settings** : Root Directory = `site`, Framework = Next.js | Envoyer une capture de ces réglages |
| « Afficher le numéro » ne marche plus pour les visiteurs sans compte (avec un compte, oui) | Vercel → **Settings** → **Environment Variables** : `SUPABASE_SECRET_KEY` | L'ajouter (Production et Preview), puis **Redeploy** |
| Un visiteur voit « Vous avez affiché beaucoup de numéros… » | Limite contre les robots (voir « Sécurité ») | Normal pour un robot ; une vraie personne peut se connecter pour continuer, ou attendre quelques minutes |
| Plus aucune annonce, connexion impossible | Page d'accueil du projet Supabase : « **Project paused** » ? | Cliquer **Restore project** : les données sont conservées. Ne pas tarder : au-delà de **90 jours** de pause, il faut télécharger la sauvegarde et recréer un projet |
| Page Connexion : « Les comptes ouvrent bientôt » | Vercel → projet `360-immo` → **Environment Variables** : les deux variables de [Relier Supabase à Vercel](#relier-supabase-à-vercel) | Les ajouter si elles manquent, puis **Deployments** → dernière version → **⋯** → **Redeploy** |
| Le site n'arrive pas à joindre la base (« Invalid API key », « Impossible de joindre le serveur ») | Vercel → **Environment Variables** ; page d'accueil de Supabase (pause ?) | Recopier les deux valeurs depuis Supabase → **Connect**, puis **Redeploy** |
| Après l'inscription : « Vérifiez vos e-mails » au lieu de l'accueil | Supabase → **Authentication** → **Sign In / Providers** → **Email** : **Confirm email** | Normal une fois le site lancé (la personne ouvre le lien reçu). Avant le lancement, sans service d'e-mails, le désactiver (voir [Réglages Supabase pour les comptes](#réglages-supabase-pour-les-comptes)) |
| E-mail de confirmation de l'inscription jamais reçu | Courriers indésirables ; Brevo → **Transactional** → **Logs** ; Supabase → **Authentication** → **Logs** | La personne se connecte sur le site et clique **Recevoir un nouveau lien de confirmation**. Rien dans Brevo : vérifier **SMTP Settings** (voir [Lancement public](#lancement-public--sécurité-étape-9e)) |
| Le lien « mot de passe oublié » mène à `localhost` ou à une page d'erreur | Supabase → **Authentication** → **URL Configuration** | Corriger **Site URL** et **Redirect URLs** (voir [Réglages Supabase pour les comptes](#réglages-supabase-pour-les-comptes)) |
| « E-mail ou mot de passe incorrect » alors que tout semble juste | Supabase → **Authentication** → **Users** : le compte existe-t-il ? | Utiliser « Mot de passe oublié » ; si le compte n'existe pas, se réinscrire |
| « Trop d'e-mails envoyés pour le moment » | — | Limite d'e-mails de Supabase sans service d'e-mails : réessayer dans une heure |
| Une modification de la base n'est pas arrivée | Page d'accueil du projet Supabase : « **Last migration** » doit porter le nom du dernier fichier de `supabase/migrations` | Envoyer une capture de Supabase → **Integrations → GitHub** |
| Message « row-level security », « permission denied » ou « 401 / 403 » | — | La base refuse un accès : souvent voulu, parfois une règle à ajuster. Envoyer le message exact et ce que vous faisiez |
| Message en français comme « Pas de nombre de pièces pour « Terrain » » | — | Ce sont les règles des biens qui bloquent une saisie incohérente : c'est normal |
| Liste des annonces : « Les annonces ne peuvent pas être affichées pour l'instant » | Page d'accueil du projet Supabase : « Project paused » ? « Last migration » ? | Réveiller le projet (**Restore project**) ; si la dernière migration (`…_recherche`) manque, envoyer une capture de **Integrations → GitHub** |
| Une annonce publiée n'apparaît pas dans la liste | Supabase → Table Editor → `annonces` : `statut` = `publiee` ? `expire_le` dans le futur ? | Attendre une minute (pages gardées une minute) ; vérifier le statut et la date de fin |
| « Afficher le numéro » : « Le numéro ne peut pas être affiché pour l'instant » | Supabase (pause ?) ; la dernière migration est-elle passée ? | Comme pour la liste des annonces ci-dessus |
| « 20 photos au plus par annonce. » ou « … ne peut pas encore être renouvelée … » | — | Règles de la publication : c'est normal (voir [supabase/README.md](supabase/README.md)) |
| Une photo refusée : « … ne peut pas être lue ici » | Le format du fichier | Souvent une photo d'iPhone (HEIC) envoyée depuis un ordinateur : l'enregistrer en JPEG, ou sur l'iPhone **Réglages** → **Appareil photo** → **Formats** → **Le plus compatible**. Depuis le téléphone lui-même, ça marche |
| Les photos ne partent pas (« Action non autorisée pour ce compte ») | Supabase → « Last migration » ; **Storage** → le compartiment **photos-annonces** existe ? | Envoyer une capture : les règles du stockage des photos ne sont probablement pas installées |
| « relation … does not exist » ou « column … does not exist » | Supabase → « Last migration » | La base n'a pas reçu la dernière migration (voir plus haut) |
| E-mail de mot de passe oublié jamais reçu | Supabase → **Authentication** → **Logs** ; dossier « courriers indésirables » | Sans service d'e-mails, seuls les membres de l'équipe Supabase le reçoivent, 2 par heure (voir [Risques](#risques-et-précautions)) |
| Les e-mails du site (messages, visites, alertes) n'arrivent pas | `https://360-immo.vercel.app/api/notifications` ; courriers indésirables ; Brevo → **Transactional** → **Logs** ; Vercel → **Logs** (lignes « E-mails : ») | `"regle":false` : ajouter les réglages manquants (voir [Envoi des e-mails](#envoi-des-e-mails-brevo)) puis **Redeploy**. « Brevo 401 » : clé de Brevo fausse ou désactivée. « sender » : adresse d'envoi pas encore validée dans Brevo. E-mail de Brevo sur une **adresse IP inconnue** : Brevo → **Security** → **Authorised IPs** → désactiver le blocage (les serveurs de Vercel changent d'adresse) |
| Pas de lien « Administration » dans Mon Espace | Un membre de l'équipe : onglet **Équipe** de l'espace Administration. Personne dans l'équipe : Supabase → **Table Editor** → `profils` → votre ligne : `role` | Donner l'accès depuis l'onglet Équipe ; ou mettre `admin`, **Save**. Puis recharger Mon Espace (voir [l'espace Administration](#vérifier-les-annonces--lespace-administration)) |
| Une personne ne peut plus publier ni écrire (« Votre compte est suspendu ») | Administration → **Comptes** : chercher la personne | Le motif est sur sa carte. **Réactiver le compte** si la suspension n'a plus lieu d'être |
| « Ce numéro est déjà utilisé par un autre compte » à l'inscription ou dans Mon profil | Administration → **Comptes** : chercher le numéro | Un numéro ne sert qu'à un compte. Si la personne prouve qu'il est à elle (appelez-le), **Libérer le numéro…** sur l'autre compte |
| « Un compte existe déjà avec cet e-mail » alors que la personne n'en a pas | Administration → **Comptes** : chercher l'e-mail (sans les points ni « +… » pour Gmail) | Les variantes Gmail (`a.kone@gmail.com`, `akone+2@gmail.com`) arrivent dans la même boîte : c'est le même compte. Utiliser « Mot de passe oublié » |
| Les documents de vérification ne partent pas (« … n'a pas pu être envoyé ») | Supabase → « Last migration » (`…_documents`) ; **Storage** : les dossiers **documents** (privé) et **logos** existent ? | Si la migration est passée : connexion trop lente, réessayer ; une photo très lourde est réduite avant l'envoi, un PDF doit faire 10 Mo au plus. Sinon, envoyer une capture de **Integrations → GitHub** |
| Onglet **Documents** : « Lien indisponible » sur un document | — | Les liens ne durent que 10 minutes : recharger la page. Si ça persiste, le document a été supprimé (par la personne, ou une décision déjà prise) : refuser avec le motif « document manquant, renvoyez-le » |
| Un badge ou un logo validé n'apparaît pas encore | La fiche, la vitrine ou l'accueil | Les pages publiques sont gardées une minute : recharger un peu plus tard. Le badge d'identité ne s'affiche que pour un particulier (pour une agence, c'est celui de l'agence) |
| Le badge « Identité vérifiée » a disparu | Administration → **Comptes** : la carte du compte | La pièce a expiré (date de fin notée à la validation), ou la personne a changé de nom : elle renvoie sa pièce depuis Mon Espace → Vérification |
| « Cette pièce a déjà servi à vérifier le compte de … » | Administration → **Comptes** : chercher les deux comptes | Une pièce ne vérifie qu'un compte : refuser la demande, ou suspendre d'abord l'autre compte s'il est frauduleux |
| Les statistiques restent à zéro | Mon Espace → **Statistiques** : l'annonce est-elle en ligne ? | Vos propres visites ne comptent pas (ouvrez la fiche depuis un autre appareil, sans être connecté à votre compte). Chaque geste compte une fois par visite du navigateur. Le détail jour par jour commence avec la mise en ligne des statistiques ; avant, seul le total des vues existe |
| Une alerte n'envoie rien | Mon Espace → **Alertes de recherche** : active ? ses critères (bouton **Modifier**) ? | Un e-mail part seulement s'il y a de nouvelles annonces qui ont **tout l'essentiel** (budget, pièces au moins, titre foncier d'un terrain…), le matin à 7 h (chaque jour ou chaque semaine). Les souhaits (meublé, commodités…) ne bloquent jamais : ils classent les annonces de l'e-mail |
| E-mail « usage limit », « will be paused » ou « over quota » | Vercel → **Usage** (équipe GADA) ; Supabase → **Usage** (organisation) | Le transférer : on voit s'il faut réduire l'usage ou passer à l'offre Pro |
| Tout est cassé d'un coup, sans aucun changement de notre côté | https://www.vercel-status.com et https://status.supabase.com | Panne chez eux : attendre |

## Sécurité : réglages et réflexes

- **« Afficher le numéro » est limité** contre les robots qui récoltent les numéros : 20 numéros en 10 minutes et 100 par
  jour par connexion internet pour un visiteur sans compte (il lui est proposé de se connecter), 40 et 200 par compte.
  Pour un visiteur sans compte, le numéro passe par le serveur du site : il faut `SUPABASE_SECRET_KEY` dans Vercel.
- **En-têtes de sécurité** (`site/next.config.ts`) : le site n'accepte que ses propres scripts, la base Supabase, les
  tuiles de la carte (OpenStreetMap) et, une fois réglé, le contrôle anti-robot de Cloudflare. Un futur service extérieur (statistiques, vidéo, paiement…) doit y être ajouté,
  sinon le navigateur le bloque (message « Content Security Policy » dans la console du navigateur).
- **Alertes de failles** : à activer une fois dans GitHub → le dépôt → **Settings** → **Code security** →
  **Dependabot alerts** : **Enable**, puis **Dependabot security updates** : **Enable**. GitHub prévient alors par
  e-mail et propose la correction (pull request « Dependabot », à fusionner si les tests sont ✅). Le contrôle
  « Sécurité des briques du site » (onglet **Actions**, chaque lundi) passe au ❌ si une faille grave est connue.
- **Double authentification de l'équipe** : l'espace Administration demande, en plus du mot de passe, le code à
  6 chiffres d'une application du téléphone (Google Authenticator ou Microsoft Authenticator, gratuites). La première
  fois : **Afficher le QR code**, le scanner avec l'application, taper le code. Ensuite, le code est demandé à chaque
  nouvelle connexion. La base refuse tout ce qui est réservé à l'équipe sans ce code. Notez la clé affichée sous le
  QR code et gardez-la en lieu sûr : elle remet le code sur un nouveau téléphone. Le réglage Supabase →
  **Authentication** → **Multi-Factor** → application d'authentification (TOTP) doit être activé (c'est le réglage
  par défaut).
- **Contrôle anti-robot** (CAPTCHA Cloudflare Turnstile, voir [Lancement public](#lancement-public--sécurité-étape-9e)) :
  inscription, connexion, « mot de passe oublié », nouveau lien de confirmation et formulaire Contact. Supabase vérifie
  le contrôle pour les comptes ; le serveur du site pour le Contact, qui ne peut plus être envoyé directement à la base
  (même sans le contrôle réglé, il passe par le serveur du site et sa clé secrète `SUPABASE_SECRET_KEY`).
- **Pendant une attaque** (site très lent, trafic anormal dans Vercel → **Observability**) : Vercel → le projet →
  **Firewall** → **Attack Challenge Mode** : chaque visiteur passe un contrôle automatique avant d'entrer. À désactiver
  quand l'attaque est passée.

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
