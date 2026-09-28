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

test('données : 188 villes, 13 communes à Abidjan, 118 quartiers', async ({ page }) => {
  await page.goto('360-immo-estimation.html');
  const r = await page.evaluate(() => ({
    villes: ChoixLieu.villes().length,
    abidjan: ChoixLieu.communes('Abidjan').length,
    quartiers: ChoixLieu.quartiers('Abidjan', '').length,
    yamoussoukro: ChoixLieu.communes('Yamoussoukro'),
  }));
  expect(r).toEqual({ villes: 188, abidjan: 13, quartiers: 118, yamoussoukro: ['Attiégouakro', 'Yamoussoukro'] });
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
