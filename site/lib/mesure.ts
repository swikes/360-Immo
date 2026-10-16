"use client";

/*
 * Mesure d'audience, sans cookie ni rien de rangé sur l'appareil : à chaque page, le navigateur envoie à la base
 * seulement le genre de page (accueil, liste, fiche…), d'où vient la visite (Google, Facebook, WhatsApp, lien de
 * campagne…) et le type d'appareil ; la base n'en garde que des compteurs par heure (supabase/migrations/…_audience.sql).
 * Rien ne relie ces chiffres à une personne. Les recherches de la liste et les pages introuvables sont comptées de même.
 * Pas de mesure quand le navigateur demande de ne pas être suivi (« Ne pas me suivre », GPC), pour les robots, ni
 * dans l'espace Administration.
 */
import { supabase } from "./supabase";

export type TypePage =
  | "accueil" | "liste" | "fiche" | "vitrine" | "carte_prix" | "prix_commune" | "estimation" | "blog" | "article"
  | "publier" | "compte" | "mon_espace" | "contact" | "informations" | "introuvable" | "autre";

const INFORMATIONS = ["/a-propos", "/aide", "/devenir-partenaire", "/mentions-legales", "/cgu", "/confidentialite", "/cookies"];

/** Le genre d'une page, d'après son adresse ; null : page à ne pas compter (Administration) */
export function typePage(chemin: string): TypePage | null {
  const c = chemin.replace(/\/+$/, "") || "/";
  if (c === "/admin" || c.startsWith("/admin/")) return null;
  if (c === "/") return "accueil";
  if (c === "/annonces") return "liste";
  if (c.startsWith("/annonces/")) return "fiche";
  if (c.startsWith("/annonceur/") || c === "/ma-vitrine") return "vitrine";
  if (c === "/carte-des-prix") return "carte_prix";
  if (c.startsWith("/prix/")) return "prix_commune";
  if (c === "/estimation") return "estimation";
  if (c === "/blog") return "blog";
  if (c.startsWith("/blog/")) return "article";
  if (c === "/publier") return "publier";
  if (["/connexion", "/mot-de-passe", "/alertes/arreter"].includes(c)) return "compte";
  if (c === "/mon-espace") return "mon_espace";
  if (c === "/contact") return "contact";
  if (INFORMATIONS.includes(c)) return "informations";
  return "autre";
}

export type Source =
  | "direct" | "google" | "autres_moteurs" | "facebook" | "instagram" | "whatsapp" | "tiktok" | "youtube" | "x" | "linkedin"
  | "email" | "sms" | "autre_site";

// Noms de sites ou de campagnes (utm_source) → source
const SOURCES: [RegExp, Source][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)(bing|yahoo|duckduckgo|ecosia|qwant|yandex|baidu|brave)\./, "autres_moteurs"],
  [/(^|\.)(facebook|fb)\.(com|me)$|^fb$|^facebook$|messenger/, "facebook"],
  [/(^|\.)instagram\.com$|^ig$|^instagram$/, "instagram"],
  [/(^|\.)(whatsapp\.(com|net)|wa\.me)$|^wa$|^whatsapp$/, "whatsapp"],
  [/(^|\.)tiktok\.com$|^tiktok$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$|^youtube$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$|^x$|^twitter$/, "x"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$|^linkedin$/, "linkedin"],
  [/mail|^newsletter$/, "email"],
  [/^sms$/, "sms"],
];

/** D'où vient une visite : la source d'un lien de campagne (utm_source), sinon le site d'où l'on arrive */
export function sourceDe(referent: string, utmSource: string | null, origine: string): Source {
  const nom = (utmSource ?? "").trim().toLowerCase();
  if (nom) return SOURCES.find(([motif]) => motif.test(nom))?.[1] ?? "autre_site";
  if (!referent) return "direct";
  let hote = "";
  try {
    const u = new URL(referent);
    if (u.origin === origine) return "direct";
    hote = u.hostname.toLowerCase();
  } catch {
    return "direct";
  }
  // Applications Android (référent android-app://com.facebook.katana…)
  if (hote.startsWith("com.facebook") || hote.includes("facebook")) return "facebook";
  return SOURCES.find(([motif]) => motif.test(hote))?.[1] ?? "autre_site";
}

/** Téléphone, tablette ou ordinateur */
export function appareilDe(agent: string, largeur: number): "telephone" | "tablette" | "ordinateur" {
  if (/iPad|Tablet/i.test(agent) || (/Android/i.test(agent) && !/Mobile/i.test(agent))) return "tablette";
  if (/Mobi|iPhone|Android/i.test(agent) || largeur < 600) return "telephone";
  return "ordinateur";
}

/** Faut-il mesurer ? Pas si le navigateur demande de ne pas être suivi, ni pour un robot */
function mesurable(): boolean {
  if (typeof window === "undefined") return false;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (n.webdriver || n.doNotTrack === "1" || n.globalPrivacyControl === true) return false;
  return !/bot|crawl|spider|slurp|preview|headless/i.test(n.userAgent);
}

// La visite en cours (dans cet onglet, tant que la page n'est pas rechargée) : rien n'est rangé sur l'appareil
let visite: { source: Source } | null = null;

/** Une page vue (et, si c'est la première de la visite, une visite) ; les erreurs sont ignorées */
export function noterPage(chemin: string, introuvable = false): void {
  const page = introuvable ? "introuvable" : typePage(chemin);
  const sb = supabase();
  if (!page || !sb || !mesurable()) return;
  const parametres = new URLSearchParams(window.location.search);
  const nouvelle = visite === null;
  if (nouvelle) visite = { source: sourceDe(document.referrer, parametres.get("utm_source"), window.location.origin) };
  // une visite qui commence en venant du site lui-même (page rechargée, nouvel onglet) n'est pas une nouvelle visite
  const arrivee = nouvelle && !document.referrer.startsWith(window.location.origin);
  sb.rpc("noter_page", {
    page, source: visite!.source, appareil: appareilDe(navigator.userAgent, window.innerWidth), visite: arrivee,
    campagne: arrivee ? parametres.get("utm_campaign") : null, campagne_source: arrivee ? parametres.get("utm_source") : null,
  }).then(() => undefined, () => undefined);
  if (introuvable) sb.rpc("noter_introuvable", { chemin }).then(() => undefined, () => undefined);
}

/** Une recherche de la liste des annonces (critères envoyés à la base) et son nombre de résultats */
export function noterRecherche(criteres: Record<string, unknown>, resultats: number): void {
  const sb = supabase();
  if (!sb || !mesurable()) return;
  sb.rpc("noter_recherche", { criteres, resultats }).then(() => undefined, () => undefined);
}
