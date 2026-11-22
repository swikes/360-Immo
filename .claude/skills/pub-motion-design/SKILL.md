---
name: pub-motion-design
description: Fabriquer une publicité vidéo « motion design » (9:16, 20 à 45 s) pour 360Immo.ci ou une autre marque, avec des personnages animés, des icônes (jamais d'emoji), une typographie animée, de l'humour local, des voix et une musique ElevenLabs, montée avec Remotion dans video/. À utiliser quand on demande une pub, un spot, une vidéo promo, une vidéo pour TikTok, Reels, Shorts ou les Statuts WhatsApp.
---

# Publicité motion design (Remotion + ElevenLabs)

Exemple complet : `video/src/pub-demarcheur/` (« Le démarcheur », 32 s). Boîte à outils réutilisable : `video/src/motion/`.
Tout se dit en français, les commentaires du code aussi.

## 1. Le brief (avant d'écrire une ligne)

- **Public** : pour la Côte d'Ivoire, des situations vécues (le démarcheur, les frais de visite, « c'est juste derrière »,
  la chaleur, « ma sœur », « tonton », « deh »), un humour bienveillant : on rit de la situation, pas des gens.
- **Format** : vertical 1080 × 1920, 30 images/s, 25 à 35 s ; le message doit passer **sans le son** (mots à l'écran,
  bulles, icônes).
- **Marque** : couleurs et polices dans `video/src/motion/palette.ts` (celles du site : `site/app/globals.css`), logos
  copiés de `site/public` par `video/outils/preparer.mjs`.
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
4. Récupérer les fichiers (`creative_get_flow_run_status` donne les liens `content_url` ; l'hôte
   `elevenlabsusercontent.com` doit être autorisé dans le réseau de l'environnement) dans `video/voix-brutes/<pub>/`.
5. `node outils/motion/voix.mjs <pub>` : découpe aux longues pauses, accélère un peu (`tempo`), met chaque réplique au
   même volume et écrit `src/<pub>/voix.json` (durées et enveloppes pour la bouche des personnages). Vérifier dans la
   sortie que chaque durée est plausible ; sinon refaire la prise avec des pauses plus nettes.

**Licence** : la formule gratuite d'ElevenLabs n'autorise **pas** l'usage commercial. Pour une pub diffusée :
formule payante (Starter ou plus), puis régénérer les voix et la musique avant de publier.

## 4. La musique et les bruitages

- Musique : `creative_generate_in_flow` avec `node_type: "music"`, modèle `eleven_music_v2_5`, une description en
  anglais (style, tempo, « no vocals », durée de la pub). **Passer `generations_count: 1`** : sans cela 4 versions sont
  faites (≈ 3 600 crédits au lieu de 900). Estimer d'abord.
- Ne pas payer une transcription pour vérifier qu'il n'y a pas de chant (≈ 290 crédits chacune) : faire écouter
  l'utilisateur, qui peut aussi choisir une autre version dans le flow.
- Bruitages : `node outils/motion/bruitages.mjs` les calcule (fouet, pop, clic, tic, ding, tampon, caisse, boing,
  trombone), sans droits à payer.

## 5. Le montage (boîte à outils `video/src/motion/`)

| Fichier | Contenu |
|---|---|
| `palette.ts` | couleurs, polices (Bricolage Grotesque pour les titres, Caveat Brush pour les notes et bulles), format |
| `anim.ts` | `entree` (ressort), `doux`, `freine`, `flotte`, `secousse`, `cligne` |
| `Personnage.tsx` | personnages articulés (`AWA`, `DEMARCHEUR`, `PROPRIETAIRE`, ou un nouveau `TypePersonnage`) : bras, tête, yeux, bouche sur la voix (`bouche={…enveloppe}`), sueur, objet en main ; contrôle : composition `planche-personnages` |
| `Texte.tsx` | `Mots` (mots un par un, mots en pastille), `MotFantome`, `Trait` (souligné, barré, entouré), `NoteMain`, `Compteur` |
| `Elements.tsx` | `Pastille`, `Carte`, `Bulle`, `Tampon`, `Logo`, `Bruit` ; icônes lucide-react en éléments (`<House />`) |
| `Decor.tsx` | `Aplat` (couleur qui envahit), `Anneaux`, `Pieces`, `Fouet` (transition avec flou de bougé), `Camera`, `Soleil` |
| `Ecran.tsx` | `Telephone` (écran libre), `Doigt` (se déplace et clique) |
| `Illustrations.tsx` | `Maison`, `Nuage`, `Jauge` (sans chiffres), `Route` |

Méthode : `src/<pub>/scenario.ts` enchaîne les répliques (souffle entre deux) et donne `R.<id>.debut/fin` ; chaque
scène est une fonction de l'image `f` calée sur ces repères (et sur les débuts de mots, lus dans l'enveloppe) ; un
`Plan` par scène avec entrée/sortie en coup de fouet ; la musique baisse quand quelqu'un parle (`parole(f)`) et peut se
couper pour un effet comique. Rien n'est jamais immobile (respiration, `flotte`, `Camera`). Enregistrer la composition
dans `src/Racine.tsx`.

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
