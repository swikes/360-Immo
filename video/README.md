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

> **Prototype.** Les écrans montrent des **annonces et chiffres d'exemple** (la fausse base des tests). La voix off est
> une voix de synthèse de Google (Gemini, voix « Achird », homme, ton chaleureux). Avant de diffuser : musique sous
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
| `outils/voix.mjs` | Voix off (`npm run voix`) : voix de Google, ou voix provisoire hors ligne (`npm run voix -- --provisoire`) |
| `outils/rendu.mjs` | Fabrique les vidéos `sortie/<nom>.mp4` et leur image d'aperçu `sortie/<nom>.jpg` (`npm run rendu`) |
| `src/pub/` | **Publicité 16:9 « Sous tous les angles »** (60 s, version de travail) : `Publicite.tsx` (les 7 scènes), `voix.json` (le texte et le moment de chaque réplique), `photos-annonces.json` (quelles photos pour quelle annonce d'exemple), `positions.json` (où sont les boutons et les cartes sur les captures, écrit par les captures), téléphone en relief, ville isométrique, planches du storyboard (`npx remotion render src/index.ts planches sortie/planches --sequence --image-format=png`) |
| `outils/musique-provisoire.py` | Musique provisoire de la publicité, calée sur ses scènes (`python3 outils/musique-provisoire.py`, il faut `numpy`) → `public/musique/provisoire.wav` |
| `outils/preparer.mjs` | Copie les polices et le logo du site dans `public/` (fait par `npm run rendu` et `npm run studio`) |

Ne sont pas gardés dans le dépôt (ils se refabriquent) : `public/ecrans/`, `public/ecrans-pub/`, `public/voix/`,
`public/musique/`, `voix-brutes/`, `public/polices/`, `public/logo/`, `sortie/`. Ni les photos (`public/photos/`) :
elles appartiennent à leurs auteurs ; seules celles dont on a le droit d'usage iront dans une version diffusée.

## Fabriquer les vidéos

1. **Captures du site** (téléphone simulé, données d'exemple) — dans `site/`, le site construit avec la fausse base
   (voir [site/README.md](../site/README.md)) :
   ```bash
   CAPTURES_VIDEO=1 npx playwright test captures-video --project=telephone
   ```
   Écrit `video/public/ecrans/*.png` et `video/src/ecrans.json` (`site/tests/captures-video.spec.ts`). Avec
   `--project=ordinateur` : les écrans de la publicité 16:9, ordinateur et téléphone (`video/public/ecrans-pub/`,
   `video/src/pub/positions.json`), avec les photos de `video/public/photos/annonces/` à la place de celles de la
   fausse base (`video/src/pub/photos-annonces.json`).
2. **Voix off** — dans `video/` : `npm install`, puis `npm run voix` (il faut `curl` et `ffmpeg`).
   - **Voix de Google** (par défaut) : une clé Gemini (Google AI Studio), soit dans la variable `GEMINI_API_KEY`, soit
     en **secret réseau** de l'environnement cloud (site `generativelanguage.googleapis.com`, en-tête `x-goog-api-key`
     sans préfixe) : la clé n'est alors jamais visible. Chaque vidéo est dite **en une seule prise** (même ton d'une
     scène à l'autre, une seule voix du quota), puis découpée aux longues pauses ; si la découpe est incertaine, une
     prise par scène. Les prises sont gardées dans `voix-brutes/` et réutilisées tant que le texte ne change pas :
     la formule gratuite de Google ne permet que **10 voix par jour**. Voix, ton et modèle : `GEMINI` dans
     `outils/voix.mjs` ; prononciation du nom du site : `prononcer`.
   - **Voix provisoire** hors ligne : `npm run voix -- --provisoire` (il faut `pico2wave` :
     `apt install libttspico-utils`).
   - **Voix d'un comédien** : déposer un fichier par scène dans `public/voix/`, mêmes noms (`annonceurs-intro.wav`,
     `annonceurs-publier.wav`…), sans silence au début ni à la fin, puis mettre leur durée (en secondes) dans
     `src/durees.json`.
3. **Vidéos** : `npm run rendu` (ou `npm run rendu -- annonceurs` pour une seule) → `sortie/`. Environ 2 minutes par
   vidéo. La publicité : `npm run rendu -- publicite` (voix : `npm run voix -- publicite`). Le navigateur de Playwright est utilisé s'il est installé ; sinon Remotion télécharge le sien.

Pour voir et régler les animations image par image : `npm run studio` (s'ouvre dans le navigateur).

## Licence de Remotion

Gratuite pour une personne seule ou une entreprise de **3 salariés au plus**, même pour un usage commercial ; au-delà,
une licence entreprise payante est nécessaire (voir `node_modules/remotion/LICENSE.md` et
[remotion.pro](https://www.remotion.pro)). Les polices (Playfair Display, Outfit) sont sous licence libre SIL OFL.
