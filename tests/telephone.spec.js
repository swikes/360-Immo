// Numéros de téléphone de tous les pays : choix de l'indicatif, vérification selon le pays (js/telephone.js).
const { test, expect, appuyer } = require('./outils');

const bouton = (page, id) => page.locator(`#${id}`).locator('xpath=preceding-sibling::button[1]');

test('Publier : choisir la France dans la liste, numéro vérifié selon le pays', async ({ page }) => {
  await page.goto('360-immo-publier-annonce.html');
  await page.evaluate(() => goStep(3));
  const tel = page.locator('#vendeurTel');
  await expect(bouton(page, 'vendeurTel')).toContainText('+225');          // Côte d'Ivoire par défaut
  await appuyer(bouton(page, 'vendeurTel'));
  await expect(page.locator('.tel-liste')).toBeVisible();
  await expect(page.locator('.tel-option').first()).toContainText("Côte d'Ivoire");   // pays fréquents en tête
  await page.locator('.tel-recherche').fill('fran');
  await appuyer(page.locator('.tel-option', { hasText: 'France' }));
  await expect(page.locator('.tel-liste')).toBeHidden();
  await expect(bouton(page, 'vendeurTel')).toContainText('+33');
  await tel.fill('0612');
  await page.locator('#vendeurNom').fill('Jean Kouassi');
  await appuyer(page.locator('#nextBtn'));
  await expect(page.locator('.message-erreur', { hasText: 'France, +33' })).toBeVisible();
  await tel.fill('06 12 34 56 78');
  await appuyer(page.locator('#nextBtn'));
  await expect(page.locator('#step4')).toBeVisible();
});

test('Un numéro saisi avec son indicatif choisit le pays tout seul', async ({ page }) => {
  await page.goto('360-immo-detail-bien.html');
  await page.evaluate(() => { openVisitModal(); selectSlot(document.querySelector('.slot-btn')); visitGoStep(2); });
  const tel = page.locator('#visitTel');
  await tel.fill('+226 70 12 34 56');
  await page.locator('#visitNom').fill('Awa Koné');                       // quitter le champ
  await expect(bouton(page, 'visitTel')).toContainText('+226');
  await expect(tel).toHaveValue('70 12 34 56');
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(page.locator('#visitStep3')).toBeVisible();
});

test('Inscription : numéro obligatoire, indicatif dans l\'aperçu', async ({ page }) => {
  await page.goto('360-immo-login.html');
  await page.evaluate(() => switchTab('register'));
  for (const [id, v] of [['regPrenom', 'Awa'], ['regNom', 'Koné'], ['regEmail', 'awa@exemple.ci'], ['regPwd', 'Motdepasse123!'], ['regPwdConfirm', 'Motdepasse123!']]) {
    await page.locator('#' + id).fill(v);
  }
  await page.locator('#cguCheck').check({ force: true });
  await appuyer(page.locator('#registerBtn'));
  await expect(page.locator('#regPhoneErr')).toBeVisible();              // numéro manquant
  await expect(page).toHaveURL(/360-immo-login\.html/);
  await appuyer(page.locator('#phone1Row .phone-flag-btn'));
  await page.locator('.tel-recherche').fill('+33');
  await page.keyboard.press('Enter');
  await page.locator('#regPhone1').fill('6 12 34 56 78');
  await expect(page.locator('#previewContent')).toContainText('+33 6 12 34 56 78');
  await expect(page.locator('#regPhoneErr')).toBeHidden();
  await appuyer(page.locator('#registerBtn'));
  await expect(page).toHaveURL(/360-immo-mon-espace\.html/, { timeout: 8000 });
});

test('Mon Espace : le numéro enregistré avec +225 garde la Côte d\'Ivoire', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  await page.evaluate(() => goTo('profil'));
  await expect(bouton(page, 'profilTel')).toContainText('+225');
  await expect(page.locator('#profilTel')).toHaveValue('07 48 32 11 90');
});
