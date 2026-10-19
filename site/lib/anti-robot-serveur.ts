/*
 * Vérification, par le serveur du site, du jeton anti-robot (Cloudflare Turnstile) joint à un formulaire
 * (lib/anti-robot.ts). Réglée dans Vercel par TURNSTILE_SECRET_KEY (clé secrète, voir DEPANNAGE.md) : sans elle,
 * rien n'est vérifié (le site marche comme avant que le contrôle soit réglé).
 */

const VERIFICATION = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type Verdict = { ok: true } | { ok: false; raison: "jeton_absent" | "refuse" | "injoignable" };

/**
 * Le jeton est-il bon ? Cloudflare ne l'accepte qu'une fois et pendant 5 minutes. « appeler » : fetch, remplacé
 * dans les tests.
 */
export async function verifierJeton(
  secret: string | undefined,
  jeton: unknown,
  adresse: string | null,
  appeler: typeof fetch = fetch,
): Promise<Verdict> {
  if (!secret?.trim()) return { ok: true };
  if (typeof jeton !== "string" || !jeton || jeton.length > 2048) return { ok: false, raison: "jeton_absent" };
  const formulaire = new URLSearchParams({ secret: secret.trim(), response: jeton });
  if (adresse) formulaire.set("remoteip", adresse);
  try {
    const reponse = await appeler(VERIFICATION, { method: "POST", body: formulaire, signal: AbortSignal.timeout(10_000) });
    const resultat = (await reponse.json()) as { success?: boolean; "error-codes"?: string[] };
    if (resultat.success === true) return { ok: true };
    console.error("Anti-robot : jeton refusé", resultat["error-codes"] ?? []);
    return { ok: false, raison: "refuse" };
  } catch (e) {
    console.error("Anti-robot : Cloudflare injoignable", e);
    return { ok: false, raison: "injoignable" };
  }
}
