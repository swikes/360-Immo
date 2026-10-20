"use client";

/*
 * Compte chaque page vue (mesure d'audience anonyme, sans cookie : lib/mesure.ts). Une page introuvable le signale par
 * un repère (data-page-introuvable, app/not-found.tsx) : elle est comptée comme telle, avec son adresse.
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { noterPage, suivrePage } from "@/lib/mesure";

export default function Mesure() {
  const chemin = usePathname();
  useEffect(() => {
    suivrePage(chemin);
    noterPage(chemin, Boolean(document.querySelector("[data-page-introuvable]")));
  }, [chemin]);
  return null;
}
