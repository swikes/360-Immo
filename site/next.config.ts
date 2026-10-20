import path from "node:path";
import type { NextConfig } from "next";
import { redirectionsVersDomaine } from "./lib/site";

// En-têtes de sécurité, sur toutes les pages (Vercel ajoute déjà Strict-Transport-Security : HTTPS seulement).
// La liste des sources permises (Content-Security-Policy) : le site lui-même, la base Supabase (données, photos,
// logos), les tuiles de la carte des prix (OpenStreetMap) et, s'il est réglé, le contrôle anti-robot de Cloudflare
// (lib/anti-robot.ts). Un script glissé dans une page ne peut donc rien charger ni envoyer ailleurs. Une source
// nouvelle (statistiques, vidéo, paiement…) doit être ajoutée ici.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const developpement = process.env.NODE_ENV !== "production";
const antiRobot = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ? "https://challenges.cloudflare.com" : "";

const SOURCES = [
  "default-src 'self'",
  // (les pages de Next.js contiennent des scripts écrits dans la page ; « unsafe-eval » : seulement pour npm run dev)
  `script-src 'self' 'unsafe-inline'${developpement ? " 'unsafe-eval'" : ""} ${antiRobot}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} https://tile.openstreetmap.org`.replace(/ +/g, " "),
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}`.trim(),
  "worker-src 'self' blob:",
  // la case « Je suis humain » de Cloudflare s'affiche dans un cadre venu de chez lui
  `frame-src 'self' ${antiRobot}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // personne ne peut afficher le site dans un cadre (contre les clics piégés)
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Le nouveau site vit dans le dossier site/ du dépôt, à côté de la maquette (qui a ses propres outils de test) :
  // on indique que la racine du site est ce dossier.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          { key: "Content-Security-Policy", value: SOURCES },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  // l'ancienne adresse 360-immo.vercel.app renvoie vers le nom de domaine, dès qu'il est réglé (lib/site.ts)
  async redirects() {
    return redirectionsVersDomaine();
  },
};

export default nextConfig;
