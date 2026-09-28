// Outils communs aux tests.
const base = require('@playwright/test');

const SERVEUR = 'http://127.0.0.1:8765/';

// Les 10 pages du site
const PAGES = [
  'accueil', 'blog', 'carte', 'detail-bien', 'documents',
  'estimation', 'login', 'mon-espace', 'publier-annonce', 'resultats',
].map(p => `360-immo-${p}.html`);

// États à contrôler sur téléphone : étapes, fenêtres, sections (code exécuté dans la page)
const ETATS = {
  'accueil': { 'départ': '', 'recherche mobile': 'openSearchSheet()' },
  'blog': { 'départ': '', 'article': 'openArticle(1)' },
  'carte': { 'départ': '', 'zone choisie': "selectZone('cocody')" },
  'detail-bien': { 'départ': '', 'visite': 'openVisitModal()', 'galerie': 'openLightbox(0)', 'message': 'toggleMsg()' },
  'documents': { 'départ': '', 'identité': "selectType('identite')", 'agence': "selectType('agence')", 'annonce': "selectType('annonce')" },
  'estimation': { 'étape 1': '', 'étape 2': 'goStep(2)', 'étape 3': 'goStep(3)', 'résultat': 'goStep(3); launchEstimation()' },
  'login': { 'connexion': '', 'inscription': "switchTab('register')", 'mot de passe oublié': 'openForgot()' },
  'mon-espace': {
    'vue d\'ensemble': '', 'annonces': "goTo('annonces')", 'favoris': "goTo('favoris')", 'messages': "goTo('messages')",
    'alertes': "goTo('alertes')", 'profil': "goTo('profil')", 'vérification': "goTo('verification')", 'menu ☰': 'openSidebar()',
  },
  'publier-annonce': { 'étape 1': '', 'étape 2': 'goStep(2)', 'étape 3': 'goStep(3)', 'étape 4': 'goStep(4)' },
  'resultats': { 'départ': '', 'filtres': 'openFilters()', 'alerte': "document.getElementById('alerteModal').classList.add('show')" },
};

// Bloque tout ce qui ne vient pas du serveur local (Google Fonts, WhatsApp…) et relève les erreurs JavaScript
async function preparer(page) {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message.split('\n')[0]));
  await page.route('**/*', r => (r.request().url().startsWith(SERVEUR) ? r.continue() : r.abort()));
  return erreurs;
}

// « page » : un test échoue si la page a produit une erreur JavaScript
const test = base.test.extend({
  page: async ({ page }, use) => {
    const erreurs = await preparer(page);
    await use(page);
    base.expect(erreurs, 'erreurs JavaScript pendant le test').toEqual([]);
  },
});

const estTelephone = () => test.info().project.name === 'telephone';

// Toucher sur téléphone, cliquer sur ordinateur (vérifie aussi que rien ne masque l'élément)
async function appuyer(locator) {
  if (estTelephone()) await locator.tap();
  else await locator.click();
}

module.exports = { test, expect: base.expect, PAGES, ETATS, SERVEUR, preparer, estTelephone, appuyer };
