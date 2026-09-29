/*
 * Photos des annonces : réduites dans le navigateur avant l'envoi, pour tenir dans l'espace de stockage et
 * s'afficher vite, même en 3G. Une photo de téléphone (3 à 8 Mo) devient une image d'environ 200 à 400 Ko,
 * de 1600 pixels au plus de large ou de haut, au format WebP (JPEG si le navigateur ne sait pas faire de WebP).
 */

export const MAX_PHOTOS = 20;
const COTE_MAX = 1600;
const QUALITE = 0.82;

export type PhotoPrete = { blob: Blob; type: "image/webp" | "image/jpeg"; extension: "webp" | "jpg"; largeur: number; hauteur: number };

/** Photo choisie → image réduite prête à envoyer ; erreur claire si le fichier n'est pas une image lisible */
export async function reduirePhoto(fichier: File): Promise<PhotoPrete> {
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
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle), hauteur = Math.round(image.height * echelle);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("Votre navigateur ne sait pas préparer les photos.");
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();

  const enImage = (type: string) => new Promise<Blob | null>((ok) => toile.toBlob(ok, type, QUALITE));
  const webp = await enImage("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, type: "image/webp", extension: "webp", largeur, hauteur };
  const jpeg = await enImage("image/jpeg");
  if (!jpeg) throw new Error(`« ${fichier.name} » n'a pas pu être préparée.`);
  return { blob: jpeg, type: "image/jpeg", extension: "jpg", largeur, hauteur };
}

/** Taille lisible : « 312 Ko », « 4,2 Mo » */
export function taille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
