/*
 * Numéros de téléphone de tous les pays : choix de l'indicatif (drapeau, pays, +XXX) devant chaque
 * champ <input type="tel"> du site, puis vérification du numéro selon le pays choisi.
 *
 * Rien à faire dans les pages : ce fichier, chargé dans le <head>, équipe tous les champs téléphone.
 *   - Côte d'Ivoire (+225) par défaut ; les pays fréquents en tête de liste ; recherche par nom ou indicatif.
 *   - Un numéro tapé ou collé avec son indicatif (« +33 6 12… », « 0033 6 12… ») choisit le pays tout seul.
 *   - Un bouton déjà présent juste avant le champ (classe « phone-flag-btn ») est utilisé tel quel.
 *
 *   Telephone.valide(input)   → true si le numéro est valide pour le pays choisi
 *   Telephone.message(input)  → message d'erreur adapté au pays (« … : 10 chiffres, ex. 07 00 00 00 00. »)
 *   Telephone.complet(input)  → « +225 07 48 32 11 90 » (vide si rien n'est saisi)
 *   Telephone.chiffres(input) → « 2250748321190 » (pour un lien WhatsApp wa.me/…)
 */
(function () {
  'use strict';

  // ── Pays : code ISO | nom | indicatif ──
  var LISTE = [
    'AF|Afghanistan|93', 'ZA|Afrique du Sud|27', 'AL|Albanie|355', 'DZ|Algérie|213', 'DE|Allemagne|49', 'AD|Andorre|376',
    'AO|Angola|244', 'AG|Antigua-et-Barbuda|1268', 'SA|Arabie saoudite|966', 'AR|Argentine|54', 'AM|Arménie|374',
    'AU|Australie|61', 'AT|Autriche|43', 'AZ|Azerbaïdjan|994', 'BS|Bahamas|1242', 'BH|Bahreïn|973', 'BD|Bangladesh|880',
    'BB|Barbade|1246', 'BE|Belgique|32', 'BZ|Belize|501', 'BJ|Bénin|229', 'BT|Bhoutan|975', 'BY|Biélorussie|375',
    'MM|Birmanie (Myanmar)|95', 'BO|Bolivie|591', 'BA|Bosnie-Herzégovine|387', 'BW|Botswana|267', 'BR|Brésil|55',
    'BN|Brunei|673', 'BG|Bulgarie|359', 'BF|Burkina Faso|226', 'BI|Burundi|257', 'KH|Cambodge|855', 'CM|Cameroun|237',
    'CA|Canada|1', 'CV|Cap-Vert|238', 'CL|Chili|56', 'CN|Chine|86', 'CY|Chypre|357', 'CO|Colombie|57', 'KM|Comores|269',
    'CG|Congo-Brazzaville|242', 'CD|Congo (RDC)|243', 'KP|Corée du Nord|850', 'KR|Corée du Sud|82', 'CR|Costa Rica|506',
    "CI|Côte d'Ivoire|225", 'HR|Croatie|385', 'CU|Cuba|53', 'DK|Danemark|45', 'DJ|Djibouti|253', 'DM|Dominique|1767',
    'EG|Égypte|20', 'AE|Émirats arabes unis|971', 'EC|Équateur|593', 'ER|Érythrée|291', 'ES|Espagne|34', 'EE|Estonie|372',
    'SZ|Eswatini|268', 'US|États-Unis|1', 'ET|Éthiopie|251', 'FJ|Fidji|679', 'FI|Finlande|358', 'FR|France|33',
    'GA|Gabon|241', 'GM|Gambie|220', 'GE|Géorgie|995', 'GH|Ghana|233', 'GR|Grèce|30', 'GD|Grenade|1473',
    'GP|Guadeloupe|590', 'GT|Guatemala|502', 'GN|Guinée|224', 'GQ|Guinée équatoriale|240', 'GW|Guinée-Bissau|245',
    'GY|Guyana|592', 'GF|Guyane|594', 'HT|Haïti|509', 'HN|Honduras|504', 'HK|Hong Kong|852', 'HU|Hongrie|36',
    'MH|Îles Marshall|692', 'SB|Îles Salomon|677', 'IN|Inde|91', 'ID|Indonésie|62', 'IQ|Irak|964', 'IR|Iran|98',
    'IE|Irlande|353', 'IS|Islande|354', 'IL|Israël|972', 'IT|Italie|39', 'JM|Jamaïque|1876', 'JP|Japon|81',
    'JO|Jordanie|962', 'KZ|Kazakhstan|7', 'KE|Kenya|254', 'KG|Kirghizistan|996', 'KI|Kiribati|686', 'XK|Kosovo|383',
    'KW|Koweït|965', 'RE|La Réunion|262', 'LA|Laos|856', 'LS|Lesotho|266', 'LV|Lettonie|371', 'LB|Liban|961',
    'LR|Libéria|231', 'LY|Libye|218', 'LI|Liechtenstein|423', 'LT|Lituanie|370', 'LU|Luxembourg|352',
    'MK|Macédoine du Nord|389', 'MG|Madagascar|261', 'MY|Malaisie|60', 'MW|Malawi|265', 'MV|Maldives|960', 'ML|Mali|223',
    'MT|Malte|356', 'MA|Maroc|212', 'MQ|Martinique|596', 'MU|Maurice|230', 'MR|Mauritanie|222', 'YT|Mayotte|262',
    'MX|Mexique|52', 'FM|Micronésie|691', 'MD|Moldavie|373', 'MC|Monaco|377', 'MN|Mongolie|976', 'ME|Monténégro|382',
    'MZ|Mozambique|258', 'NA|Namibie|264', 'NR|Nauru|674', 'NP|Népal|977', 'NI|Nicaragua|505', 'NE|Niger|227',
    'NG|Nigeria|234', 'NO|Norvège|47', 'NC|Nouvelle-Calédonie|687', 'NZ|Nouvelle-Zélande|64', 'OM|Oman|968',
    'UG|Ouganda|256', 'UZ|Ouzbékistan|998', 'PK|Pakistan|92', 'PW|Palaos|680', 'PS|Palestine|970', 'PA|Panama|507',
    'PG|Papouasie-Nouvelle-Guinée|675', 'PY|Paraguay|595', 'NL|Pays-Bas|31', 'PE|Pérou|51', 'PH|Philippines|63',
    'PL|Pologne|48', 'PF|Polynésie française|689', 'PR|Porto Rico|1787', 'PT|Portugal|351', 'QA|Qatar|974',
    'CF|République centrafricaine|236', 'DO|République dominicaine|1809', 'RO|Roumanie|40', 'GB|Royaume-Uni|44',
    'RU|Russie|7', 'RW|Rwanda|250', 'KN|Saint-Christophe-et-Niévès|1869', 'SM|Saint-Marin|378',
    'PM|Saint-Pierre-et-Miquelon|508', 'VC|Saint-Vincent-et-les-Grenadines|1784', 'LC|Sainte-Lucie|1758',
    'SV|Salvador|503', 'WS|Samoa|685', 'ST|Sao Tomé-et-Principe|239', 'SN|Sénégal|221', 'RS|Serbie|381',
    'SC|Seychelles|248', 'SL|Sierra Leone|232', 'SG|Singapour|65', 'SK|Slovaquie|421', 'SI|Slovénie|386',
    'SO|Somalie|252', 'SD|Soudan|249', 'SS|Soudan du Sud|211', 'LK|Sri Lanka|94', 'SE|Suède|46', 'CH|Suisse|41',
    'SR|Suriname|597', 'SY|Syrie|963', 'TJ|Tadjikistan|992', 'TW|Taïwan|886', 'TZ|Tanzanie|255', 'TD|Tchad|235',
    'CZ|Tchéquie|420', 'TH|Thaïlande|66', 'TL|Timor oriental|670', 'TG|Togo|228', 'TO|Tonga|676',
    'TT|Trinité-et-Tobago|1868', 'TN|Tunisie|216', 'TM|Turkménistan|993', 'TR|Turquie|90', 'TV|Tuvalu|688',
    'UA|Ukraine|380', 'UY|Uruguay|598', 'VU|Vanuatu|678', 'VA|Vatican|39', 'VE|Venezuela|58', 'VN|Viêt Nam|84',
    'YE|Yémen|967', 'ZM|Zambie|260', 'ZW|Zimbabwe|263',
  ].map(function (l) {
    var p = l.split('|');
    return { iso: p[0], nom: p[1], indicatif: p[2] };
  });

  // En tête de liste : la Côte d'Ivoire, ses voisins et les pays d'où l'on appelle le plus souvent
  var FREQUENTS = ['CI', 'BF', 'ML', 'GN', 'GH', 'LR', 'SN', 'TG', 'BJ', 'NE', 'NG', 'CM', 'FR', 'BE', 'CH', 'US', 'CA', 'GB', 'MA', 'LB'];

  // Longueur du numéro national (sans l'indicatif). « zero » : un 0 initial se tape en national et n'est pas compté.
  var REGLES = {
    CI: { n: [10], ex: '07 00 00 00 00' },
    BF: { n: [8], ex: '70 12 34 56' }, ML: { n: [8], ex: '70 12 34 56' }, NE: { n: [8], ex: '90 12 34 56' },
    TG: { n: [8], ex: '90 12 34 56' }, BJ: { n: [8, 10], ex: '01 90 12 34 56' }, SN: { n: [9], ex: '77 123 45 67' },
    GN: { n: [9], ex: '622 12 34 56' }, GH: { n: [9], zero: true, ex: '024 123 4567' }, LR: { n: [7, 9], zero: true, ex: '077 012 3456' },
    SL: { n: [8], zero: true, ex: '076 123456' }, NG: { n: [10], zero: true, ex: '0802 123 4567' }, CM: { n: [9], ex: '6 71 23 45 67' },
    GA: { n: [7, 8] }, CG: { n: [9] }, CD: { n: [9], zero: true }, TD: { n: [8] }, CF: { n: [8] }, MR: { n: [8] },
    GM: { n: [7] }, GW: { n: [7, 9] }, CV: { n: [7] }, MA: { n: [9], zero: true, ex: '0612 345678' },
    DZ: { n: [8, 9], zero: true }, TN: { n: [8] }, EG: { n: [9, 10], zero: true },
    FR: { n: [9], zero: true, ex: '06 12 34 56 78' }, BE: { n: [8, 9], zero: true, ex: '0470 12 34 56' },
    CH: { n: [9], zero: true, ex: '078 123 45 67' }, LU: { n: [4, 11] }, DE: { n: [6, 11], zero: true },
    IT: { n: [6, 11] }, ES: { n: [9] }, PT: { n: [9] }, GB: { n: [9, 10], zero: true, ex: '07400 123456' },
    NL: { n: [9], zero: true }, US: { n: [10], ex: '201 555 0123' }, CA: { n: [10], ex: '514 555 0123' },
    LB: { n: [7, 8], zero: true, ex: '03 123 456' }, AE: { n: [8, 9], zero: true }, CN: { n: [10, 11], zero: true },
    IN: { n: [10], zero: true }, TR: { n: [10], zero: true }, BR: { n: [10, 11], zero: true },
    RE: { n: [9], zero: true }, YT: { n: [9], zero: true }, GP: { n: [9], zero: true }, MQ: { n: [9], zero: true },
    GF: { n: [9], zero: true },
  };

  var parIso = {};
  LISTE.forEach(function (p) { parIso[p.iso] = p; });
  var norm = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var tri = new Intl.Collator('fr', { sensitivity: 'base' });
  var TOUS = LISTE.slice().sort(function (a, b) { return tri.compare(a.nom, b.nom); });

  function drapeau(iso) {
    return String.fromCodePoint.apply(null, iso.split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; }));
  }
  function regle(p) {
    if (REGLES[p.iso]) return REGLES[p.iso];
    if (p.indicatif.length === 4 && p.indicatif[0] === '1') return { n: [7] };   // îles des Caraïbes (+1 xxx)
    return { n: [6, 15 - p.indicatif.length], zero: true };                    // norme internationale : 15 chiffres au plus
  }
  var chiffresDe = function (s) { return String(s).replace(/\D/g, ''); };

  // Indicatifs partagés par plusieurs pays : celui retenu quand on tape « +1 », « +7 »…
  var PRINCIPAL = { '1': 'US', '7': 'RU', '39': 'IT', '262': 'RE' };

  // Pays dont l'indicatif commence la suite de chiffres (le plus long d'abord ; à égalité : le pays déjà choisi)
  function paysParIndicatif(d, prefere) {
    for (var l = 4; l >= 1; l--) {
      var code = d.slice(0, l);
      var c = LISTE.filter(function (p) { return p.indicatif === code; });
      if (!c.length) continue;
      if (prefere && prefere.indicatif === code) return prefere;
      return parIso[PRINCIPAL[code]] || c[0];
    }
    return null;
  }
  function rang(p) { var i = FREQUENTS.indexOf(p.iso); return i < 0 ? 99 : i; }

  function paysDe(input) { return parIso[input.dataset.pays] || parIso.CI; }

  // Pays et numéro national, d'après la saisie : un « +XX » ou « 00XX » tapé l'emporte sur le pays choisi
  function analyser(input) {
    var brut = String(input.value).trim(), compact = brut.replace(/[\s.\-()]/g, '');
    var pays = paysDe(input), d = chiffresDe(brut);
    if (/^(\+|00)/.test(compact)) {
      if (compact.indexOf('00') === 0) d = d.slice(2);
      var trouve = paysParIndicatif(d, pays);
      if (trouve) { pays = trouve; d = d.slice(trouve.indicatif.length); }
    }
    var r = regle(pays);
    var national = r.zero && d.length > 1 && d[0] === '0' ? d.slice(1) : d;
    return { pays: pays, regle: r, national: national, brut: brut };
  }

  function valide(input) {
    var a = analyser(input), min = a.regle.n[0], max = a.regle.n[a.regle.n.length - 1];
    return /^\+?[\d\s.\-()]+$/.test(a.brut) && a.national.length >= min && a.national.length <= max;
  }

  function message(input) {
    var a = analyser(input), n = a.regle.n;
    if (!a.brut) return 'Indiquez un numéro de téléphone.';
    var nb = (n.length === 1 || n[0] === n[1] ? n[0] : 'de ' + n[0] + ' à ' + n[n.length - 1]) + ' chiffres';
    if (a.regle.zero) nb += ' sans compter le 0 du début';
    return 'Numéro invalide (' + a.pays.nom + ', +' + a.pays.indicatif + ') : ' + nb + (a.regle.ex ? ', ex. ' + a.regle.ex : '') + '.';
  }

  // Groupes de deux chiffres (« 07 48 32 11 90 », « 6 12 34 56 78 ») : lisible dans la plupart des pays
  function grouper(d) {
    var impair = d.length % 2 === 1;
    return ((impair ? d[0] + ' ' : '') + (impair ? d.slice(1) : d).replace(/(\d{2})(?=\d)/g, '$1 ')).trim();
  }
  function complet(input) {
    var a = analyser(input);
    return a.national ? '+' + a.pays.indicatif + ' ' + grouper(a.national) : '';
  }
  function chiffres(input) {
    var a = analyser(input);
    return a.national ? a.pays.indicatif + a.national : '';
  }

  // ── Styles (ajoutés une seule fois) ──
  var CSS =
    '.tel-champ{position:relative;display:block;width:100%;flex:1 1 auto;min-width:0}' +
    '.tel-pays{position:absolute;left:6px;top:50%;transform:translateY(-50%);z-index:1;display:inline-flex;align-items:center;gap:4px;' +
      'padding:6px 8px;border:none;border-radius:8px;background:transparent;font-family:"Outfit",sans-serif;font-size:13px;font-weight:600;' +
      'color:var(--gray-dark,#3A3A3C);cursor:pointer;white-space:nowrap}' +
    '.tel-pays:hover,.tel-pays[aria-expanded="true"]{background:var(--gray-pale,#F5F5F2)}' +
    '.tel-drapeau{font-size:17px;line-height:1}' +
    '.tel-chevron{opacity:.6}' +
    '.tel-liste{position:fixed;z-index:2100;display:flex;flex-direction:column;width:min(320px,calc(100vw - 24px));' +
      'background:#fff;border:1px solid var(--border,#E8E8E3);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden;font-family:"Outfit",sans-serif}' +
    '.tel-liste[hidden]{display:none}' +
    '.tel-recherche{margin:10px;padding:9px 12px;border:1.5px solid var(--border,#E8E8E3);border-radius:8px;font-family:"Outfit",sans-serif;font-size:14px;outline:none}' +
    '.tel-recherche:focus{border-color:var(--green,#1A6B4A)}' +
    '.tel-options{list-style:none;margin:0;padding:0 6px 8px;overflow-y:auto}' +
    '.tel-titre{padding:8px 10px 4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gray-light,#ADADAD)}' +
    '.tel-option{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:14px;color:var(--charcoal,#1C1C1E);cursor:pointer}' +
    '.tel-option.actif{background:var(--gray-pale,#F5F5F2)}' +
    '.tel-option.courant .tel-nom{font-weight:600;color:var(--green,#1A6B4A)}' +
    '.tel-option .tel-code{margin-left:auto;font-size:13px;color:var(--gray-mid,#6B6B6B)}' +
    '.tel-vide{padding:12px 10px;font-size:13px;color:var(--gray-mid,#6B6B6B)}';
  function styles() {
    if (document.getElementById('telephone-styles')) return;
    var st = document.createElement('style');
    st.id = 'telephone-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ── Bouton du pays devant le champ ──
  function etiquette(bouton, pays) {
    bouton.innerHTML = '<span class="tel-drapeau" aria-hidden="true">' + drapeau(pays.iso) + '</span>' +
      '<span class="tel-indicatif">+' + pays.indicatif + '</span>' +
      '<svg class="tel-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    bouton.setAttribute('aria-label', 'Indicatif : ' + pays.nom + ' +' + pays.indicatif + '. Changer de pays');
    bouton.title = pays.nom + ' (+' + pays.indicatif + ')';
  }

  function choisir(input, pays, signaler) {
    input.dataset.pays = pays.iso;
    var t = input._telephone;
    etiquette(t.bouton, pays);
    // Exemple de numéro du pays (en gardant « (optionnel) » si le champ l'indiquait)
    var suffixe = (t.placeholderInitial.match(/\((optionnel|facultatif)\)/) || [''])[0];
    input.placeholder = ((regle(pays).ex || 'Numéro de téléphone') + ' ' + suffixe).trim();
    if (t.integre) decaler(input);
    if (signaler) input.dispatchEvent(new Event('input', { bubbles: true }));   // met à jour aperçus et messages d'erreur
  }

  // Le texte du champ commence après le bouton du pays (largeur réelle si visible, sinon estimée)
  function decaler(input) {
    var b = input._telephone.bouton;
    var largeur = b.offsetWidth || 64 + 8 * paysDe(input).indicatif.length;
    input.style.paddingLeft = (largeur + 14) + 'px';
  }

  // Numéro saisi avec son indicatif : on choisit le pays et on ne garde que le numéro national
  function normaliser(input) {
    var compact = String(input.value).replace(/[\s.\-()]/g, '');
    if (!/^(\+|00)\d/.test(compact)) return;
    var d = chiffresDe(compact);
    if (compact.indexOf('00') === 0) d = d.slice(2);
    var pays = paysParIndicatif(d, paysDe(input));
    if (!pays) return;   // indicatif inconnu : laissé tel quel, le message d'erreur l'indiquera
    input.value = grouper(d.slice(pays.indicatif.length));
    choisir(input, pays, true);
  }

  function champ(input, bouton) {
    if (input._telephone) return;
    styles();
    var integre = !bouton;
    if (integre) {
      var enveloppe = document.createElement('span');
      enveloppe.className = 'tel-champ';
      input.parentNode.insertBefore(enveloppe, input);
      enveloppe.appendChild(input);
      bouton = document.createElement('button');
      bouton.className = 'tel-pays';
      enveloppe.insertBefore(bouton, input);
    }
    bouton.type = 'button';
    bouton.setAttribute('aria-haspopup', 'listbox');
    bouton.setAttribute('aria-expanded', 'false');
    input._telephone = { bouton: bouton, integre: integre, placeholderInitial: input.placeholder };
    input.setAttribute('autocomplete', 'tel-national');
    // Champ d'abord caché (fenêtre, section repliée) : la place du bouton se recalcule quand il apparaît
    if (integre && window.ResizeObserver) new ResizeObserver(function () { decaler(input); }).observe(bouton);
    choisir(input, parIso[input.dataset.pays] || parIso.CI, false);
    normaliser(input);   // valeur déjà présente avec « +225 … »
    input.addEventListener('change', function () { normaliser(input); });
    bouton.addEventListener('click', function (e) { e.preventDefault(); ouvrir(input); });
  }

  // ── Liste des pays (une seule, partagée par tous les champs) ──
  var liste, recherche, options, courant = null, actif = -1, visibles = [];

  function creerListe() {
    liste = document.createElement('div');
    liste.className = 'tel-liste';
    liste.hidden = true;
    liste.setAttribute('role', 'dialog');
    liste.setAttribute('aria-label', 'Choisir l\'indicatif du pays');
    liste.innerHTML = '<input type="text" class="tel-recherche" placeholder="Pays ou indicatif (ex. France, +33)" ' +
      'aria-label="Rechercher un pays ou un indicatif" role="combobox" aria-expanded="true" aria-controls="telOptions" aria-autocomplete="list">' +
      '<ul class="tel-options" id="telOptions" role="listbox"></ul>';
    recherche = liste.querySelector('.tel-recherche');
    options = liste.querySelector('.tel-options');
    recherche.addEventListener('input', function () { afficher(recherche.value); });
    recherche.addEventListener('keydown', clavier);
    options.addEventListener('mousedown', function (e) { e.preventDefault(); });   // garder le curseur dans la recherche
    options.addEventListener('click', function (e) {
      var li = e.target.closest('.tel-option');
      if (li) valider(parIso[li.dataset.iso]);
    });
    document.body.appendChild(liste);
    document.addEventListener('mousedown', function (e) {
      if (!liste.hidden && !liste.contains(e.target) && !(courant && courant._telephone.bouton.contains(e.target))) fermer(false);
    });
    window.addEventListener('resize', function () { fermer(false); });
    window.addEventListener('scroll', function (e) { if (!liste.hidden && !liste.contains(e.target)) placer(); }, true);
  }

  function afficher(filtre) {
    var f = norm(filtre).trim(), code = chiffresDe(filtre);
    var html = '', n = 0;
    visibles = [];
    var ligne = function (p) {
      visibles.push(p);
      return '<li class="tel-option' + (p.iso === courant.dataset.pays ? ' courant' : '') + '" role="option" id="telOpt' + (n++) + '" data-iso="' + p.iso + '" aria-selected="false">' +
        '<span class="tel-drapeau" aria-hidden="true">' + drapeau(p.iso) + '</span><span class="tel-nom">' + p.nom + '</span><span class="tel-code">+' + p.indicatif + '</span></li>';
    };
    if (!f) {
      html += '<li class="tel-titre" role="presentation">Pays fréquents</li>' + FREQUENTS.map(function (i) { return ligne(parIso[i]); }).join('');
      html += '<li class="tel-titre" role="presentation">Tous les pays</li>' + TOUS.map(ligne).join('');
    } else {
      var trouves = TOUS.filter(function (p) {
        return norm(p.nom).indexOf(f) >= 0 || (code && /^[+\d\s]+$/.test(filtre.trim()) && p.indicatif.indexOf(code) === 0);
      });
      trouves.sort(function (a, b) {
        var da = norm(a.nom).indexOf(f) === 0 ? 0 : 1, db = norm(b.nom).indexOf(f) === 0 ? 0 : 1;
        return da - db || rang(a) - rang(b) || tri.compare(a.nom, b.nom);
      });
      html = trouves.length ? trouves.map(ligne).join('') : '<li class="tel-vide" role="presentation">Aucun pays trouvé</li>';
    }
    options.innerHTML = html;
    activer(f ? 0 : visibles.indexOf(paysDe(courant)));
  }

  function activer(i) {
    var lis = options.querySelectorAll('.tel-option');
    if (actif >= 0 && lis[actif]) { lis[actif].classList.remove('actif'); lis[actif].setAttribute('aria-selected', 'false'); }
    actif = Math.max(-1, Math.min(i, lis.length - 1));
    if (actif >= 0) {
      lis[actif].classList.add('actif');
      lis[actif].setAttribute('aria-selected', 'true');
      recherche.setAttribute('aria-activedescendant', lis[actif].id);
      lis[actif].scrollIntoView({ block: 'nearest' });
    } else recherche.removeAttribute('aria-activedescendant');
  }

  function clavier(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activer(actif + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activer(Math.max(0, actif - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (visibles[actif]) valider(visibles[actif]); }
    else if (e.key === 'Escape') { e.preventDefault(); fermer(true); }
    else if (e.key === 'Tab') fermer(false);
  }

  function placer() {
    var r = courant._telephone.bouton.getBoundingClientRect();
    var largeur = liste.offsetWidth, hMax = 340;
    var dessous = window.innerHeight - r.bottom - 12, dessus = r.top - 12;
    liste.style.left = Math.max(12, Math.min(r.left, window.innerWidth - largeur - 12)) + 'px';
    if (dessous >= Math.min(hMax, 240) || dessous >= dessus) {
      liste.style.top = (r.bottom + 6) + 'px'; liste.style.bottom = '';
      liste.style.maxHeight = Math.min(hMax, dessous) + 'px';
    } else {
      liste.style.top = ''; liste.style.bottom = (window.innerHeight - r.top + 6) + 'px';
      liste.style.maxHeight = Math.min(hMax, dessus) + 'px';
    }
  }

  function ouvrir(input) {
    if (!liste) creerListe();
    if (!liste.hidden && courant === input) { fermer(true); return; }
    courant = input;
    recherche.value = '';
    afficher('');
    liste.hidden = false;
    input._telephone.bouton.setAttribute('aria-expanded', 'true');
    placer();
    recherche.focus({ preventScroll: true });
  }

  function fermer(rendreFocus) {
    if (!liste || liste.hidden) return;
    liste.hidden = true;
    courant._telephone.bouton.setAttribute('aria-expanded', 'false');
    if (rendreFocus) courant._telephone.bouton.focus({ preventScroll: true });
  }

  function valider(pays) {
    var input = courant;
    fermer(false);
    choisir(input, pays, true);
    input.focus({ preventScroll: true });
  }

  // Tous les champs téléphone de la page, dès qu'elle est lue
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[type="tel"]').forEach(function (input) {
      var avant = input.previousElementSibling;
      champ(input, avant && avant.classList.contains('phone-flag-btn') ? avant : null);
    });
  });

  window.Telephone = { champ: champ, valide: valide, message: message, complet: complet, chiffres: chiffres, pays: function (input) { return analyser(input).pays; } };
})();
