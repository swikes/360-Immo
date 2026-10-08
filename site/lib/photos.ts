/*
 * Photos des annonces : réduites dans le navigateur avant l'envoi, pour tenir dans l'espace de stockage et
 * s'afficher vite, même en 3G. Une photo de téléphone (3 à 8 Mo) devient une image d'environ 200 à 400 Ko,
 * de 1600 pixels au plus de large ou de haut, au format WebP (JPEG si le navigateur ne sait pas faire de WebP).
 * Chaque photo reçoit aussi une empreinte : la base repère ainsi une photo déjà utilisée dans une autre annonce
 * (supabase/migrations/…_doublons.sql).
 */

export const MAX_PHOTOS = 20;
const COTE_MAX = 1600;
const QUALITE = 0.82;

export type PhotoPrete = {
  blob: Blob; type: "image/webp" | "image/jpeg"; extension: "webp" | "jpg"; largeur: number; hauteur: number;
  /** empreinte de l'image (null si le navigateur ne sait pas la calculer) */
  empreinte: string | null;
};

/**
 * Empreinte d'une image : 64 bits (16 caractères hexadécimaux). L'image est réduite à 9 × 8 points gris ; chaque bit
 * dit si un point est plus clair que son voisin de droite. La même photo, redimensionnée ou recompressée, garde une
 * empreinte presque identique (quelques bits de différence au plus).
 */
export function empreinteImage(source: CanvasImageSource, largeur: number, hauteur: number): string | null {
  // en deux fois (144 × 128, puis 9 × 8) : une réduction directe d'une grande image laisserait des points au hasard
  const etape = document.createElement("canvas");
  etape.width = 144;
  etape.height = 128;
  const e = etape.getContext("2d");
  const petite = document.createElement("canvas");
  petite.width = 9;
  petite.height = 8;
  const c = petite.getContext("2d", { willReadFrequently: true });
  if (!e || !c || !largeur || !hauteur) return null;
  e.imageSmoothingQuality = "high";
  e.drawImage(source, 0, 0, largeur, hauteur, 0, 0, 144, 128);
  c.imageSmoothingQuality = "high";
  c.drawImage(etape, 0, 0, 9, 8);
  const { data } = c.getImageData(0, 0, 9, 8);
  const gris = (i: number) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let octet = 0;
    for (let x = 0; x < 8; x++) octet = (octet << 1) | (gris(y * 9 + x) > gris(y * 9 + x + 1) ? 1 : 0);
    hex += octet.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Photo choisie → image réduite prête à envoyer ; erreur claire si le fichier n'est pas une image lisible.
 * coteMax : plus grand côté (1600 pixels pour les annonces ; davantage pour qu'un document reste lisible, moins pour un logo)
 */
export async function reduirePhoto(fichier: File, coteMax = COTE_MAX): Promise<PhotoPrete> {
  if (!fichier.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(fichier.name)) {
    throw new Error(`« ${fichier.name} » n'est pas une photo.`);
  }
  let image: ImageBitmap;
  try {
    // photo de téléphone tenu en hauteur : tournée dans le bon sens (indication de l'appareil photo)
    image = await createImageBitmap(fichier, { imageOrientation: "from-image" }).catch(() => createImageBitmap(fichier));
  } catch {
    throw new Error(`« ${fichier.name} » ne peut pas être lue ici. Choisissez une photo JPG, PNG ou WebP.`);
  }
  const echelle = Math.min(1, coteMax / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle), hauteur = Math.round(image.height * echelle);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("Votre navigateur ne sait pas préparer les photos.");
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  let empreinte: string | null = null;
  try {
    empreinte = empreinteImage(toile, largeur, hauteur);
  } catch {
    empreinte = null; // la photo part quand même, sans empreinte
  }

  const enImage = (type: string) => new Promise<Blob | null>((ok) => toile.toBlob(ok, type, QUALITE));
  const webp = await enImage("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, type: "image/webp", extension: "webp", largeur, hauteur, empreinte };
  const jpeg = await enImage("image/jpeg");
  if (!jpeg) throw new Error(`« ${fichier.name} » n'a pas pu être préparée.`);
  return { blob: jpeg, type: "image/jpeg", extension: "jpg", largeur, hauteur, empreinte };
}

/** Taille lisible : « 312 Ko », « 4,2 Mo » */
export function taille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
