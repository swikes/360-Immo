// Pages : chargement sans erreur, redirection de l'accueil, en-tête propre.
const { test, expect, PAGES } = require('./outils');

// Page de connexion : mise en page plein écran, sans barre d'en-tête
const SANS_ENTETE = ['360-immo-login.html'];

test('index.html redirige vers l\'accueil (en gardant les paramètres)', async ({ page }) => {
  await page.goto('index.html?tx=location#test');
  await expect(page).toHaveURL(/360-immo-accueil\.html\?tx=location#test$/);
});

for (const fichier of PAGES) {
  test.describe(fichier, () => {
    test('se charge sans erreur ni fichier manquant', async ({ page }) => {
      const manquants = [];
      page.on('response', r => { if (r.status() >= 400) manquants.push(`${r.status()} ${r.url()}`); });
      const reponse = await page.goto(fichier);
      expect(reponse.status()).toBe(200);
      await expect(page).toHaveTitle(/360-Immo/);
      expect(manquants).toEqual([]);
    });

    test('en-tête sur une ligne, boutons stylés', async ({ page }) => {
      test.skip(SANS_ENTETE.includes(fichier), 'pas de barre d\'en-tête sur cette page');
      await page.goto(fichier);
      const defauts = await page.evaluate(() => {
        const nav = document.querySelector('body > nav');
        if (!nav) return ['pas d\'en-tête <nav>'];
        const n = nav.getBoundingClientRect();
        const out = [];
        for (const e of nav.querySelectorAll('a, button')) {
          if (!e.offsetParent) continue;
          const r = e.getBoundingClientRect(), c = getComputedStyle(e), nom = `« ${e.innerText.trim().slice(0, 20)} »`;
          if (r.top < n.top - 1 || r.bottom > n.bottom + 1) out.push(`${nom} sort de l'en-tête`);
          if (r.right > innerWidth + 1) out.push(`${nom} dépasse à droite`);
          if (c.color === 'rgb(0, 0, 238)' || (e.tagName === 'A' && c.textDecorationLine.includes('underline'))) out.push(`${nom} sans style (lien bleu souligné)`);
        }
        return out;
      });
      expect(defauts).toEqual([]);
    });
  });
}
