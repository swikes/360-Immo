// Aide au calcul de la surface, prix des annonces, page de connexion.
const { test, expect, appuyer } = require('./outils');

test.describe('Aide au calcul de la surface', () => {
  const fenetre = page => page.getByRole('dialog', { name: 'Comment calculer la surface de votre bien ?' });
  const onglet = (page, nom) => page.locator('.aide-onglet', { hasText: nom });

  test('Publier : la fenêtre s\'ouvre, change d\'onglet et se ferme', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await appuyer(page.locator('.aide-surface-btn'));
    await expect(fenetre(page)).toBeVisible();
    await expect(onglet(page, 'Logement')).toHaveAttribute('aria-pressed', 'true');
    await expect(fenetre(page)).toContainText('longueur × largeur');
    await appuyer(onglet(page, 'Terrain'));
    await expect(fenetre(page)).toContainText('titre foncier');
    await expect(fenetre(page)).toContainText('10 000 m²');
    await appuyer(page.locator('.aide-ok'));
    await expect(fenetre(page)).toBeHidden();
    // Pour un terrain, l'aide s'ouvre directement sur l'onglet « Terrain » ; Échap la ferme
    await appuyer(page.locator('#typeChips .chip', { hasText: 'Terrain' }));
    await appuyer(page.locator('.aide-surface-btn'));
    await expect(onglet(page, 'Terrain')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
  });

  test('Estimation : même aide sous le champ surface', async ({ page }) => {
    await page.goto('360-immo-estimation.html');
    await page.evaluate(() => { setType('terrain'); goStep(3); });
    await appuyer(page.locator('.aide-surface-btn'));
    await expect(fenetre(page)).toBeVisible();
    await expect(onglet(page, 'Terrain')).toHaveAttribute('aria-pressed', 'true');
    await appuyer(page.locator('.aide-fermer'));
    await expect(fenetre(page)).toBeHidden();
  });
});

test('Prix des annonces : même style sur toutes les cartes, chiffres de même hauteur', async ({ page }) => {
  for (const [fichier, prix] of [['360-immo-accueil.html', '.property-card .card-price'], ['360-immo-resultats.html', '.prop-card .card-price']]) {
    await page.goto(fichier);
    const styles = await page.locator(prix).evaluateAll(els => els.map(e => {
      const c = getComputedStyle(e);
      return [c.fontFamily, c.fontSize, c.fontWeight, c.color, c.fontVariantNumeric].join(' | ');
    }));
    expect(styles.length, fichier).toBeGreaterThan(3);
    expect(new Set(styles).size, `${fichier} : ${[...new Set(styles)].join(' // ')}`).toBe(1);
    expect(styles[0]).toContain('lining-nums');
  }
});

test('Connexion : « Retour à l\'accueil » ne touche pas les onglets, même en inscription', async ({ page }) => {
  await page.goto('360-immo-login.html');
  for (const onglet of ['login', 'register']) {
    await page.evaluate(o => switchTab(o), onglet);
    for (const largeur of [320, 390, 768, 1024, 1366]) {
      await page.setViewportSize({ width: largeur, height: 700 });
      const ecart = await page.evaluate(() => {
        const retour = document.querySelector('.back-link').getBoundingClientRect();
        const onglets = document.querySelector('.auth-tabs').getBoundingClientRect();
        return Math.round(onglets.top - retour.bottom);
      });
      expect(ecart, `${onglet} · ${largeur} px : écart entre le lien et les onglets`).toBeGreaterThanOrEqual(16);
    }
  }
});
