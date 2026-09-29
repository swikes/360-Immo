/*
 * Fonctions communes à toutes les pages de 360-Immo.ci
 * (chargé dans le <head> de chaque page, avant les scripts de la page)
 */

// ── Menu du site ──
// Pour ajouter, retirer ou renommer un lien du menu sur TOUTES les pages, c'est ici.
//   Acheter → annonces « À vendre » ; Louer → annonces « À louer ».
//   Publier une annonce (vendre ou mettre en location) : le bouton vert de la barre du haut.
var MENU_SITE = [
  { texte: 'Acheter',        lien: '360-immo-resultats.html?tx=achat' },
  { texte: 'Louer',          lien: '360-immo-resultats.html?tx=location' },
  { texte: 'Carte des prix', lien: '360-immo-carte.html' },
  { texte: 'Guide & Blog',   lien: '360-immo-blog.html' },
  { texte: '✦ Estimer',      lien: '360-immo-estimation.html', classe: 'nav-estimer' },
];

var MenuSite = (function () {
  'use strict';

  // Le lien de la page où l'on se trouve (même fichier et, pour les résultats, même choix Acheter/Louer)
  function estActif(lien) {
    var cible = new URL(lien, location.href);
    if (cible.pathname.split('/').pop() !== location.pathname.split('/').pop()) return false;
    var tx = cible.searchParams.get('tx');
    return !tx || tx === new URLSearchParams(location.search).get('tx');
  }

  function creerLien(entree, classe) {
    var a = document.createElement('a');
    a.href = entree.lien;
    a.textContent = entree.texte;
    a.className = [classe, entree.classe].filter(Boolean).join(' ');
    if (estActif(entree.lien)) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    return a;
  }

  // <ul class="nav-links"></ul> de la barre du haut
  function remplirBarre(ul) {
    if (ul.dataset.rempli) return;
    ul.dataset.rempli = '1';
    MENU_SITE.forEach(function (entree) {
      var li = document.createElement('li');
      li.appendChild(creerLien(entree));
      ul.appendChild(li);
    });
  }

  // Tout élément <… data-menu-site="classe"> reçoit les liens du menu (ex. menu latéral de Mon Espace)
  function remplirConteneur(el) {
    if (el.dataset.rempli) return;
    el.dataset.rempli = '1';
    MENU_SITE.forEach(function (entree) { el.appendChild(creerLien(entree, el.dataset.menuSite)); });
  }

  function remplirTout() {
    document.querySelectorAll('body > nav ul.nav-links').forEach(remplirBarre);
    document.querySelectorAll('[data-menu-site]').forEach(remplirConteneur);
  }

  // Le menu est rempli dès que la barre du haut est lue, avant le premier affichage (pas de clignotement)
  var observateur = new MutationObserver(remplirTout);
  observateur.observe(document.documentElement, { childList: true, subtree: true });

  // ── Panneau ☰ sur téléphone et tablette ──
  var bouton, panneau, fond;

  function creerPanneau() {
    fond = document.createElement('div');
    fond.className = 'menu-site-fond';
    fond.addEventListener('click', fermer);

    panneau = document.createElement('aside');
    panneau.className = 'menu-site';
    panneau.id = 'menuSite';
    panneau.setAttribute('aria-label', 'Menu du site');
    panneau.innerHTML =
      '<div class="menu-site-haut">' +
        '<a href="360-immo-accueil.html" class="nav-logo">360<span>-Immo</span>.ci</a>' +
        '<button type="button" class="menu-site-fermer" aria-label="Fermer le menu">&#215;</button>' +
      '</div>' +
      '<div class="menu-site-liens"></div>' +
      '<div class="menu-site-boutons">' +
        '<a href="360-immo-login.html" class="btn-nav-outline">Mon espace</a>' +
        '<a href="360-immo-publier-annonce.html" class="btn-nav-primary">Publier une annonce</a>' +
      '</div>';
    var liens = panneau.querySelector('.menu-site-liens');
    liens.appendChild(creerLien({ texte: 'Accueil', lien: '360-immo-accueil.html' }, 'menu-site-lien'));
    MENU_SITE.forEach(function (entree) { liens.appendChild(creerLien(entree, 'menu-site-lien')); });
    panneau.querySelector('.menu-site-fermer').addEventListener('click', fermer);

    document.body.appendChild(fond);
    document.body.appendChild(panneau);
  }

  function ouvrir() {
    if (!panneau) return;
    panneau.classList.add('ouvert');
    fond.classList.add('ouvert');
    bouton.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    panneau.querySelector('.menu-site-fermer').focus({ preventScroll: true });
  }

  function fermer() {
    if (!panneau || !panneau.classList.contains('ouvert')) return;
    panneau.classList.remove('ouvert');
    fond.classList.remove('ouvert');
    bouton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (panneau.contains(document.activeElement)) bouton.focus({ preventScroll: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    observateur.disconnect();
    remplirTout();
    var nav = document.querySelector('body > nav');
    // Pas de barre du haut (connexion) ou menu ☰ propre à la page (Mon Espace) : rien à ajouter
    if (!nav || !nav.querySelector('.nav-links') || nav.querySelector('.nav-menu-btn')) return;
    bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'nav-menu-btn';
    bouton.setAttribute('aria-label', 'Ouvrir le menu');
    bouton.setAttribute('aria-controls', 'menuSite');
    bouton.setAttribute('aria-expanded', 'false');
    bouton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
    bouton.addEventListener('click', ouvrir);
    nav.insertBefore(bouton, nav.firstChild);
    creerPanneau();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
    // Écran agrandi (rotation, fenêtre élargie) : le bouton disparaît, le panneau se referme
    window.addEventListener('resize', function () { if (!bouton.offsetParent) fermer(); });
  });

  return { ouvrir: ouvrir, fermer: fermer };
})();

// ── Petit message en bas de l'écran, qui disparaît tout seul ──
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

// ── Bandeau « Démonstration » ──
// La connexion et Mon Espace de la maquette sont fictifs (compte « Kamika ») : les vrais comptes sont sur le
// nouveau site. Un bandeau le rappelle en bas de ces deux pages.
var NOUVEAU_SITE = 'https://360-immo.vercel.app';
document.addEventListener('DOMContentLoaded', function () {
  var page = location.pathname.split('/').pop();
  if (page !== '360-immo-login.html' && page !== '360-immo-mon-espace.html') return;
  var bandeau = document.createElement('div');
  bandeau.className = 'bandeau-demo';
  bandeau.setAttribute('role', 'note');
  bandeau.innerHTML = '<strong>Démonstration</strong> : cette page fait partie de la maquette, avec un compte fictif. ' +
    'Les vrais comptes sont sur le nouveau site : <a href="' + NOUVEAU_SITE + '/connexion">se connecter pour de vrai</a>';
  document.body.appendChild(bandeau);
  // La page garde en bas la place du bandeau (une ou plusieurs lignes selon la largeur de l'écran)
  var place = function () { document.body.style.paddingBottom = bandeau.offsetHeight + 'px'; };
  place();
  window.addEventListener('resize', place);
});
