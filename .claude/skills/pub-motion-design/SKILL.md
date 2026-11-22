---
name: pub-motion-design
description: Fabriquer une publicité vidéo « motion design » (9:16, 20 à 45 s) pour 360Immo.ci ou une autre marque, avec des personnages animés, des icônes (jamais d'emoji), une typographie animée, de l'humour local, des voix et une musique ElevenLabs, montée avec Remotion dans video/. À utiliser quand on demande une pub, un spot, une vidéo promo, une vidéo pour TikTok, Reels, Shorts ou les Statuts WhatsApp.
---

# Publicité motion design (Remotion + ElevenLabs)

Exemples complets : `video/src/pub-demarcheur/` (« Le démarcheur », 32 s, humour, pour les chercheurs) et
`video/src/pub-annonceurs/` (« Annonceurs », 47 s, haut de gamme avec ralentis, pour les propriétaires et agences).
Boîte à outils réutilisable : `video/src/motion/`.
Tout se dit en français, les commentaires du code aussi.

## 1. Le brief (avant d'écrire une ligne)

- **Public** : pour la Côte d'Ivoire, des situations vécues (le démarcheur, les frais de visite, « c'est juste derrière »,
  la chaleur, « ma sœur », « tonton », « deh »), un humour bienveillant : on rit de la situation, pas des gens.
- **Format** : vertical 1080 × 1920, 30 images/s, 25 à 35 s ; le message doit passer **sans le son** (mots à l'écran,
  bulles, icônes).
- **Marque** : couleurs et polices dans `video/src/motion/palette.ts` (celles du site : `site/app/globals.css`), logos
  copiés de `site/public` par `video/outils/preparer.mjs`.
- **Vérifier chaque atout dans le code du site** avant de l'écrire (libellés exacts des boutons et badges : « Partager
  ma vitrine », « Identité vérifiée », « Agence vérifiée », « Bien visité », « Envoyer pour vérification »…). Un atout
  payant (Premium, Bien visité) ne se diffuse qu'une fois les paiements ouverts (`NEXT_PUBLIC_PAIEMENTS`).
- **Jamais de chiffres inventés** : ni prix, ni nombre d'annonces, ni statistiques. Les chiffres d'une blague (« 8,5 km »)
  doivent se lire comme une blague. Ne promettre que ce que le site fait vraiment.
- **Référence** : si l'utilisateur donne une vidéo modèle, en tirer des planches (une image par seconde) et noter le
  rythme, les transitions, les éléments (cartes, pilules, mots fantômes, aplats de couleur, curseur, logo final).

## 2. Le script

Un tableau réplique par réplique : qui parle (narrateur ou personnage), le texte, ce qu'on voit. Structure qui marche :
problème (1–2 répliques) → le « méchant » comique (2–3) → la marque (« Avec 360Immo.ci… ») → 3 points forts, un par
réplique → retour comique → fin (logo, slogan, adresse du site, doigt qui clique). Le mettre dans
`src/<pub>/repliques.json` (modèle : `src/pub-demarcheur/repliques.json`).

## 3. Les voix (ElevenLabs, connecteur MCP)

1. `creative_create_flow` (un seul flow pour toute la pub), puis `creative_list_voices` (filtrer langue `fr`, accent) :
   choisir une voix par personnage, ne jamais inventer un `voice_id`.
2. **Une seule prise par personnage**, avec toutes ses répliques séparées par `[long pause]`, et des indications de jeu
   entre crochets (`[excited]`, `[sighs]`, `[mischievously]`, `[sad]`, `[strong Ivorian accent]`) ; modèle `eleven_v4`
   (lire `creative_get_model_guide` avant). Écrire « 360 Immo point C.I. » pour la prononciation.
3. **Toujours `estimate_only: true` d'abord**, annoncer le coût, puis lancer. La parole donne 2 prises par défaut.
   Vérifier le solde (`account_get_usage`) : la formule gratuite a 10 000 crédits par mois.
4. Récupérer les fichiers (`creative_get_flow_run_status` donne les liens `content_url` ; l'hôte
   `elevenlabsusercontent.com` doit être autorisé dans le réseau de l'environnement) dans `video/voix-brutes/<pub>/`.
5. `node outils/motion/voix.mjs <pub>` : découpe la prise aux fins de répliques (les silences les plus proches de la
   durée attendue de chaque texte, en préférant les longs : une pause au milieu d'une phrase n'est pas prise pour une
   fin), accélère un peu (`tempo`), met chaque réplique au même volume et écrit `src/<pub>/voix.json` (durées et
   enveloppes pour la bouche des personnages). Vérifier dans la sortie que chaque durée est plausible ; sinon imposer
   les coupes (`"coupes"` dans `repliques.json`, en secondes de la prise brute).

**Licence** : la formule gratuite d'ElevenLabs n'autorise **pas** l'usage commercial. Pour une pub diffusée :
formule payante (Starter ou plus), puis régénérer les voix et la musique avant de publier.

## 4. La musique et les bruitages

- Musique : `creative_generate_in_flow` avec `node_type: "music"`, modèle `eleven_music_v2_5`, une description en
  anglais (style, tempo, « no vocals », durée de la pub, moments forts). Par défaut **4 versions** sont faites
  (≈ 3 600 crédits au lieu de 900) : estimer, puis **demander à l'utilisateur** combien de versions il veut avant de
  lancer (on ne change ce nombre que s'il le demande).
- La musique ne respecte pas toujours les moments demandés : mesurer où tombent son entrée, ses respirations et sa fin
  (volume toutes les 0,1 s avec ffmpeg), puis caler la vidéo dessus : décaler le début du fichier (`startFrom`) pour que
  l'entrée tombe sur l'apparition de la marque, placer un ralenti sur une respiration, couper la musique pour un gag et
  la reprendre plus loin dans le fichier pour finir sur sa vraie fin (voir `PubAnnonceurs.tsx`, `Son`).
- Ne pas payer une transcription pour vérifier qu'il n'y a pas de chant (≈ 290 crédits chacune) : faire écouter
  l'utilisateur, qui peut aussi choisir une autre version dans le flow.
- Bruitages : `node outils/motion/bruitages.mjs` les calcule (fouet, pop, clic, tic, ding, tampon, caisse, boing,
  trombone, sonnerie, notif, montee, impact, declic, scintille), sans droits à payer.

## 5. Le montage (boîte à outils `video/src/motion/`)

| Fichier | Contenu |
|---|---|
| `palette.ts` | couleurs, polices (Bricolage Grotesque pour les titres, Caveat Brush pour les notes et bulles), format |
| `anim.ts` | `entree` (ressort), `doux`, `freine`, `flotte`, `secousse`, `cligne`, `ralenti` (vite, très lent au milieu, vite), `elan` (arrive vite puis glisse longtemps) |
| `Personnage.tsx` | personnages articulés (`AWA`, `DEMARCHEUR`, `TONTON`, `AGENTE`, `AGENT`, `PROPRIETAIRE`, ou un nouveau `TypePersonnage` : coiffure foulard, court ou tresses, barbe, veste, logo) : bras, tête, yeux, bouche sur la voix (`bouche={…enveloppe}`), sueur, objet en main (téléphone, clés, appareil photo) ; contrôle : composition `planche-personnages` |
| `Effets.tsx` | `Particules` (poussières de lumière), `Rayons`, `Lueur` (reflet qui balaie), `Eclats`, `Confettis`, `Flash`, `Vignette`, `Grain`, `Profondeur`, `Notification` (de téléphone) |
| `Texte.tsx` | `Mots` (mots un par un, mots en pastille), `MotFantome`, `Trait` (souligné, barré, entouré), `NoteMain`, `Compteur` |
| `Elements.tsx` | `Pastille`, `Carte`, `Bulle`, `Tampon`, `Logo`, `Bruit` ; icônes lucide-react en éléments (`<House />`) |
| `Decor.tsx` | `Aplat` (couleur qui envahit), `Anneaux`, `Pieces`, `Fouet` (transition avec flou de bougé), `Plongee` (transition en zoom flouté), `Plan` (un plan avec ses transitions), `Camera`, `Soleil` |
| `Ecran.tsx` | `Telephone` (écran libre), `Doigt` (se déplace et clique) |
| `Illustrations.tsx` | `Maison`, `Nuage`, `Jauge` (sans chiffres), `Route`, `Devanture` (vitrine de boutique), `CarteAnnonce` (comme sur le site) |

Méthode : `src/<pub>/scenario.ts` enchaîne les répliques (souffle entre deux) et donne `R.<id>.debut/fin` ; chaque
scène est une fonction de l'image `f` calée sur ces repères (et sur les débuts de mots, lus dans l'enveloppe) ; un
`Plan` par scène avec entrée/sortie en coup de fouet ; la musique baisse quand quelqu'un parle (`parole(f)`) et peut se
couper pour un effet comique. Rien n'est jamais immobile (respiration, `flotte`, `Camera`). Enregistrer la composition
dans `src/Racine.tsx`.

Pour un rendu « haut de gamme » (demande de « wow », de ralentis) : fonds sombres en dégradé radial avec `Rayons`,
`Particules` et `Vignette` pour les moments forts, fonds clairs pour les écrans ; éléments qui arrivent avec `elan`
(vite puis suspendus) ; un vrai ralenti (`ralenti`) posé sur une respiration de la musique ; `Flash` + bruit `impact`
sur l'apparition de la marque ; `Lueur` et `Eclats` quand un badge s'obtient ; `Grain` léger sur toute la vidéo ;
alterner `Fouet` et `Plongee` entre les plans.

## 6. Contrôler, puis livrer

1. `npx tsc -p .` puis `node outils/motion/rendu.mjs <pub> --brouillon` (rendu à moitié de la taille, ~30 s) : regarder
   **toutes** les planches de `sortie/controle/` (une image toutes les 12) : textes qui se chevauchent, personnages
   coupés, éléments trop petits, moments vides, transitions. Corriger, recommencer.
2. `node outils/motion/rendu.mjs <pub>` : `sortie/<pub>.mp4` (son à -14 LUFS) et `sortie/<pub>.jpg` (couverture).
   Dans l'environnement cloud : `NAVIGATEUR=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
3. On ne peut pas écouter le son soi-même : le dire, donner le lien du flow ElevenLabs pour réécouter ou changer une
   prise, et indiquer les crédits dépensés.
4. Envoyer la vidéo à l'utilisateur (SendUserFile) avec : ce qui est provisoire (voix et musique de la formule gratuite),
   ce qu'il doit vérifier (prononciation, ton, musique), et ce qu'il reste avant de diffuser.
