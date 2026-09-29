/*
 * Plan du site pour Google (/sitemap.xml) : pages principales et chaque annonce en ligne.
 */
import type { MetadataRoute } from "next";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { planDuSite } from "@/lib/annonces-serveur";
import { ADRESSE_SITE } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const annonces = await planDuSite().catch(() => []);
  return [
    { url: `${ADRESSE_SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ADRESSE_SITE}/annonces`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/annonces?tx=location`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/annonces?tx=achat`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/publier`, changeFrequency: "monthly", priority: 0.5 },
    ...annonces.map((a) => ({
      url: `${ADRESSE_SITE}${lienAnnonce(a)}`,
      lastModified: a.publiee_le,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
