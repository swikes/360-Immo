import type { Metadata } from "next";
import Connexion from "@/components/compte/Connexion";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous ou créez gratuitement votre compte 360-Immo.ci pour publier et suivre vos annonces.",
};

export default function PageConnexion() {
  return <Connexion />;
}
