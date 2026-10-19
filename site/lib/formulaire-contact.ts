"use client";

/*
 * Envoi du formulaire Contact, avec ou sans compte, par le serveur du site (app/api/contact : contrôle anti-robot,
 * puis envoyer_contact dans la base, supabase/migrations/…_contact_serveur.sql). L'équipe est prévenue par e-mail
 * aussitôt (relancerEmails) et retrouve la demande dans Administration → Contact.
 */
import type { SujetContact } from "./contact";
import { relancerEmails } from "./relance-emails";
import { supabase } from "./supabase";

export type NouvelleDemande = { nom: string; email: string; telephone: string; sujet: SujetContact; reference: string; message: string };

/** jeton : celui du contrôle anti-robot (lib/anti-robot.ts), s'il est réglé */
export async function envoyerContact(d: NouvelleDemande, jeton?: string): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("indisponible");
  // Connecté : le serveur rattache la demande au compte
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({
      demande: {
        nom: d.nom.trim(), email: d.email.trim() || null, telephone: d.telephone.trim() || null, sujet: d.sujet,
        reference: d.reference.trim() || null, message: d.message.trim(),
      },
      jeton,
    }),
  });
  const corps = (await r.json().catch(() => null)) as { id?: string; code?: string; message?: string } | null;
  // règle de la base (message en français) ou contrôle anti-robot refusé : expliqué par messageErreur (lib/compte.ts)
  if (!r.ok) throw Object.assign(new Error(corps?.message ?? ""), { code: corps?.code ?? "contact_indisponible", status: r.status });
  relancerEmails();
  return corps!.id!;
}
