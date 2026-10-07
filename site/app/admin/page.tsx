import type { Metadata } from "next";
import Administration from "@/components/admin/Administration";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

export default function PageAdministration() {
  return <Administration />;
}
