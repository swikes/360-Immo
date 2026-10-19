"use client";

/*
 * Dernier recours : erreur dans la mise en page générale elle-même (app/layout.tsx), où app/error.tsx ne peut rien
 * afficher. Page minimale en français, sans les styles du site.
 */
export default function ErreurGenerale({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FAFAF8", color: "#1C1C1E" }}>
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: "0 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 26 }}>360-Immo.ci ne répond pas pour l&apos;instant</h1>
          <p style={{ color: "#555", lineHeight: 1.6 }}>Réessayez dans quelques instants : rien n&apos;a été supprimé.</p>
          <button type="button" onClick={reset}
            style={{ marginTop: 16, padding: "12px 24px", borderRadius: 50, border: "none", background: "#1E5E3F", color: "#fff", fontSize: 15, cursor: "pointer" }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
