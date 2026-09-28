// Logique des biens : chaque page ne propose que ce qui a un sens pour le type de bien et la transaction
// (règles communes : js/regles-biens.js).
const { test, expect, estTelephone, appuyer } = require('./outils');

const visibles = (page, sel) => page.locator(sel).filter({ visible: true });

test.describe('Publier une annonce', () => {
  const choisir = (page, groupe, texte) => appuyer(page.locator(`#${groupe} .chip`, { hasText: texte }).first());

  test('Terrain : ni meublé, ni pièces, ni chambres, ni étage ; commodités de terrain', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await choisir(page, 'typeChips', 'Terrain');
    for (const id of ['#chip-meuble', '#chip-immeuble', '#etageRow', '#piecesGroup', '#chambresGroup', '#sdbGroup']) await expect(page.locator(id)).toBeHidden();
    await expect(page.locator('#surfaceLabel')).toHaveText('Superficie');
    await expect(visibles(page, '#amenitiesGrid .amenity-item')).toHaveText(['Gardien', 'Terrain clôturé', 'Viabilisé (eau, électricité)', 'Titre foncier (ACD)', 'Accès route bitumée']);
    await expect(page.locator('#sidebarPiecesLigne')).toBeHidden();
  });

  test('Vente : prix total, sans « par jour / mois » ni caution', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await expect(visibles(page, '#parChips .chip')).toHaveText(['Jour', 'Mois', 'Année']);   // location d'un appartement
    await choisir(page, 'transChips', 'À vendre');
    await expect(page.locator('#prixLabel')).toHaveText('Prix de vente');
    await expect(page.locator('#parGroup')).toBeHidden();
    await expect(page.locator('#cautionGroup')).toBeHidden();
    await page.locator('#prixInput').fill('45000000');
    await expect(page.locator('#sidebarPrix')).toHaveText('45 000 000 FCFA');
  });

  test('Villa : jamais dans un immeuble ; bureau : étage seulement s\'il est dans un immeuble', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await expect(page.locator('#etageRow')).toBeVisible();          // appartement : toujours un étage
    await choisir(page, 'typeChips', 'Villa');
    await expect(page.locator('#chip-immeuble')).toBeHidden();
    await expect(page.locator('#etageRow')).toBeHidden();
    await choisir(page, 'typeChips', 'Bureau');
    await expect(page.locator('#chambresGroup')).toBeHidden();
    await expect(page.locator('#sdbLabel')).toHaveText('Toilettes');
    await expect(page.locator('#etageRow')).toBeHidden();
    await appuyer(page.locator('#chip-immeuble'));
    await expect(page.locator('#etageRow')).toBeVisible();
    await expect(visibles(page, '#parChips .chip')).toHaveText(['Mois', 'Année']);   // pas de bureau à la journée
  });

  test('Chambre d\'hôtel : location uniquement, à la nuit', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await choisir(page, 'transChips', 'À vendre');
    await choisir(page, 'typeChips', "Chambre d'hôtel");
    await expect(page.locator('#transChips .chip.selected')).toHaveText('À louer');
    await expect(page.locator('#transNote')).toBeVisible();
    await expect(visibles(page, '#parChips .chip')).toHaveText(['Nuit']);
  });

  test('Résumé en cours : le nombre de pièces et de chambres suit le formulaire', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    await expect(page.locator('#sidebarPieces')).toHaveText('2 pièces — 1 ch.');
    await choisir(page, 'piecesChips', '4');
    await expect(page.locator('#chambres')).toHaveValue('3');         // séjour + 3 chambres
    await expect(page.locator('#sidebarPieces')).toHaveText('4 pièces — 3 ch.');
    await appuyer(page.locator('[onclick="changeNum(\'chambres\',1)"]'));   // 4 chambres dans 4 pièces : impossible
    await expect(page.locator('#chambres')).toHaveValue('3');
    await appuyer(page.locator('[onclick="changeNum(\'chambres\',-1)"]'));
    await expect(page.locator('#sidebarPieces')).toHaveText('4 pièces — 2 ch.');
    await choisir(page, 'piecesChips', 'Studio');
    await expect(page.locator('#sidebarPieces')).toHaveText('Studio — sans chambre séparée');
    await choisir(page, 'typeChips', 'Maison');                        // pas de « studio » pour une maison
    await expect(page.locator('#piecesChips .chip.selected')).toHaveText('1');
    await expect(page.locator('#sidebarType')).toHaveText('Maison');
  });
});

test.describe('Résultats', () => {
  const cartes = page => visibles(page, '#propertyGrid .prop-card');

  test('Menu : Acheter → annonces à vendre, Louer → à louer, Vendre → publier', async ({ page }) => {
    await page.goto('360-immo-resultats.html?tx=achat');
    await expect(cartes(page).locator('.cbadge-louer')).toHaveCount(0);
    await expect(cartes(page)).toHaveCount(await cartes(page).locator('.cbadge-vendre').count());
    await expect(page.locator('#budgetTitre')).toHaveText('Prix de vente (FCFA)');
    await page.goto('360-immo-resultats.html?tx=location');
    await expect(cartes(page).locator('.cbadge-vendre')).toHaveCount(0);
    await expect(page.locator('#budgetTitre')).toHaveText('Loyer par mois (FCFA)');
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.locator('body > nav .nav-links a', { hasText: 'Vendre' }).click();
    await expect(page).toHaveURL(/360-immo-publier-annonce\.html/);
  });

  test('Sans transaction, pas de budget : un loyer et un prix de vente ne se comparent pas', async ({ page }) => {
    await page.goto('360-immo-resultats.html');
    await expect(page.locator('#budgetNote')).toBeAttached();
    await expect(page.locator('#budgetChamps')).toBeHidden();
    await expect(cartes(page)).toHaveCount(6);
  });

  test('Terrain : ni pièces, ni chambres, ni meublé ; seulement les terrains', async ({ page }) => {
    await page.goto('360-immo-resultats.html?type=terrain');
    for (const id of ['#groupePieces', '#groupeChambres', '[data-pref="meuble"]']) await expect(page.locator(id)).toBeHidden();
    await expect(page.locator('#groupeCommodites .com-item', { hasText: 'Titre foncier (ACD)' })).toBeAttached();
    await expect(cartes(page)).toHaveCount(1);
    await expect(cartes(page)).toContainText('Terrain');
  });

  test('3 pièces : 3 chambres ou plus impossibles, terrains et bureaux écartés', async ({ page }) => {
    await page.goto('360-immo-resultats.html');
    if (estTelephone()) await appuyer(page.locator('.btn-all-filters'));
    await appuyer(page.locator('#groupePieces .pill-sel', { hasText: '3' }));
    await expect(page.locator('#groupeChambres .pill-sel.indispo')).toHaveText(['3', '4', '5+']);
    await expect(cartes(page)).toHaveCount(1);
    await expect(page.locator('#filtresActifs .filter-chip')).toHaveText(['3 pièces×']);
  });
});

test.describe('Accueil', () => {
  test('« Vendre » mène à la publication d\'une annonce', async ({ page }) => {
    await page.goto('360-immo-accueil.html');
    if (estTelephone()) {
      await appuyer(page.locator('.mobile-search-filters'));
      await appuyer(page.locator('#sheetTabVendre'));
    } else await page.locator('.search-tab', { hasText: 'Vendre' }).click();
    await expect(page).toHaveURL(/360-immo-publier-annonce\.html/);
  });

  test('Terrain à louer : critères adaptés, transmis aux résultats', async ({ page }) => {
    await page.goto('360-immo-accueil.html');
    if (estTelephone()) {
      await appuyer(page.locator('.mobile-search-filters'));
      await appuyer(page.locator('#sheetTabLouer'));
      await appuyer(page.locator('#sheetTypeChips .sheet-chip', { hasText: 'Terrain' }));
      for (const id of ['#sheetPiecesField', '#sheetChambresField', '#sheetBtnJournaliere']) await expect(page.locator(id)).toBeHidden();
      await expect(page.locator('#sheetBudgetLabel')).toHaveText('Loyer (FCFA / mois)');
      await appuyer(page.locator('.sheet-search-btn'));
    } else {
      await page.locator('.search-tab', { hasText: 'Louer' }).click();
      await page.locator('#searchType').selectOption('Terrain');
      await page.locator('#advToggleBtn').click();
      for (const id of ['#advPieces', '#advChambres', '#prefMeuble', '#immeubleToggle', '#btnJournaliere']) await expect(page.locator(id)).toBeHidden();
      await expect(page.locator('#budgetLabel')).toHaveText('Loyer max (FCFA / mois)');
      await page.locator('.btn-search').click();
    }
    await expect(page).toHaveURL(/tx=location.*type=terrain/);
    await expect(page.locator('#groupeTypes [data-type="Terrain"]')).toHaveClass(/checked/);
  });
});

test.describe('Mêmes types de biens partout', () => {
  const TYPES = ['Appartement', 'Maison', 'Villa', 'Terrain', 'Bureau', 'Commerce / Magasin', 'Immeuble', "Chambre d'hôtel", 'Autres'];
  const textes = (page, sel) => page.locator(sel).evaluateAll(els => els.map(e => e.textContent.trim()));

  test('Publication, recherche de l\'accueil et filtres des résultats proposent la même liste', async ({ page }) => {
    await page.goto('360-immo-publier-annonce.html');
    expect(await page.evaluate(() => ReglesBiens.TYPES)).toEqual(TYPES);
    expect(await textes(page, '#typeChips .chip')).toEqual(TYPES);
    await page.goto('360-immo-accueil.html');
    expect(await textes(page, '#searchType option:not([value=""])')).toEqual(TYPES);
    expect(await textes(page, '#sheetTypeChips .sheet-chip')).toEqual(TYPES);
    await page.goto('360-immo-resultats.html');
    expect(await page.locator('#groupeTypes .check-item').evaluateAll(els => els.map(e => e.dataset.type))).toEqual(TYPES);
  });

  test('Chambre d\'hôtel : ne s\'achète pas, se loue à la nuit', async ({ page }) => {
    await page.goto('360-immo-accueil.html');
    if (estTelephone()) {
      await appuyer(page.locator('.mobile-search-filters'));
      const hotel = page.locator('#sheetTypeChips .sheet-chip', { hasText: "Chambre d'hôtel" });
      await expect(hotel).toBeHidden();                                   // Acheter
      await appuyer(page.locator('#sheetTabLouer'));
      await appuyer(hotel);
      await expect(page.locator('#sheetBtnMensuelle')).toBeHidden();
      await expect(page.locator('#sheetBtnJournaliere')).toHaveClass(/\bon\b/);
      await expect(page.locator('#sheetBudgetLabel')).toHaveText('Loyer (FCFA / nuit)');
      await appuyer(page.locator('.sheet-search-btn'));
    } else {
      await expect(page.locator('#searchType option', { hasText: "Chambre d'hôtel" })).toBeDisabled();   // Acheter
      await page.locator('.search-tab', { hasText: 'Louer' }).click();
      await page.locator('#searchType').selectOption("Chambre d'hôtel");
      await expect(page.locator('#btnMensuelle')).toBeHidden();
      await expect(page.locator('#btnJournaliere')).toHaveClass(/active/);
      await expect(page.locator('#budgetLabel')).toHaveText('Loyer max (FCFA / nuit)');
      await page.locator('.btn-search').click();
    }
    await expect(page).toHaveURL(/tx=location&duree=jour&type=hotel/);
    await expect(page.locator('#groupeTypes [data-type="Chambre d\'hôtel"]')).toHaveClass(/checked/);
    await expect(page.locator('#rangeeDuree [data-duree="mois"]')).toBeHidden();
    // À l'achat, la chambre d'hôtel disparaît des filtres
    await page.goto('360-immo-resultats.html?tx=achat');
    await expect(page.locator('#groupeTypes [data-type="Chambre d\'hôtel"]')).toBeHidden();
    await expect(page.locator('#groupeTypes [data-type="Autres"]')).toBeAttached();
  });

  test('Maison et Villa sont deux types distincts, de l\'accueil aux résultats', async ({ page }) => {
    await page.goto('360-immo-resultats.html?type=villa');
    await expect(page.locator('#groupeTypes .check-item.checked')).toHaveCount(1);
    await expect(page.locator('#groupeTypes [data-type="Villa"]')).toHaveClass(/checked/);
    await page.goto('360-immo-resultats.html?type=maison');
    await expect(page.locator('#groupeTypes .check-item.checked')).toHaveCount(1);
    await expect(page.locator('#groupeTypes [data-type="Maison"]')).toHaveClass(/checked/);
  });
});

test('Estimation : un terrain n\'a ni pièces, ni chambres, ni étage, ni meublé', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  await page.evaluate(() => { setType('terrain'); goStep(3); });
  await expect(page.locator('#surfaceLabel')).toHaveText('Superficie du terrain');
  for (const id of ['#groupePieces', '#groupeChambres', '#groupeEtage', '#groupeMeuble', '#groupeEtat']) await expect(page.locator(id)).toBeHidden();
  await page.evaluate(() => setType('maison'));
  await expect(page.locator('#groupeEtage')).toBeHidden();              // une maison n'est pas dans un immeuble
  await expect(page.locator('#groupeChambres')).toBeVisible();
});
