/*
 * Numéros de téléphone de tous les pays : liste des pays et indicatifs, vérification du numéro selon le pays,
 * écriture complète (« +225 07 48 32 11 90 »). Mêmes règles que la maquette (js/telephone.js), vérifié par les tests.
 *   - Côte d'Ivoire (+225) par défaut ; les pays fréquents en tête de liste ; recherche par nom ou indicatif.
 *   - Un numéro tapé ou collé avec son indicatif (« +33 6 12… », « 0033 6 12… ») choisit le pays tout seul.
 */

export type Pays = { iso: string; nom: string; indicatif: string };
type Regle = { n: number[]; zero?: boolean; ex?: string };

// Pays : code ISO | nom | indicatif
export const PAYS: Pays[] = [
  "AF|Afghanistan|93", "ZA|Afrique du Sud|27", "AL|Albanie|355", "DZ|Algérie|213", "DE|Allemagne|49", "AD|Andorre|376",
  "AO|Angola|244", "AG|Antigua-et-Barbuda|1268", "SA|Arabie saoudite|966", "AR|Argentine|54", "AM|Arménie|374",
  "AU|Australie|61", "AT|Autriche|43", "AZ|Azerbaïdjan|994", "BS|Bahamas|1242", "BH|Bahreïn|973", "BD|Bangladesh|880",
  "BB|Barbade|1246", "BE|Belgique|32", "BZ|Belize|501", "BJ|Bénin|229", "BT|Bhoutan|975", "BY|Biélorussie|375",
  "MM|Birmanie (Myanmar)|95", "BO|Bolivie|591", "BA|Bosnie-Herzégovine|387", "BW|Botswana|267", "BR|Brésil|55",
  "BN|Brunei|673", "BG|Bulgarie|359", "BF|Burkina Faso|226", "BI|Burundi|257", "KH|Cambodge|855", "CM|Cameroun|237",
  "CA|Canada|1", "CV|Cap-Vert|238", "CL|Chili|56", "CN|Chine|86", "CY|Chypre|357", "CO|Colombie|57", "KM|Comores|269",
  "CG|Congo-Brazzaville|242", "CD|Congo (RDC)|243", "KP|Corée du Nord|850", "KR|Corée du Sud|82", "CR|Costa Rica|506",
  "CI|Côte d'Ivoire|225", "HR|Croatie|385", "CU|Cuba|53", "DK|Danemark|45", "DJ|Djibouti|253", "DM|Dominique|1767",
  "EG|Égypte|20", "AE|Émirats arabes unis|971", "EC|Équateur|593", "ER|Érythrée|291", "ES|Espagne|34", "EE|Estonie|372",
  "SZ|Eswatini|268", "US|États-Unis|1", "ET|Éthiopie|251", "FJ|Fidji|679", "FI|Finlande|358", "FR|France|33",
  "GA|Gabon|241", "GM|Gambie|220", "GE|Géorgie|995", "GH|Ghana|233", "GR|Grèce|30", "GD|Grenade|1473",
  "GP|Guadeloupe|590", "GT|Guatemala|502", "GN|Guinée|224", "GQ|Guinée équatoriale|240", "GW|Guinée-Bissau|245",
  "GY|Guyana|592", "GF|Guyane|594", "HT|Haïti|509", "HN|Honduras|504", "HK|Hong Kong|852", "HU|Hongrie|36",
  "MH|Îles Marshall|692", "SB|Îles Salomon|677", "IN|Inde|91", "ID|Indonésie|62", "IQ|Irak|964", "IR|Iran|98",
  "IE|Irlande|353", "IS|Islande|354", "IL|Israël|972", "IT|Italie|39", "JM|Jamaïque|1876", "JP|Japon|81",
  "JO|Jordanie|962", "KZ|Kazakhstan|7", "KE|Kenya|254", "KG|Kirghizistan|996", "KI|Kiribati|686", "XK|Kosovo|383",
  "KW|Koweït|965", "RE|La Réunion|262", "LA|Laos|856", "LS|Lesotho|266", "LV|Lettonie|371", "LB|Liban|961",
  "LR|Libéria|231", "LY|Libye|218", "LI|Liechtenstein|423", "LT|Lituanie|370", "LU|Luxembourg|352",
  "MK|Macédoine du Nord|389", "MG|Madagascar|261", "MY|Malaisie|60", "MW|Malawi|265", "MV|Maldives|960", "ML|Mali|223",
  "MT|Malte|356", "MA|Maroc|212", "MQ|Martinique|596", "MU|Maurice|230", "MR|Mauritanie|222", "YT|Mayotte|262",
  "MX|Mexique|52", "FM|Micronésie|691", "MD|Moldavie|373", "MC|Monaco|377", "MN|Mongolie|976", "ME|Monténégro|382",
  "MZ|Mozambique|258", "NA|Namibie|264", "NR|Nauru|674", "NP|Népal|977", "NI|Nicaragua|505", "NE|Niger|227",
  "NG|Nigeria|234", "NO|Norvège|47", "NC|Nouvelle-Calédonie|687", "NZ|Nouvelle-Zélande|64", "OM|Oman|968",
  "UG|Ouganda|256", "UZ|Ouzbékistan|998", "PK|Pakistan|92", "PW|Palaos|680", "PS|Palestine|970", "PA|Panama|507",
  "PG|Papouasie-Nouvelle-Guinée|675", "PY|Paraguay|595", "NL|Pays-Bas|31", "PE|Pérou|51", "PH|Philippines|63",
  "PL|Pologne|48", "PF|Polynésie française|689", "PR|Porto Rico|1787", "PT|Portugal|351", "QA|Qatar|974",
  "CF|République centrafricaine|236", "DO|République dominicaine|1809", "RO|Roumanie|40", "GB|Royaume-Uni|44",
  "RU|Russie|7", "RW|Rwanda|250", "KN|Saint-Christophe-et-Niévès|1869", "SM|Saint-Marin|378",
  "PM|Saint-Pierre-et-Miquelon|508", "VC|Saint-Vincent-et-les-Grenadines|1784", "LC|Sainte-Lucie|1758",
  "SV|Salvador|503", "WS|Samoa|685", "ST|Sao Tomé-et-Principe|239", "SN|Sénégal|221", "RS|Serbie|381",
  "SC|Seychelles|248", "SL|Sierra Leone|232", "SG|Singapour|65", "SK|Slovaquie|421", "SI|Slovénie|386",
  "SO|Somalie|252", "SD|Soudan|249", "SS|Soudan du Sud|211", "LK|Sri Lanka|94", "SE|Suède|46", "CH|Suisse|41",
  "SR|Suriname|597", "SY|Syrie|963", "TJ|Tadjikistan|992", "TW|Taïwan|886", "TZ|Tanzanie|255", "TD|Tchad|235",
  "CZ|Tchéquie|420", "TH|Thaïlande|66", "TL|Timor oriental|670", "TG|Togo|228", "TO|Tonga|676",
  "TT|Trinité-et-Tobago|1868", "TN|Tunisie|216", "TM|Turkménistan|993", "TR|Turquie|90", "TV|Tuvalu|688",
  "UA|Ukraine|380", "UY|Uruguay|598", "VU|Vanuatu|678", "VA|Vatican|39", "VE|Venezuela|58", "VN|Viêt Nam|84",
  "YE|Yémen|967", "ZM|Zambie|260", "ZW|Zimbabwe|263",
].map((l) => {
  const [iso, nom, indicatif] = l.split("|");
  return { iso, nom, indicatif };
});

// En tête de liste : la Côte d'Ivoire, ses voisins et les pays d'où l'on appelle le plus souvent
export const FREQUENTS = ["CI", "BF", "ML", "GN", "GH", "LR", "SN", "TG", "BJ", "NE", "NG", "CM", "FR", "BE", "CH", "US", "CA", "GB", "MA", "LB"];

// Longueur du numéro national (sans l'indicatif). « zero » : un 0 initial se tape en national et n'est pas compté.
const REGLES: Record<string, Regle> = {
  CI: { n: [10], ex: "07 00 00 00 00" },
  BF: { n: [8], ex: "70 12 34 56" }, ML: { n: [8], ex: "70 12 34 56" }, NE: { n: [8], ex: "90 12 34 56" },
  TG: { n: [8], ex: "90 12 34 56" }, BJ: { n: [8, 10], ex: "01 90 12 34 56" }, SN: { n: [9], ex: "77 123 45 67" },
  GN: { n: [9], ex: "622 12 34 56" }, GH: { n: [9], zero: true, ex: "024 123 4567" }, LR: { n: [7, 9], zero: true, ex: "077 012 3456" },
  SL: { n: [8], zero: true, ex: "076 123456" }, NG: { n: [10], zero: true, ex: "0802 123 4567" }, CM: { n: [9], ex: "6 71 23 45 67" },
  GA: { n: [7, 8] }, CG: { n: [9] }, CD: { n: [9], zero: true }, TD: { n: [8] }, CF: { n: [8] }, MR: { n: [8] },
  GM: { n: [7] }, GW: { n: [7, 9] }, CV: { n: [7] }, MA: { n: [9], zero: true, ex: "0612 345678" },
  DZ: { n: [8, 9], zero: true }, TN: { n: [8] }, EG: { n: [9, 10], zero: true },
  FR: { n: [9], zero: true, ex: "06 12 34 56 78" }, BE: { n: [8, 9], zero: true, ex: "0470 12 34 56" },
  CH: { n: [9], zero: true, ex: "078 123 45 67" }, LU: { n: [4, 11] }, DE: { n: [6, 11], zero: true },
  IT: { n: [6, 11] }, ES: { n: [9] }, PT: { n: [9] }, GB: { n: [9, 10], zero: true, ex: "07400 123456" },
  NL: { n: [9], zero: true }, US: { n: [10], ex: "201 555 0123" }, CA: { n: [10], ex: "514 555 0123" },
  LB: { n: [7, 8], zero: true, ex: "03 123 456" }, AE: { n: [8, 9], zero: true }, CN: { n: [10, 11], zero: true },
  IN: { n: [10], zero: true }, TR: { n: [10], zero: true }, BR: { n: [10, 11], zero: true },
  RE: { n: [9], zero: true }, YT: { n: [9], zero: true }, GP: { n: [9], zero: true }, MQ: { n: [9], zero: true },
  GF: { n: [9], zero: true },
};

const PAR_ISO: Record<string, Pays> = Object.fromEntries(PAYS.map((p) => [p.iso, p]));
export const PAYS_DEFAUT = PAR_ISO.CI;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tri = new Intl.Collator("fr", { sensitivity: "base" });
const TOUS = [...PAYS].sort((a, b) => tri.compare(a.nom, b.nom));
const chiffresDe = (s: string) => s.replace(/\D/g, "");

export const paysIso = (iso: string | undefined): Pays => (iso && PAR_ISO[iso]) || PAYS_DEFAUT;

/** Drapeau du pays (emoji) */
export function drapeau(iso: string): string {
  return String.fromCodePoint(...iso.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function regle(p: Pays): Regle {
  if (REGLES[p.iso]) return REGLES[p.iso];
  if (p.indicatif.length === 4 && p.indicatif[0] === "1") return { n: [7] }; // îles des Caraïbes (+1 xxx)
  return { n: [6, 15 - p.indicatif.length], zero: true }; // norme internationale : 15 chiffres au plus
}

/** Exemple de numéro pour le pays (texte d'aide dans le champ) */
export const exemple = (iso: string) => regle(paysIso(iso)).ex ?? "Numéro de téléphone";

// Indicatifs partagés par plusieurs pays : celui retenu quand on tape « +1 », « +7 »…
const PRINCIPAL: Record<string, string> = { "1": "US", "7": "RU", "39": "IT", "262": "RE" };

// Pays dont l'indicatif commence la suite de chiffres (le plus long d'abord ; à égalité : le pays déjà choisi)
function paysParIndicatif(d: string, prefere?: Pays): Pays | null {
  for (let l = 4; l >= 1; l--) {
    const code = d.slice(0, l);
    const c = PAYS.filter((p) => p.indicatif === code);
    if (!c.length) continue;
    if (prefere && prefere.indicatif === code) return prefere;
    return PAR_ISO[PRINCIPAL[code]] || c[0];
  }
  return null;
}
const rang = (p: Pays) => {
  const i = FREQUENTS.indexOf(p.iso);
  return i < 0 ? 99 : i;
};

// Pays et numéro national, d'après la saisie : un « +XX » ou « 00XX » tapé l'emporte sur le pays choisi
function analyser(valeur: string, iso: string) {
  const brut = valeur.trim();
  const compact = brut.replace(/[\s.\-()]/g, "");
  let pays = paysIso(iso);
  let d = chiffresDe(brut);
  if (/^(\+|00)/.test(compact)) {
    if (compact.startsWith("00")) d = d.slice(2);
    const trouve = paysParIndicatif(d, pays);
    if (trouve) {
      pays = trouve;
      d = d.slice(trouve.indicatif.length);
    }
  }
  const r = regle(pays);
  const national = r.zero && d.length > 1 && d[0] === "0" ? d.slice(1) : d;
  return { pays, regle: r, national, brut };
}

/** Le numéro est-il valide pour le pays choisi ? */
export function valide(valeur: string, iso: string): boolean {
  const a = analyser(valeur, iso);
  const min = a.regle.n[0], max = a.regle.n[a.regle.n.length - 1];
  return /^\+?[\d\s.\-()]+$/.test(a.brut) && a.national.length >= min && a.national.length <= max;
}

/** Message d'erreur adapté au pays (« … : 10 chiffres, ex. 07 00 00 00 00. ») */
export function message(valeur: string, iso: string): string {
  const a = analyser(valeur, iso);
  const n = a.regle.n;
  if (!a.brut) return "Indiquez un numéro de téléphone.";
  let nb = (n.length === 1 || n[0] === n[1] ? n[0] : "de " + n[0] + " à " + n[n.length - 1]) + " chiffres";
  if (a.regle.zero) nb += " sans compter le 0 du début";
  return "Numéro invalide (" + a.pays.nom + ", +" + a.pays.indicatif + ") : " + nb + (a.regle.ex ? ", ex. " + a.regle.ex : "") + ".";
}

// Groupes de deux chiffres (« 07 48 32 11 90 », « 6 12 34 56 78 ») : lisible dans la plupart des pays
export function grouper(d: string): string {
  const impair = d.length % 2 === 1;
  return ((impair ? d[0] + " " : "") + (impair ? d.slice(1) : d).replace(/(\d{2})(?=\d)/g, "$1 ")).trim();
}

/** « +225 07 48 32 11 90 » (vide si rien n'est saisi) : c'est ainsi que les numéros sont enregistrés */
export function complet(valeur: string, iso: string): string {
  const a = analyser(valeur, iso);
  return a.national ? "+" + a.pays.indicatif + " " + grouper(a.national) : "";
}

/** « 2250748321190 » (pour un lien WhatsApp wa.me/…) */
export function chiffres(valeur: string, iso: string): string {
  const a = analyser(valeur, iso);
  return a.national ? a.pays.indicatif + a.national : "";
}

/** Numéro tapé ou collé avec son indicatif : le pays trouvé et le numéro national seul (sinon null) */
export function normaliser(valeur: string, iso: string): { iso: string; valeur: string } | null {
  const compact = valeur.replace(/[\s.\-()]/g, "");
  if (!/^(\+|00)\d/.test(compact)) return null;
  let d = chiffresDe(compact);
  if (compact.startsWith("00")) d = d.slice(2);
  const pays = paysParIndicatif(d, paysIso(iso));
  if (!pays) return null; // indicatif inconnu : laissé tel quel, le message d'erreur l'indiquera
  return { iso: pays.iso, valeur: grouper(d.slice(pays.indicatif.length)) };
}

/** Numéro enregistré (« +225 07 48 32 11 90 ») → pays et numéro national, pour le modifier */
export function decomposer(enregistre: string | null | undefined): { iso: string; valeur: string } {
  return (enregistre && normaliser(enregistre, PAYS_DEFAUT.iso)) || { iso: PAYS_DEFAUT.iso, valeur: enregistre ?? "" };
}

/** Liste des pays à proposer : sans recherche, les pays fréquents puis tous ; sinon ceux qui correspondent */
export function rechercherPays(filtre: string): { frequents: Pays[]; tous: Pays[] } {
  const f = norm(filtre).trim();
  const code = chiffresDe(filtre);
  if (!f) return { frequents: FREQUENTS.map((i) => PAR_ISO[i]), tous: TOUS };
  const trouves = TOUS.filter(
    (p) => norm(p.nom).includes(f) || (!!code && /^[+\d\s]+$/.test(filtre.trim()) && p.indicatif.startsWith(code)),
  );
  trouves.sort((a, b) => {
    const da = norm(a.nom).startsWith(f) ? 0 : 1, db = norm(b.nom).startsWith(f) ? 0 : 1;
    return da - db || rang(a) - rang(b) || tri.compare(a.nom, b.nom);
  });
  return { frequents: [], tous: trouves };
}
