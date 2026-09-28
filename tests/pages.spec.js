// Pages : chargement sans erreur, redirection de l'accueil, en-tête propre.
const { test, expect, PAGES, appuyer } = require('./outils');

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

    test('en-tête commun, sur une ligne à toutes les largeurs, boutons stylés', async ({ page }) => {
      test.skip(SANS_ENTETE.includes(fichier), 'pas de barre d\'en-tête sur cette page');
      await page.goto(fichier);
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });   // mesurer sans animation
      const defauts = [];
      // petit téléphone, téléphone, tablette, puis de part et d'autre des seuils de css/commun.css (900 et 1100 px)
      for (const largeur of [320, 390, 768, 901, 1024, 1101, 1366]) {
        await page.setViewportSize({ width: largeur, height: 800 });
        defauts.push(...(await page.evaluate(largeur => {
          const nav = document.querySelector('body > nav');
          if (!nav) return ['pas d\'en-tête <nav>'];
          const n = nav.getBoundingClientRect();
          const out = [];
          const hauteur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
          if (Math.round(n.height) !== hauteur) out.push(`${largeur} px : en-tête de ${Math.round(n.height)} px au lieu de ${hauteur} px (css/commun.css)`);
          const blocs = [...nav.children].filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
          if (blocs.some((b, i) => i && b.left < blocs[i - 1].right + 8)) out.push(`${largeur} px : des éléments de l'en-tête se touchent`);
          const liens = nav.querySelector('.nav-links');
          const bouton = nav.querySelector('.nav-menu-btn');
          if (liens && !liens.offsetParent && !(bouton && bouton.offsetParent)) out.push(`${largeur} px : menu masqué sans bouton ☰`);
          for (const e of nav.querySelectorAll('a, button')) {
            if (!e.offsetParent) continue;
            const r = e.getBoundingClientRect(), c = getComputedStyle(e), nom = `${largeur} px : « ${e.innerText.trim().slice(0, 20)} »`;
            if (r.top < n.top - 1 || r.bottom > n.bottom + 1) out.push(`${nom} sort de l'en-tête`);
            if (r.right > innerWidth + 1) out.push(`${nom} dépasse à droite`);
            if (c.color === 'rgb(0, 0, 238)' || (e.tagName === 'A' && c.textDecorationLine.includes('underline'))) out.push(`${nom} sans style (lien bleu souligné)`);
          }
          return out;
        }, largeur)));
      }
      expect(defauts).toEqual([]);
    });

    test('même menu que les autres pages, page en cours mise en évidence', async ({ page }) => {
      test.skip(SANS_ENTETE.includes(fichier), 'pas de barre d\'en-tête sur cette page');
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(fichier);
      const liens = page.locator('body > nav .nav-links a');
      await expect(liens).toHaveText(['Acheter', 'Louer', 'Vendre', 'Carte des prix', 'Guide & Blog', '✦ Estimer']);
      const attendu = { 'carte': 'Carte des prix', 'blog': 'Guide & Blog', 'estimation': '✦ Estimer', 'publier-annonce': 'Vendre' }[fichier.replace(/^360-immo-|\.html$/g, '')];
      const actifs = page.locator('body > nav .nav-links a.active');
      if (attendu) await expect(actifs).toHaveText([attendu]);
      else await expect(actifs).toHaveCount(0);
    });

    test('menu ☰ sur téléphone : ouvre les pages du site', async ({ page }) => {
      test.skip(SANS_ENTETE.includes(fichier), 'pas de barre d\'en-tête sur cette page');
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(fichier);
      await expect(page.locator('body > nav .nav-links')).toBeHidden();
      await appuyer(page.locator('body > nav .nav-menu-btn'));
      // Mon Espace : le ☰ ouvre son menu latéral, qui contient aussi les pages du site
      const menu = fichier.includes('mon-espace') ? page.locator('#sidebar') : page.locator('#menuSite');
      await expect(menu).toBeVisible();
      if (!fichier.includes('mon-espace')) {
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await appuyer(page.locator('body > nav .nav-menu-btn'));
      }
      const cible = fichier.includes('carte') ? ['Guide & Blog', /360-immo-blog\.html/] : ['Carte des prix', /360-immo-carte\.html/];
      await appuyer(menu.locator('a', { hasText: cible[0] }));
      await expect(page).toHaveURL(cible[1]);
    });

    test('messages (toast) communs', async ({ page }) => {
      await page.goto(fichier);
      await page.evaluate(() => showToast('Message de test', 'success'));
      const toast = page.locator('#toast');
      await expect(toast).toHaveText('Message de test');
      await expect(toast).toHaveClass(/show/);
      await expect(toast).toHaveCSS('opacity', '1');
      await expect(toast).not.toHaveClass(/show/, { timeout: 5000 });
    });
  });
}
