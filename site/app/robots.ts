/*
 * Consignes aux moteurs de recherche (/robots.txt) : tout le site, sauf les pages personnelles ; plan du site.
 */
import type { MetadataRoute } from "next";
import { ADRESSE_SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/mon-espace", "/connexion", "/mot-de-passe", "/publier?"] },
    sitemap: `${ADRESSE_SITE}/sitemap.xml`,
  };
}
