// Parcours complets, comme un visiteur : chaque bouton important mène au bon résultat.
const path = require('path');
const { test, expect, estTelephone, appuyer } = require('./outils');

const PHOTO = path.join(__dirname, 'fichiers', 'photo-test.png');

test('Accueil : la recherche (et « Filtres ») ouvre les critères puis lance la recherche', async ({ page }) => {
  await page.goto('360-immo-accueil.html');
  if (estTelephone()) {
    // Bug corrigé : sur mobile, la barre de recherche était masquée par les décors
    await appuyer(page.locator('.mobile-search-filters'));
    await expect(page.locator('#searchSheetOverlay')).toHaveClass(/open/);
    await appuyer(page.locator('#sheetLocation'));
    await page.keyboard.type('coco');
    await appuyer(page.locator('.cl-liste.ouverte .cl-option', { hasText: 'Cocody' }).first());
    await expect(page.locator('#sheetLocation')).toHaveValue('Cocody');
    await appuyer(page.locator('.sheet-search-btn'));
  } else {
    await page.locator('#searchLocation').click();
    await page.keyboard.type('bouak');
    await page.keyboard.press('Enter');
    await expect(page.locator('#searchLocation')).toHaveValue('Bouaké');
    await page.locator('.btn-search').click();
  }
  await expect(page).toHaveURL(/360-immo-resultats\.html/);
});

test('Résultats : « Filtres » ouvre le panneau, les réinitialisations fonctionnent', async ({ page }) => {
  await page.goto('360-immo-resultats.html');
  await appuyer(page.locator('.btn-all-filters'));
  if (estTelephone()) await expect(page.locator('#sidebarFilters')).toHaveClass(/open/);
  else await expect(page.locator('#sidebarFilters')).toHaveClass(/flash/);
  await appuyer(page.locator('.btn-reset-all'));
  await expect(page.locator('#sidebarFilters .pill-sel.on, #sidebarFilters .com-item.on, #sidebarFilters .check-item.checked')).toHaveCount(0);
  await appuyer(page.locator('.btn-apply'));
  await expect(page.locator('#sidebarFilters')).not.toHaveClass(/open/);
});

test('Résultats : une annonce ouvre sa fiche', async ({ page }) => {
  await page.goto('360-immo-resultats.html');
  await appuyer(page.locator('.prop-card .card-title').first());
  await expect(page).toHaveURL(/360-immo-detail-bien\.html/);
});

test('Fiche du bien : réserver une visite', async ({ page }) => {
  await page.goto('360-immo-detail-bien.html');
  await appuyer(page.locator('[onclick="openVisitModal()"]:visible').first());
  await appuyer(page.locator('#visitModal .slot-btn').first());
  await appuyer(page.locator('#slotNextBtn'));
  await page.locator('#visitNom').fill('Awa Koné');
  await page.locator('#visitTel').fill('07 07 07 07 07');
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(page.locator('#visitStep3')).toBeVisible();
});

test('Publier une annonce : les 4 étapes jusqu\'à la confirmation', async ({ page }) => {
  await page.goto('360-immo-publier-annonce.html');
  await page.locator('#surfaceInput').fill('85');
  await page.locator('#prixInput').fill('150000');
  await page.locator('#descriptionInput').fill('Bel appartement lumineux, proche des commerces.');
  await appuyer(page.locator('#nextBtn'));
  await expect(page.locator('#step2')).toBeVisible();
  await appuyer(page.locator('#nextBtn'));
  await page.locator('#vendeurNom').fill('Kamika Immobilier');
  await page.locator('#vendeurTel').fill('07 48 32 11 90');
  await appuyer(page.locator('#nextBtn'));
  await expect(page.locator('#step4')).toBeVisible();
  await appuyer(page.locator('#toggleCGU'));
  await appuyer(page.locator('#nextBtn'));
  await expect(page.locator('#successModal')).toHaveClass(/show/);
});

test('Estimation : les 3 étapes donnent une estimation', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  await appuyer(page.locator('[onclick="goStep(2)"]:visible').first());
  await appuyer(page.locator('[onclick="validerLocalisation()"]:visible').first());
  await appuyer(page.locator('[onclick="launchEstimation()"]'));
  await expect(page.locator('#res-median')).toContainText(/\d[\d\s]* FCFA/, { timeout: 8000 });
});

test('Connexion : redirige vers Mon Espace', async ({ page }) => {
  await page.goto('360-immo-login.html');
  await page.locator('#loginEmail').fill('test@exemple.ci');
  await page.locator('#loginPwd').fill('Motdepasse123!');
  await appuyer(page.locator('#loginBtn'));
  await expect(page).toHaveURL(/360-immo-mon-espace\.html/, { timeout: 8000 });
});

test('Créer un compte : redirige vers Mon Espace', async ({ page }) => {
  await page.goto('360-immo-login.html');
  await appuyer(page.locator('[onclick*="switchTab(\'register\')"]:visible').first());
  for (const [id, v] of [['regPrenom', 'Awa'], ['regNom', 'Koné'], ['regEmail', 'awa@exemple.ci'], ['regPwd', 'Motdepasse123!'], ['regPwdConfirm', 'Motdepasse123!']]) {
    await page.locator('#' + id).fill(v);
  }
  await page.locator('#cguCheck').check({ force: true });
  await appuyer(page.locator('#registerBtn'));
  await expect(page).toHaveURL(/360-immo-mon-espace\.html/, { timeout: 8000 });
});

test('Documents : envoyer une pièce d\'identité', async ({ page }) => {
  await page.goto('360-immo-documents.html');
  await appuyer(page.locator('#type-identite'));
  for (const champ of await page.locator('#section-identite input[type=file]').all()) await champ.setInputFiles(PHOTO);
  await expect(page.locator('#submit-identite')).toBeEnabled();
  await appuyer(page.locator('#submit-identite'));
  await expect(page.locator('#successModal')).toBeVisible({ timeout: 6000 });
});

test('Mon Espace : le menu ouvre chaque section', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  for (const section of ['annonces', 'favoris', 'messages', 'alertes', 'profil', 'verification', 'overview']) {
    if (estTelephone()) await appuyer(page.locator('.nav-menu-btn'));   // menu ☰ sur téléphone
    await appuyer(page.locator(`#sidebar [onclick="goTo('${section}')"]`));
    await expect(page.locator('#section-' + section)).toBeVisible();
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  }
});

test('Mon Espace : une carte de favori ouvre l\'annonce, le ♥ la retire', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  await page.evaluate(() => goTo('favoris'));
  await appuyer(page.locator('.fav-card .fav-remove').first());
  await expect(page.locator('#section-favoris .page-sub')).toHaveText('4 biens sauvegardés');
  await expect(page).toHaveURL(/360-immo-mon-espace\.html/);
  await appuyer(page.locator('.fav-card .fav-title').first());
  await expect(page).toHaveURL(/360-immo-detail-bien\.html/);
});

test('Mon Espace : envoyer un message', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  await page.evaluate(() => goTo('messages'));
  const avant = await page.locator('.bubble.me').count();
  await page.locator('#msgInput').fill('Bonjour, le bien est-il disponible ?');
  await appuyer(page.locator('[onclick="sendMessage()"]'));
  await expect(page.locator('.bubble.me')).toHaveCount(avant + 1);
});
