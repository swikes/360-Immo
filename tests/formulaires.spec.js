// Formulaires : un envoi incomplet ou invalide est refusé avec un message sous le champ.
const { test, expect, estTelephone, appuyer } = require('./outils');

const erreurs = page => page.locator('.message-erreur');

test('Visite : nom et téléphone obligatoires, message effacé à la correction', async ({ page }) => {
  await page.goto('360-immo-detail-bien.html');
  await page.evaluate(() => { openVisitModal(); selectSlot(document.querySelector('.slot-btn')); visitGoStep(2); });
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(erreurs(page)).toHaveCount(2);
  await expect(page.locator('#visitStep3')).toBeHidden();
  await page.locator('#visitNom').fill('Awa Koné');
  await expect(erreurs(page)).toHaveCount(1);
  await page.locator('#visitTel').fill('0707');
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(erreurs(page)).toContainText(['10 chiffres']);
  await page.locator('#visitTel').fill('+225 07 07 07 07 07');
  await page.locator('#visitEmail').fill('awa@');
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(erreurs(page)).toContainText(['email']);
  await page.locator('#visitEmail').fill('');
  await appuyer(page.locator('[onclick="confirmerVisite()"]'));
  await expect(page.locator('#visitStep3')).toBeVisible();
});

test('Contacter l\'agence : nom, message et un moyen de contact', async ({ page }) => {
  test.skip(estTelephone(), 'formulaire masqué sur téléphone (design actuel)');
  await page.goto('360-immo-detail-bien.html');
  await page.evaluate(() => toggleMsg());
  await page.locator('#msgText').fill('');
  await page.evaluate(() => sendMessage());
  await expect(erreurs(page)).toHaveCount(3);
  await page.locator('#msgNom').fill('Yao');
  await page.locator('#msgEmail').fill('yao@exemple.ci');
  await page.locator('#msgText').fill('Bonjour, le bien est-il disponible ?');
  await page.evaluate(() => sendMessage());
  await expect(erreurs(page)).toHaveCount(0);
  await expect(page.locator('#msgForm')).not.toHaveClass(/open/);
});

test('Alerte : email obligatoire, téléphone facultatif mais valide', async ({ page }) => {
  await page.goto('360-immo-resultats.html');
  await appuyer(page.locator('[onclick*="alerteModal"]:visible').first());
  await appuyer(page.locator('[onclick="confirmAlerte()"]'));
  await expect(erreurs(page)).toHaveCount(1);
  await page.locator('#alerteEmail').fill('awa@exemple.ci');
  await page.locator('#alerteTel').fill('12');
  await appuyer(page.locator('[onclick="confirmAlerte()"]'));
  await expect(erreurs(page)).toHaveCount(1);
  await page.locator('#alerteTel').fill('');
  await appuyer(page.locator('[onclick="confirmAlerte()"]'));
  await expect(page.locator('#alerteModal')).toContainText('Alerte créée');
});

test('Publier : chaque étape est vérifiée, impossible de sauter une étape incomplète', async ({ page }) => {
  await page.goto('360-immo-publier-annonce.html');
  await appuyer(page.locator('#step4-btn'));               // saut direct : bloqué à l'étape 1
  expect(await page.evaluate(() => currentStep)).toBe(1);
  await expect(erreurs(page)).toHaveCount(3);              // surface, prix, description
  await page.locator('#villeInput').fill('Paris');
  await page.keyboard.press('Escape');
  await appuyer(page.locator('#nextBtn'));
  await expect(erreurs(page)).toContainText(['ville dans la liste']);
  await page.evaluate(() => {
    for (const [id, v] of [['villeInput', 'Abidjan'], ['communeInput', 'Cocody']]) {
      const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.locator('#surfaceInput').fill('85');
  await page.locator('#prixInput').fill('150000');
  await page.locator('#descriptionInput').fill('Bel appartement lumineux, proche des commerces.');
  await appuyer(page.locator('#nextBtn'));
  await appuyer(page.locator('#nextBtn'));                 // photos : facultatives
  await appuyer(page.locator('#nextBtn'));                 // contact vide : bloqué
  expect(await page.evaluate(() => currentStep)).toBe(3);
  await expect(erreurs(page)).toHaveCount(2);
  await page.locator('#vendeurNom').fill('Kamika Immobilier');
  await page.locator('#vendeurTel').fill('07 48 32 11 90');
  await appuyer(page.locator('#nextBtn'));
  await appuyer(page.locator('#nextBtn'));                 // CGU non acceptées : bloqué
  await expect(erreurs(page)).toContainText(['Conditions Générales']);
  await expect(page.locator('#successModal')).not.toHaveClass(/show/);
  await appuyer(page.locator('#step1-btn'));               // retour en arrière : libre
  expect(await page.evaluate(() => currentStep)).toBe(1);
});

test('Mon Espace : profil et mot de passe vérifiés', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  await page.evaluate(() => goTo('profil'));
  await page.locator('#profilEmail').fill('pas-un-email');
  await page.locator('#profilTel').fill('');
  await appuyer(page.locator('[onclick="sauvegarderProfil()"]'));
  await expect(erreurs(page)).toHaveCount(2);
  await page.locator('#profilEmail').fill('contact@kamika-immo.ci');
  await page.locator('#profilTel').fill('07 48 32 11 90');
  await appuyer(page.locator('[onclick="sauvegarderProfil()"]'));
  await expect(erreurs(page)).toHaveCount(0);

  await page.locator('#mdpNouveau').fill('court');
  await page.locator('#mdpConfirm').fill('autre');
  await appuyer(page.locator('[onclick="changerMotDePasse()"]'));
  await expect(erreurs(page)).toHaveCount(3);             // actuel manquant, trop court, différent
  await page.locator('#mdpActuel').fill('ancien');
  await page.locator('#mdpNouveau').fill('Motdepasse123');
  await page.locator('#mdpConfirm').fill('Motdepasse123');
  await appuyer(page.locator('[onclick="changerMotDePasse()"]'));
  await expect(erreurs(page)).toHaveCount(0);
  await expect(page.locator('#mdpNouveau')).toHaveValue('');
});

test('Mon Espace : un message contenant du HTML est affiché comme du texte', async ({ page }) => {
  await page.goto('360-immo-mon-espace.html');
  await page.evaluate(() => goTo('messages'));
  await page.locator('#msgInput').fill('<img src=x onerror="window.__pirate=1">');
  await page.evaluate(() => sendMessage());
  await expect(page.locator('.bubble.me').last()).toContainText('<img');
  expect(await page.evaluate(() => window.__pirate)).toBeUndefined();
});

test('Estimation : ville de la liste et surface valide obligatoires', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  await page.evaluate(() => goStep(2));
  await page.locator('#f-ville').fill('');
  await page.keyboard.press('Escape');
  await page.evaluate(() => validerLocalisation());
  await expect(erreurs(page)).toHaveCount(1);
  expect(await page.evaluate(() => state.step)).toBe(2);
  await page.locator('#f-ville').focus();
  await page.keyboard.type('korhogo');
  await page.keyboard.press('Enter');
  await page.evaluate(() => validerLocalisation());
  expect(await page.evaluate(() => state.step)).toBe(3);
  await page.locator('#f-surface').fill('5');
  await page.evaluate(() => launchEstimation());
  await expect(erreurs(page)).toContainText(['surface']);
});

test('Mot de passe oublié : un email contenant du HTML est refusé', async ({ page }) => {
  await page.goto('360-immo-login.html');
  await page.evaluate(() => openForgot());
  await page.locator('#forgotEmail').fill('<b>x</b>@a.ci');
  await page.evaluate(() => sendReset());
  await expect(page.locator('#forgotEmail')).toBeVisible();   // le formulaire n'a pas été remplacé
});
