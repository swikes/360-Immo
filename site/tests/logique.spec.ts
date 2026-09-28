// Logique sans affichage : règles des biens, adresse de recherche, menu (lib/).
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { chercher, trouver } from "../lib/choix-lieu";
import { estActif } from "../lib/menu";
import { adresseAnnonces } from "../lib/recherche";
import { TYPES_BIEN, chambresMax, cleType, reglesPour, typeDeCle, typesProposes } from "../lib/regles-biens";

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

test("Types de bien : les mêmes que sur la maquette (publication, recherche, filtres)", () => {
  // js/regles-biens.js de la maquette, lu tel quel
  const fenetre: { ReglesBiens?: { TYPES: string[]; cle: (t: string) => string } } = {};
  new Function("window", readFileSync(path.join(__dirname, "../../js/regles-biens.js"), "utf8"))(fenetre);
  expect(TYPES_BIEN).toEqual(fenetre.ReglesBiens!.TYPES);
  expect(TYPES_BIEN.map(cleType)).toEqual(TYPES_BIEN.map(fenetre.ReglesBiens!.cle));
  expect(TYPES_BIEN).toEqual([
    "Appartement", "Maison", "Villa", "Terrain", "Bureau", "Commerce / Magasin", "Immeuble", "Chambre d'hôtel", "Autres",
  ]);
});

test("Types proposés : une chambre d'hôtel ne s'achète pas ; clés d'adresse dans les deux sens", () => {
  expect(typesProposes("vente")).not.toContain("Chambre d'hôtel");
  expect(typesProposes("location")).toEqual(TYPES_BIEN);
  for (const t of TYPES_BIEN) expect(typeDeCle(cleType(t)!)).toBe(t);
  expect(cleType("Maison / Villa")).toBe("maison");
  expect(adresseAnnonces({ location: true, journaliere: true, types: ["Chambre d'hôtel"] }))
    .toBe("/annonces?tx=location&duree=jour&type=hotel");
});

test("Lieux : quartiers en tapant, lieu reconnu au bon niveau", () => {
  expect(chercher("rivi", { quartiers: true }).slice(0, 2).map((e) => `${e.libelle} | ${e.detail}`))
    .toEqual(["Riviera 1 | Quartier · Cocody", "Riviera 2 | Quartier · Cocody"]);
  expect(chercher("rivi")).toHaveLength(0);
  expect(chercher("abidjan")).toHaveLength(14); // la ville et ses 13 communes
  expect(chercher("port bouet")[0].libelle).toBe("Port-Bouët");
  expect(trouver("divo")).toMatchObject({ type: "ville", ville: "Divo" }); // la ville, pas le quartier de Koumassi
  expect(trouver("riviera 2, cocody")).toMatchObject({ type: "quartier", commune: "Cocody", texte: "Riviera 2, Cocody" });
  expect(trouver("Remblais")).toMatchObject({ type: "quartier", commune: null }); // Koumassi ou Marcory
  expect(trouver("Chez Tantie Awa")).toBeNull();
});

test("Lieux : mêmes suggestions que la maquette", () => {
  // js/villes-communes.js et js/choix-lieu.js de la maquette, lus tels quels
  const fenetre: Record<string, unknown> = { matchMedia: () => ({ matches: false }) };
  for (const f of ["villes-communes.js", "choix-lieu.js"]) {
    new Function("window", readFileSync(path.join(__dirname, "../../js", f), "utf8"))(fenetre);
  }
  type Proto = { chercher: (q: string, o?: { quartiers: boolean }) => { libelle: string; detail: string }[] };
  const maquette = fenetre.ChoixLieu as Proto;
  for (const q of ["", "rivi", "coco", "bouake", "port bouet", "remblais", "marcory", "yop", "mbah", "zzz"]) {
    const texte = (l: { libelle: string; detail: string }[]) => l.map((e) => `${e.libelle} | ${e.detail}`);
    expect(texte(chercher(q, { quartiers: true })), `« ${q} »`).toEqual(texte(maquette.chercher(q, { quartiers: true })));
  }
});
