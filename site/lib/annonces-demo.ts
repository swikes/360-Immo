/*
 * Annonces de démonstration de la page d'accueil (les mêmes que sur la maquette).
 * Elles seront remplacées par les vraies annonces de la base de données (étape « base de données »).
 */

export type TypeAnnonce = "Appartement" | "Villa" | "Maison" | "Terrain" | "Bureau";
export type Icone = "maison" | "bureau" | "terrain";
export type Caracteristique = {
  icone: "pieces" | "surface" | "chambres" | "parking" | "fibre" | "viabilise";
  texte: string;
};

export type Annonce = {
  id: string;
  transaction: "vente" | "location";
  type: TypeAnnonce;
  premium?: boolean;
  prix: number;
  /** location : prix par mois ou par jour */
  loyerPar?: "mois" | "jour";
  titre: string;
  lieu: string;
  caracteristiques: Caracteristique[];
  agence: { nom: string; initiales: string; fond?: string; couleur?: string };
  /** date de publication, en clair (« Il y a 5 jours ») */
  depuis: string;
  /** numéro WhatsApp de l'annonceur (chiffres, avec l'indicatif) */
  whatsapp?: string;
  /** image en attendant les photos : dégradé et dessin */
  visuel: { de: string; a: string; trait: string; icone: Icone };
};

export const ANNONCES_DEMO: Annonce[] = [
  {
    id: "appartement-cocody-riviera-2",
    transaction: "location", type: "Appartement", prix: 150_000, loyerPar: "mois",
    titre: "Appartement 3 pièces meublé, Cocody",
    lieu: "Abidjan, Cocody Riviera 2",
    caracteristiques: [
      { icone: "pieces", texte: "3 pièces" },
      { icone: "surface", texte: "85 m²" },
      { icone: "chambres", texte: "2 chambres" },
    ],
    agence: { nom: "Kamika Immobilier", initiales: "KI" },
    depuis: "Il y a 2 jours",
    whatsapp: "2250748321190",
    visuel: { de: "#e8f5ee", a: "#c8e6d8", trait: "#1a6b4a", icone: "maison" },
  },
  {
    id: "villa-plateau-piscine",
    transaction: "vente", type: "Villa", premium: true, prix: 85_000_000,
    titre: "Villa 5 chambres avec piscine, Plateau",
    lieu: "Abidjan, Le Plateau",
    caracteristiques: [
      { icone: "pieces", texte: "7 pièces" },
      { icone: "surface", texte: "320 m²" },
      { icone: "chambres", texte: "5 chambres" },
    ],
    agence: { nom: "Abidjan Invest", initiales: "AI", fond: "#fff8e8", couleur: "var(--gold-dark)" },
    depuis: "Il y a 5 jours",
    visuel: { de: "#f5f0e8", a: "#e6d9bb", trait: "#8b6914", icone: "maison" },
  },
  {
    id: "bureau-zone-4",
    transaction: "location", type: "Bureau", prix: 350_000, loyerPar: "mois",
    titre: "Bureau open space 120 m², Zone 4",
    lieu: "Abidjan, Zone 4 Marcory",
    caracteristiques: [
      { icone: "surface", texte: "120 m²" },
      { icone: "parking", texte: "Parking" },
      { icone: "fibre", texte: "Fibre" },
    ],
    agence: { nom: "CI Bureau Pro", initiales: "CI", fond: "#eaf3de", couleur: "#3b6d11" },
    depuis: "Aujourd'hui",
    visuel: { de: "#e8eef5", a: "#b8c8e6", trait: "#185fa5", icone: "bureau" },
  },
  {
    id: "terrain-bingerville",
    transaction: "vente", type: "Terrain", prix: 12_500_000,
    titre: "Terrain 500 m² constructible, Bingerville",
    lieu: "Bingerville, près du lac",
    caracteristiques: [
      { icone: "surface", texte: "500 m²" },
      { icone: "viabilise", texte: "Viabilisé" },
    ],
    agence: { nom: "Terra Invest CI", initiales: "TI", fond: "#faece7", couleur: "#993c1d" },
    depuis: "Il y a 1 jour",
    visuel: { de: "#f5ece8", a: "#e6c4b8", trait: "#993c1d", icone: "terrain" },
  },
  {
    id: "studio-yopougon-ananeraie",
    transaction: "location", type: "Appartement", prix: 75_000, loyerPar: "mois",
    titre: "Studio meublé, Yopougon Ananeraie",
    lieu: "Abidjan, Yopougon",
    caracteristiques: [
      { icone: "pieces", texte: "Studio" },
      { icone: "surface", texte: "22 m²" },
      { icone: "chambres", texte: "Meublé" },
    ],
    agence: { nom: "Kamika Immobilier", initiales: "KI" },
    depuis: "Il y a 3 jours",
    visuel: { de: "#eaf0e8", a: "#c0d8b8", trait: "#3b6d11", icone: "maison" },
  },
  {
    id: "maison-songon-jardin",
    transaction: "vente", type: "Maison", prix: 45_000_000,
    titre: "Maison 4 chambres avec jardin, Songon",
    lieu: "Songon, Grand Bassam Road",
    caracteristiques: [
      { icone: "pieces", texte: "5 pièces" },
      { icone: "surface", texte: "200 m²" },
      { icone: "chambres", texte: "Jardin" },
    ],
    agence: { nom: "Maison Plus CI", initiales: "MP", fond: "#eeedfe", couleur: "#534ab7" },
    depuis: "Il y a 1 semaine",
    visuel: { de: "#f0e8f5", a: "#d4b8e6", trait: "#534ab7", icone: "maison" },
  },
];
