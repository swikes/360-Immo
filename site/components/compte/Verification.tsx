"use client";

/*
 * Mon Espace → Vérification : faire vérifier par l'équipe 360-Immo.ci
 *   Mon identité   CNI (recto et verso) ou passeport (page photo), et photo de soi tenant la pièce → badge « Identité
 *                  vérifiée » jusqu'à la date de fin de la pièce ; changer de nom le retire
 *   Mon agence     (compte agence) RCCM et logo → badge « Agence vérifiée » et logo sur le site
 *   Mes biens      pour chaque annonce en ligne ou en vérification : titre de propriété ou mandat → « Bien vérifié »
 * Pour chacun : non vérifié, en cours, vérifié, ou refusé avec le motif de l'équipe (on peut alors renvoyer).
 * Les documents vont dans un dossier privé ; la pièce d'identité validée est gardée (compte + 1 an, en cas de plainte), les
 * autres documents sont supprimés une fois la demande traitée (lib/verifications.ts).
 */
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import Icone, { type NomIcone } from "@/components/Icone";
import { urlLogo } from "@/lib/annonces-en-ligne";
import { messageErreur } from "@/lib/compte";
import { taille } from "@/lib/photos";
import {
  demanderVerification, formatsAcceptes, mesVerifications, NOM_CHOIX, piecesDemandees, problemeFichier,
  type ChoixPiece, type Demande, type MesVerifications, type Piece, type TypeVerification,
} from "@/lib/verifications";
import f from "./Formulaire.module.css";
import s from "./MonEspace.module.css";
import v from "./Verification.module.css";

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function Verification({ moi }: { moi: string }) {
  const [donnees, setDonnees] = useState<MesVerifications | null>(null);
  const [erreur, setErreur] = useState("");
  const [fait, setFait] = useState("");

  const charger = useCallback(() => mesVerifications().then(setDonnees, (e) => setErreur(messageErreur(e))), []);
  useEffect(() => {
    let actif = true;
    mesVerifications().then((d) => actif && setDonnees(d), (e) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, []);
  const envoye = () => {
    setFait("Documents envoyés : l'équipe 360-Immo.ci les vérifie et vous répond par e-mail.");
    void charger();
  };

  if (erreur) {
    return <p className={`${f.message} ${f.messageErreur}`} role="alert"><Icone nom="bouclier" taille={16} /> {erreur}</p>;
  }
  if (!donnees) return <p className={v.attente}>Chargement…</p>;
  const { identite, agence, biens } = donnees;
  return (
    <div className={v.page}>
      <div className={v.pourquoi}>
        <p><Icone nom="bouclier" taille={16} /> <span>Les visiteurs font davantage confiance aux annonceurs et aux biens vérifiés : le badge
          s&apos;affiche sur vos annonces et votre vitrine, et le filtre « Biens vérifiés » de la recherche les met en avant.</span></p>
        <p><Icone nom="cadenas" taille={16} /> <span>Vos documents restent privés : seule l&apos;équipe 360-Immo.ci peut les ouvrir. Votre
          pièce d&apos;identité validée est gardée tant que votre compte existe, puis un an (elle ne sert qu&apos;en cas de plainte) ;
          les autres documents sont supprimés dès que la vérification est faite.</span></p>
      </div>
      {fait && <p className={`${f.message} ${f.messageSucces}`} role="status"><Icone nom="valide" taille={16} /> {fait}</p>}

      <section className={s.carte} aria-labelledby="v-identite">
        <Titre id="v-identite" icone="personne" texte="Mon identité" etat={etat(identite.valide, identite.demande)} />
        <p className={s.carteTexte}>
          {agence
            ? "Pour un compte agence, le badge affiché sur vos annonces est celui de l'agence (plus bas) ; vérifier votre identité aide l'équipe à valider l'agence."
            : "Le badge vert « Identité vérifiée » s'affiche sur vos annonces et votre vitrine. Sans lui, vos annonces indiquent « Annonceur non vérifié »."}
        </p>
        {identite.valide && identite.verifiee_le ? (
          <>
            <p className={v.ok}>
              <Icone nom="valide" taille={16} /> Identité vérifiée le {dateFr(identite.verifiee_le)}
              {identite.expire_le ? `, jusqu'au ${dateFr(identite.expire_le)} (fin de validité de votre pièce)` : ""}.
            </p>
            <p className={v.vide}>Si vous changez de prénom ou de nom dans votre profil, le badge est retiré : il faudra renvoyer votre pièce.</p>
            {bientotExpiree(identite.expire_le) && (
              <>
                <p className={`${f.message} ${f.messageInfo}`}>
                  <Icone nom="horloge" taille={16} /> Votre pièce expire bientôt : envoyez dès maintenant votre nouvelle pièce pour garder le badge.
                </p>
                <Suite demande={identite.demande?.statut === "validee" ? null : identite.demande}>
                  <Formulaire moi={moi} type="identite" envoye={envoye} />
                </Suite>
              </>
            )}
          </>
        ) : (
          <>
            {identite.verifiee_le && identite.expire_le && identite.demande?.statut !== "soumise" && (
              <p className={`${f.message} ${f.messageErreur}`}>
                <Icone nom="horloge" taille={16} /> Votre pièce a expiré le {dateFr(identite.expire_le)} : le badge n&apos;est plus affiché.
                Envoyez une pièce en cours de validité.
              </p>
            )}
            <Suite demande={identite.demande?.statut === "validee" ? null : identite.demande}>
              <Formulaire moi={moi} type="identite" envoye={envoye} />
            </Suite>
          </>
        )}
      </section>

      {agence && (
        <section className={s.carte} aria-labelledby="v-agence">
          <Titre id="v-agence" icone="maison" texte={`Mon agence : ${agence.nom}`} etat={etat(agence.verifiee, agence.demande)} />
          {agence.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlLogo(agence.logo)} alt={`Logo de ${agence.nom}`} className={v.logo} width={72} height={72} />
          )}
          {agence.verifiee ? (
            <p className={v.ok}><Icone nom="valide" taille={16} /> Agence vérifiée : le badge{agence.logo ? " et votre logo s'affichent" : " s'affiche"} sur vos annonces,
              votre vitrine et la page d&apos;accueil (agences partenaires).</p>
          ) : (
            <>
              <p className={s.carteTexte}>Le badge « Agence vérifiée » et votre logo s&apos;affichent sur vos annonces, votre vitrine et la page
                d&apos;accueil, parmi les agences partenaires.</p>
              <Suite demande={agence.demande}>
                <Formulaire moi={moi} type="agence" envoye={envoye} />
              </Suite>
            </>
          )}
        </section>
      )}

      <section className={s.carte} aria-labelledby="v-biens">
        <Titre id="v-biens" icone="document" texte="Mes biens" />
        <p className={s.carteTexte}>
          Le badge « Bien vérifié » montre que l&apos;équipe a contrôlé le titre de propriété, ou le mandat si vous louez ou vendez
          pour le propriétaire.
        </p>
        {biens.length === 0 ? (
          <p className={v.vide}>
            Aucune annonce en ligne ou en vérification. <Link href="/publier" className={f.lien}>Publier une annonce</Link>
          </p>
        ) : (
          <ul className={v.biens} aria-label="Mes biens">
            {biens.map((b) => <Bien key={b.id} moi={moi} bien={b} envoye={envoye} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Pièce qui expire dans moins de 30 jours : on peut déjà envoyer la nouvelle */
const bientotExpiree = (fin: string | null) => !!fin && new Date(fin).getTime() - Date.now() < 30 * 86_400_000;

type Etat = "verifie" | "soumise" | "refusee" | "aucune";
const etat = (verifie: boolean, d: Demande): Etat => (verifie ? "verifie" : d?.statut === "soumise" ? "soumise" : d?.statut === "refusee" ? "refusee" : "aucune");
const ETATS: Record<Etat, [string, string]> = {
  verifie: ["Vérifié", v.etatOk], soumise: ["En cours de vérification", v.etatAttente], refusee: ["Refusé", v.etatRefus], aucune: ["Non vérifié", ""],
};

function Titre({ id, icone, texte, etat: e }: { id: string; icone: NomIcone; texte: string; etat?: Etat }) {
  return (
    <div className={v.titreLigne}>
      <h2 id={id} className={s.carteTitre}><Icone nom={icone} taille={18} /> {texte}</h2>
      {e && <span className={`${v.etat} ${ETATS[e][1]}`}>{ETATS[e][0]}</span>}
    </div>
  );
}

/** Demande en cours : on attend ; refusée : le motif, puis le formulaire ; sinon le formulaire */
function Suite({ demande, children }: { demande: Demande; children: React.ReactNode }) {
  if (demande?.statut === "soumise") {
    return (
      <p className={`${f.message} ${f.messageInfo}`}>
        <Icone nom="horloge" taille={16} />
        <span>Documents envoyés le {dateFr(demande.le)} : l&apos;équipe 360-Immo.ci les vérifie et vous répond par e-mail.</span>
      </p>
    );
  }
  return (
    <>
      {demande?.statut === "refusee" && (
        <p className={`${f.message} ${f.messageErreur}`}>
          <Icone nom="fermer" taille={16} />
          <span>
            <strong>Demande refusée le {dateFr(demande.le)}</strong>{demande.motif ? ` : ${demande.motif}` : "."} Renvoyez les documents corrigés
            ci-dessous.
          </span>
        </p>
      )}
      {children}
    </>
  );
}

function Bien({ moi, bien: b, envoye }: { moi: string; bien: MesVerifications["biens"][number]; envoye: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const e = etat(b.verifiee, b.demande);
  return (
    <li className={v.bien}>
      <div className={v.bienLigne}>
        <span className={v.bienNom}>
          <strong>{b.titre}</strong>
          <small>réf. {b.reference} · {b.statut === "publiee" ? "en ligne" : "en vérification"}</small>
        </span>
        <span className={`${v.etat} ${ETATS[e][1]}`}>{e === "verifie" ? "Bien vérifié" : ETATS[e][0]}</span>
      </div>
      {e === "soumise" || e === "verifie" ? null : ouvert ? (
        <Suite demande={b.demande}>
          <Formulaire moi={moi} type="bien" annonce={b.id} envoye={envoye} annuler={() => setOuvert(false)} />
        </Suite>
      ) : (
        <>
          {e === "refusee" && b.demande?.motif && <p className={v.motif}>Motif du refus : {b.demande.motif}</p>}
          <button type="button" className={`${f.boutonContour} ${v.petit}`} onClick={() => setOuvert(true)}>
            <Icone nom="bouclier" taille={15} /> {e === "refusee" ? "Renvoyer les documents" : "Faire vérifier ce bien"}
          </button>
        </>
      )}
    </li>
  );
}

function Formulaire({ moi, type, annonce = null, envoye, annuler }: {
  moi: string; type: TypeVerification; annonce?: string | null; envoye: () => void; annuler?: () => void;
}) {
  const id = useId();
  const [choix, setChoix] = useState<ChoixPiece>("cni");
  const [choisis, setChoisis] = useState<Partial<Record<Piece, File>>>({});
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  const choisir = (piece: Piece, fichier: File | null) => {
    setErreur("");
    if (fichier) {
      const probleme = problemeFichier(piece, fichier);
      if (probleme) return setErreur(probleme);
    }
    setChoisis((c) => {
      const suite = { ...c };
      if (fichier) suite[piece] = fichier;
      else delete suite[piece];
      return suite;
    });
  };

  const envoyer = async () => {
    setErreur("");
    setEnvoi("Préparation des documents…");
    try {
      await demanderVerification(moi, type, choisis, {
        annonce, note, choix,
        avancement: (n, total) => setEnvoi(n < total ? `Envoi des documents… (${n + 1} sur ${total})` : "Envoi de la demande…"),
      });
      envoye();
    } catch (e) {
      // nos propres messages (fichier trop lourd, document manquant…) tels quels ; ceux de la base : messageErreur
      setErreur(e instanceof Error && !("code" in e) && e.message !== "indisponible" ? e.message : messageErreur(e));
      setEnvoi(null);
    }
  };

  return (
    <div className={v.formulaire}>
      {type === "identite" && (
        <fieldset className={v.choix} disabled={!!envoi}>
          <legend className={f.etiquette}>Votre pièce d&apos;identité</legend>
          {(["cni", "passeport"] as const).map((c) => (
            <label key={c} className={`${v.option} ${choix === c ? v.optionChoisie : ""}`}>
              <input type="radio" name={`${id}-piece`} checked={choix === c} onChange={() => setChoix(c)} />
              <span>{c === "cni" ? "Carte nationale d'identité (CNI)" : "Passeport"}</span>
              <small>{c === "cni" ? "recto et verso" : "page photo"}</small>
            </label>
          ))}
        </fieldset>
      )}
      <ul className={v.pieces} aria-label={type === "identite" ? `Documents : ${NOM_CHOIX[choix]}` : "Documents"}>
        {piecesDemandees(type, choix).map((p) => {
          const fichier = choisis[p.piece];
          return (
            <li key={p.piece} className={v.piece}>
              <span className={v.pieceTitre}>
                {p.texte} {p.obligatoire ? <span className={f.obligatoire} aria-hidden="true">*</span> : <span className={v.facultatif}>(facultatif)</span>}
              </span>
              <span className={f.aide}>{p.aide}</span>
              {fichier ? (
                <span className={v.choisi}>
                  <Icone nom={fichier.type === "application/pdf" ? "document" : "photo"} taille={16} />
                  <span className={v.choisiNom}>{fichier.name} <small>· {taille(fichier.size)}</small></span>
                  <button type="button" className={f.lien} disabled={!!envoi} onClick={() => choisir(p.piece, null)}
                    aria-label={`Retirer : ${p.texte}`}>Retirer</button>
                </span>
              ) : (
                <label className={`${f.boutonContour} ${v.petit}`}>
                  <Icone nom={p.piece === "logo" ? "photo" : "plus"} taille={15} />
                  {p.piece === "logo" ? "Choisir une image" : "Choisir une photo ou un PDF"}
                  <input type="file" className={v.cache} accept={formatsAcceptes(p.piece)} aria-label={p.texte} disabled={!!envoi}
                    onChange={(e) => { choisir(p.piece, e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <label htmlFor={`${id}-note`} className={f.etiquette}>Un mot pour l&apos;équipe <span className={v.facultatif}>(facultatif)</span></label>
      <textarea id={`${id}-note`} className={`${f.champ} ${v.note}`} rows={2} maxLength={1000} value={note} disabled={!!envoi}
        onChange={(e) => setNote(e.target.value)}
        placeholder={type === "bien" ? "Ex : je suis le gérant, mandat signé par le propriétaire." : "Ex : carte nationale d'identité."} />
      {erreur && <p className={`${f.message} ${f.messageErreur}`} role="alert"><Icone nom="fermer" taille={16} /> {erreur}</p>}
      <div className={s.boutons}>
        <button type="button" className={f.bouton} disabled={!!envoi} onClick={envoyer}>
          <Icone nom="envoyer" taille={16} /> {envoi ?? "Envoyer pour vérification"}
        </button>
        {annuler && <button type="button" className={f.boutonContour} disabled={!!envoi} onClick={annuler}>Annuler</button>}
      </div>
    </div>
  );
}
