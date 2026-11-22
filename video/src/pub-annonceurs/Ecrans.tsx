/*
 * Écrans dessinés dans le téléphone de la publicité « Annonceurs » (stylisés, aucune vraie annonce ni vraie personne) :
 *   EcranVitrine   la vitrine de l'annonceur : bandeau « C'est votre vitrine », bouton « Partager ma vitrine », menu de
 *                  partage (WhatsApp, copier le lien), annonces
 *   EcranVerrouille  écran de verrouillage (heure), pour les notifications
 * Les textes reprennent ceux du site (components/vitrine/BandeauProprietaire.tsx, components/BoutonPartage.tsx).
 */
import { Copy, House, Link2, Share2, UserRound } from "lucide-react";
import { doux, entree } from "../motion/anim";
import { Logo } from "../motion/Elements";
import { CarteAnnonce } from "../motion/Illustrations";
import { P, TITRE } from "../motion/palette";

export function LogoWhatsApp({ taille, couleur = "#FFFFFF" }: { taille: number; couleur?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill={couleur} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

/** Téléphone de la scène « partager » et position du bouton et du choix WhatsApp (repère de l'écran) */
export const TEL = { x: 540, y: 1060, largeur: 600 };
const BORD = TEL.largeur * 0.035;
export const LARGEUR_ECRAN = TEL.largeur - 2 * BORD;
export const ORIGINE_ECRAN = { x: TEL.x - TEL.largeur / 2 + BORD, y: TEL.y - (TEL.largeur * 2.05) / 2 + BORD + TEL.largeur * 0.11 };
export const BOUTON_PARTAGER = { x: LARGEUR_ECRAN / 2, y: 314 };
export const CHOIX_WHATSAPP = { x: LARGEUR_ECRAN / 2, y: 914 };

export function EcranVitrine({ f, partage, whatsapp }: { f: number; partage: number; whatsapp: number }) {
  const W = LARGEUR_ECRAN;
  const menu = doux(f, partage + 2, 8) * (1 - doux(f, whatsapp + 8, 6));
  const presseP = f >= partage - 3 && f < partage + 3 ? 0.95 : 1;
  const presseW = f >= whatsapp - 3 && f < whatsapp + 3;
  return (
    <div style={{ position: "absolute", inset: 0, background: P.creme }}>
      <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: `2px solid ${P.bord}`, background: P.blanc }}>
        <Logo largeur={210} />
        <UserRound size={34} color={P.encre} strokeWidth={2.4} />
      </div>
      {/* en-tête de la vitrine */}
      <div style={{ padding: "22px 24px 0", display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: P.vert, display: "grid", placeItems: "center", fontFamily: TITRE, fontWeight: 800, fontSize: 40, color: P.blanc }}>VN</div>
        <div style={{ fontFamily: TITRE }}>
          <div style={{ fontWeight: 800, fontSize: 36, color: P.encre }}>Votre nom</div>
          <div style={{ fontWeight: 600, fontSize: 24, color: P.gris }}>Particulier · vos annonces en ligne</div>
        </div>
      </div>
      {/* bandeau du propriétaire */}
      <div style={{ margin: "20px 20px 0", padding: "18px 20px", borderRadius: 22, background: P.vertPale, fontFamily: TITRE }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 800, fontSize: 27, color: P.vert }}>
          <House size={28} color={P.vert} strokeWidth={2.4} /> C&apos;est votre vitrine.
        </div>
        <div style={{ marginTop: 14, height: 76, borderRadius: 18, background: P.vert, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          fontWeight: 800, fontSize: 30, color: P.blanc, transform: `scale(${presseP})` }}>
          <Share2 size={32} color={P.blanc} strokeWidth={2.6} /> Partager ma vitrine
        </div>
      </div>
      {/* annonces */}
      <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <CarteAnnonce largeur={W - 40} titre="Appartement 3 pièces" lieu="Cocody" f={f} badges={[{ texte: "À louer", fond: P.vert }]} />
        <CarteAnnonce largeur={W - 40} titre="Villa 5 pièces" lieu="Bingerville" f={f + 30} ciel="#CDEBD9" mur="#FFF4E0" toit="#2A7E56"
          badges={[{ texte: "À vendre", fond: P.orFonce }]} />
      </div>
      {/* menu de partage (comme sur le site : WhatsApp, copier le lien) */}
      {menu > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.35 * menu})` }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: `translateY(${(1 - menu) * 100}%)`, background: P.blanc,
            borderRadius: "34px 34px 0 0", padding: "26px 24px 40px", fontFamily: TITRE }}>
            <div style={{ width: 80, height: 8, borderRadius: 4, background: P.bord, margin: "0 auto 22px" }} />
            <div style={{ fontWeight: 800, fontSize: 32, color: P.encre, marginBottom: 18 }}>Partager ma vitrine</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 22px", borderRadius: 22, background: presseW ? "#D8F7E3" : P.grisPale,
              fontWeight: 800, fontSize: 32, color: P.encre, transform: presseW ? "scale(0.97)" : undefined }}>
              <span style={{ width: 64, height: 64, borderRadius: 999, background: "#25D366", display: "grid", placeItems: "center" }}><LogoWhatsApp taille={38} /></span>
              WhatsApp
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 22px", marginTop: 12, borderRadius: 22, background: P.grisPale,
              fontWeight: 700, fontSize: 30, color: P.encre }}>
              <span style={{ width: 64, height: 64, borderRadius: 999, background: P.bord, display: "grid", placeItems: "center" }}><Copy size={32} color={P.encre} /></span>
              Copier le lien
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Message WhatsApp avec le lien de la vitrine (s'envole vers les contacts) */
export function MessageVitrine({ largeur = 560 }: { largeur?: number }) {
  return (
    <div style={{ width: largeur, background: "#DCF8C6", borderRadius: "28px 28px 6px 28px", padding: "18px 22px", fontFamily: TITRE,
      boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
      <div style={{ fontWeight: 600, fontSize: 26, color: P.encre }}>Découvrez mes annonces immobilières sur 360Immo.ci :</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 24, color: "#1A73E8" }}>
        <Link2 size={26} color="#1A73E8" /> 360immo.ci/annonceur/…
      </div>
    </div>
  );
}

/** Écran de verrouillage : l'heure, la date */
export function EcranVerrouille({ f }: { f: number }) {
  const p = entree(f, 0, 14, 120);
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 30% 20%, ${P.vertMoyen} 0%, ${P.vertFonce} 55%, #0B2418 100%)`,
      fontFamily: TITRE, color: P.blanc, textAlign: "center" }}>
      <div style={{ marginTop: 40, fontSize: 30, fontWeight: 600, opacity: 0.8 * p }}>samedi</div>
      <div style={{ fontSize: 150, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1, opacity: p }}>10:42</div>
    </div>
  );
}
