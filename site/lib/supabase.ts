/*
 * Connexion du site à la base de données (Supabase), depuis le navigateur.
 *
 * L'adresse de la base et sa clé publique viennent des réglages de Vercel (Environment Variables) :
 *   NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (voir DEPANNAGE.md).
 * Ces deux valeurs sont publiques : la base ne laisse faire que ce que ses règles d'accès permettent.
 * Sans elles (site construit sans les réglages), le site marche, mais sans comptes ni connexion.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ADRESSE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Le site sait-il joindre la base ? */
export const baseConfiguree = Boolean(ADRESSE && CLE);

// « Se souvenir de moi » décoché : la connexion est gardée dans l'onglet seulement (sessionStorage) et
// s'arrête quand on ferme le navigateur. Sinon elle est gardée sur l'appareil (localStorage).
const SOUVENIR = "360-immo-souvenir";

export function seSouvenir(oui: boolean) {
  try {
    if (oui) localStorage.removeItem(SOUVENIR);
    else localStorage.setItem(SOUVENIR, "non");
  } catch {
    // navigation privée : rien à retenir
  }
}

const rangement = {
  getItem(cle: string) {
    try {
      return sessionStorage.getItem(cle) ?? localStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  setItem(cle: string, valeur: string) {
    try {
      const garder = localStorage.getItem(SOUVENIR) !== "non";
      (garder ? localStorage : sessionStorage).setItem(cle, valeur);
      (garder ? sessionStorage : localStorage).removeItem(cle);
    } catch {
      // stockage refusé : la connexion dure le temps de la page
    }
  },
  removeItem(cle: string) {
    try {
      localStorage.removeItem(cle);
      sessionStorage.removeItem(cle);
    } catch {
      // rien à effacer
    }
  },
};

let client: SupabaseClient | null = null;

/** Le client Supabase du navigateur (null si le site n'a pas les réglages de la base) */
export function supabase(): SupabaseClient | null {
  if (!baseConfiguree || typeof window === "undefined") return null;
  client ??= createClient(ADRESSE!, CLE!, {
    auth: {
      storage: rangement,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // lien « mot de passe oublié » reçu par e-mail
      // Liens reçus par e-mail valables dans n'importe quel navigateur (l'appli Gmail ouvre souvent le sien)
      flowType: "implicit",
    },
  });
  return client;
}
