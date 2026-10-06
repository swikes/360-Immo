import type { Metadata } from "next";
import ArreterAlerte from "@/components/compte/ArreterAlerte";

export const metadata: Metadata = { title: "Arrêter une alerte", robots: { index: false } };

export default function PageArreterAlerte() {
  return <ArreterAlerte />;
}
