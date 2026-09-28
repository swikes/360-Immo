import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Connexion" };

export default function Connexion() {
  return <BientotDisponible titre="Mon espace" etape="Comptes et connexion" maquette="360-immo-login.html" />;
}
