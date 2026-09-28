import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Publier une annonce" };

export default function Publier() {
  return <BientotDisponible titre="Publier une annonce" etape="Publication avec photos" maquette="360-immo-publier-annonce.html" />;
}
