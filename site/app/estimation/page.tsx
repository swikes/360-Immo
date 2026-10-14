/*
 * « Estimer mon bien » : components/estimation/Estimation.tsx (calcul dans la base : estimer_bien)
 */
import type { Metadata } from "next";
import Estimation from "@/components/estimation/Estimation";

export const metadata: Metadata = {
  title: "Estimer mon bien",
  description:
    "Estimation gratuite du prix ou du loyer de votre bien en Côte d'Ivoire, d'après les annonces semblables de votre quartier, " +
    "de votre commune ou de votre ville.",
  alternates: { canonical: "/estimation" },
};

export default function PageEstimation() {
  return <Estimation />;
}
