/*
 * Règles des biens immobiliers : ce qui a du sens pour chaque type de bien et chaque transaction.
 *
 * Utilisé par le formulaire « Publier une annonce », les filtres des résultats et la recherche
 * de l'accueil : pour changer une règle sur tout le site, c'est ici.
 *
 *   ReglesBiens.pour('Terrain', 'vente')                  → règles d'un bien (formulaire)
 *   ReglesBiens.pour(['Maison', 'Terrain'], 'location')    → règles combinées (filtres : un critère est
 *                                                            proposé dès qu'il a du sens pour un des types)
 *   ReglesBiens.pour([], null)                             → aucun type choisi : tous les critères
 */
(function () {
  'use strict';

  // ── Commodités, par famille ──
  var INTERIEUR = ['Air conditionné', 'Chauffe-eau', 'Balcon', 'Terrasse', 'Jacuzzi', 'Cave'];
  var RESIDENCE = ['Piscine', 'Jardin', 'Garage', 'Parking', 'Ascenseur', 'Gardien'];
  var SERVICES  = ['Fibre / Wifi', 'Rénové'];
  var TERRAIN   = ['Terrain clôturé', 'Viabilisé (eau, électricité)', 'Titre foncier (ACD)', 'Accès route bitumée'];
  var TOUTES    = INTERIEUR.concat(RESIDENCE, SERVICES, TERRAIN);   // ordre d'affichage
  var sauf = function (liste, retirer) { return liste.filter(function (c) { return retirer.indexOf(c) < 0; }); };

  // ── Ce qui a du sens pour chaque type de bien ──
  //   meuble     : l'option « Déjà meublé » est proposée (« toujours » : meublé d'office, option masquée)
  //   etage      : « toujours » (forcément dans un immeuble : on demande l'étage),
  //                « option » (peut être dans un immeuble : case « Dans un immeuble » puis étage), false
  //   pieces     : « studio » (Studio, 2, 3…), true (1, 2, 3…), false
  //   chambres   : nombre de chambres proposé
  //   sanitaires : libellé (« Salles de bain », « Toilettes ») ou false
  //   vente      : peut être mis en vente (sinon : location uniquement)
  //   loyerPar   : unités du loyer en location
  //   caution    : mois de caution demandés en location
  //   surface    : libellé de la surface
  var HABITATION = {
    meuble: true, etage: false, pieces: true, chambres: true, sanitaires: 'Salles de bain', vente: true,
    loyerPar: ['Jour', 'Mois', 'Année'], caution: true, surface: 'Surface',
    commodites: sauf(INTERIEUR.concat(RESIDENCE, SERVICES), ['Ascenseur']),
  };
  var TYPES = {
    'Appartement': Object.assign({}, HABITATION, {
      etage: 'toujours', pieces: 'studio', commodites: INTERIEUR.concat(RESIDENCE, SERVICES),
    }),
    'Maison': HABITATION,
    'Villa': HABITATION,
    'Terrain': {
      meuble: false, etage: false, pieces: false, chambres: false, sanitaires: false, vente: true,
      loyerPar: ['Mois', 'Année'], caution: true, surface: 'Superficie',
      commodites: TERRAIN.concat(['Gardien']),
    },
    'Bureau': {
      meuble: true, etage: 'option', pieces: true, chambres: false, sanitaires: 'Toilettes', vente: true,
      loyerPar: ['Mois', 'Année'], caution: true, surface: 'Surface',
      commodites: ['Air conditionné', 'Balcon', 'Terrasse', 'Parking', 'Ascenseur', 'Gardien', 'Fibre / Wifi', 'Rénové'],
    },
    'Commerce / Magasin': {
      meuble: false, etage: 'option', pieces: false, chambres: false, sanitaires: 'Toilettes', vente: true,
      loyerPar: ['Mois', 'Année'], caution: true, surface: 'Surface',
      commodites: ['Air conditionné', 'Terrasse', 'Parking', 'Gardien', 'Fibre / Wifi', 'Rénové'],
    },
    'Immeuble': {
      meuble: false, etage: false, pieces: false, chambres: false, sanitaires: false, vente: true,
      loyerPar: ['Mois', 'Année'], caution: true, surface: 'Surface',
      commodites: ['Piscine', 'Jardin', 'Garage', 'Parking', 'Ascenseur', 'Gardien', 'Fibre / Wifi', 'Rénové'],
    },
    "Chambre d'hôtel": {
      meuble: 'toujours', etage: false, pieces: false, chambres: false, sanitaires: 'Salles de bain', vente: false,
      loyerPar: ['Nuit'], caution: false, surface: 'Surface',
      commodites: ['Air conditionné', 'Chauffe-eau', 'Balcon', 'Terrasse', 'Jacuzzi', 'Piscine', 'Parking', 'Ascenseur', 'Fibre / Wifi'],
    },
    'Autres': Object.assign({}, HABITATION, { etage: 'option', commodites: INTERIEUR.concat(RESIDENCE, SERVICES) }),
  };
  // Autres noms utilisés dans les listes du site
  var ALIAS = { 'Maison / Villa': 'Maison', 'Commerce': 'Commerce / Magasin', 'Magasin': 'Commerce / Magasin' };

  function regles(nom) { return TYPES[ALIAS[nom] || nom] || TYPES['Autres']; }

  function unique(liste) { return liste.filter(function (x, i) { return liste.indexOf(x) === i; }); }

  // transaction : 'vente', 'location' ou null (les deux)
  function pour(types, transaction) {
    var liste = [].concat(types || []).filter(Boolean);
    var aucunType = !liste.length;   // « tous les biens »
    if (aucunType) liste = Object.keys(TYPES).filter(function (t) { return t !== 'Autres'; });
    var r = liste.map(regles);
    var un = function (cle) { return r.some(function (x) { return x[cle]; }); };
    var etages = r.map(function (x) { return x.etage; });
    var pieces = r.map(function (x) { return x.pieces; });
    var location = transaction !== 'vente';
    var resultat = {
      meuble: r.some(function (x) { return x.meuble === true; }),       // option à cocher
      meubleToujours: r.every(function (x) { return x.meuble === 'toujours'; }),
      etage: etages.indexOf('option') >= 0 ? 'option' : (etages.indexOf('toujours') >= 0 ? 'toujours' : false),
      pieces: pieces.some(Boolean),
      studio: pieces.indexOf('studio') >= 0,          // « Studio » proposé (appartements)
      unePiece: !aucunType && pieces.indexOf(true) >= 0,   // « 1 » proposé (autres biens choisis ; sinon « Studio » suffit)
      chambres: un('chambres'),
      sanitaires: aucunType ? 'Salles de bain' : (unique(r.map(function (x) { return x.sanitaires; }).filter(Boolean)).join(' / ') || false),
      vente: un('vente'),
      location: location,
      caution: location && transaction === 'location' && un('caution'),
      loyerPar: transaction === 'vente' ? [] : unique([].concat.apply([], r.map(function (x) { return x.loyerPar; }))),
      surface: unique(r.map(function (x) { return x.surface; })).length === 1 ? r[0].surface : 'Surface',
      // Tous les biens : les commodités propres aux terrains seulement si « Terrain » est choisi
      commodites: TOUTES.filter(function (c) {
        return r.some(function (x) { return x.commodites.indexOf(c) >= 0; }) && !(aucunType && TERRAIN.indexOf(c) >= 0);
      }),
    };
    // Ordre naturel des unités de loyer
    var ORDRE = ['Nuit', 'Jour', 'Mois', 'Année'];
    resultat.loyerPar.sort(function (a, b) { return ORDRE.indexOf(a) - ORDRE.indexOf(b); });
    return resultat;
  }

  // Chambres possibles pour un nombre de pièces (le séjour compte pour une pièce) : Studio/1 → 0, 2 → 1, 3 → 2…
  function chambresMax(pieces) {
    var n = parseInt(pieces, 10);
    if (/studio/i.test(pieces)) n = 1;
    if (!n) return Infinity;
    return /\+/.test(pieces) ? Infinity : n - 1;
  }

  window.ReglesBiens = {
    pour: pour, regles: regles, chambresMax: chambresMax,
    TYPES: Object.keys(TYPES), COMMODITES: TOUTES, COMMODITES_TERRAIN: TERRAIN,
  };
})();
