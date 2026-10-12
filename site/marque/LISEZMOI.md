# Logo 360-Immo.ci

Fichiers du graphiste (proposition 6 : épingle, flèche qui tourne, maison) :

| Fichier | Usage |
|---|---|
| `svg/360-immo-logo.svg` | Logo complet, sur fond clair (vert `#1E5E3F`, or `#C99A2E`, texte `#1A1A17`, « .ci » `#B07D1E`) |
| `svg/360-immo-logo-fond-sombre.svg` | Logo complet, sur fond foncé (blanc et or `#E2B54A`) |
| `svg/360-immo-symbole.svg` / `svg/360-immo-symbole-fond-sombre.svg` | L'épingle seule |
| `pdf/` | Les mêmes en PDF, pour l'imprimeur (cartes de visite, panneaux, flyers) |

Le site affiche les SVG copiés dans `public/logo/` (`components/Logo.tsx`).

`generer.mjs` fabrique, à partir des SVG, les images que les navigateurs, téléphones, réseaux sociaux et messageries
demandent dans un format précis : icônes de l'onglet et de l'écran d'accueil, aperçu d'un lien partagé (1200 × 630),
logo des e-mails en PNG. Si le logo change : remplacer les fichiers de `svg/` et `public/logo/`, puis, depuis `site/` :

```bash
node marque/generer.mjs
```
