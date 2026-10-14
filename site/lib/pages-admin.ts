"use client";

/*
 * Administration → Pages du site et → Contact (supabase/migrations/…_pages_contact.sql). La base vérifie elle-même
 * que le compte est de l'équipe.
 */
import type { DemandeContact } from "./contact";
import type { AdressePage, PageAdmin } from "./pages-site";
import { supabase } from "./supabase";

async function rpc<T>(fonction: string, parametres?: Record<string, unknown>): Promise<T> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  const { data, error } = await sb.rpc(fonction, parametres);
  if (error) throw error;
  return data as T;
}

export type PageAEnregistrer = { slug: AdressePage; titre: string; resume: string; contenu: string; notes: string };

export const pagesAdmin = () => rpc<PageAdmin[]>("admin_pages");
export const enregistrerPage = (page: PageAEnregistrer) => rpc<PageAdmin>("enregistrer_page", { page });
export const publierPage = (adresse: AdressePage, publier: boolean) => rpc<PageAdmin>("publier_page", { adresse, publier });

export const demandesContact = () => rpc<DemandeContact[]>("admin_contacts");
export const traiterContact = (demande: string, traitee: boolean) => rpc<void>("traiter_contact", { demande, traitee });
