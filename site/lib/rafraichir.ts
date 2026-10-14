"use client";

/*
 * Après une modification dans l'Administration (article du blog, page du site) : demande au site de rafraîchir aussitôt
 * les pages publiques concernées (app/api/rafraichir ; sinon : 10 minutes au plus). Sans conséquence si cela échoue.
 */
import { supabase } from "./supabase";

export async function rafraichirPages(quoi: { articles?: string[]; pages?: string[] }): Promise<void> {
  try {
    const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/rafraichir", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` }, body: JSON.stringify(quoi),
    });
  } catch {
    // les pages se mettront à jour d'elles-mêmes
  }
}
