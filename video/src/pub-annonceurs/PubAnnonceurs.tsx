/*
 * Publicité « Annonceurs » (9:16, ~47 s) : les atouts d'annoncer sur 360Immo.ci.
 *   ouverture au ralenti (un bien à louer ou à vendre) → le téléphone sonne jour et nuit, le démarcheur s'invite →
 *   impact : la vitrine → la partager sur WhatsApp → messages, visites, rappels → publier en cochant →
 *   Premium (au ralenti, pendant la respiration de la musique) → comptes certifiés → un agent visite le bien →
 *   compte sécurisé, WhatsApp, confiance → le démarcheur veut publier lui aussi → fin : publier, c'est gratuit.
 * Tout se cale sur les répliques (scenario.ts) et sur la musique (son entrée tombe sur la vitrine).
 *   npx remotion render src/index.ts pub-annonceurs sortie/pub-annonceurs.mp4
 */
import {
  BadgeCheck, Building2, CalendarCheck, Camera, Check, Crown, KeyRound, ListChecks, Lock, MessageCircle, PhoneCall,
  Plus, Send, Share2, Shield, ShieldCheck, Store, UserRound,
} from "lucide-react";
import { cloneElement } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { doux, elan, entree, flotte, ralenti, secousse } from "../motion/anim";
import { Anneaux, Camera as CameraLente, Plan } from "../motion/Decor";
import { Doigt, Telephone } from "../motion/Ecran";
import { Confettis, Eclats, Flash, Grain, Lueur, Notification, Particules, Rayons, Vignette } from "../motion/Effets";
import { Bruit, Bulle, Logo, Pastille, type Icone } from "../motion/Elements";
import { CarteAnnonce, Devanture, Maison } from "../motion/Illustrations";
import { AGENT, AGENTE, AppareilPhoto, AWA, DEMARCHEUR, Personnage, TelephoneMain, TONTON } from "../motion/Personnage";
import { H, IPS, L, P, TITRE } from "../motion/palette";
import { MotFantome, Mots, NoteMain } from "../motion/Texte";
import { BOUTON_PARTAGER, CHOIX_WHATSAPP, EcranVerrouille, EcranVitrine, LogoWhatsApp, MessageVitrine, ORIGINE_ECRAN, TEL } from "./Ecrans";
import { bouche, DUREE, parole, R, type Replique } from "./scenario";

export { DUREE as IMAGES_PUB_ANNONCEURS };

// ── La musique (public/musique/pub-annonceurs.mp3) : son entrée (16,25 s) tombe sur l'apparition de la marque ──
const MARQUE = R.N3.debut - 8;
const ENTREE_MUSIQUE = 16.25; // secondes, dans le fichier de musique
const DEBUT_MUSIQUE = ENTREE_MUSIQUE - MARQUE / IPS; // moment du fichier joué à l'image 0
const imageMusique = (s: number) => Math.round((s - DEBUT_MUSIQUE) * IPS);
const RESPIRATION = { debut: imageMusique(31.2), fin: imageMusique(32.45) }; // la musique respire : le Premium monte
const COUPURE = R.D2.debut - 6; // la musique se coupe pour le démarcheur…
const REPRISE = R.N11.debut - 4; // … et repart pour la fin, sur un temps fort
const REPRISE_MUSIQUE = 41.26;

// ── Changements de plan ──
const T = {
  probleme: R.N2.debut - 4, vitrine: MARQUE, partage: R.N4.debut - 4, clients: R.N5.debut - 4, publier: R.N6.debut - 4,
  premium: R.N7.debut - 4, certifie: R.N8.debut - 4, visite: R.N9.debut - 4, securite: R.N10.debut - 4, gag: COUPURE, fin: R.N11.debut - 6,
};

const dit = (ids: Replique[], f: number) => bouche(ids, f);

// ───────────────────────── A. Un bien à louer… ou à vendre ? (au ralenti) ─────────────────────────
function Ouverture({ f }: { f: number }) {
  const n1 = R.N1.debut;
  const vol = elan(f, 0, 70); // la carte arrive vite puis flotte, comme suspendue
  const cles: [number, number, number, number][] = [[200, 640, -30, 0], [880, 760, 25, 6], [150, 1480, 15, 12], [930, 1420, -20, 18]];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, ${P.vertMoyen} 0%, ${P.vertFonce} 60%, #0A2016 100%)` }}>
      <Rayons f={f} x={540} y={1060} couleur={P.orClair} opacite={0.1} debut={0} />
      <Particules f={f} nombre={46} couleur={P.orClair} vitesse={0.5} opacite={0.55} />
      <div style={{ position: "absolute", top: 230, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Mots texte="Vous avez un bien" f={f} debut={n1 + 1} ecart={5} taille={96} couleur={P.blanc} />
        <Mots texte="à louer…" f={f} debut={n1 + 24} ecart={5} taille={112} couleur={P.blanc} accents={{ louer: { fond: P.vertClair, couleur: P.blanc } }} />
        <Mots texte="ou à vendre ?" f={f} debut={n1 + 48} ecart={5} taille={112} couleur={P.blanc} accents={{ vendre: { fond: P.orClair, couleur: P.vertFonce } }} />
      </div>
      {/* la maison, en 3D, au ralenti */}
      <div style={{ position: "absolute", left: 540 - 330, top: 860 + (1 - vol) * 900, width: 660, perspective: 1600 }}>
        <div style={{ transform: `rotateY(${(1 - vol) * 70 - 10 + flotte(f, 5) * 6}deg) rotateX(${(1 - vol) * 30 + 6}deg) rotateZ(${(1 - vol) * -20 + flotte(f, 4) * 2}deg)`,
          transformStyle: "preserve-3d" }}>
          <CarteAnnonce largeur={660} titre="Votre bien" lieu="Abidjan" f={f}
            badges={[
              ...(f >= n1 + 26 ? [{ texte: "À louer", fond: P.vert }] : []),
              ...(f >= n1 + 50 ? [{ texte: "À vendre", fond: P.orFonce }] : []),
            ]} />
        </div>
      </div>
      {/* des clés qui flottent au ralenti */}
      {cles.map(([x, y, r, d], i) => {
        const p = elan(f, d, 80);
        return (
          <div key={i} style={{ position: "absolute", left: x - 60 + (1 - p) * (i % 2 ? 400 : -400), top: y + flotte(f, 3 + i, i * 0.2) * 20, opacity: Math.min(1, p * 1.5),
            transform: `rotate(${r + f * (i % 2 ? 0.4 : -0.4)}deg)`, filter: i > 1 ? "blur(3px)" : undefined }}>
            <KeyRound size={i > 1 ? 150 : 110} color={P.orClair} strokeWidth={2} />
          </div>
        );
      })}
      <Vignette force={0.5} />
    </AbsoluteFill>
  );
}

// ───────────────────────── B. Le téléphone sonne jour et nuit ; le démarcheur s'invite ─────────────────────────
function Probleme({ f }: { f: number }) {
  const n2 = R.N2.debut, d1 = R.D1.debut;
  const nuit = doux(f, n2 + 62, 14);
  const ciel = `linear-gradient(180deg, ${nuit > 0.5 ? "#13203D" : "#BFE3F2"} 0%, ${nuit > 0.5 ? "#2B3F6B" : "#EAF6FB"} 100%)`;
  const appels = [n2 + 4, n2 + 22, n2 + 40, n2 + 58, n2 + 76, d1 + 6];
  const sonne = appels.some((a) => f >= a && f < a + 16);
  const arrivee = entree(f, d1 - 6, 13, 130);
  const xD = 1500 - (1500 - 800) * arrivee;
  const main = f >= d1 + 98; // « mais faut me donner quelque chose d'abord »
  return (
    <AbsoluteFill style={{ background: ciel }}>
      <CameraLente f={f - d1} duree={R.D1.fin - d1 + 10} de={1} a={1.1} origine="55% 75%">
      {/* le soleil se couche, la lune se lève */}
      <div style={{ position: "absolute", left: 820, top: 220 + nuit * 500, width: 160, height: 160, borderRadius: 999, background: "#FCE38A",
        opacity: 1 - nuit, boxShadow: "0 0 80px #FCE38A" }} />
      <div style={{ position: "absolute", left: 150, top: 700 - nuit * 480, width: 130, height: 130, borderRadius: 999, background: "#F4F1E6", opacity: nuit,
        boxShadow: "inset -30px -10px 0 #D9D3C0, 0 0 60px rgba(255,255,255,0.4)" }} />
      {nuit > 0 && Array.from({ length: 24 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (i * 397) % L, top: 80 + ((i * 263) % 700), width: 6, height: 6, borderRadius: 9,
          background: P.blanc, opacity: nuit * (0.4 + 0.6 * Math.abs(Math.sin(f / 9 + i))) }} />
      ))}
      <div style={{ position: "absolute", top: 220, width: L, display: "flex", justifyContent: "center", opacity: 1 - doux(f, d1 - 8, 6) }}>
        <Mots texte="Ça sonne… jour et nuit !" f={f} debut={n2 + 24} ecart={6} taille={92} couleur={nuit > 0.5 ? P.blanc : P.encre}
          accents={{ nuit: { fond: P.orClair, couleur: P.vertFonce } }} />
      </div>
      {/* « Allô ? » de tous les côtés */}
      {appels.map((a, i) => (
        <Bulle key={a} texte="Allô ?" f={f} debut={a} fin={a + 26} x={[120, 640, 90, 660, 360, 120][i]} y={[520, 600, 860, 900, 420, 560][i]}
          largeur={300} taille={64} queue={i % 2 ? "bas-gauche" : "bas-droite"} rotation={i % 2 ? 5 : -6} />
      ))}
      <Personnage type={TONTON} x={540 - 200 * doux(f, d1 - 8, 12)} y={1880} taille={1.02} f={f} objetD={<TelephoneMain ecran={sonne ? P.orClair : P.vert} />}
        brasD={[28 + (sonne ? secousse(f, appels.find((a) => f >= a && f < a + 16) ?? 0, 16, 4) : 0), 118]} brasG={[8, -4]}
        yeux={f >= d1 + 20 ? "mi-clos" : f >= n2 + 40 ? "fatigues" : "ouverts"} sueur={doux(f, n2 + 40, 10) * (f >= d1 ? 0 : 1)}
        sourire={f >= d1 + 20 ? -0.3 : -0.5 + 0.3 * (1 - doux(f, n2 + 30, 20))} sourcils={f >= d1 + 20 ? -0.6 : 0.3} regard={f >= d1 ? 1 : 0}
        tete={f >= d1 + 100 ? flotte(f, 0.5) * 7 : 4} />
      {/* le démarcheur */}
      {f >= d1 - 8 && (
        <>
          <Bulle texte="Tonton ! Donne-moi la maison…" f={f} debut={d1 + 2} fin={d1 + 92} x={300} y={460} largeur={700} queue="bas-droite" taille={66} />
          <Bulle texte="Mais faut me donner quelque chose d'abord hein !" f={f} debut={d1 + 98} x={240} y={420} largeur={780} queue="bas-droite" taille={62} />
          <NoteMain texte="(non merci…)" f={f} debut={d1 + 128} x={300} y={800} rotation={-6} taille={88} couleur={nuit > 0.5 ? P.orClair : P.encre} largeur={460} />
          <Personnage type={DEMARCHEUR} x={xD} y={1880} taille={1.06} f={f} miroir bouche={dit(["D1"], f)} sourire={0.9}
            brasG={main ? [70, -40] : [118 + flotte(f, 0.5) * 14, -40]} brasD={[22, 64]} tete={-4 + flotte(f, 0.7) * 3} saut={f < d1 + 6 ? Math.max(0, Math.sin(((f - d1 + 6) / 14) * Math.PI)) * 90 : 0} />
        </>
      )}
      </CameraLente>
    </AbsoluteFill>
  );
}

// ───────────────────────── C. Impact : votre vitrine ─────────────────────────
function Vitrine({ f }: { f: number }) {
  const n3 = R.N3.debut;
  const logo = elan(f, MARQUE + 2, 26);
  const monte = elan(f, n3 + 30, 40);
  const haut = interpolate(logo, [0, 1], [1.8, 1]);
  const remonte = doux(f, n3 + 34, 16);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${P.vertMoyen} 0%, ${P.vertFonce} 65%, #0A2016 100%)` }}>
      <Rayons f={f} x={540} y={760} couleur={P.orClair} opacite={0.16} debut={MARQUE} />
      <Particules f={f} nombre={40} couleur={P.orClair} vitesse={0.8} opacite={0.6} graine={2} />
      <CameraLente f={f - MARQUE} duree={160} de={1} a={1.16} origine="50% 66%">
        <div style={{ position: "absolute", top: 360 - remonte * 210, width: L, display: "flex", justifyContent: "center", transform: `scale(${haut * (1 - remonte * 0.25)})`, opacity: Math.min(1, logo * 2) }}>
          <Logo largeur={820} sombre />
        </div>
        <div style={{ position: "absolute", top: 330, width: L, display: "flex", justifyContent: "center", opacity: remonte }}>
          <Mots texte="Votre vitrine" f={f} debut={n3 + 44} ecart={7} taille={120} couleur={P.blanc} accents={{ vitrine: { fond: P.orClair, couleur: P.vertFonce } }} />
        </div>
        {/* la devanture monte au ralenti */}
        <div style={{ position: "absolute", left: 540 - 460, top: 560 + (1 - monte) * 1300, transform: `rotate(${(1 - monte) * 6}deg)` }}>
          <Devanture largeur={920} enseigne="MA VITRINE" f={f}
            enfants={
              <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
                {[0, 1, 2].map((i) => {
                  const p = elan(f, n3 + 60 + i * 10, 26);
                  return (
                    <div key={i} style={{ transform: `translateY(${(1 - p) * 500}px) rotate(${(i - 1) * 4}deg)`, opacity: Math.min(1, p * 2) }}>
                      <CarteAnnonce largeur={232} titre={["Appartement", "Villa", "Terrain"][i]} lieu={["Cocody", "Riviera", "Bingerville"][i]} f={f + i * 20}
                        ciel={["#BFE3F2", "#CDEBD9", "#FCE7C8"][i]} toit={["#C8553D", "#2A7E56", "#B07D1E"][i]} />
                    </div>
                  );
                })}
              </div>
            } />
        </div>
      </CameraLente>
      <div style={{ position: "absolute", top: 1620, width: L, display: "flex", justifyContent: "center" }}>
        <Pastille texte="Toutes vos annonces, à votre nom" f={f} debut={n3 + 106} icone={<Store />} taille={48} fond={P.blanc} couleur={P.vertFonce} fondIcone={P.or} />
      </div>
      <Flash f={f} debut={MARQUE - 1} duree={12} />
      <Vignette force={0.4} />
    </AbsoluteFill>
  );
}

// ───────────────────────── D. Partager sa vitrine sur WhatsApp ─────────────────────────
function Partage({ f }: { f: number }) {
  const n4 = R.N4.debut;
  const clic1 = n4 + 6, clic2 = n4 + 24;
  const envol = elan(f, clic2 + 4, 30);
  const contacts: [number, number][] = [[170, 520], [910, 640], [180, 1500], [900, 1560]];
  const bouton = { x: ORIGINE_ECRAN.x + BOUTON_PARTAGER.x, y: ORIGINE_ECRAN.y + BOUTON_PARTAGER.y };
  const whatsapp = { x: ORIGINE_ECRAN.x + CHOIX_WHATSAPP.x, y: ORIGINE_ECRAN.y + CHOIX_WHATSAPP.y };
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <Anneaux f={f} couleur={P.vert} x={TEL.x} y={TEL.y} opacite={0.07} ecart={200} nombre={6} />
      <div style={{ position: "absolute", top: 120, width: L, display: "flex", justifyContent: "center" }}>
        <Mots texte="Partagez-la sur WhatsApp" f={f} debut={n4} ecart={5} taille={84} accents={{ WhatsApp: { fond: "#25D366", couleur: P.blanc } }} />
      </div>
      <div style={{ position: "absolute", inset: 0, perspective: 2000 }}>
        <div style={{ position: "absolute", inset: 0, transform: `rotateY(${(1 - entree(f, T.partage, 14, 120)) * -35 + flotte(f, 4) * 2}deg)` }}>
          <Telephone x={TEL.x} y={TEL.y + (1 - entree(f, T.partage, 14, 120)) * 300} largeur={TEL.largeur}>
            <EcranVitrine f={f} partage={clic1} whatsapp={clic2} />
          </Telephone>
        </div>
      </div>
      <Doigt f={f} etapes={[{ a: T.partage, x: 960, y: 1500 }, { a: clic1 - 2, x: bouton.x + 60, y: bouton.y + 10 }, { a: clic1 + 5, x: bouton.x + 60, y: bouton.y + 10 },
        { a: clic2 - 3, x: whatsapp.x - 60, y: whatsapp.y + 10 }]}
        clics={[clic1, clic2]} taille={140} />
      {/* le lien s'envole vers les contacts, au ralenti */}
      {envol > 0 && contacts.map(([x, y], i) => {
        const p = elan(f, clic2 + 4 + i * 3, 30);
        const px = TEL.x + (x - TEL.x) * p, py = TEL.y + (y - TEL.y) * p;
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: 999, background: P.blanc,
              border: `6px solid #25D366`, display: "grid", placeItems: "center", transform: `scale(${entree(f, clic2 + 12 + i * 3, 12, 160)})` }}>
              <UserRound size={74} color={P.vert} strokeWidth={2.2} />
            </div>
            {p < 0.98 && (
              <div style={{ position: "absolute", left: px - 40, top: py - 40, transform: `rotate(${Math.atan2(y - TEL.y, x - TEL.x) * 57.3 + 45}deg) scale(${0.6 + p * 0.6})`, opacity: 1 - p * 0.3 }}>
                <Send size={80} color={P.blanc} fill="#25D366" strokeWidth={1.6} />
              </div>
            )}
          </div>
        );
      })}
      {envol > 0 && (
        <div style={{ position: "absolute", left: 540 - 300, top: 1700, transform: `scale(${entree(f, clic2 + 8, 12, 170)})` }}>
          <MessageVitrine largeur={600} />
        </div>
      )}
    </AbsoluteFill>
  );
}

// ───────────────────────── E. Messages, visites, rappels ─────────────────────────
function Clients({ f }: { f: number }) {
  const n5 = R.N5.debut;
  const notes: { a: number; icone: Icone; fond: string; titre: string; texte: string }[] = [
    { a: n5 + 4, icone: <MessageCircle />, fond: P.vert, titre: "Nouveau message", texte: "Awa K. : Bonjour, est-il toujours libre ?" },
    { a: n5 + 32, icone: <CalendarCheck />, fond: P.or, titre: "Demande de visite", texte: "Samedi à 11 h · Appartement 3 pièces" },
    { a: n5 + 72, icone: <PhoneCall />, fond: P.bleu, titre: "Être rappelé", texte: "Yao B. · En fin de journée (17 h – 20 h)" },
  ];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #24533E 0%, #0E2A1D 70%)` }}>
      <Particules f={f} nombre={36} couleur={P.vertClair} vitesse={0.6} opacite={0.45} graine={5} />
      <div style={{ position: "absolute", inset: 0, perspective: 2200 }}>
        <div style={{ position: "absolute", inset: 0, transform: `rotateX(${8 - elan(f, T.clients, 40) * 8}deg) scale(${1.04 - elan(f, T.clients, 80) * 0.04})` }}>
          <Telephone x={540} y={1180} largeur={800} fondEcran="#0E2A1D">
            <EcranVerrouille f={f - T.clients} />
          </Telephone>
          {notes.map((n, i) => (
            <Notification key={n.titre} f={f} debut={n.a} icone={n.icone} fondIcone={n.fond} titre={n.titre} texte={n.texte} quand={i === 0 ? "maintenant" : "à l'instant"}
              x={540} y={980 + i * 190} largeur={720} />
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", top: 150, width: L, display: "flex", justifyContent: "center", gap: 18 }}>
        <Pastille texte="Messages" f={f} debut={n5 + 6} icone={<MessageCircle />} taille={52} fond={P.blanc} couleur={P.encre} />
        <Pastille texte="Visites" f={f} debut={n5 + 34} icone={<CalendarCheck />} taille={52} fond={P.blanc} couleur={P.encre} fondIcone={P.or} />
        <Pastille texte="Rappels" f={f} debut={n5 + 74} icone={<PhoneCall />} taille={52} fond={P.blanc} couleur={P.encre} fondIcone={P.bleu} />
      </div>
      <Vignette force={0.45} />
    </AbsoluteFill>
  );
}

// ───────────────────────── F. Publier : cochez, décochez, c'est prêt ─────────────────────────
const PUCES = ["Air conditionné", "Chauffe-eau", "Balcon", "Terrasse", "Piscine", "Jardin", "Parking", "Gardien", "Fibre / Wifi", "Rénové"];
// la puce, le moment où le doigt la touche (images après le début de la réplique) ; « Terrasse » est cochée puis décochée
const TOUCHES: [number, number][] = [[0, 44], [6, 50], [3, 56], [4, 62], [8, 68], [3, 76]];

function Publier({ f }: { f: number }) {
  const n6 = R.N6.debut;
  const pret = n6 + 88;
  const etat = (i: number) => TOUCHES.filter(([k, a]) => k === i && f >= n6 + a).length % 2 === 1;
  // positions des puces (3 colonnes) dans la carte
  const pos = (i: number) => ({ x: 70 + (i % 2) * 450, y: 330 + Math.floor(i / 2) * 118 });
  const carte = { x: 60, y: 520 };
  const touche = TOUCHES.flatMap(([k, a]) => [{ a: n6 + a - 3, x: pos(k).x + 250, y: carte.y + pos(k).y - 4 }, { a: n6 + a + 1, x: pos(k).x + 250, y: carte.y + pos(k).y - 4 }]);
  const presse = f >= pret - 3 && f < pret + 3 ? 0.95 : 1;
  const valide = elan(f, pret + 2, 20);
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <Anneaux f={f} couleur={P.vert} x={540} y={1100} opacite={0.07} ecart={220} nombre={6} />
      <MotFantome texte="PUBLIER" f={f} debut={T.publier} y={1760} taille={300} opacite={0.06} />
      <div style={{ position: "absolute", top: 160, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Mots texte="Publier ? C'est simple." f={f} debut={n6} ecart={6} taille={96} accents={{ simple: { fond: P.vertPale, couleur: P.vert } }} />
      </div>
      <div style={{ position: "absolute", left: carte.x, top: carte.y, width: L - 2 * carte.x, perspective: 1800 }}>
        <div style={{ background: P.blanc, borderRadius: 44, padding: "40px 40px 50px", boxShadow: "0 40px 90px rgba(17,59,39,0.18)",
          transform: `rotateX(${(1 - elan(f, T.publier, 30)) * 25}deg) translateY(${(1 - elan(f, T.publier, 30)) * 200}px)`, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: TITRE, fontWeight: 800, fontSize: 46, color: P.encre }}>
            <span style={{ width: 70, height: 70, borderRadius: 999, background: P.vert, color: P.blanc, display: "grid", placeItems: "center", fontSize: 38 }}>5</span>
            Commodités et équipements
          </div>
          <div style={{ fontFamily: TITRE, fontWeight: 600, fontSize: 30, color: P.gris, marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <ListChecks size={34} color={P.vert} /> Touchez pour cocher ou décocher
          </div>
          <div style={{ height: 620 }} />
          {PUCES.map((c, i) => {
            const oui = etat(i);
            const t = TOUCHES.filter(([k]) => k === i).map(([, a]) => n6 + a).filter((a) => f >= a).at(-1);
            const rebond = t === undefined ? 0 : secousse(f, t, 8, 0.06);
            return (
              <div key={c} style={{ position: "absolute", left: pos(i).x - carte.x + 10, top: pos(i).y - 60, width: 420, height: 92, borderRadius: 999,
                border: `4px solid ${oui ? P.vert : P.bord}`, background: oui ? P.vert : P.blanc, color: oui ? P.blanc : P.encre,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: TITRE, fontWeight: 700, fontSize: 34,
                transform: `scale(${(0.6 + 0.4 * entree(f, T.publier + 6 + i * 2, 12, 180)) * (1 + rebond)})` }}>
                {oui && <Check size={34} color={P.blanc} strokeWidth={3.4} />}{c}
              </div>
            );
          })}
          <div style={{ marginTop: 40, height: 116, borderRadius: 30, background: valide > 0 ? P.vertFonce : P.vert, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 18, fontFamily: TITRE, fontWeight: 800, fontSize: 42, color: P.blanc, transform: `scale(${presse})`, position: "relative", overflow: "hidden" }}>
            <Send size={42} color={P.blanc} /> Envoyer pour vérification
            <Lueur f={f} debut={pret + 2} duree={16} />
          </div>
        </div>
      </div>
      <Doigt f={f} etapes={[{ a: n6 + 30, x: 1000, y: 1700 }, ...touche, { a: pret - 3, x: 600, y: 1600 }]} clics={[...TOUCHES.map(([, a]) => n6 + a), pret]} taille={130} />
      {/* « c'est prêt ! » */}
      {valide > 0 && (
        <div style={{ position: "absolute", left: 540 - 170, top: 1120 - 170, width: 340, height: 340, borderRadius: 999, background: P.vert,
          display: "grid", placeItems: "center", transform: `scale(${entree(f, pret + 2, 10, 200)})`, boxShadow: "0 30px 80px rgba(30,94,63,0.5)" }}>
          <Check size={220} color={P.blanc} strokeWidth={3.2} />
        </div>
      )}
      <Eclats f={f} debut={pret + 4} x={540} y={1120} nombre={14} rayon={340} />
    </AbsoluteFill>
  );
}

// ───────────────────────── G. Premium : l'annonce passe devant (au ralenti) ─────────────────────────
function Premium({ f }: { f: number }) {
  const n7 = R.N7.debut;
  // la carte Premium monte pendant que la musique respire, et se pose quand elle repart
  const monte = ralenti(f, RESPIRATION.debut - 10, RESPIRATION.fin - RESPIRATION.debut + 14);
  const rangs = [0, 1, 2, 3];
  const Y = (r: number) => 640 + r * 300;
  const pose = RESPIRATION.fin + 4;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, #2A2410 0%, #121008 70%)` }}>
      <Rayons f={f} x={540} y={Y(0) + 120} couleur={P.orClair} opacite={0.14 + 0.1 * doux(f, pose, 10)} debut={T.premium} />
      <Particules f={f} nombre={50} couleur={P.orClair} vitesse={0.3} opacite={0.6} graine={9} />
      <div style={{ position: "absolute", top: 150, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, transform: `scale(${entree(f, n7 + 2, 11, 170)})` }}>
          <Crown size={110} color={P.orClair} fill={P.or} strokeWidth={1.6} />
          <span style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 130, color: P.orClair, letterSpacing: "-0.03em" }}>Premium</span>
        </div>
        <Mots texte="Votre annonce passe devant" f={f} debut={n7 + 24} ecart={5} taille={70} couleur={P.blanc} accents={{ devant: { fond: P.orClair, couleur: "#121008" } }} />
      </div>
      {rangs.map((r) => {
        // les annonces ordinaires descendent d'un rang quand la Premium passe
        const y = Y(r) + (r < 3 ? monte * 300 : 0);
        return r < 3 ? (
          <div key={r} style={{ position: "absolute", left: 140, top: y, opacity: 0.55, filter: "saturate(0.6)" }}>
            <LigneAnnonce titre={["Studio", "Appartement 2 pièces", "Maison 4 pièces"][r]} lieu={["Yopougon", "Marcory", "Angré"][r]} f={f + r * 15} />
          </div>
        ) : null;
      })}
      <div style={{ position: "absolute", left: 140, top: Y(3) - monte * 900, transform: `scale(${1 + monte * 0.06})`, zIndex: 2 }}>
        <div style={{ position: "relative", borderRadius: 30, overflow: "hidden", boxShadow: `0 0 0 6px ${P.orClair}, 0 0 ${40 + 40 * monte}px rgba(226,181,74,0.7)` }}>
          <LigneAnnonce titre="Votre annonce" lieu="Cocody" premium f={f} />
          <Lueur f={f} debut={pose} duree={18} />
        </div>
      </div>
      <Eclats f={f} debut={pose} x={540} y={Y(0) + 120} nombre={16} rayon={420} />
      <Vignette force={0.5} />
    </AbsoluteFill>
  );
}

function LigneAnnonce({ titre, lieu, premium = false, f }: { titre: string; lieu: string; premium?: boolean; f: number }) {
  return (
    <div style={{ width: 800, height: 260, background: P.blanc, borderRadius: 30, display: "flex", overflow: "hidden" }}>
      <div style={{ width: 300, flexShrink: 0 }}><Maison largeur={300} hauteur={260} f={f} /></div>
      <div style={{ padding: "26px 30px", fontFamily: TITRE, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ padding: "6px 16px", borderRadius: 999, background: P.vert, color: P.blanc, fontWeight: 800, fontSize: 24 }}>À louer</span>
          {premium && <span style={{ padding: "6px 16px", borderRadius: 999, background: P.orClair, color: "#121008", fontWeight: 800, fontSize: 24 }}>Premium</span>}
        </div>
        <div style={{ fontWeight: 800, fontSize: 38, color: P.encre }}>{titre}</div>
        <div style={{ fontWeight: 600, fontSize: 28, color: P.gris }}>{lieu}</div>
      </div>
    </div>
  );
}

// ───────────────────────── H. Comptes certifiés : particulier ou agence ─────────────────────────
function Certifie({ f }: { f: number }) {
  const n8 = R.N8.debut;
  const cartes = [
    { x: 290, type: TONTON, nom: "Particulier", badge: "Identité vérifiée", icone: <UserRound />, a: n8 + 40 },
    { x: 790, type: AGENTE, nom: "Agence", badge: "Agence vérifiée", icone: <Building2 />, a: n8 + 64 },
  ];
  return (
    <AbsoluteFill style={{ background: P.creme }}>
      <Anneaux f={f} couleur={P.vert} x={540} y={1000} opacite={0.07} ecart={220} nombre={6} />
      <div style={{ position: "absolute", top: 180, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Mots texte="Faites certifier" f={f} debut={n8} ecart={6} taille={104} />
        <Mots texte="votre compte" f={f} debut={n8 + 16} ecart={6} taille={104} accents={{ compte: { fond: P.vert, couleur: P.blanc } }} />
      </div>
      {cartes.map((c, i) => {
        const p = elan(f, T.certifie + 4 + i * 6, 30);
        const tampon = entree(f, c.a, 10, 210);
        return (
          <div key={c.nom} style={{ position: "absolute", left: c.x - 230, top: 720 + (1 - p) * 700, width: 460, perspective: 1400, transform: "scale(1.12)", transformOrigin: `${i ? 0 : 100}% 0%` }}>
            <div style={{ background: P.blanc, borderRadius: 40, padding: "40px 30px 36px", boxShadow: "0 30px 70px rgba(17,59,39,0.16)", textAlign: "center",
              transform: `rotateY(${(1 - p) * (i ? 40 : -40)}deg)`, position: "relative", overflow: "hidden" }}>
              <div style={{ width: 300, height: 300, margin: "0 auto", borderRadius: 999, overflow: "hidden", background: i ? P.vertPale : P.orPale,
                border: `8px solid ${f >= c.a ? P.vert : P.bord}`, position: "relative" }}>
                <Personnage type={c.type} x={150} y={370} taille={0.92} buste sourire={f >= c.a ? 1 : 0.4} yeux={f >= c.a ? "joie" : "ouverts"} f={f} />
              </div>
              <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 52, color: P.encre, marginTop: 24, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
                {c.nom}
              </div>
              <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 24px", borderRadius: 999,
                background: P.vert, color: P.blanc, fontFamily: TITRE, fontWeight: 800, fontSize: 34, transform: `scale(${tampon}) rotate(${(1 - tampon) * -20}deg)` }}>
                <BadgeCheck size={40} color={P.vert} fill={P.blanc} strokeWidth={2} /> {c.badge}
              </div>
              <Lueur f={f} debut={c.a + 4} duree={16} />
            </div>
            <Eclats f={f} debut={c.a} x={230} y={560} nombre={10} rayon={260} />
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 1560, width: L, display: "flex", justifyContent: "center" }}>
        <Pastille texte="Vérifié par l'équipe 360Immo.ci" f={f} debut={n8 + 70} icone={<ShieldCheck />} taille={50} fond={P.vertPale} />
      </div>
    </AbsoluteFill>
  );
}

// ───────────────────────── I. Un agent visite votre bien ─────────────────────────
function Visite({ f }: { f: number }) {
  const n9 = R.N9.debut;
  const flash = n9 + 56;
  const photo = elan(f, flash + 4, 40);
  const xAgent = 1300 - 540 * entree(f, T.visite + 2, 14, 110);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #9FD3E8 0%, #E6F4F9 60%, #7BC47F 60%)" }}>
      <div style={{ position: "absolute", left: -60, top: 420, transform: `scale(${1 + doux(f, T.visite, 120) * 0.05})`, transformOrigin: "50% 100%" }}>
        <Maison largeur={1200} hauteur={780} f={f} />
      </div>
      <div style={{ position: "absolute", top: 120, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Mots texte="Un agent 360Immo.ci" f={f} debut={n9 + 6} ecart={5} taille={88} accents={{ agent: { fond: P.vert, couleur: P.blanc } }} />
        <Mots texte="visite votre bien" f={f} debut={n9 + 40} ecart={5} taille={88} />
      </div>
      <Personnage type={AGENT} x={xAgent} y={1900} taille={1.06} f={f} objetD={<AppareilPhoto flash={f >= flash && f < flash + 6 ? (f - flash) / 6 : 0} />}
        brasD={f >= flash - 18 ? [100, 100] : [24, 70]} brasG={[10, -4]} sourire={0.8} regard={-1} tete={f >= flash - 18 ? -6 : 0}
        yeux={f >= flash && f < flash + 4 ? "fermes" : "ouverts"} />
      <Flash f={f} debut={flash} duree={9} />
      {/* la photo tombe au ralenti, avec le badge « Bien visité » */}
      {f >= flash + 2 && (
        <div style={{ position: "absolute", left: 120, top: 420 + photo * 260, transform: `rotate(${-14 + photo * 8}deg) scale(${0.7 + photo * 0.3})`,
          filter: `drop-shadow(0 30px 40px rgba(0,0,0,${0.3 * photo}))` }}>
          <div style={{ background: P.blanc, padding: "20px 20px 26px", borderRadius: 10, width: 540 }}>
            <Maison largeur={500} hauteur={340} f={f} />
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 22px", borderRadius: 999, background: P.vert,
                color: P.blanc, fontFamily: TITRE, fontWeight: 800, fontSize: 38, transform: `scale(${entree(f, flash + 26, 10, 200)})` }}>
                <ShieldCheck size={40} color={P.blanc} strokeWidth={2.4} /> Bien visité
              </span>
            </div>
          </div>
        </div>
      )}
      <Eclats f={f} debut={flash + 28} x={390} y={1040} nombre={12} rayon={300} />
    </AbsoluteFill>
  );
}

// ───────────────────────── J. Compte sécurisé, contact WhatsApp, confiance ─────────────────────────
function Securite({ f }: { f: number }) {
  const n10 = R.N10.debut;
  const ferme = doux(f, n10 + 10, 8);
  const confiance = n10 + 60;
  const poignee = doux(f, confiance - 6, 12);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${P.vertMoyen} 0%, ${P.vertFonce} 65%, #0A2016 100%)` }}>
      <Rayons f={f} x={540} y={640} couleur={P.orClair} opacite={0.12} debut={T.securite} />
      <Particules f={f} nombre={34} couleur={P.orClair} vitesse={0.5} opacite={0.5} graine={4} />
      {/* bouclier et cadenas qui se ferme */}
      <div style={{ position: "absolute", left: 540 - 250, top: 280, width: 500, height: 500, transform: `scale(${elan(f, T.securite + 2, 24)})` }}>
        <Shield size={500} color={P.orClair} fill="rgba(226,181,74,0.15)" strokeWidth={1.3} />
        <div style={{ position: "absolute", left: 175, top: 165 - (1 - ferme) * 30 }}>
          <Lock size={150} color={P.blanc} strokeWidth={2.2} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 160, width: L, display: "flex", justifyContent: "center", gap: 20 }}>
        <Pastille texte="Compte sécurisé" f={f} debut={n10 + 4} icone={<Lock />} taille={56} fond={P.blanc} couleur={P.vertFonce} />
      </div>
      <div style={{ position: "absolute", top: 830, width: L, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "18px 34px 18px 18px", borderRadius: 999, background: "#25D366",
          fontFamily: TITRE, fontWeight: 800, fontSize: 50, color: P.blanc, transform: `scale(${entree(f, n10 + 30, 11, 180)})`, boxShadow: "0 20px 50px rgba(37,211,102,0.4)" }}>
          <span style={{ width: 84, height: 84, borderRadius: 999, background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center" }}><LogoWhatsApp taille={56} /></span>
          Contact WhatsApp
        </div>
      </div>
      <div style={{ position: "absolute", top: 990, width: L, display: "flex", justifyContent: "center" }}>
        <Mots texte="On vous fait confiance." f={f} debut={confiance} ecart={5} taille={84} couleur={P.blanc} accents={{ confiance: { fond: P.orClair, couleur: P.vertFonce } }} />
      </div>
      {/* le propriétaire et une cliente se serrent la main */}
      <Personnage type={TONTON} x={330 + poignee * 40} y={1990} taille={0.98} f={f} brasD={[20 + poignee * 50, 20 + poignee * 40]} brasG={[8, -4]}
        sourire={1} yeux={poignee > 0.5 ? "joie" : "ouverts"} regard={1} />
      <Personnage type={AWA} x={760 - poignee * 40} y={1990} taille={0.98} f={f} miroir brasD={[20 + poignee * 50, 20 + poignee * 40]} brasG={[8, -4]}
        sourire={1} yeux={poignee > 0.5 ? "joie" : "ouverts"} regard={1} />
      <Eclats f={f} debut={confiance + 8} x={540} y={1380} nombre={10} rayon={240} />
      <Vignette force={0.45} />
    </AbsoluteFill>
  );
}

// ───────────────────────── K. Le démarcheur veut publier lui aussi ─────────────────────────
function Gag({ f }: { f: number }) {
  const d2 = R.D2.debut;
  return (
    <AbsoluteFill style={{ background: P.orPale }}>
      <Anneaux f={f} couleur={P.or} x={540} y={1200} opacite={0.14} ecart={180} nombre={6} />
      <Bulle texte="Eh Dieu… Même moi je vais publier là-bas !" f={f} debut={d2 + 2} x={110} y={240} largeur={860} queue="bas-droite" taille={74} rotation={-2} />
      <Personnage type={DEMARCHEUR} x={540} y={1900} taille={1.15} f={f} bouche={dit(["D2"], f)} sourire={f >= d2 + 40 ? 1 : 0.2}
        sourcils={f < d2 + 40 ? 1 : 0.2} objetD={<TelephoneMain ecran={P.vert} />} brasD={[30, 120]} brasG={f >= d2 + 40 ? [150, -30] : [10, -6]}
        saut={f >= d2 + 44 ? Math.abs(Math.sin(((f - d2 - 44) / 30) * Math.PI * 2)) * 30 : 0} />
      <NoteMain texte="(annonces vérifiées, hein !)" f={f} debut={d2 + 58} x={540} y={720} rotation={-4} taille={64} couleur={P.vert} largeur={760} />
    </AbsoluteFill>
  );
}

// ───────────────────────── L. Fin : publiez, c'est gratuit ─────────────────────────
const ORBITE: Icone[] = [<Store />, <Share2 />, <MessageCircle />, <CalendarCheck />, <PhoneCall />, <ListChecks />, <Crown />, <BadgeCheck />, <Camera />, <ShieldCheck />];

function Fin({ f }: { f: number }) {
  const n11 = R.N11.debut;
  const clic = n11 + 92;
  const presse = f >= clic - 3 && f < clic + 3 ? 0.94 : 1;
  const orbite = elan(f, T.fin + 2, 40);
  const icones = ORBITE.map((ic, i) => {
    const a = (i / ORBITE.length) * Math.PI * 2 + f * 0.008;
    const x = 540 + Math.cos(a) * (60 + 410 * orbite), y = 700 + Math.sin(a) * (40 + 290 * orbite);
    return { ic, i, x, y, devant: Math.sin(a) > 0 };
  });
  const dessiner = (devant: boolean) => icones.filter((o) => o.devant === devant).map(({ ic, i, x, y }) => (
    <div key={i} style={{ position: "absolute", left: x - 58, top: y - 58, width: 116, height: 116, borderRadius: 999, background: devant ? P.vert : P.vertPale,
      display: "grid", placeItems: "center", opacity: orbite, transform: `scale(${devant ? 1 : 0.78})`, boxShadow: "0 12px 30px rgba(17,59,39,0.2)" }}>
      {cloneIcone(ic, devant ? P.blanc : P.vert)}
    </div>
  ));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 36%, #FFFFFF 0%, ${P.creme} 55%, #EFE9DA 100%)` }}>
      <Rayons f={f} x={540} y={700} couleur={P.orClair} opacite={0.16} debut={T.fin} />
      {dessiner(false)}
      <div style={{ position: "absolute", top: 700 - 62, width: L, display: "flex", justifyContent: "center", transform: `scale(${entree(f, n11 + 2, 11, 160)})` }}>
        <Logo largeur={640} />
      </div>
      {dessiner(true)}
      <div style={{ position: "absolute", top: 1140, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Mots texte="Publiez votre annonce…" f={f} debut={n11 + 52} ecart={6} taille={86} largeur={1040} />
        <Mots texte="c'est gratuit !" f={f} debut={n11 + 90} ecart={6} taille={110} accents={{ gratuit: { fond: P.vert, couleur: P.blanc } }} />
      </div>
      <div style={{ position: "absolute", top: 1440, width: L, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "28px 52px", borderRadius: 999, background: P.vert, color: P.blanc,
          fontFamily: TITRE, fontWeight: 800, fontSize: 58, boxShadow: "0 18px 40px rgba(30,94,63,0.35)", transform: `scale(${entree(f, n11 + 60, 11, 180) * presse})`,
          position: "relative", overflow: "hidden" }}>
          <Plus size={58} color={P.orClair} strokeWidth={3} /> Publier une annonce
          <Lueur f={f} debut={clic + 2} duree={16} />
        </div>
        <div style={{ fontFamily: TITRE, fontWeight: 800, fontSize: 50, color: P.vertFonce, opacity: doux(f, n11 + 70, 8) }}>www.360immo.ci</div>
      </div>
      <Personnage type={TONTON} x={150} y={2110} taille={0.6} f={f} yeux="joie" sourire={1} brasD={[150 + flotte(f, 0.5) * 10, -20]} />
      <Personnage type={AGENTE} x={930} y={2110} taille={0.6} f={f} miroir yeux="joie" sourire={1} brasD={[150 - flotte(f, 0.5) * 10, -20]} />
      <Doigt f={f} etapes={[{ a: clic - 22, x: 1000, y: 1800 }, { a: clic - 4, x: 760, y: 1510 }]} clics={[clic]} taille={130} />
      <Confettis f={f} debut={clic + 2} nombre={80} />
    </AbsoluteFill>
  );
}

const cloneIcone = (ic: Icone, couleur: string) => cloneElement(ic, { size: 58, color: couleur, strokeWidth: 2.2 });

// ───────────────────────── Son ─────────────────────────
function Son() {
  const musique = (i: number) => {
    const baisse = 0.5 - 0.3 * parole(i);
    const intro = i < MARQUE ? 1.6 : 1; // l'intro de la musique est très douce : un peu plus fort
    const coupe = interpolate(i, [COUPURE - 3, COUPURE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return baisse * intro * coupe;
  };
  const fin = (i: number) => {
    const j = i + REPRISE;
    const baisse = 0.5 - 0.3 * parole(j);
    const sortie = interpolate(j, [DUREE - 24, DUREE - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return baisse * sortie;
  };
  return (
    <>
      <Sequence from={0} durationInFrames={COUPURE + 2} layout="none">
        <Audio src={staticFile("musique/pub-annonceurs.mp3")} startFrom={Math.round(DEBUT_MUSIQUE * IPS)} volume={musique} />
      </Sequence>
      <Sequence from={REPRISE} layout="none">
        <Audio src={staticFile("musique/pub-annonceurs.mp3")} startFrom={Math.round(REPRISE_MUSIQUE * IPS)} volume={fin} />
      </Sequence>
      {(Object.keys(R) as Replique[]).map((id) => (
        <Sequence key={id} from={R[id].debut} durationInFrames={R[id].images + 4} layout="none">
          <Audio src={staticFile(`voix/pub-annonceurs/${id}.wav`)} volume={id.startsWith("D") ? 1 : 0.95} />
        </Sequence>
      ))}
      {/* A */}
      <Bruit nom="montee" a={0} volume={0.25} />
      {/* B */}
      {[R.N2.debut + 4, R.N2.debut + 22, R.N2.debut + 40, R.N2.debut + 58, R.N2.debut + 76, R.D1.debut + 6].map((a) => <Bruit key={a} nom="sonnerie" a={a} volume={0.28} />)}
      <Bruit nom="fouet" a={R.D1.debut - 8} volume={0.4} />
      <Bruit nom="boing" a={R.D1.debut - 2} volume={0.3} />
      <Bruit nom="montee" a={MARQUE - 42} volume={0.4} />
      {/* C */}
      <Bruit nom="impact" a={MARQUE} volume={0.7} />
      <Bruit nom="scintille" a={R.N3.debut + 60} volume={0.3} />
      {/* D */}
      <Bruit nom="fouet" a={T.partage - 3} volume={0.35} />
      <Bruit nom="clic" a={R.N4.debut + 10} volume={0.6} />
      <Bruit nom="clic" a={R.N4.debut + 34} volume={0.6} />
      <Bruit nom="fouet" a={R.N4.debut + 40} volume={0.3} vitesse={1.3} />
      {/* E */}
      {[4, 32, 72].map((d) => <Bruit key={d} nom="notif" a={R.N5.debut + d} volume={0.45} />)}
      {/* F */}
      <Bruit nom="fouet" a={T.publier - 3} volume={0.35} />
      {TOUCHES.map(([, a]) => <Bruit key={a} nom="tic" a={R.N6.debut + a} volume={0.5} />)}
      <Bruit nom="clic" a={R.N6.debut + 88} volume={0.6} />
      <Bruit nom="ding" a={R.N6.debut + 90} volume={0.45} />
      {/* G */}
      <Bruit nom="montee" a={RESPIRATION.debut - 20} volume={0.35} />
      <Bruit nom="scintille" a={RESPIRATION.fin + 4} volume={0.45} />
      {/* H */}
      <Bruit nom="fouet" a={T.certifie - 3} volume={0.35} />
      <Bruit nom="tampon" a={R.N8.debut + 40} volume={0.4} />
      <Bruit nom="tampon" a={R.N8.debut + 64} volume={0.4} />
      <Bruit nom="scintille" a={R.N8.debut + 66} volume={0.3} />
      {/* I */}
      <Bruit nom="declic" a={R.N9.debut + 56} volume={0.6} />
      <Bruit nom="pop" a={R.N9.debut + 82} volume={0.3} />
      {/* J */}
      <Bruit nom="clic" a={R.N10.debut + 14} volume={0.4} />
      <Bruit nom="pop" a={R.N10.debut + 30} volume={0.3} />
      {/* K */}
      <Bruit nom="boing" a={R.D2.debut + 42} volume={0.3} />
      {/* L */}
      <Bruit nom="impact" a={REPRISE} volume={0.45} />
      <Bruit nom="clic" a={R.N11.debut + 92} volume={0.6} />
      <Bruit nom="ding" a={R.N11.debut + 94} volume={0.45} />
    </>
  );
}

export function PubAnnonceurs() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: P.vertFonce, overflow: "hidden", width: L, height: H }}>
      <Plan f={f} de={0} a={T.probleme} sortie="plongee"><Ouverture f={f} /></Plan>
      <Plan f={f} de={T.probleme} a={T.vitrine} entree="plongee"><Probleme f={f} /></Plan>
      <Plan f={f} de={T.vitrine} a={T.partage} sortie="fouet"><Vitrine f={f} /></Plan>
      <Plan f={f} de={T.partage} a={T.clients} entree="fouet" sortie="plongee"><Partage f={f} /></Plan>
      <Plan f={f} de={T.clients} a={T.publier} entree="plongee" sortie="fouet"><Clients f={f} /></Plan>
      <Plan f={f} de={T.publier} a={T.premium} entree="fouet" sortie="plongee"><Publier f={f} /></Plan>
      <Plan f={f} de={T.premium} a={T.certifie} entree="plongee" sortie="fouet"><Premium f={f} /></Plan>
      <Plan f={f} de={T.certifie} a={T.visite} entree="fouet" sortie="fouet"><Certifie f={f} /></Plan>
      <Plan f={f} de={T.visite} a={T.securite} entree="fouet" sortie="plongee"><Visite f={f} /></Plan>
      <Plan f={f} de={T.securite} a={T.gag} entree="plongee"><Securite f={f} /></Plan>
      <Plan f={f} de={T.gag} a={T.fin} sortie="plongee"><Gag f={f} /></Plan>
      <Plan f={f} de={T.fin} a={DUREE} entree="plongee"><Fin f={f} /></Plan>
      <Grain opacite={0.05} />
      <Son />
    </AbsoluteFill>
  );
}

