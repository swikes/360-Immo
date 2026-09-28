import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Estimer mon bien" };

export default function Estimation() {
  return <BientotDisponible titre="Combien vaut votre bien ?" etape="Estimation" maquette="360-immo-estimation.html" />;
}
