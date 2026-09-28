import type { Metadata } from "next";
import MonEspace from "@/components/compte/MonEspace";

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } };

export default function PageMonEspace() {
  return <MonEspace />;
}
