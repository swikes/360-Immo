// Logique sans affichage : règles des biens, adresse de recherche, menu (lib/).
import { expect, test } from "@playwright/test";
import { estActif } from "../lib/menu";
import { adresseAnnonces } from "../lib/recherche";
import { chambresMax, reglesPour } from "../lib/regles-biens";

// Ces tests n'ouvrent pas de navigateur : un seul passage suffit
test.beforeEach(() => test.skip(test.info().project.name !== "ordinateur", "une seule fois"));

test("Terrain : ni meublé, ni pièces, ni chambres, ni location à la journée", () => {
  const r = reglesPour(["Terrain"], "location");
  expect(r).toMatchObject({ meuble: false, pieces: false, chambres: false, sanitaires: false, etage: false });
  expect(r.loyerPar).toEqual(["Mois", "Année"]);
  expect(r.surface).toBe("Superficie");
  expect(r.commodites).toContain("Titre foncier (ACD)");
  expect(r.commodites).not.toContain("Piscine");
});

test("Vente : aucun loyer, pas de caution", () => {
  const r = reglesPour(["Appartement"], "vente");
  expect(r.loyerPar).toEqual([]);
  expect(r.caution).toBe(false);
  expect(r.location).toBe(false);
});

test("Appartement : studio, étage toujours demandé ; bureau : étage en option", () => {
  expect(reglesPour(["Appartement"], "location")).toMatchObject({ studio: true, unePiece: false, etage: "toujours" });
  expect(reglesPour(["Bureau"], "location")).toMatchObject({ etage: "option", chambres: false, sanitaires: "Toilettes" });
  expect(reglesPour(["Maison / Villa"], "location").loyerPar).toEqual(["Jour", "Mois", "Année"]);
});

test("Tous les biens : pas de commodités de terrain, « Salles de bain »", () => {
  const r = reglesPour([], null);
  expect(r.commodites).not.toContain("Terrain clôturé");
  expect(r.sanitaires).toBe("Salles de bain");
  expect(r.unePiece).toBe(false);
});

test("Chambres possibles selon les pièces (le séjour compte pour une pièce)", () => {
  expect(chambresMax("Studio")).toBe(0);
  expect(chambresMax("1")).toBe(0);
  expect(chambresMax("3")).toBe(2);
  expect(chambresMax("5+")).toBe(Infinity);
});

test("Adresse de recherche", () => {
  expect(adresseAnnonces({ location: false })).toBe("/annonces?tx=achat");
  expect(adresseAnnonces({ location: true, journaliere: true, types: ["Maison / Villa"], lieu: " Riviera 2 ", max: "75 000" }))
    .toBe("/annonces?tx=location&duree=jour&type=maison&q=Riviera+2&max=75000");
  expect(adresseAnnonces({ location: false, types: ["Commerce / Magasin"], min: "abc" })).toBe("/annonces?tx=achat&type=commerce");
});

test("Lien actif du menu", () => {
  expect(estActif("/annonces?tx=location", "/annonces", "location")).toBe(true);
  expect(estActif("/annonces?tx=location", "/annonces", "achat")).toBe(false);
  expect(estActif("/publier", "/publier", null)).toBe(true);
  expect(estActif("/blog", "/", null)).toBe(false);
});
