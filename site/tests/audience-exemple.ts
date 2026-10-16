// Chiffres d'exemple de l'onglet Administration → Audience (réponse de admin_audience imitée) : tests/audience.spec.ts

const JOUR = 86_400_000;
/** Chiffres d'exemple, selon la période (les vrais viennent de admin_audience) */
export function exemple(jours: number) {
  const fin = new Date().toISOString().slice(0, 10);
  const jour = (i: number) => new Date(Date.parse(fin) - (jours - 1 - i) * JOUR).toISOString().slice(0, 10);
  const par_jour = Array.from({ length: jours }, (_, i) => ({ jour: jour(i), visites: 40 + ((i * 7) % 23), vues: 120 + ((i * 11) % 60) }));
  const visites = par_jour.reduce((n, x) => n + x.visites, 0);
  const vues = par_jour.reduce((n, x) => n + x.vues, 0);
  const forme = [1, 0, 0, 0, 0, 1, 3, 6, 9, 11, 12, 13, 14, 12, 11, 12, 13, 15, 18, 21, 19, 14, 8, 3];
  return {
    jours, du: jour(0), au: fin,
    totaux: { vues, visites, vues_avant: Math.round(vues * 0.8), visites_avant: Math.round(visites * 0.75), vues_aujourdhui: 131, visites_aujourdhui: 47 },
    par_jour,
    par_heure: forme.map((p, heure) => ({ heure, visites: p * 10, vues: p * 31 })),
    par_jour_semaine: [62, 58, 60, 57, 66, 81, 74].map((p, i) => ({ jour: i + 1, visites: p * 10, vues: p * 30 })),
    par_mois: Array.from({ length: 12 }, (_, i) => ({
      mois: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11 + i, 15)).toISOString().slice(0, 7),
      visites: i < 9 ? 0 : [380, 910, 1460][i - 9], vues: i < 9 ? 0 : [1100, 2700, 4300][i - 9],
    })),
    pages: [{ page: "fiche", vues: 1840 }, { page: "liste", vues: 1210 }, { page: "accueil", vues: 980 }, { page: "carte_prix", vues: 220 }],
    sources: [{ source: "facebook", visites: 610 }, { source: "google", visites: 420 }, { source: "whatsapp", visites: 300 }, { source: "direct", visites: 130 }],
    appareils: [{ appareil: "telephone", visites: 1190 }, { appareil: "ordinateur", visites: 240 }, { appareil: "tablette", visites: 30 }],
    campagnes: [{ campagne: "pub-octobre", source: "facebook", visites: 280 }, { campagne: "statut-whatsapp", source: "whatsapp", visites: 96 }],
    parcours: { visites, recherches: 820, fiches: 1840, numeros: 140, appels: 62, whatsapp: 95, emails: 8, partages: 31, messages: 44,
      visites_demandees: 21, rappels: 12, favoris: 160, alertes: 37, inscriptions: 58, annonces_envoyees: 26, annonces_publiees: 22 },
    favoris: [
      { reference: "IMM-2026-01001", titre: "Appartement 3 pièces meublé — Riviera 2", transaction: "location", prix: 350000, loyer_par: "mois",
        commune: "Cocody", en_ligne: true, favoris: 34, nouveaux: 12, vues: 610 },
      { reference: "IMM-2026-01010", titre: "Villa 5 pièces avec piscine — Angré", transaction: "vente", prix: 185000000, loyer_par: null,
        commune: "Cocody", en_ligne: false, favoris: 19, nouveaux: 0, vues: 402 },
    ],
    annonceurs: [
      { nom: "Kamika Immobilier", agence: true, en_ligne: 14, annonces: 18, vues: 3120, contacts: 96 },
      { nom: "Awa Koné", agence: false, en_ligne: 3, annonces: 4, vues: 540, contacts: 12 },
    ],
    recherches: {
      total: 820, sans_resultat: 118,
      lieux: [{ lieu: "Riviera 2 (Cocody)", nombre: 140, sans_resultat: 6 }, { lieu: "Yopougon (Abidjan)", nombre: 96, sans_resultat: 22 },
        { lieu: "Bingerville (Abidjan)", nombre: 41, sans_resultat: 30 }],
      types: [{ type_bien: "appartement", nom: "Appartement", nombre: 410 }, { type_bien: "", nom: "Tous les types", nombre: 220 },
        { type_bien: "terrain", nom: "Terrain", nombre: 120 }],
      transactions: [{ transaction: "location", duree: "mois", nombre: 560 }, { transaction: "achat", duree: "", nombre: 210 },
        { transaction: "location", duree: "jour", nombre: 50 }],
      budgets: [
        { transaction: "location", duree: "mois", budget: "moins de 100 000 / mois", nombre: 90 },
        { transaction: "location", duree: "mois", budget: "100 000 à 200 000 / mois", nombre: 210 },
        { transaction: "location", duree: "mois", budget: "200 000 à 300 000 / mois", nombre: 120 },
        { transaction: "achat", duree: "", budget: "25 à 50 millions", nombre: 70 },
      ],
      combinaisons: [{ transaction: "location", duree: "mois", type_nom: "Appartement", lieu: "Riviera 2 (Cocody)", budget: "200 000 à 300 000 / mois", nombre: 64 }],
      sans_resultat_detail: [{ transaction: "achat", duree: "", type_nom: "Terrain", lieu: "Bingerville (Abidjan)", budget: "25 à 50 millions", nombre: 30 }],
    },
    demande_offre: [
      { ville: "Abidjan", commune: "Cocody", recherches: 260, location: 210, achat: 50, offre: 120, offre_location: 90, offre_achat: 30 },
      { ville: "Abidjan", commune: "Bingerville", recherches: 41, location: 5, achat: 36, offre: 4, offre_location: 1, offre_achat: 3 },
    ],
    prix_en_ligne: [
      { transaction: "location", duree: "mois", budget: "100 000 à 200 000 / mois", annonces: 40 },
      { transaction: "location", duree: "mois", budget: "300 000 à 500 000 / mois", annonces: 55 },
      { transaction: "achat", duree: "", budget: "100 millions et plus", annonces: 30 },
    ],
    verification: { publiees: 22, refusees: 4, retirees: 1, delai_median_heures: 5.5, en_attente: 3, plus_ancienne_heures: 30,
      motifs: [{ motif: "Photos floues ou prises ailleurs", nombre: 2 }] },
    sans_contact: { nombre: 7, en_ligne: 140, annonces: [{ reference: "IMM-2026-01020", titre: "Bureau 60 m² — Plateau", commune: "Plateau", vues: 12,
      publiee_le: new Date(Date.now() - 40 * JOUR).toISOString() }] },
    reactivite: { messages: 44, messages_repondus: 31, premiere_reponse_heures: 3.2, visites: 21, visites_traitees: 15, rappels: 12, rappels_faits: 9 },
    comptes: { total: 412, inscriptions: 58, inscriptions_avant: 40, actifs_7: 96, actifs_30: 210 },
    introuvables: [{ chemin: "/annonces/imm-2026-00042", nombre: 17, dernier_le: new Date().toISOString() }],
  };
}
