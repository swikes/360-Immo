/*
 * Après un message, une demande de visite ou une réponse : le site demande l'envoi immédiat des e-mails en attente
 * (app/api/notifications). Sans réponse, rien n'est perdu : l'envoi du matin s'en charge.
 */
export function relancerEmails() {
  try {
    void fetch("/api/notifications", { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // navigateur sans fetch : l'envoi du matin s'en charge
  }
}
