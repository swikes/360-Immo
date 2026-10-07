"use client";

/*
 * Statistiques de l'annonceur (supabase/migrations/…_statistiques.sql) :
 *   - sur la fiche, chaque geste est noté une fois par visite du navigateur : numéro affiché, appel, WhatsApp, e-mail,
 *     partage (les vues : components/fiche/CompteurVues.tsx) ; l'auteur de l'annonce ne compte pas
 *   - Mon Espace → Statistiques (components/compte/Statistiques.tsx) : sur 7, 30 ou 90 jours, comparés à la période
 *     d'avant ; jour par jour ; annonce par annonce avec la position du prix et des conseils
 */
import { supabase } from "./supabase";

export type Action = "numero" | "appel" | "whatsapp" | "email" | "partage";

/** Un geste sur la fiche d'une annonce (une fois par visite du navigateur et par geste) */
export function noterAction(annonce: string, action: Action) {
  const cle = `geste-${action}-${annonce}`;
  try {
    if (sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle, "1");
  } catch {
    // navigation privée : on compte quand même
  }
  supabase()?.rpc("noter_action", { annonce, action }).then(() => {}, () => {});
}

export const PERIODES = [7, 30, 90] as const;
export type Periode = (typeof PERIODES)[number];

export type Chiffres = {
  vues: number; numeros: number; appels: number; whatsapp: number; emails: number; partages: number;
  messages: number; visites: number; rappels: number; favoris: number; alertes: number;
};

export type StatAnnonce = Chiffres & {
  id: string; reference: string; titre: string; statut: "publiee" | "archivee"; en_ligne: boolean;
  type_bien: string; type_nom: string; transaction: "vente" | "location"; loyer_par: "nuit" | "jour" | "mois" | "annee" | null;
  prix: number; surface: number | null; pieces: number | null; commune: string;
  publiee_le: string; expire_le: string | null;
  /** nombre de photos ; longueur de la description */
  photos: number; description: number;
  vues_total: number; favoris_total: number;
  /** prix ramené à une base commune (loyer au mois, prix au m² d'un terrain) et médiane des annonces semblables */
  prix_compare: number | null; comparables: number; mediane: number | null;
};

export type Statistiques = {
  jours: number; du: string; au: string;
  totaux: Chiffres; avant: Chiffres;
  par_jour: { jour: string; vues: number; contacts: number }[];
  annonces: StatAnnonce[];
};

export const CHIFFRES_VIDES: Chiffres = {
  vues: 0, numeros: 0, appels: 0, whatsapp: 0, emails: 0, partages: 0, messages: 0, visites: 0, rappels: 0, favoris: 0, alertes: 0,
};

export async function mesStatistiques(jours: Periode): Promise<Statistiques> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  const { data, error } = await sb.rpc("statistiques_annonceur", { jours });
  if (error) throw error;
  const s = data as Statistiques;
  // sommes de la base : des nombres, toujours
  const nombres = (c: Partial<Chiffres>) =>
    Object.fromEntries(Object.keys(CHIFFRES_VIDES).map((k) => [k, Number(c?.[k as keyof Chiffres] ?? 0)])) as Chiffres;
  return { ...s, totaux: nombres(s.totaux), avant: nombres(s.avant), par_jour: s.par_jour ?? [], annonces: s.annonces ?? [] };
}

/** Contacts : numéros affichés, messages, demandes de visite et de rappel (appels, WhatsApp et e-mails suivent le
 *  numéro affiché : ils ne s'ajoutent pas) */
export const contacts = (c: Chiffres) => c.numeros + c.messages + c.visites + c.rappels;

/** Taux de contact en % (null sans vue) */
export const tauxContact = (c: Chiffres) => (c.vues ? Math.round((contacts(c) / c.vues) * 1000) / 10 : null);

/** Évolution par rapport à la période d'avant, en % ; « nouveau » quand il n'y avait rien avant */
export function evolution(actuel: number, avant: number): number | "nouveau" | null {
  if (!avant) return actuel ? "nouveau" : null;
  return Math.round((actuel / avant - 1) * 100);
}

/** Unité du prix comparé : « FCFA / m² » (terrain), « FCFA / mois », « FCFA / jour », « FCFA » */
export function uniteComparee(a: Pick<StatAnnonce, "type_bien" | "transaction" | "loyer_par">): string {
  if (a.type_bien === "terrain") return "FCFA / m²";
  if (a.transaction === "vente") return "FCFA";
  return a.loyer_par === "jour" ? "FCFA / jour" : a.loyer_par === "nuit" ? "FCFA / nuit" : "FCFA / mois";
}

/** Le prix face à la médiane des annonces semblables : écart en % (null : pas assez d'annonces semblables) */
export function positionPrix(a: StatAnnonce): { ecart: number; mediane: number; unite: string } | null {
  if (!a.en_ligne || !a.mediane || !a.prix_compare) return null;
  return { ecart: Math.round((a.prix_compare / a.mediane - 1) * 100), mediane: a.mediane, unite: uniteComparee(a) };
}

export type Conseil = { ton: "attention" | "info" | "bien"; texte: string };

const JOUR = 86_400_000;

/** Conseils pour une annonce, les plus urgents d'abord */
export function conseils(a: StatAnnonce, jours: number, maintenant = Date.now()): Conseil[] {
  if (a.statut === "archivee") return [];
  const c: Conseil[] = [];
  const reste = a.expire_le ? Math.ceil((new Date(a.expire_le).getTime() - maintenant) / JOUR) : null;
  if (!a.en_ligne) {
    c.push({ ton: "attention", texte: "Expirée : elle n'est plus visible. Renouvelez-la pour 90 jours dans Mes annonces." });
    return c;
  }
  if (reste !== null && reste <= 7) {
    c.push({ ton: "attention", texte: `Elle expire dans ${reste} jour${reste > 1 ? "s" : ""} : renouvelez-la dans Mes annonces pour rester visible.` });
  }
  if (a.photos === 0) {
    c.push({ ton: "attention", texte: "Aucune photo : c'est la première chose que regardent les visiteurs. Ajoutez-en (20 au plus)." });
  } else if (a.photos < 4) {
    c.push({ ton: "info", texte: `Seulement ${a.photos} photo${a.photos > 1 ? "s" : ""} : ajoutez la façade, chaque pièce, la cuisine et la salle de bain.` });
  }
  const prix = positionPrix(a);
  if (prix && prix.ecart >= 15) {
    c.push({ ton: "attention", texte: `Prix ${prix.ecart} % au-dessus des annonces semblables : si les contacts manquent, c'est souvent la raison.` });
  }
  const enLigneDepuis = (maintenant - new Date(a.publiee_le).getTime()) / JOUR;
  if (a.vues >= 20 && contacts(a) === 0) {
    c.push({ ton: "attention", texte: `${a.vues} vues mais aucun contact : revoyez le prix, les photos et la description.` });
  } else if (a.vues < 10 && enLigneDepuis >= Math.min(jours, 7)) {
    c.push({ ton: "info", texte: "Peu de vues : partagez-la sur WhatsApp et Facebook depuis Mes annonces, dans vos groupes et à vos contacts." });
  }
  if (a.description < 120) {
    c.push({ ton: "info", texte: "Description courte : précisez l'état du bien, l'accès, l'eau et l'électricité, les conditions…" });
  }
  if (!c.length) {
    c.push({ ton: "bien", texte: prix && prix.ecart > -15 ? "Rien à redire : annonce complète, au prix du marché." : "Rien à redire : annonce complète." });
  }
  return c;
}
