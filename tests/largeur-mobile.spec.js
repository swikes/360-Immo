// Téléphone : aucune page ne doit être plus large que l'écran (sinon le téléphone dézoome tout).
const { test, expect, devices } = require('@playwright/test');
const { ETATS, SERVEUR, preparer } = require('./outils');

const LARGEURS = [320, 390];   // petit téléphone, téléphone courant

test.beforeEach(() => test.skip(test.info().project.name !== 'telephone', 'contrôle propre au téléphone'));

for (const [page, etats] of Object.entries(ETATS)) {
  test(`${page} : tient dans la largeur de l'écran`, async ({ browser }) => {
    const depassements = [];
    for (const largeur of LARGEURS) {
      const ctx = await browser.newContext({
        ...devices['iPhone 13'], baseURL: SERVEUR, viewport: { width: largeur, height: 700 }, screen: { width: largeur, height: 700 },
      });
      for (const [nom, code] of Object.entries(etats)) {
        const p = await ctx.newPage();
        const erreurs = await preparer(p);
        await p.goto(`360-immo-${page}.html`);
        if (code) {
          await p.evaluate(code);
          if (code.includes('launchEstimation')) await expect(p.locator('#res-median')).toContainText(/\d/, { timeout: 5000 });
        }
        await p.waitForTimeout(300);
        const largeurPage = await p.evaluate(() => innerWidth);
        if (largeurPage > largeur) depassements.push(`${largeur} px · ${nom} : la page fait ${largeurPage} px`);
        expect(erreurs, `erreurs JavaScript (${largeur} px · ${nom})`).toEqual([]);
        await p.close();
      }
      await ctx.close();
    }
    expect(depassements).toEqual([]);
  });
}
