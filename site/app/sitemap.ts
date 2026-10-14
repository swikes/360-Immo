/*
 * Plan du site pour Google (/sitemap.xml) : pages principales, chaque annonce en ligne, et la page des prix de chaque
 * commune qui a au moins un prix (les autres ne sont pas proposées à Google : app/prix/[commune]/page.tsx).
 */
import type { MetadataRoute } from "next";
import { lienAnnonce } from "@/lib/annonces-en-ligne";
import { communesAvecPrix, planDuSite } from "@/lib/annonces-serveur";
import { lienCommune } from "@/lib/prix-marche";
import { ADRESSE_SITE } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [annonces, communes] = await Promise.all([planDuSite().catch(() => []), communesAvecPrix().catch(() => [])]);
  return [
    { url: `${ADRESSE_SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ADRESSE_SITE}/annonces`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/annonces?tx=location`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/annonces?tx=achat`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${ADRESSE_SITE}/publier`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${ADRESSE_SITE}/estimation`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ADRESSE_SITE}/carte-des-prix`, changeFrequency: "weekly", priority: 0.7 },
    ...communes.map((c) => ({ url: `${ADRESSE_SITE}${lienCommune(c.commune)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...annonces.map((a) => ({
      url: `${ADRESSE_SITE}${lienAnnonce(a)}`,
      lastModified: a.publiee_le,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
