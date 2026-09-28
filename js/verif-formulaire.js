/*
 * Vérification des formulaires : règles communes et affichage des erreurs.
 *
 *   Verif.verifier([
 *     { champ: el, test: Verif.rempli, message: 'Indiquez votre nom' },
 *     { champ: el, test: Verif.telephone, message: 'Numéro invalide', facultatif: true },
 *   ])  → true si tout est bon ; sinon affiche un message sous chaque champ fautif,
 *         fait défiler jusqu'au premier et renvoie false.
 *
 * « champ » peut être un <input>/<textarea> (sa valeur est testée) ou n'importe quel
 * élément (le test reçoit alors l'élément lui-même). Le message disparaît dès que
 * l'utilisateur modifie le champ.
 */
(function () {
  'use strict';

  function styles() {
    if (document.getElementById('verif-styles')) return;
    var st = document.createElement('style');
    st.id = 'verif-styles';
    st.textContent =
      '.champ-erreur{border-color:#C62828!important;box-shadow:0 0 0 3px rgba(198,40,40,.12)!important}' +
      '.message-erreur{color:#C62828;font-size:12px;font-weight:500;line-height:1.4;margin-top:6px;text-align:left}' +
      '.message-erreur::before{content:"⚠ "}';
    document.head.appendChild(st);
  }

  function estSaisie(el) { return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName); }
  function valeur(el) { return estSaisie(el) ? el.value : el; }

  var Verif = {
    rempli: function (v) { return typeof v === 'string' ? v.trim() !== '' : !!v; },
    longueurMin: function (n) { return function (v) { return String(v).trim().length >= n; }; },
    email: function (v) { return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(String(v).trim()); },
    // Côte d'Ivoire : 10 chiffres, précédés ou non de +225 / 00225 (espaces, points et tirets acceptés)
    telephone: function (v) { return /^(\+225|00225)?\d{10}$/.test(String(v).replace(/[\s.\-()]/g, '')); },
    nombreMin: function (n) { return function (v) { var x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return !isNaN(x) && x >= n; }; },

    // Affiche un message sous le champ (ou sous « apres », si le champ est dans un bloc)
    erreur: function (champ, message, apres) {
      styles();
      Verif.effacer(champ);
      champ.classList.add('champ-erreur');
      if (estSaisie(champ)) champ.setAttribute('aria-invalid', 'true');
      var msg = document.createElement('div');
      msg.className = 'message-erreur';
      msg.setAttribute('role', 'alert');
      msg.textContent = message;
      var ref = apres || champ;
      ref.insertAdjacentElement('afterend', msg);
      champ._verifMessage = msg;
      if (!champ._verifEcoute) {
        champ._verifEcoute = true;
        // seulement quand l'utilisateur modifie le champ (pas au « change » déclenché en quittant le champ)
        champ.addEventListener(estSaisie(champ) ? 'input' : 'click', function () { Verif.effacer(champ); });
      }
    },

    effacer: function (champ) {
      champ.classList.remove('champ-erreur');
      champ.removeAttribute('aria-invalid');
      if (champ._verifMessage) { champ._verifMessage.remove(); champ._verifMessage = null; }
    },

    verifier: function (regles) {
      var premier = null;
      regles.forEach(function (r) {
        if (!r.champ) return;
        var v = valeur(r.champ);
        var vide = estSaisie(r.champ) && String(v).trim() === '';
        var ok = (r.facultatif && vide) || r.test(v);
        if (ok) { Verif.effacer(r.champ); return; }
        Verif.erreur(r.champ, r.message, r.apres);
        if (!premier) premier = r.champ;
      });
      if (premier) {
        premier.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (estSaisie(premier)) setTimeout(function () { premier.focus({ preventScroll: true }); }, 300);
        return false;
      }
      return true;
    },
  };

  window.Verif = Verif;
})();
