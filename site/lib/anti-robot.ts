"use client";

/*
 * Contrôle anti-robot (CAPTCHA Cloudflare Turnstile) des formulaires ouverts à tous : inscription, connexion,
 * mot de passe oublié, nouveau lien de confirmation, contact.
 *
 * Réglé dans Vercel par NEXT_PUBLIC_TURNSTILE_SITE_KEY (clé publique, voir DEPANNAGE.md). Sans elle, rien ne
 * s'affiche et les formulaires marchent comme avant. Avec elle, chaque envoi joint un « jeton » prouvant le
 * contrôle : Supabase le vérifie pour les comptes (Authentication → Attack Protection), le serveur du site pour
 * le contact (app/api/contact). Le plus souvent le contrôle est invisible ; une case à cocher n'apparaît qu'en
 * cas de doute.
 */
import { useCallback, useRef } from "react";

export const CLE_ANTI_ROBOT = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

// Ce que le script de Cloudflare met à disposition (https://developers.cloudflare.com/turnstile/)
type Turnstile = {
  render: (zone: HTMLElement, reglages: Record<string, unknown>) => string;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
};

let chargement: Promise<Turnstile> | null = null;

/** Charge une seule fois le script de Cloudflare (adresse permise par next.config.ts) */
function charger(): Promise<Turnstile> {
  chargement ??= new Promise((ok, ko) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (t) ok(t);
      else ko(new Error("anti-robot"));
    };
    script.onerror = () => {
      chargement = null; // nouvel essai à la prochaine ouverture d'un formulaire
      script.remove();
      ko(new Error("anti-robot"));
    };
    document.head.appendChild(script);
  });
  return chargement;
}

/** Délai d'attente d'un jeton au moment de l'envoi (contrôle encore en cours, ou case à cocher) */
const ATTENTE = 20_000;

/**
 * Le contrôle d'un formulaire : « zone » (où Cloudflare dessine la case, si besoin) à placer dans le formulaire
 * quand « actif », et « jeton() » à appeler au moment de l'envoi. Un jeton ne sert qu'une fois : le suivant se
 * prépare aussitôt (nouvel essai après une erreur de mot de passe, par exemple).
 */
export function useAntiRobot() {
  const widget = useRef<{ t: Turnstile; id: string } | null>(null);
  const pret = useRef<string | null>(null);
  const enAttente = useRef<((jeton: string) => void)[]>([]);

  // Le contrôle vit avec sa zone : dessiné quand elle apparaît, retiré quand elle disparaît (écran suivant)
  const zone = useCallback((el: HTMLDivElement | null) => {
    if (!CLE_ANTI_ROBOT || !el) return;
    let retire = false;
    charger().then(
      (t) => {
        if (retire) return;
        const id = t.render(el, {
          sitekey: CLE_ANTI_ROBOT,
          language: "fr",
          appearance: "interaction-only", // invisible, sauf si Cloudflare demande de cocher la case
          size: "flexible",
          callback: (jeton: string) => {
            pret.current = jeton;
            enAttente.current.splice(0).forEach((suite) => suite(jeton));
          },
          "expired-callback": () => {
            pret.current = null; // Cloudflare en prépare un autre tout seul
          },
          "error-callback": () => {
            pret.current = null;
          },
        });
        widget.current = { t, id };
      },
      () => {}, // script injoignable : l'envoi l'expliquera (jeton() → « anti-robot »)
    );
    return () => {
      retire = true;
      if (widget.current) widget.current.t.remove(widget.current.id);
      widget.current = null;
      pret.current = null;
    };
  }, []);

  /** Jeton à joindre à l'envoi (undefined sans contrôle réglé) ; erreur « anti-robot » s'il ne vient pas */
  const jeton = useCallback(async (): Promise<string | undefined> => {
    if (!CLE_ANTI_ROBOT) return undefined;
    const j =
      pret.current ??
      (await new Promise<string | null>((ok) => {
        enAttente.current.push(ok);
        window.setTimeout(() => ok(null), ATTENTE);
      }));
    if (!j) throw new Error("anti-robot");
    pret.current = null;
    if (widget.current) widget.current.t.reset(widget.current.id);
    return j;
  }, []);

  return { actif: Boolean(CLE_ANTI_ROBOT), zone, jeton };
}
