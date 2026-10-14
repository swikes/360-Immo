/* Page « confidentialite » : écrite dans l'Administration → Pages du site (components/pages/PageSite.tsx) */
import PageSite, { metadonneesPage } from "@/components/pages/PageSite";

// Faite à la première visite, puis gardée 10 minutes ; l'Administration la rafraîchit aussitôt après une modification
export const revalidate = 600;
export const generateMetadata = () => metadonneesPage("confidentialite");

export default function Page() {
  return <PageSite slug="confidentialite" />;
}
