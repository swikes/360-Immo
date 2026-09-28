"use client";

/*
 * Chiffre qui défile de 0 à sa valeur quand il apparaît à l'écran (bandeau des chiffres de l'accueil).
 * Sans JavaScript, ou si l'appareil demande moins d'animations, la valeur s'affiche directement.
 */
import { useEffect, useRef, useState } from "react";
import { formaterPrix } from "@/lib/format";

export default function Compteur({ valeur, suffixe = "" }: { valeur: number; suffixe?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const [affiche, setAffiche] = useState(valeur);

  useEffect(() => {
    if (!el.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let image = 0;
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (!entree.isIntersecting) return;
        observateur.disconnect();
        const debut = performance.now();
        const avancer = (maintenant: number) => {
          const p = Math.min(1, (maintenant - debut) / 1500);
          setAffiche(Math.round(valeur * (1 - Math.pow(1 - p, 3))));   // ralentit en arrivant
          if (p < 1) image = requestAnimationFrame(avancer);
        };
        image = requestAnimationFrame(avancer);
      },
      { threshold: 0.3 },
    );
    observateur.observe(el.current);
    return () => {
      observateur.disconnect();
      cancelAnimationFrame(image);
    };
  }, [valeur]);

  return (
    <span ref={el}>
      {formaterPrix(affiche)}
      {suffixe}
    </span>
  );
}
