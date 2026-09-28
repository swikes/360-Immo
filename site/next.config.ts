import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le nouveau site vit dans le dossier site/ du dépôt, à côté de la maquette (qui a ses propres outils de test) :
  // on indique que la racine du site est ce dossier.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
