/*
 * Écrans de l'application dessinés dans le téléphone (stylisés, pas des captures : aucune vraie annonce montrée).
 *   EcranAnnonce : une annonce, son badge « Vérifiée »      EcranContact : boutons Appeler / WhatsApp, puis l'appel
 * Repère : l'écran sous la barre d'état, LARGEUR_ECRAN de large.
 */
import { Bath, BadgeCheck, BedDouble, Heart, House, MapPin, Phone, Search, Sofa, UserRound } from "lucide-react";
import { doux, entree, flotte } from "../motion/anim";
import { Logo } from "../motion/Elements";
import { Maison } from "../motion/Illustrations";
import { P, TITRE } from "../motion/palette";
import { PROPRIETAIRE, Personnage } from "../motion/Personnage";

/** Téléphone de la scène : position et taille (le doigt vise les boutons avec ces valeurs) */
export const TEL = { x: 540, y: 1110, largeur: 580 };
const BORD = TEL.largeur * 0.035;
export const LARGEUR_ECRAN = TEL.largeur - 2 * BORD;
/** Coin haut gauche du contenu de l'écran, dans l'image */
export const ORIGINE_ECRAN = { x: TEL.x - TEL.largeur / 2 + BORD, y: TEL.y - (TEL.largeur * 2.05) / 2 + BORD + TEL.largeur * 0.11 };
/** Bouton « Appeler » de l'écran de contact (centre, dans le repère de l'écran) */
export const BOUTON_APPELER = { x: LARGEUR_ECRAN / 2, y: 520 };

const W = LARGEUR_ECRAN;

function BarreApp() {
  return (
    <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: `2px solid ${P.bord}` }}>
      <Logo largeur={210} />
      <Search size={34} color={P.encre} strokeWidth={2.4} />
    </div>
  );
}

/** Barre d'onglets en bas de l'écran */
function Onglets() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: P.blanc, borderTop: `2px solid ${P.bord}`,
      display: "flex", justifyContent: "space-around", alignItems: "center" }}>
      <House size={34} color={P.vert} strokeWidth={2.4} />
      <Search size={34} color={P.grisClair} strokeWidth={2.4} />
      <Heart size={34} color={P.grisClair} strokeWidth={2.4} />
      <UserRound size={34} color={P.grisClair} strokeWidth={2.4} />
    </div>
  );
}

function Caracteristique({ icone, texte }: { icone: React.ReactNode; texte: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 14, background: P.grisPale,
      fontFamily: TITRE, fontWeight: 600, fontSize: 22, color: P.encre, whiteSpace: "nowrap" }}>
      {icone}{texte}
    </span>
  );
}

export function EcranAnnonce({ f, verifiee }: { f: number; verifiee: number }) {
  const badge = entree(f, verifiee + 6, 11, 200);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BarreApp />
      <div style={{ padding: 20 }}>
        <div style={{ borderRadius: 26, overflow: "hidden", position: "relative", boxShadow: "0 10px 24px rgba(0,0,0,0.10)" }}>
          <Maison largeur={W - 40} hauteur={330} f={f} />
          <div style={{ position: "absolute", left: 16, top: 16, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 10px",
            borderRadius: 999, background: P.blanc, fontFamily: TITRE, fontWeight: 800, fontSize: 24, color: P.vert,
            transform: `scale(${badge})`, transformOrigin: "0 50%" }}>
            <BadgeCheck size={30} color={P.blanc} fill={P.vert} strokeWidth={2.2} /> Vérifiée
          </div>
        </div>
        <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 36, color: P.encre, marginTop: 20, letterSpacing: "-0.02em" }}>Appartement 2 pièces</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: TITRE, fontWeight: 600, fontSize: 26, color: P.gris, marginTop: 6 }}>
          <MapPin size={26} color={P.vert} strokeWidth={2.4} /> Cocody, Abidjan
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Caracteristique icone={<BedDouble size={26} color={P.vert} />} texte="1 chambre" />
          <Caracteristique icone={<Sofa size={26} color={P.vert} />} texte="1 salon" />
          <Caracteristique icone={<Bath size={26} color={P.vert} />} texte="1 douche" />
        </div>
        {/* l'annonce suivante, à moitié visible */}
        <div style={{ marginTop: 26, borderRadius: 26, overflow: "hidden", opacity: 0.9 }}>
          <Maison largeur={W - 40} hauteur={240} f={f + 40} ciel="#CDEBD9" mur="#FFF4E0" toit="#2A7E56" />
        </div>
      </div>
      <Onglets />
    </div>
  );
}

function WhatsApp({ taille }: { taille: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

/** Écran de contact ; « appel » : image où l'appel démarre (l'écran d'appel monte) */
export function EcranContact({ f, appel }: { f: number; appel: number }) {
  const monte = doux(f, appel, 9);
  const presse = f >= appel - 4 && f < appel + 2 ? 0.94 : 1;
  const bouton = (fond: string, icone: React.ReactNode, texte: string, echelle = 1) => (
    <div style={{ height: 104, borderRadius: 26, background: fond, display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
      fontFamily: TITRE, fontWeight: 800, fontSize: 38, color: P.blanc, transform: `scale(${echelle})`, boxShadow: "0 10px 20px rgba(0,0,0,0.12)" }}>
      {icone}{texte}
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BarreApp />
      <div style={{ padding: 20 }}>
        <div style={{ borderRadius: 26, overflow: "hidden" }}><Maison largeur={W - 40} hauteur={250} f={f} /></div>
        <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 34, color: P.encre, marginTop: 18 }}>Appartement 2 pièces</div>
        <div style={{ fontFamily: TITRE, fontWeight: 600, fontSize: 26, color: P.gris, marginTop: 4, marginBottom: 26 }}>Contacter l'annonceur</div>
        {/* centre du bouton Appeler à y = 520 dans l'écran (BOUTON_APPELER) */}
        {bouton(P.vert, <Phone size={40} color={P.blanc} fill={P.blanc} strokeWidth={1.5} />, "Appeler", presse)}
        <div style={{ height: 18 }} />
        {bouton("#25D366", <WhatsApp taille={42} />, "WhatsApp")}
      </div>
      <Onglets />
      {/* écran d'appel */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${P.vert} 0%, ${P.vertFonce} 100%)`,
        transform: `translateY(${(1 - monte) * 105}%)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 140 }}>
        <div style={{ position: "relative", width: 260, height: 260 }}>
          {[0, 1, 2].map((i) => {
            const t = ((f - appel + i * 12) % 36) / 36;
            return <div key={i} style={{ position: "absolute", inset: -t * 90, borderRadius: 999, border: `4px solid ${P.orClair}`, opacity: (1 - t) * 0.8 * monte }} />;
          })}
          <div style={{ position: "absolute", inset: 0, borderRadius: 999, overflow: "hidden", background: P.orPale, border: `6px solid ${P.blanc}` }}>
            <Personnage type={PROPRIETAIRE} x={125} y={330} taille={0.78} buste sourire={0.9} bouche={f > appel + 30 ? Math.abs(flotte(f, 0.4)) * 0.5 : 0} f={f} />
          </div>
        </div>
        <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 42, color: P.blanc, marginTop: 50 }}>Propriétaire</div>
        <div style={{ fontFamily: TITRE, fontWeight: 600, fontSize: 28, color: P.vertPale, marginTop: 8, opacity: 0.85 }}>
          {f > appel + 30 ? "En ligne" : "Appel en cours…"}
        </div>
      </div>
    </div>
  );
}
