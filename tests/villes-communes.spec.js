// Villes, communes et quartiers : la recherche tolère accents, tirets, apostrophes ; les champs sont liés.
const { test, expect } = require('./outils');

test.beforeEach(() => test.skip(test.info().project.name !== 'ordinateur', 'logique indépendante de l\'appareil'));

const CAS = [
  ['bouake', 'Bouaké'],
  ['BOUAKÉ', 'Bouaké'],
  ['port bouet', 'Port-Bouët'],
  ['portbouet', 'Port-Bouët'],
  ['mbah', "M'Bahiakro"],
  ["m'bah", "M'Bahiakro"],
  ['coco', 'Cocody'],
  ['san pedro', 'San-Pédro'],
  ['tie ndiekro', "Tié-N'Diékro"],
  ['attie', 'Attiégouakro'],
];

test('données : 188 villes, 13 communes à Abidjan, 119 quartiers', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  const r = await page.evaluate(() => ({
    villes: ChoixLieu.villes().length,
    abidjan: ChoixLieu.communes('Abidjan').length,
    quartiers: ChoixLieu.quartiers('Abidjan', '').length,
    yamoussoukro: ChoixLieu.communes('Yamoussoukro'),
  }));
  expect(r).toEqual({ villes: 188, abidjan: 13, quartiers: 119, yamoussoukro: ['Attiégouakro', 'Yamoussoukro'] });
});

test('recherche tolérante (accents, majuscules, tirets, apostrophes)', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  for (const [saisie, attendu] of CAS) {
    const premier = await page.evaluate(q => ChoixLieu.chercher(q)[0]?.libelle, saisie);
    expect(premier, `« ${saisie} »`).toBe(attendu);
  }
  expect(await page.evaluate(() => ChoixLieu.chercher('abidjan').length)).toBe(14);  // la ville + ses 13 communes
  expect(await page.evaluate(() => ChoixLieu.chercher('zzz').length)).toBe(0);
});

test('Publier : la ville filtre les communes, la commune remplit la ville', async ({ page }) => {
  await page.goto('360-immo-publier-annonce.html');
  const ville = page.locator('#villeInput'), commune = page.locator('#communeInput');
  await ville.click(); await page.keyboard.type('bouak'); await page.keyboard.press('Enter');
  await expect(ville).toHaveValue('Bouaké');
  await expect(commune).toHaveValue('Bouaké');            // une seule commune : remplie d'office
  await expect(page.locator('#recapLoc')).toHaveText('Bouaké');
  await ville.fill(''); await page.keyboard.press('Tab');
  await commune.click(); await page.keyboard.type('coco'); await page.keyboard.press('Enter');
  await expect(commune).toHaveValue('Cocody');
  await expect(ville).toHaveValue('Abidjan');            // la commune remplit la ville
});

test('Publier : quartier choisi dans la liste des quartiers de la commune', async ({ page }) => {
  await page.goto('360-immo-publier-annonce.html');
  const q = page.locator('#quartierInput'), commune = page.locator('#communeInput');
  await expect(page.locator('#blocQuartier')).toBeVisible();            // Abidjan, Marcory : quartiers connus
  await q.click(); await page.keyboard.type('bietr'); await page.keyboard.press('Enter');
  await expect(q).toHaveValue('Biétry');
  await expect(page.locator('#recapDetails')).toContainText('Biétry');
  // Un quartier d'une autre commune de la ville met la commune à jour
  await commune.fill(''); await page.keyboard.press('Tab');
  await q.click(); await q.fill(''); await page.keyboard.type('palmer'); await page.keyboard.press('Enter');
  await expect(q).toHaveValue('Riviera Palmeraie');
  await expect(commune).toHaveValue('Cocody');
  // Quartier inconnu : refusé à l'étape suivante
  await q.fill('Quartier imaginaire');
  await page.evaluate(() => verifierEtape(1));
  await expect(page.locator('.message-erreur', { hasText: 'quartier de la liste' })).toBeVisible();
  // Ville sans liste de quartiers : le champ disparaît, l'adresse reste
  const ville = page.locator('#villeInput');
  await ville.click(); await page.keyboard.type('korho'); await page.keyboard.press('Enter');
  await expect(page.locator('#blocQuartier')).toBeHidden();
  await expect(page.locator('#adresseInput')).toBeVisible();
});

test('Estimation : quartiers liés à la commune, masqués hors d\'Abidjan', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  await page.evaluate(() => goStep(2));
  const q = page.locator('#f-quartier');
  await q.click(); await page.keyboard.type('rivi'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(q).toHaveValue('Riviera 2');
  await expect(page.locator('#f-commune')).toHaveValue('Cocody');
  expect(await page.evaluate(() => state.quartier)).toBe('riviera2');
  const ville = page.locator('#f-ville');
  await ville.click(); await page.keyboard.type('korho'); await page.keyboard.press('Enter');
  await expect(page.locator('#blocQuartier')).toBeHidden();
  await expect(q).toHaveValue('');
});

test('Recherche par quartier : quartiers proposés en tapant, lieu reconnu au bon niveau', async ({ page }) => {
  await page.goto('360-immo-accueil.html');
  const r = await page.evaluate(() => ({
    riviera: ChoixLieu.chercher('rivi', { quartiers: true }).slice(0, 2).map(e => `${e.libelle} | ${e.detail}`),
    sansQuartiers: ChoixLieu.chercher('rivi').length,
    divo: ChoixLieu.trouver('divo'),                    // la ville, pas le quartier de Koumassi
    cocody: ChoixLieu.trouver('COCODY'),
    riviera2: ChoixLieu.trouver('riviera 2, cocody'),
    remblais: ChoixLieu.trouver('Remblais'),            // à Koumassi et à Marcory : commune non devinée
    inconnu: ChoixLieu.trouver('Chez Tantie Awa'),
  }));
  expect(r.riviera).toEqual(['Riviera 1 | Quartier · Cocody', 'Riviera 2 | Quartier · Cocody']);
  expect(r.sansQuartiers).toBe(0);
  expect(r.divo).toMatchObject({ type: 'ville', ville: 'Divo' });
  expect(r.cocody).toMatchObject({ type: 'commune', ville: 'Abidjan', commune: 'Cocody', texte: 'Cocody' });
  expect(r.riviera2).toMatchObject({ type: 'quartier', commune: 'Cocody', quartier: 'Riviera 2', texte: 'Riviera 2, Cocody' });
  expect(r.remblais).toMatchObject({ type: 'quartier', commune: null, quartier: 'Remblais' });
  expect(r.inconnu).toBeNull();
});

test('Recherche par quartier : de l\'accueil aux résultats, qui ne gardent que ce quartier', async ({ page }) => {
  await page.goto('360-immo-accueil.html');
  await page.locator('.search-tab', { hasText: 'Louer' }).click();
  const lieu = page.locator('#searchLocation');
  await lieu.click(); await page.keyboard.type('riviera 2');
  await expect(page.locator('.cl-liste.ouverte .cl-option').first()).toContainText('Riviera 2Quartier · Cocody');
  await page.keyboard.press('Enter');
  await expect(lieu).toHaveValue('Riviera 2, Cocody');
  await page.locator('.btn-search').click();
  await expect(page).toHaveURL(/tx=location.*q=Riviera\+2%2C\+Cocody/);
  const cartes = page.locator('#propertyGrid .prop-card:visible');
  await expect(cartes).toHaveCount(1);
  await expect(cartes).toContainText('Cocody Riviera 2');
  await expect(page.locator('#filtresActifs .filter-chip').first()).toHaveText('📍 Riviera 2, Cocody×');
  // Commune entière : Marcory ; puis on retire le lieu
  const champ = page.locator('#navSearchInput');
  await champ.click(); await champ.fill(''); await page.keyboard.type('marcory'); await page.keyboard.press('Enter');
  await expect(champ).toHaveValue('Marcory');
  await expect(cartes).toHaveCount(1);
  await expect(cartes).toContainText('Marcory Zone 4');
  await page.locator('#filtresActifs .filter-chip', { hasText: 'Marcory' }).click();
  await expect(champ).toHaveValue('');
  await expect(cartes).toHaveCount(2);                  // toutes les locations au mois
});
