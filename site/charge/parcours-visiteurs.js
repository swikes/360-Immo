/*
 * Test de charge de 360-Immo.ci avec k6 (https://k6.io, outil libre de Grafana) : des visiteurs simulés parcourent
 * le site en même temps, comme de vrais visiteurs, avec des pauses de lecture (3 à 8 secondes) entre les pages.
 * En lecture seule : aucun compte, aucun message, aucun formulaire envoyé ; rien n'est écrit dans la base.
 *
 * Parcours d'un visiteur : accueil → liste des annonces (location ou achat, parfois une commune) → une fiche
 * → parfois la carte des prix, le blog et un article, l'estimation.
 *
 * Lancer (voir charge/README.md) :
 *   k6 run charge/parcours-visiteurs.js                                  palier « fort » sur le site en ligne
 *   k6 run -e PALIER=petit charge/parcours-visiteurs.js                  10 visiteurs en même temps
 *   k6 run -e SITE=http://127.0.0.1:3100 -e PALIER=essai charge/parcours-visiteurs.js   essai sur le site local
 * Paliers : essai (2 visiteurs, 30 s), petit (10), moyen (50), fort (100, par défaut), max (200).
 * Objectifs (seuils) : 95 % des pages en moins de 2 secondes ; moins de 1 % d'erreurs. Le test s'arrête de lui-même
 * si plus de 5 % des pages sont en erreur.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const SITE = (__ENV.SITE || "https://360-immo.vercel.app").replace(/\/$/, "");

// Montée progressive, plateau, puis descente
const monter = (n) => [
  { duration: "1m", target: Math.ceil(n / 4) },
  { duration: "1m", target: Math.ceil(n / 2) },
  { duration: "1m", target: n },
  { duration: "2m", target: n },
  { duration: "30s", target: 0 },
];
const PALIERS = {
  essai: [{ duration: "30s", target: 2 }],
  petit: monter(10),
  moyen: monter(50),
  fort: monter(100),
  max: monter(200),
};
const PAGES = ["accueil", "liste", "fiche", "carte des prix", "blog", "article", "estimation"];

export const options = {
  stages: PALIERS[__ENV.PALIER || "fort"],
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" }, "rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    // une ligne par page dans le bilan
    ...Object.fromEntries(PAGES.map((p) => [`http_req_duration{page:${p}}`, ["p(95)<2000"]])),
  },
  userAgent: "360-Immo.ci test de charge (k6)",
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

const COMMUNES = ["Cocody", "Yopougon", "Marcory", "Plateau", "Bingerville", "Koumassi", "Abobo"];
const choix = (liste) => liste[Math.floor(Math.random() * liste.length)];
const pause = () => sleep(3 + Math.random() * 5);
const liens = (r, motif) => [...new Set([...String(r.body ?? "").matchAll(motif)].map((m) => m[1]))];

/** Une page, comme un navigateur la demande ; vérifie qu'elle répond */
function page(nom, chemin) {
  const r = http.get(SITE + chemin, { tags: { page: nom } });
  check(r, { [`${nom} : la page répond`]: (x) => x.status === 200 });
  return r;
}

export default function () {
  const tx = Math.random() < 0.6 ? "location" : "achat";
  page("accueil", "/");
  pause();

  const lieu = Math.random() < 0.4 ? `&q=${encodeURIComponent(choix(COMMUNES))}` : "";
  const liste = page("liste", `/annonces?tx=${tx}${lieu}`);
  pause();
  const fiches = liens(liste, /href="(\/annonces\/[^"?#]*imm-\d+-\d+)"/g);
  if (fiches.length) {
    page("fiche", choix(fiches));
    pause();
  }

  if (Math.random() < 0.4) {
    page("carte des prix", `/carte-des-prix?tx=${tx}&type=${choix(["appartement", "maison", "terrain"])}`);
    pause();
  }
  if (Math.random() < 0.3) {
    const blog = page("blog", "/blog");
    const articles = liens(blog, /href="(\/blog\/[a-z0-9-]+)"/g);
    if (articles.length) {
      pause();
      page("article", choix(articles));
    }
    pause();
  }
  if (Math.random() < 0.25) {
    page("estimation", "/estimation");
    pause();
  }
}
