// Aide au calcul de la surface, prix des annonces, page de connexion, montants sur iPhone, listes de lieux.
const { test, expect, appuyer, PAGES, estTelephone } = require('./outils');

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

test('iPhone : les montants ne deviennent pas des numéros de téléphone (bleus, soulignés)', async ({ page }) => {
  // Safari sur iPhone prend « 85 000 000 » pour un numéro et le souligne en bleu, sauf si la page le lui interdit
  for (const fichier of PAGES) {
    await page.goto(fichier);
    await expect(page.locator('meta[name="format-detection"]'), fichier).toHaveAttribute('content', /telephone=no/);
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

test('Connexion et Mon Espace de la maquette : bandeau « Démonstration » vers les vrais comptes du nouveau site', async ({ page }) => {
  for (const fichier of ['360-immo-login.html', '360-immo-mon-espace.html']) {
    await page.goto(fichier);
    const bandeau = page.locator('.bandeau-demo');
    await expect(bandeau, fichier).toBeVisible();
    await expect(bandeau).toContainText('Démonstration');
    await expect(bandeau.getByRole('link', { name: 'se connecter pour de vrai' })).toHaveAttribute('href', 'https://360-immo.vercel.app/connexion');
    // Le bandeau ne cache pas le bas de la page (la page a de la place pour lui)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bas = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    expect(bas, fichier).toBeGreaterThanOrEqual(await bandeau.evaluate((e) => e.getBoundingClientRect().height));
  }
  await page.goto('360-immo-accueil.html');
  await expect(page.locator('.bandeau-demo')).toHaveCount(0);
});

test.describe('Téléphone : la liste des lieux ne cache jamais le champ, même clavier ouvert', () => {
  // Clavier ouvert simulé : la partie visible de l'écran ne fait plus que 364 px de haut
  test.beforeEach(async ({ page }) => {
    test.skip(!estTelephone(), 'téléphone seulement');
    await page.addInitScript(() => {
      const vv = { offsetTop: 0, offsetLeft: 0, width: innerWidth, height: 364, scale: 1, addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(window, 'visualViewport', { get: () => vv });
    });
  });
  const verifier = async (page, champ) => {
    await page.waitForTimeout(300);
    const { i, l } = await page.evaluate(id => {
      const b = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { i: b(document.getElementById(id)), l: b(document.querySelector('.cl-liste.ouverte')) };
    }, champ);
    expect(l.top, 'la liste commence sous le champ').toBeGreaterThanOrEqual(i.bottom);
    expect(l.bottom, 'la liste s\'arrête au-dessus du clavier').toBeLessThanOrEqual(364);
    expect(i.top, 'le champ reste visible').toBeGreaterThanOrEqual(68);
    expect(l.bottom - l.top, 'assez de place pour plusieurs lieux').toBeGreaterThan(90);
  };

  test('Publier : champ Quartier en bas de l\'écran', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    await page.locator('#quartierInput').evaluate(e => window.scrollBy(0, e.getBoundingClientRect().top - 300));
    await appuyer(page.locator('#quartierInput'));
    await verifier(page, 'quartierInput');
  });

  test('Accueil : lieu dans l\'onglet « Louer » du volet de recherche', async ({ page }) => {
    await page.goto('360-immo-accueil.html');
    await appuyer(page.locator('.mobile-search-filters'));
    await appuyer(page.locator('#sheetTabLouer'));
    await appuyer(page.locator('#sheetLocation'));
    await verifier(page, 'sheetLocation');
  });
});
