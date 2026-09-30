"use client";

/*
 * Mène à sa vitrine (/annonceur/…) ; sans compte, à la connexion (qui ramène ici).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { maVitrine } from "@/lib/annonces";
import { lienVitrine } from "@/lib/annonces-en-ligne";
import { lireProfil, messageErreur, useCompte } from "@/lib/compte";
import s from "@/components/fiche/Fiche.module.css";

export default function VersMaVitrine() {
  const { etat, utilisateur } = useCompte();
  const router = useRouter();
  const [erreur, setErreur] = useState("");
  const id = utilisateur?.id;

  useEffect(() => {
    if (etat === "anonyme") return router.replace("/connexion?suite=/ma-vitrine");
    if (!id) return;
    let actif = true;
    lireProfil(id)
      .then(async (p) => {
        const v = await maVitrine(p.code_vitrine);
        if (actif) router.replace(v ? lienVitrine(v) : `/annonceur/${p.code_vitrine}`);
      })
      .catch((e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [etat, id, router]);

  return (
    <div className={s.page}>
      <div className={s.introuvable}>
        {erreur || etat === "indisponible" ? (
          <p role="alert">Votre vitrine ne peut pas être ouverte pour l&apos;instant{erreur ? ` : ${erreur}` : ""}. Réessayez dans un moment.</p>
        ) : (
          <p>Ouverture de votre vitrine…</p>
        )}
      </div>
    </div>
  );
}
