import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Carte des prix" };

export default function CarteDesPrix() {
  return <BientotDisponible titre="Carte des prix de l'immobilier" etape="Carte des prix" maquette="360-immo-carte.html" />;
}
