/*
 * Fonctions communes à toutes les pages de 360-Immo.ci
 * (chargé dans le <head> de chaque page, avant les scripts de la page)
 */

// Petit message en bas de l'écran, qui disparaît tout seul.
//   showToast('Annonce enregistrée')            → message gris foncé
//   showToast('Profil mis à jour', 'success')   → message vert
//   showToast('Une erreur est survenue', 'error') → message rouge
function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.setAttribute('role', 'status');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(showToast.minuteur);
  showToast.minuteur = setTimeout(function () { t.classList.remove('show'); }, 2800);
}
