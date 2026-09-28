// Liens : aucune page ni aucun script ne pointe vers un fichier qui n'existe pas.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./outils');

const RACINE = path.join(__dirname, '..');
const HTML = fs.readdirSync(RACINE).filter(f => f.endsWith('.html'));

// Vérification des fichiers : inutile de la refaire pour chaque appareil
test.beforeEach(() => test.skip(test.info().project.name !== 'ordinateur', 'vérifié une seule fois'));

for (const fichier of HTML) {
  test(`${fichier} : liens vers des pages existantes`, () => {
    const contenu = fs.readFileSync(path.join(RACINE, fichier), 'utf-8');
    // href="…html", window.location.href='…html', chaînes JavaScript…
    const cibles = [...new Set((contenu.match(/[A-Za-z0-9_.-]+\.html/g) || []))];
    const manquantes = cibles.filter(c => !fs.existsSync(path.join(RACINE, c)));
    expect(manquantes, `pages introuvables référencées par ${fichier}`).toEqual([]);
  });

  test(`${fichier} : scripts et feuilles de style locaux présents`, () => {
    const contenu = fs.readFileSync(path.join(RACINE, fichier), 'utf-8');
    const locaux = [...contenu.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
    const manquants = locaux.filter(u => !fs.existsSync(path.join(RACINE, u)));
    expect(manquants, `fichiers introuvables chargés par ${fichier}`).toEqual([]);
  });
}
