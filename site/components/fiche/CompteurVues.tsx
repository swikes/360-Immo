"use client";

/*
 * Une vue de plus pour l'annonce (fonction compter_vue de la base), une seule fois par visite du navigateur.
 * Comptée par le navigateur et non par le serveur : les robots (Google…) ne gonflent pas le nombre.
 */
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CompteurVues({ id }: { id: string }) {
  useEffect(() => {
    const cle = `vue-${id}`;
    try {
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, "1");
    } catch {
      // navigation privée : on compte quand même
    }
    supabase()?.rpc("compter_vue", { annonce: id }).then(() => {}, () => {});
  }, [id]);
  return null;
}
