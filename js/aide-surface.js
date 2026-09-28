/*
 * Aide au calcul de la surface : une fenêtre d'explications pour les personnes qui ne savent pas
 * comment mesurer la surface de leur bien (utilisée par « Publier une annonce » et « Estimation »).
 *
 *   <button type="button" class="aide-surface-btn" onclick="AideSurface.ouvrir('terrain')">…</button>
 *   AideSurface.ouvrir('batiment')   → logement, bureau, commerce (par défaut)
 *   AideSurface.ouvrir('terrain')    → terrain
 *
 * Le style est ajouté par ce fichier : il suffit de le charger dans le <head> de la page.
 */
(function () {
  'use strict';

  var CSS =
    // Bouton sous le champ Surface
    '.aide-surface-btn{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin-top:6px;padding:0;border:none;background:none;' +
      'font-family:"Outfit",sans-serif;font-size:13px;font-weight:600;color:var(--green);cursor:pointer;text-align:left}' +
    '.aide-surface-btn:hover{text-decoration:underline}' +
    '.aide-surface-btn .aide-rond{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;' +
      'border-radius:50%;background:var(--green-pale);font-size:12px;font-weight:700;text-decoration:none}' +
    // Fenêtre
    '.aide-fond{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.5)}' +
    '.aide-fond[hidden]{display:none}' +
    '.aide-fenetre{position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;max-height:calc(100vh - 40px);' +
      'background:var(--white);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.25);overflow:hidden;font-family:"Outfit",sans-serif;color:var(--charcoal)}' +
    '.aide-haut{padding:22px 24px 0;flex-shrink:0}' +
    '.aide-titre{font-family:"Playfair Display",serif;font-size:22px;font-weight:700;line-height:1.25;padding-right:40px}' +
    '.aide-sous-titre{margin-top:6px;font-size:14px;color:var(--gray-mid);line-height:1.5}' +
    '.aide-fermer{position:absolute;top:16px;right:16px;display:flex;align-items:center;justify-content:center;width:34px;height:34px;' +
      'border:none;border-radius:50%;background:var(--gray-pale);color:var(--charcoal);font-size:20px;line-height:1;cursor:pointer}' +
    '.aide-onglets{display:flex;gap:4px;margin-top:16px;padding:4px;border-radius:12px;background:var(--gray-pale)}' +
    '.aide-onglet{flex:1;padding:9px 8px;border:none;border-radius:9px;background:transparent;font-family:"Outfit",sans-serif;' +
      'font-size:13px;font-weight:600;color:var(--gray-mid);cursor:pointer}' +
    '.aide-onglet[aria-pressed="true"]{background:var(--white);color:var(--green);box-shadow:0 2px 8px rgba(0,0,0,.08)}' +
    '.aide-corps{padding:18px 24px 8px;overflow-y:auto;font-size:14px;line-height:1.6}' +
    '.aide-etape{display:flex;gap:12px;margin-bottom:16px}' +
    '.aide-num{display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0;border-radius:50%;' +
      'background:var(--green);color:var(--white);font-size:13px;font-weight:700}' +
    '.aide-etape h3{font-size:15px;font-weight:600;margin-bottom:2px}' +
    '.aide-etape p{color:var(--gray-dark)}' +
    '.aide-exemple{margin-top:8px;padding:10px 12px;border-radius:10px;background:var(--gray-pale);font-size:13px;color:var(--gray-dark)}' +
    '.aide-exemple strong{color:var(--green)}' +
    '.aide-schema{display:block;width:100%;max-width:260px;height:auto;margin:10px 0 2px}' +
    '.aide-tableau{width:100%;margin-top:8px;border-collapse:collapse;font-size:13px}' +
    '.aide-tableau td{padding:5px 0;border-bottom:1px solid var(--border)}' +
    '.aide-tableau td:last-child{text-align:right;font-weight:600}' +
    '.aide-tableau tr:last-child td{border-bottom:none;color:var(--green);font-size:14px}' +
    '.aide-astuce{margin:4px 0 12px;padding:12px 14px;border-radius:10px;background:var(--gold-pale,#FDF6E3);font-size:13px;color:var(--gray-dark)}' +
    '.aide-bas{padding:14px 24px 20px;flex-shrink:0;border-top:1px solid var(--border)}' +
    '.aide-ok{width:100%;padding:12px;border:none;border-radius:50px;background:var(--green);color:var(--white);' +
      'font-family:"Outfit",sans-serif;font-size:14px;font-weight:600;cursor:pointer}' +
    '.aide-ok:hover{background:var(--green-dark)}' +
    // Téléphone : la fenêtre monte du bas de l'écran
    '@media (max-width:600px){.aide-fond{align-items:flex-end;padding:0}' +
      '.aide-fenetre{max-width:none;max-height:90vh;border-radius:20px 20px 0 0}.aide-titre{font-size:20px}}';

  // Schémas cotés, dessinés à l'échelle (vert : première partie, or : partie ajoutée)
  var trait = 'fill="#E8F5EE" stroke="#1A6B4A" stroke-width="2"';
  var ajout = 'fill="#FDF6E3" stroke="#D4A843" stroke-width="2"';
  var cote = 'font-family="Outfit,sans-serif" font-size="13" fill="#3A3A3C"';
  var total = 'font-family="Outfit,sans-serif" font-size="15" font-weight="700" fill="#1A6B4A" text-anchor="middle"';
  var totalOr = total.replace('#1A6B4A', '#A8842F');
  // Chambre 4 m × 3,5 m (40 px par mètre)
  var SCHEMA_PIECE =
    '<svg class="aide-schema" viewBox="0 0 250 190" role="img" aria-label="Chambre de 4 mètres sur 3,5 mètres : 14 mètres carrés">' +
      '<rect x="50" y="10" width="160" height="140" rx="3" ' + trait + '/>' +
      '<text x="130" y="175" text-anchor="middle" ' + cote + '>longueur : 4 m</text>' +
      '<text x="34" y="80" text-anchor="middle" ' + cote + ' transform="rotate(-90 34 80)">largeur : 3,5 m</text>' +
      '<text x="130" y="85" ' + total + '>4 × 3,5 = 14 m²</text>' +
    '</svg>';
  // Salon en L : A 5 m × 4 m et B 3 m × 2 m (30 px par mètre)
  var SCHEMA_L =
    '<svg class="aide-schema" viewBox="0 0 260 205" role="img" aria-label="Salon en L découpé en deux rectangles : 20 et 6 mètres carrés, 26 au total">' +
      '<rect x="20" y="10" width="150" height="120" rx="2" ' + trait + '/>' +
      '<rect x="20" y="130" width="90" height="60" rx="2" ' + ajout + '/>' +
      '<text x="95" y="65" ' + total + '>A : 5 × 4</text><text x="95" y="85" ' + total + '>= 20 m²</text>' +
      '<text x="65" y="158" ' + totalOr + '>B : 3 × 2</text><text x="65" y="177" ' + totalOr + '>= 6 m²</text>' +
      '<text x="185" y="160" ' + cote + '>A + B</text><text x="185" y="180" ' + cote + ' font-weight="700">= 26 m²</text>' +
    '</svg>';
  // Terrain : rectangle 20 m × 25 m et triangle de 20 m de base sur 10 m de haut (5 px par mètre)
  var SCHEMA_TERRAIN =
    '<svg class="aide-schema" viewBox="0 0 250 215" role="img" aria-label="Terrain : rectangle de 20 sur 25 mètres et triangle, 600 mètres carrés au total">' +
      '<polygon points="60,60 160,60 160,10" ' + ajout + '/>' +
      '<rect x="60" y="60" width="100" height="125" rx="2" ' + trait + '/>' +
      '<text x="110" y="118" ' + total + '>20 × 25</text><text x="110" y="138" ' + total + '>= 500 m²</text>' +
      '<text x="110" y="205" text-anchor="middle" ' + cote + '>20 m</text>' +
      '<text x="170" y="127" ' + cote + '>25 m</text>' +
      '<text x="170" y="40" ' + cote + '>10 m</text>' +
    '</svg>';

  var etape = function (n, titre, texte) {
    return '<div class="aide-etape"><div class="aide-num">' + n + '</div><div><h3>' + titre + '</h3>' + texte + '</div></div>';
  };

  var CONTENU = {
    batiment:
      etape(1, 'Mesurez chaque pièce',
        '<p>Avec un mètre ruban (ou un télémètre laser), mesurez la <strong>longueur</strong> et la <strong>largeur</strong> ' +
        'de chaque pièce, d\'un mur à l\'autre, en mètres.</p>' +
        '<div class="aide-exemple">Astuce : 350 cm = <strong>3,5 m</strong> ; 80 cm = <strong>0,8 m</strong>.</div>') +
      etape(2, 'Multipliez la longueur par la largeur',
        '<p>Surface d\'une pièce = <strong>longueur × largeur</strong>.</p>' + SCHEMA_PIECE +
        '<div class="aide-exemple">Une chambre de 4 m sur 3,5 m mesure <strong>14 m²</strong>.</div>') +
      etape(3, 'Pièce en L ou de forme irrégulière ?',
        '<p>Découpez-la en rectangles, calculez chaque rectangle, puis additionnez.</p>' + SCHEMA_L) +
      etape(4, 'Additionnez toutes les pièces',
        '<p>Salon, chambres, cuisine, salles de bain, toilettes, couloirs et placards.</p>' +
        '<table class="aide-tableau"><tbody>' +
          '<tr><td>Salon</td><td>26 m²</td></tr><tr><td>Chambre 1</td><td>14 m²</td></tr><tr><td>Chambre 2</td><td>12 m²</td></tr>' +
          '<tr><td>Cuisine</td><td>8 m²</td></tr><tr><td>Salle de bain et toilettes</td><td>6 m²</td></tr><tr><td>Couloir</td><td>4 m²</td></tr>' +
          '<tr><td><strong>Surface totale</strong></td><td>70 m²</td></tr>' +
        '</tbody></table>') +
      etape(5, 'Ce qu\'on ne compte pas',
        '<p>Les <strong>balcons, terrasses, garage, cave, cour et jardin</strong>, ni l\'épaisseur des murs. ' +
        'Signalez-les plutôt dans les commodités ou la description.</p>') +
      '<div class="aide-astuce">💡 Vous avez un plan, un contrat de bail ou un titre de propriété ? La surface y est souvent déjà indiquée.</div>',
    terrain:
      etape(1, 'Regardez d\'abord vos documents',
        '<p>La superficie figure sur le <strong>titre foncier (ACD)</strong>, l\'extrait topographique ou le plan de lotissement. ' +
        'C\'est la valeur la plus fiable : reportez-la telle quelle.</p>') +
      etape(2, 'Terrain rectangulaire : longueur × largeur',
        '<p>Mesurez deux côtés qui se touchent, le long des bornes, en mètres.</p>' +
        '<div class="aide-exemple">Un terrain de 20 m sur 25 m mesure <strong>500 m²</strong>.</div>') +
      etape(3, 'Terrain de forme irrégulière ?',
        '<p>Découpez-le en rectangles et en triangles, puis additionnez. Surface d\'un triangle = <strong>base × hauteur ÷ 2</strong>.</p>' +
        SCHEMA_TERRAIN +
        '<div class="aide-exemple">Rectangle 20 × 25 = 500 m² + triangle 20 × 10 ÷ 2 = 100 m² → <strong>600 m²</strong>.</div>') +
      etape(4, 'Convertir les hectares et les ares',
        '<p>1 hectare (ha) = <strong>10 000 m²</strong> ; 1 are = <strong>100 m²</strong>.</p>' +
        '<div class="aide-exemple">0,5 ha = <strong>5 000 m²</strong> ; 6 ares = <strong>600 m²</strong>.</div>') +
      '<div class="aide-astuce">💡 En cas de doute, un géomètre peut établir un plan précis de votre terrain.</div>',
  };

  var fond, corps, retour;

  function styles() {
    if (document.getElementById('aide-surface-styles')) return;
    var st = document.createElement('style');
    st.id = 'aide-surface-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function creer() {
    fond = document.createElement('div');
    fond.className = 'aide-fond';
    fond.hidden = true;
    fond.innerHTML =
      '<div class="aide-fenetre" role="dialog" aria-modal="true" aria-labelledby="aideSurfaceTitre">' +
        '<div class="aide-haut">' +
          '<div class="aide-titre" id="aideSurfaceTitre">Comment calculer la surface de votre bien ?</div>' +
          '<p class="aide-sous-titre">Quelques mesures suffisent : suivez ces étapes, un mètre ruban à la main.</p>' +
          '<button type="button" class="aide-fermer" aria-label="Fermer l\'aide">&#215;</button>' +
          '<div class="aide-onglets">' +
            '<button type="button" class="aide-onglet" data-cas="batiment">Logement, bureau, commerce</button>' +
            '<button type="button" class="aide-onglet" data-cas="terrain">Terrain</button>' +
          '</div>' +
        '</div>' +
        '<div class="aide-corps"></div>' +
        '<div class="aide-bas"><button type="button" class="aide-ok">J\'ai compris</button></div>' +
      '</div>';
    corps = fond.querySelector('.aide-corps');
    fond.addEventListener('click', function (e) { if (e.target === fond) fermer(); });
    fond.querySelector('.aide-fermer').addEventListener('click', fermer);
    fond.querySelector('.aide-ok').addEventListener('click', fermer);
    fond.querySelectorAll('.aide-onglet').forEach(function (b) {
      b.addEventListener('click', function () { afficher(b.dataset.cas); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fond.hidden) fermer(); });
    document.body.appendChild(fond);
  }

  function afficher(cas) {
    if (!CONTENU[cas]) cas = 'batiment';
    corps.innerHTML = CONTENU[cas];
    corps.scrollTop = 0;
    fond.querySelectorAll('.aide-onglet').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cas === cas)); });
  }

  function ouvrir(cas) {
    styles();
    if (!fond) creer();
    retour = document.activeElement;
    afficher(cas);
    fond.hidden = false;
    document.body.style.overflow = 'hidden';
    fond.querySelector('.aide-fermer').focus({ preventScroll: true });
  }

  function fermer() {
    if (!fond || fond.hidden) return;
    fond.hidden = true;
    document.body.style.overflow = '';
    if (retour && retour.focus) retour.focus({ preventScroll: true });
  }

  styles();
  window.AideSurface = { ouvrir: ouvrir, fermer: fermer };
})();
