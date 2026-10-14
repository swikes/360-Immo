"use client";

/*
 * Envoi du formulaire Contact (envoyer_contact dans la base : supabase/migrations/…_pages_contact.sql), avec ou sans
 * compte. L'équipe est prévenue par e-mail aussitôt (relancerEmails) et retrouve la demande dans Administration → Contact.
 */
import type { SujetContact } from "./contact";
import { relancerEmails } from "./relance-emails";
import { supabase } from "./supabase";

export type NouvelleDemande = { nom: string; email: string; telephone: string; sujet: SujetContact; reference: string; message: string };

export async function envoyerContact(d: NouvelleDemande): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  const { data, error } = await sb.rpc("envoyer_contact", {
    demande: {
      nom: d.nom.trim(), email: d.email.trim() || null, telephone: d.telephone.trim() || null, sujet: d.sujet,
      reference: d.reference.trim() || null, message: d.message.trim(),
    },
  });
  if (error) throw error;
  relancerEmails();
  return data as string;
}
