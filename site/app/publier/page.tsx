import type { Metadata } from "next";
import Publication from "@/components/publication/Publication";

export const metadata: Metadata = {
  title: "Publier une annonce",
  description: "Vendez ou louez votre bien en Côte d'Ivoire : publiez votre annonce avec photos sur 360-Immo.ci.",
};

export default function PagePublier() {
  return <Publication />;
}
