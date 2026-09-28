/*
 * Choix d'une ville ou d'une commune : liste déroulante + recherche en tapant.
 * Données : window.VILLES_COMMUNES et window.QUARTIERS (js/villes-communes.js).
 *
 *   ChoixLieu.recherche(input, { format })   champ de recherche : villes et communes
 *                                             proposées, saisie libre toujours possible
 *   ChoixLieu.villeCommune(inputVille, inputCommune, { quartier, blocQuartier })
 *                                             champs liés : la ville filtre les communes,
 *                                             la commune remplit la ville ; le quartier
 *                                             (facultatif) suit la commune et son bloc est
 *                                             masqué quand la commune n'a pas de quartiers
 *
 * La recherche ignore accents, majuscules, tirets et apostrophes
 * (« bouake » → Bouaké, « port bouet » → Port-Bouët, « mbah » → M'Bahiakro).
 * Après un choix, le champ reçoit les événements « input » et « change ».
 */
(function () {
  'use strict';

  var DONNEES = window.VILLES_COMMUNES || [];
  var QUARTIERS = window.QUARTIERS || {};
  var TRI = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

  // Normalise une lettre : sans accent, minuscule ; tiret → espace ; apostrophe → rien.
  function normCar(c) {
    if (c === "'" || c === '’' || c === '`') return '';
    if (c === '-' || c === '_') return ' ';
    return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function norm(s) {
    return Array.from(s || '').map(normCar).join('').replace(/\s+/g, ' ').trim();
  }

  // ── Index : ville → communes ──
  var communesDe = new Map();
  DONNEES.forEach(function (p) {
    if (!communesDe.has(p[0])) communesDe.set(p[0], []);
    communesDe.get(p[0]).push(p[1]);
  });
  var villeParNorm = new Map();
  communesDe.forEach(function (_, v) { villeParNorm.set(norm(v), v); });

  function entree(type, ville, commune, libelle, detail) {
    return { type: type, ville: ville, commune: commune, libelle: libelle, detail: detail,
             nLibelle: norm(libelle), nDetail: norm(detail) };
  }
  function trier(a, b) {
    return TRI.compare(a.ville, b.ville) || (a.type === 'ville' ? -1 : b.type === 'ville' ? 1 : TRI.compare(a.libelle, b.libelle));
  }

  // Recherche : chaque ville (avec son nombre de communes) et chaque commune d'une ville à plusieurs communes
  var ENTREES_RECHERCHE = [];
  communesDe.forEach(function (cs, v) {
    ENTREES_RECHERCHE.push(entree('ville', v, cs.length === 1 ? cs[0] : null, v, cs.length > 1 ? 'Ville · ' + cs.length + ' communes' : 'Ville'));
    if (cs.length > 1) cs.forEach(function (c) { ENTREES_RECHERCHE.push(entree('commune', v, c, c, 'Commune · ' + v)); });
  });
  ENTREES_RECHERCHE.sort(trier);

  var ENTREES_VILLES = [];
  communesDe.forEach(function (cs, v) { ENTREES_VILLES.push(entree('ville', v, null, v, cs.length > 1 ? cs.length + ' communes' : '')); });
  ENTREES_VILLES.sort(trier);

  var ENTREES_COMMUNES = DONNEES.map(function (p) { return entree('commune', p[0], p[1], p[1], p[0]); }).sort(trier);

  // Quartiers d'une ville (toutes communes) ou d'une commune : [{ quartier, commune }]
  function quartiersDe(ville, commune) {
    var parCommune = QUARTIERS[ville];
    if (!parCommune) return [];
    var communes = commune ? [commune] : Object.keys(parCommune);
    var out = [];
    communes.forEach(function (c) { (parCommune[c] || []).forEach(function (q) { out.push({ quartier: q, commune: c }); }); });
    return out;
  }

  // ── Correspondance : chaque mot tapé doit commencer un mot du nom (ou de la ville), ou y figurer ──
  function score(e, mots, q, qCompact) {
    var texte = e.nLibelle + ' ' + e.nDetail;
    var motsTexte = texte.split(' ');
    var compact = texte.replace(/ /g, '');
    for (var i = 0; i < mots.length; i++) {
      var m = mots[i];
      if (!motsTexte.some(function (w) { return w.indexOf(m) === 0; }) && texte.indexOf(m) < 0) {
        if (compact.indexOf(qCompact) < 0) return -1;
      }
    }
    if (e.nLibelle === q) return 0;
    if (e.nLibelle.indexOf(q) === 0) return 1;
    if (e.nLibelle.split(' ').some(function (w) { return w.indexOf(mots[0]) === 0; })) return 2;
    if (e.nDetail.split(' ').some(function (w) { return w.indexOf(mots[0]) === 0; })) return 3;
    return 4;
  }
  function filtrer(entrees, saisie) {
    var q = norm(saisie);
    if (!q) return entrees.slice();
    var mots = q.split(' '), qCompact = q.replace(/ /g, '');
    return entrees
      .map(function (e) { return { e: e, s: score(e, mots, q, qCompact) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return a.s - b.s || trier(a.e, b.e); })
      .map(function (x) { return x.e; });
  }

  // ── Mise en évidence des lettres tapées ──
  function echapper(s) {
    return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function surligner(texte, saisie) {
    var mots = norm(saisie).split(' ').filter(Boolean);
    if (!mots.length) return echapper(texte);
    // version normalisée lettre par lettre, avec la position de chaque lettre dans le texte d'origine
    var n = '', pos = [];
    Array.from(texte).forEach(function (c, i) { var k = normCar(c); for (var j = 0; j < k.length; j++) { n += k[j]; pos.push(i); } });
    var marques = new Array(Array.from(texte).length).fill(false);
    mots.forEach(function (m) {
      var re = new RegExp('(^| )' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      var r = re.exec(n), debut = r ? r.index + r[1].length : n.indexOf(m);
      if (debut < 0) return;
      for (var k = debut; k < debut + m.length && k < pos.length; k++) marques[pos[k]] = true;
    });
    var html = '', ouvert = false;
    Array.from(texte).forEach(function (c, i) {
      if (marques[i] && !ouvert) { html += '<mark>'; ouvert = true; }
      if (!marques[i] && ouvert) { html += '</mark>'; ouvert = false; }
      html += echapper(c);
    });
    return html + (ouvert ? '</mark>' : '');
  }

  // ── Styles de la liste (injectés une fois) ──
  function injecterStyles() {
    if (document.getElementById('choix-lieu-styles')) return;
    var st = document.createElement('style');
    st.id = 'choix-lieu-styles';
    st.textContent =
      '.cl-liste{position:fixed;z-index:2000;margin:0;padding:6px;list-style:none;background:#fff;' +
      'border:1px solid #E8E8E3;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.16);overflow-y:auto;' +
      'overscroll-behavior:contain;font-family:Outfit,system-ui,sans-serif;display:none;-webkit-overflow-scrolling:touch}' +
      '.cl-liste.ouverte{display:block}' +
      '.cl-option{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:10px 12px;' +
      'border-radius:8px;cursor:pointer;font-size:14px;color:#1C1C1E;line-height:1.3}' +
      '.cl-option.commune-de-ville{padding-left:26px}' +
      '.cl-option.active,.cl-option:hover{background:#E8F5EE}' +
      '.cl-option[aria-selected="true"] .cl-libelle{color:#1A6B4A;font-weight:600}' +
      '.cl-detail{font-size:12px;color:#6B6B6B;white-space:nowrap;flex-shrink:0}' +
      '.cl-option mark{background:none;color:#1A6B4A;font-weight:700}' +
      '.cl-vide{padding:12px;font-size:13px;color:#6B6B6B;line-height:1.5}';
    document.head.appendChild(st);
  }

  var compteur = 0;

  // ── Composant générique ──
  function attacher(input, opts) {
    injecterStyles();
    var id = 'cl-liste-' + (++compteur);
    var liste = document.createElement('ul');
    liste.className = 'cl-liste';
    liste.id = id;
    liste.setAttribute('role', 'listbox');
    document.body.appendChild(liste);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', id);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    if (opts.deroulant) {
      // flèche de liste déroulante, comme sur un <select>
      input.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";
      input.style.backgroundRepeat = 'no-repeat';
      input.style.backgroundPosition = 'right 12px center';
      input.style.paddingRight = '34px';
    }

    var resultats = [], active = -1, tape = false, fermeture = null, vientDeFocus = false;

    function ouvert() { return liste.classList.contains('ouverte'); }

    function placer() {
      var r = input.getBoundingClientRect();
      var vv = window.visualViewport;
      var haut = vv ? vv.offsetTop : 0, bas = vv ? vv.offsetTop + vv.height : window.innerHeight;
      // (si le champ sort de l'écran, la liste le suit simplement)
      var dessous = bas - r.bottom - 8, dessus = r.top - haut - 8;
      var enBas = dessous >= 180 || dessous >= dessus;
      var h = Math.max(120, Math.min(300, enBas ? dessous : dessus));
      var largeur = Math.max(r.width, Math.min(280, window.innerWidth - 16));
      liste.style.width = largeur + 'px';
      liste.style.left = Math.max(8, Math.min(r.left, window.innerWidth - largeur - 8)) + 'px';
      liste.style.maxHeight = h + 'px';
      if (enBas) { liste.style.top = (r.bottom + 4) + 'px'; liste.style.bottom = 'auto'; }
      else { liste.style.top = 'auto'; liste.style.bottom = (window.innerHeight - r.top + 4) + 'px'; }
    }

    function afficher() {
      var saisie = tape ? input.value : '';
      resultats = filtrer(opts.entrees(), saisie);
      var courant = norm(input.value);
      liste.innerHTML = '';
      if (!resultats.length) {
        var vide = document.createElement('li');
        vide.className = 'cl-vide';
        vide.textContent = opts.libre
          ? 'Aucune ville ou commune ne correspond. Vous pouvez rechercher « ' + input.value.trim() + ' » tel quel.'
          : 'Aucune ville ou commune ne correspond à « ' + input.value.trim() + ' ».';
        liste.appendChild(vide);
      }
      active = -1;
      resultats.forEach(function (e, i) {
        var li = document.createElement('li');
        li.className = 'cl-option' + (e.type === 'commune' && opts.indenter && !saisie ? ' commune-de-ville' : '');
        li.id = id + '-' + i;
        li.setAttribute('role', 'option');
        var choisi = norm(opts.valeur(e)) === courant && courant !== '';
        li.setAttribute('aria-selected', choisi ? 'true' : 'false');
        if (choisi && active < 0) active = i;
        li.innerHTML = '<span class="cl-libelle">' + surligner(e.libelle, saisie) + '</span>' +
          (e.detail ? '<span class="cl-detail">' + surligner(e.detail, saisie) + '</span>' : '');
        li.addEventListener('click', function () { choisir(e); });
        liste.appendChild(li);
      });
      if (tape && resultats.length) active = 0;
      marquer();
      liste.classList.add('ouverte');
      input.setAttribute('aria-expanded', 'true');
      placer();
    }

    function marquer() {
      Array.prototype.forEach.call(liste.children, function (li, i) { li.classList.toggle('active', i === active); });
      if (active >= 0 && liste.children[active]) {
        input.setAttribute('aria-activedescendant', liste.children[active].id);
        var li = liste.children[active];
        if (li.offsetTop < liste.scrollTop) liste.scrollTop = li.offsetTop - 6;
        else if (li.offsetTop + li.offsetHeight > liste.scrollTop + liste.clientHeight) liste.scrollTop = li.offsetTop + li.offsetHeight - liste.clientHeight + 6;
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function fermer() {
      liste.classList.remove('ouverte');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      tape = false;
    }

    function signaler(el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function choisir(e) {
      input.value = opts.valeur(e);
      fermer();
      signaler(input);
      if (opts.apresChoix) opts.apresChoix(e);
    }

    // Écrit le nom exact (accents, majuscules) si la saisie correspond à une entrée
    function canoniser() {
      var q = norm(input.value);
      if (!q) return;
      var e = opts.entrees().find(function (x) { return norm(opts.valeur(x)) === q || x.nLibelle === q; });
      if (e && input.value !== opts.valeur(e)) choisir(e);
      else if (e && opts.apresChoix) opts.apresChoix(e);
    }

    input.addEventListener('focus', function () {
      clearTimeout(fermeture);
      tape = false;
      vientDeFocus = true;
      if (opts.deroulant) input.select();
      // attendre que le navigateur ait fait défiler la page jusqu'au champ
      requestAnimationFrame(function () { if (document.activeElement === input && !tape) afficher(); });
    });
    // Un clic qui ouvre la liste (ou qui suit l'arrivée dans le champ) garde tout le texte sélectionné :
    // la frappe remplace alors la valeur au lieu de s'y ajouter (sinon « Bouaké » + « coco » → « Bouakécoco »).
    // Le navigateur annule la sélection au relâchement du bouton : on empêche ce comportement dans ce cas.
    var garderSelection = false;
    input.addEventListener('mousedown', function () {
      garderSelection = !!opts.deroulant && (document.activeElement !== input || vientDeFocus || !ouvert());
    });
    input.addEventListener('mouseup', function (ev) {
      if (garderSelection) { ev.preventDefault(); input.select(); }
      garderSelection = false;
    });
    input.addEventListener('click', function () {
      vientDeFocus = false;
      if (!ouvert()) { tape = false; afficher(); }
    });
    input.addEventListener('input', function (ev) {
      if (!ev.isTrusted) return; // événement envoyé par choisir()
      tape = true;
      afficher();
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!ouvert()) { afficher(); return; }
        if (!resultats.length) return;
        active = ev.key === 'ArrowDown' ? (active + 1) % resultats.length : (active <= 0 ? resultats.length - 1 : active - 1);
        marquer();
      } else if (ev.key === 'Enter') {
        if (ouvert() && active >= 0 && resultats[active]) { ev.preventDefault(); choisir(resultats[active]); }
        else fermer();
      } else if (ev.key === 'Escape') {
        if (ouvert()) { ev.preventDefault(); ev.stopPropagation(); fermer(); }
      } else if (ev.key === 'Tab') {
        fermer();
      }
    });
    input.addEventListener('blur', function () {
      fermeture = setTimeout(function () { fermer(); canoniser(); }, 200);
    });
    // Garder le focus dans le champ quand on touche la liste (sinon la liste se ferme avant le choix)
    liste.addEventListener('mousedown', function (ev) { ev.preventDefault(); });

    window.addEventListener('resize', function () { if (ouvert()) placer(); });
    window.addEventListener('scroll', function (ev) {
      if (ouvert() && ev.target !== liste) placer();
    }, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { if (ouvert()) placer(); });
      window.visualViewport.addEventListener('scroll', function () { if (ouvert()) placer(); });
    }

    return { fermer: fermer, canoniser: canoniser };
  }

  // ── Champ de recherche : villes + communes, saisie libre (quartiers…) ──
  function recherche(input, o) {
    o = o || {};
    var format = o.format || function (e) { return e.libelle; };
    return attacher(input, {
      entrees: function () { return ENTREES_RECHERCHE; },
      valeur: format,
      libre: true,
      indenter: true,
      apresChoix: o.apresChoix,
    });
  }

  // ── Deux champs liés : Ville et Commune ──
  function villeCommune(inputVille, inputCommune, o) {
    o = o || {};
    function villeChoisie() { return villeParNorm.get(norm(inputVille.value)) || null; }
    function communeChoisie() {
      var v = villeChoisie(), q = norm(inputCommune.value);
      return v && q ? ((communesDe.get(v) || []).find(function (c) { return norm(c) === q; }) || null) : null;
    }
    function signalerChamp(el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    var cVille = attacher(inputVille, {
      entrees: function () { return ENTREES_VILLES; },
      valeur: function (e) { return e.libelle; },
      deroulant: true,
      apresChoix: function (e) {
        var cs = communesDe.get(e.ville) || [];
        var actuelle = norm(inputCommune.value);
        var garder = cs.some(function (c) { return norm(c) === actuelle; });
        var nouvelle = cs.length === 1 ? cs[0] : (garder ? inputCommune.value : '');
        if (nouvelle !== inputCommune.value) {
          inputCommune.value = nouvelle;
          inputCommune.dispatchEvent(new Event('input', { bubbles: true }));
          inputCommune.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
    });

    var cCommune = attacher(inputCommune, {
      entrees: function () {
        var v = villeChoisie();
        return v ? ENTREES_COMMUNES.filter(function (e) { return e.ville === v; }) : ENTREES_COMMUNES;
      },
      valeur: function (e) { return e.libelle; },
      deroulant: true,
      apresChoix: function (e) {
        if (inputVille.value !== e.ville) {
          inputVille.value = e.ville;
          inputVille.dispatchEvent(new Event('input', { bubbles: true }));
          inputVille.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
    });
    if (!o.quartier) return { ville: cVille, commune: cCommune };

    // ── Quartier : suit la ville et la commune ──
    var inputQuartier = o.quartier;
    function entreesQuartier() {
      var v = villeChoisie(), c = communeChoisie();
      if (!v) return [];
      var liste = quartiersDe(v, c).map(function (x) { return entree('quartier', v, x.commune, x.quartier, c ? '' : x.commune); });
      return liste.sort(function (a, b) { return (c ? 0 : TRI.compare(a.commune, b.commune)) || TRI.compare(a.libelle, b.libelle); });
    }
    var cQuartier = attacher(inputQuartier, {
      entrees: entreesQuartier,
      valeur: function (e) { return e.libelle; },
      deroulant: true,
      apresChoix: function (e) {
        if (norm(inputCommune.value) !== norm(e.commune)) { inputCommune.value = e.commune; signalerChamp(inputCommune); }
      },
    });
    // Affiche le bloc Quartier seulement si la ville (et la commune) ont des quartiers ; vide un quartier devenu invalide
    function majQuartier() {
      var liste = entreesQuartier();
      if (o.blocQuartier) o.blocQuartier.style.display = liste.length ? '' : 'none';
      var q = norm(inputQuartier.value);
      if (q && !liste.some(function (e) { return e.nLibelle === q; })) { inputQuartier.value = ''; signalerChamp(inputQuartier); }
    }
    inputVille.addEventListener('change', majQuartier);
    inputCommune.addEventListener('change', majQuartier);
    majQuartier();
    return { ville: cVille, commune: cCommune, quartier: cQuartier, majQuartier: majQuartier };
  }

  window.ChoixLieu = {
    recherche: recherche,
    villeCommune: villeCommune,
    // utiles pour d'autres pages ou pour une future API
    normaliser: norm,
    villes: function () { return ENTREES_VILLES.map(function (e) { return e.ville; }); },
    communes: function (ville) { return (communesDe.get(ville) || []).slice(); },
    quartiers: function (ville, commune) {
      var v = villeParNorm.get(norm(ville)) || null;
      var c = v ? ((communesDe.get(v) || []).find(function (x) { return norm(x) === norm(commune); }) || null) : null;
      return v ? quartiersDe(v, c) : [];
    },
    chercher: function (saisie) { return filtrer(ENTREES_RECHERCHE, saisie); },
  };
})();
