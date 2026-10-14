# Test de charge (k6)

`parcours-visiteurs.js` simule des visiteurs qui parcourent le site **en même temps** (accueil, liste des annonces,
fiche, carte des prix, blog, estimation), avec des pauses de lecture. Il ne fait que lire : aucun compte, aucun
message, aucun formulaire envoyé.

Outil : [k6](https://k6.io) (libre, de Grafana). Installation : https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
cd site
k6 run -e PALIER=petit charge/parcours-visiteurs.js     # 10 visiteurs en même temps
k6 run charge/parcours-visiteurs.js                     # 100 visiteurs (palier « fort »), environ 6 minutes
k6 run -e PALIER=max charge/parcours-visiteurs.js       # 200 visiteurs
k6 run -e SITE=https://360-immo.ci charge/parcours-visiteurs.js   # une autre adresse (nom de domaine)
```

Paliers : `essai` (2 visiteurs, 30 s), `petit` (10), `moyen` (50), `fort` (100, par défaut), `max` (200) : montée en
3 minutes, 2 minutes au plus fort, puis descente.

**Objectifs** : 95 % des pages en moins de 2 secondes, moins de 1 % d'erreurs (le test s'arrête de lui-même au-delà
de 5 %). Le bilan donne, page par page, le temps moyen, médian et le plus long.

**Sans rien installer** : [Grafana Cloud k6](https://grafana.com/products/cloud/k6/) (compte gratuit) lance ce même
script depuis ses propres serveurs, avec des graphiques. Créer un test, coller le contenu de `parcours-visiteurs.js`.

**Précautions** : un test fort sur le site en ligne charge aussi Vercel et Supabase (offres gratuites) ; le lancer
plutôt hors des heures de visite, et prévenir l'équipe. Le temps mesuré dépend aussi de l'endroit d'où part le test
(un test lancé d'Europe ne mesure pas le trajet jusqu'à Abidjan). Les photos, polices et scripts des pages, servis par
le réseau de Vercel, ne sont pas demandés : le test mesure les pages elles-mêmes, qui interrogent la base.
