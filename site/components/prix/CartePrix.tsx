"use client";

/*
 * Carte de la page « Carte des prix » : une pastille par commune (lib/positions-communes.ts), plus foncée quand le prix
 * est plus haut (même dégradé de verts que la maquette), plus grande quand il y a plus d'annonces. Grise : pas encore
 * assez d'annonces pour un prix. Toucher une pastille : son nom et son prix ; le lien mène à la page de la commune.
 * Fond de carte OpenStreetMap (bibliothèque Leaflet, chargée seulement sur cette page). Sans connexion au fond de
 * carte, les pastilles restent ; la liste à côté dit tout ce que dit la carte.
 */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { TEINTES } from "@/lib/prix-marche";
import s from "./CartePrix.module.css";

export type Point = {
  commune: string;
  ville: string;
  lien: string;
  position: [number, number];
  nombre: number;
  /** « 300 000 FCFA / mois » ; null : pas encore assez d'annonces */
  prix: string | null;
  /** 0 (le moins cher) à 4 (le plus cher) ; null sans prix */
  classe: number | null;
};

const SANS_PRIX = "#ADADAD";
const COTE_D_IVOIRE: [[number, number], [number, number]] = [[4.3, -8.6], [10.8, -2.4]];

const echapper = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default function CartePrix({ points, titre }: { points: Point[]; titre: string }) {
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let carte: import("leaflet").Map | null = null;
    let fini = false;
    import("leaflet").then(({ default: L }) => {
      if (fini || !boite.current) return;
      carte = L.map(boite.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · positions <a href="https://www.geonames.org/">GeoNames</a>',
      }).addTo(carte);
      // les communes sans prix d'abord : celles qui ont un prix passent par-dessus
      const tries = [...points].sort((a, b) => (a.classe ?? -1) - (b.classe ?? -1));
      for (const p of tries) {
        const rayon = Math.min(26, 7 + Math.sqrt(p.nombre) * 3);
        L.circleMarker(p.position, {
          radius: rayon, weight: 2, color: "#FFFFFF", fillOpacity: 0.9,
          fillColor: p.classe == null ? SANS_PRIX : TEINTES[p.classe],
        })
          .bindPopup(
            `<strong>${echapper(p.commune)}</strong>${p.ville !== p.commune ? ` · ${echapper(p.ville)}` : ""}<br>` +
            (p.prix ? `${echapper(p.prix)}<br><span>${p.nombre} annonces</span>` : `Pas encore assez d'annonces (${p.nombre})`) +
            `<br><a href="${p.lien}">Voir les prix à ${echapper(p.commune)}</a>`,
          )
          .bindTooltip(p.commune, { direction: "top", offset: [0, -rayon] })
          .addTo(carte);
      }
      // toutes les communes qui ont des annonces dans le cadre (zoom de quartier au plus)
      if (points.length) carte.fitBounds(L.latLngBounds(points.map((p) => p.position)).pad(0.3), { maxZoom: 12 });
      else carte.fitBounds(COTE_D_IVOIRE);
    });
    return () => {
      fini = true;
      carte?.remove();
    };
  }, [points]);

  return <div ref={boite} className={s.carte} role="region" aria-label={titre} />;
}
