import type { Metadata } from "next";
import BientotDisponible from "@/components/BientotDisponible";

export const metadata: Metadata = { title: "Guide & Blog" };

export default function Blog() {
  return <BientotDisponible titre="Guide & Blog" etape="Guide & Blog" maquette="360-immo-blog.html" />;
}
