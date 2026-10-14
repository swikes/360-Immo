/*
 * Glossaire du blog (page /blog) : les mots de l'immobilier en Côte d'Ivoire, expliqués simplement.
 * Définitions générales, à faire relire par un juriste avant le lancement (document « Articles du blog — à relire »).
 * Pour ajouter un mot : une ligne de plus ici (l'ordre alphabétique est fait par la page).
 */
export type Mot = { mot: string; definition: string };

export const GLOSSAIRE: Mot[] = [
  {
    mot: "Titre foncier (TF)",
    definition: "Le document qui prouve la propriété d'un terrain, inscrit au Livre foncier tenu par la Conservation foncière. "
      + "C'est le titre le plus sûr : il est définitif et opposable à tous.",
  },
  {
    mot: "ACD (arrêté de concession définitive)",
    definition: "L'acte de l'administration qui accorde la propriété d'un terrain en ville. Il permet ensuite d'établir "
      + "le titre foncier au nom du propriétaire.",
  },
  {
    mot: "Lettre d'attribution",
    definition: "Un ancien document par lequel l'administration attribuait un lot. Seul, ce n'est pas un titre de "
      + "propriété : il doit être régularisé (ACD). Prudence si c'est le seul papier présenté.",
  },
  {
    mot: "Attestation villageoise",
    definition: "Un document établi par un village ou une autorité coutumière. Il ne prouve pas la propriété : "
      + "acheter un terrain sur cette seule base est risqué.",
  },
  {
    mot: "Certificat foncier",
    definition: "En zone rurale, le document qui constate les droits d'une personne ou d'une famille sur une terre. "
      + "Il doit ensuite conduire à un titre foncier.",
  },
  {
    mot: "Lotissement approuvé",
    definition: "Un terrain découpé en lots selon un plan validé par l'administration. Un lot pris dans un "
      + "lotissement non approuvé est difficile, voire impossible, à faire régulariser.",
  },
  {
    mot: "Bornage",
    definition: "La pose de bornes par un géomètre expert, pour fixer les limites exactes d'un terrain sur place.",
  },
  {
    mot: "État foncier",
    definition: "Un document délivré par la Conservation foncière : il indique le propriétaire d'un terrain titré et "
      + "ce qui pèse sur lui (hypothèque, inscriptions). À demander avant tout achat.",
  },
  {
    mot: "Mutation",
    definition: "Le transfert du titre foncier au nom du nouveau propriétaire, après la vente.",
  },
  {
    mot: "Notaire",
    definition: "Un officier public qui rédige l'acte de vente, vérifie les documents et s'occupe des formalités "
      + "(enregistrement, mutation).",
  },
  {
    mot: "Hypothèque",
    definition: "Une garantie prise par une banque sur un bien en échange d'un prêt. Elle est inscrite sur le titre foncier.",
  },
  {
    mot: "Bail",
    definition: "Le contrat de location entre le propriétaire et le locataire : loyer, durée, caution, préavis et "
      + "obligations de chacun.",
  },
  {
    mot: "Caution (dépôt de garantie)",
    definition: "Une somme versée au propriétaire à l'entrée et rendue au départ, moins le coût des dégâts constatés "
      + "à l'état des lieux de sortie.",
  },
  {
    mot: "Avance sur loyer",
    definition: "Des mois de loyer payés d'avance à l'entrée dans le logement. Contrairement à la caution, elle n'est "
      + "pas rendue : elle couvre les premiers mois.",
  },
  {
    mot: "Frais d'agence",
    definition: "La rémunération de l'agence qui a trouvé le logement, le locataire ou l'acheteur. Leur montant se "
      + "convient avant la visite ; demandez toujours un reçu.",
  },
  {
    mot: "État des lieux",
    definition: "La description du logement pièce par pièce, faite à l'entrée et à la sortie et signée par les deux "
      + "parties. C'est elle qui permet de savoir ce qui peut être retenu sur la caution.",
  },
  {
    mot: "Permis de construire",
    definition: "L'autorisation de l'administration nécessaire avant de construire.",
  },
];
