# Vidéos de présentation (motion design)

Deux vidéos verticales (1080 × 1920, pour téléphone : Statuts WhatsApp, Reels, TikTok, Shorts), faites à partir des
**vrais écrans du site**, avec une voix off et des sous-titres :

| Vidéo | Pour qui | Message |
|---|---|---|
| `annonceurs` | Propriétaires, agences | Publier gratuitement, annonces vérifiées, contacts directs, statistiques, bon prix |
| `chercheurs` | Locataires, acheteurs | Chercher simplement, annonces vérifiées, contacter, alertes, carte des prix |

Chaque vidéo : une **ouverture** (la question), cinq **écrans du site** dans un téléphone (l'élément important est
encadré en doré puis sort agrandi, comme sous une loupe), et une **fin** (logo, bouton, points forts).
Fabriquées avec [Remotion](https://www.remotion.dev) (vidéo écrite en React).

> **Prototype.** Les écrans montrent des **annonces et chiffres d'exemple** (la fausse base des tests) et la voix est une
> **synthèse provisoire** (SVOX Pico), seulement pour juger du rythme. Avant de diffuser : vraie voix, musique sous
> licence, relecture des textes.

## Contenu

| Fichier | Rôle |
|---|---|
| `src/scripts.json` | **Le texte de chaque scène** : titre (`*mot*` en doré), voix off (`texte`, et `voix` quand la prononciation diffère : « trois cent soixante Immo point C I »), écran du site montré. C'est ici qu'on modifie les vidéos |
| `src/ecrans.json` | Les captures du site et la position de l'élément à mettre en avant (écrit par les captures, ci-dessous) |
| `src/durees.json` | La durée de la voix de chaque scène (écrit par `npm run voix`) : chaque scène se cale sur sa voix |
| `src/scenes/` | Ouverture, écran du site (téléphone et loupe), fin |
| `src/composants/` | Fond animé, téléphone, titre, sous-titres, icônes |
| `src/theme.ts` | Couleurs et polices du site, format, rythme (fondus, pauses avant et après la voix) |
| `outils/voix.mjs` | Voix off provisoire (`npm run voix`) |
| `outils/rendu.mjs` | Fabrique les vidéos `sortie/<nom>.mp4` et leur image d'aperçu `sortie/<nom>.jpg` (`npm run rendu`) |
| `outils/preparer.mjs` | Copie les polices et le logo du site dans `public/` (fait par `npm run rendu` et `npm run studio`) |

Ne sont pas gardés dans le dépôt (ils se refabriquent) : `public/ecrans/`, `public/voix/`, `public/polices/`,
`public/logo/`, `sortie/`.

## Fabriquer les vidéos

1. **Captures du site** (téléphone simulé, données d'exemple) — dans `site/`, le site construit avec la fausse base
   (voir [site/README.md](../site/README.md)) :
   ```bash
   CAPTURES_VIDEO=1 npx playwright test captures-video --project=telephone
   ```
   Écrit `video/public/ecrans/*.png` et `video/src/ecrans.json` (`site/tests/captures-video.spec.ts`).
2. **Voix off** — dans `video/` : `npm install`, puis `npm run voix` (il faut `pico2wave` et `ffmpeg` :
   `apt install libttspico-utils ffmpeg`). Pour une **vraie voix** : déposer un fichier par scène dans `public/voix/`,
   mêmes noms (`annonceurs-intro.wav`, `annonceurs-publier.wav`…), sans silence au début ni à la fin, puis mettre leur
   durée (en secondes) dans `src/durees.json`.
3. **Vidéos** : `npm run rendu` (ou `npm run rendu -- annonceurs` pour une seule) → `sortie/`. Environ 2 minutes par
   vidéo. Le navigateur de Playwright est utilisé s'il est installé ; sinon Remotion télécharge le sien.

Pour voir et régler les animations image par image : `npm run studio` (s'ouvre dans le navigateur).

## Licence de Remotion

Gratuite pour une personne seule ou une entreprise de **3 salariés au plus**, même pour un usage commercial ; au-delà,
une licence entreprise payante est nécessaire (voir `node_modules/remotion/LICENSE.md` et
[remotion.pro](https://www.remotion.pro)). Les polices (Playfair Display, Outfit) sont sous licence libre SIL OFL.
