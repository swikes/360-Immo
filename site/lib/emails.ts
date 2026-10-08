/*
 * Les e-mails de 360-Immo.ci, écrits à partir de la file de la base (supabase/migrations/…_alertes_emails.sql) :
 *   message       nouveau message (à l'annonceur ou à la personne intéressée)
 *   visite        demande de visite et réponses (demandée, confirmée, autre créneau proposé, acceptée, refusée, annulée)
 *   rappel        demande « Être rappelé » (à l'annonceur)
 *   alerte        nouvelles annonces d'une alerte, avec le lien « Arrêter cette alerte »
 *   fin_annonce   annonce qui expire dans les 3 jours
 *   moderation    décision de l'équipe : annonce en ligne, refusée ou retirée (avec le motif)
 *   compte        compte agence validé ou refusé, compte suspendu ou réactivé, accès à l'espace Administration,
 *                 vérification (identité, agence, bien) validée ou refusée, numéro de téléphone libéré
 * Chaque e-mail existe en HTML (mise en page simple, lisible par toutes les messageries) et en texte seul.
 * Envoi : lib/envoi-notifications.ts.
 */
import { lienAnnonce, lieuAnnonce, uniteLoyer, urlPhotoPublique, type CarteAnnonce } from "./annonces-en-ligne";
import { texteCreneau, texteDate, texteMoment, type MomentRappel } from "./creneaux";

/** « 2031-05-01 » → « 1 mai 2031 » (date de fin d'une pièce d'identité : l'année compte) */
const dateComplete = (jour: string) =>
  new Date(`${jour.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
import { formaterPrix } from "./format";

export type NotificationAEnvoyer = {
  id: string;
  modele: "message" | "visite" | "rappel" | "alerte" | "fin_annonce" | "moderation" | "compte";
  /** adresse du destinataire (compte, ou adresse laissée sans compte) */
  email: string | null;
  prenom: string | null;
  donnees: Record<string, unknown>;
};

export type EmailPret = {
  a: string;
  nom: string | null;
  sujet: string;
  html: string;
  texte: string;
  /** lien « Arrêter cette alerte » (en-tête List-Unsubscribe) */
  desabonnement: string | null;
  /** type d'e-mail (statistiques de Brevo) */
  etiquette: string;
};

type Annonce = { titre: string; reference: string };
type Souhaits = { ok: string[]; manque: string[] };

const VERT = "#1A6B4A", OR = "#D4A843", ENCRE = "#1C1C1E", GRIS = "#6B6B6B", FOND = "#F5F5F2", BORD = "#E8E8E3";
const POLICE = "font-family:Arial,Helvetica,sans-serif;";

export const echapper = (t: unknown) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Contenu d'un e-mail, écrit en HTML et en texte en même temps */
class Corps {
  html: string[] = [];
  texte: string[] = [];
  constructor(private site: string) {}
  lien = (chemin: string) => (/^https?:/.test(chemin) ? chemin : `${this.site}${chemin}`);
  /** paragraphe ; **gras** (texte déjà échappé par cette méthode) */
  p(t: string) {
    this.html.push(`<p style="margin:0 0 14px;">${echapper(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
    this.texte.push(t.replace(/\*\*/g, ""));
    return this;
  }
  citation(t: string) {
    this.html.push(`<p style="margin:0 0 16px;padding:12px 16px;background:${FOND};border-left:3px solid ${VERT};border-radius:6px;white-space:pre-wrap;">${echapper(t)}</p>`);
    this.texte.push(t.split("\n").map((l) => `> ${l}`).join("\n"));
    return this;
  }
  /** lignes « libellé : valeur » */
  infos(lignes: [string, string | null | undefined][]) {
    const l = lignes.filter((x): x is [string, string] => !!x[1]);
    if (!l.length) return this;
    this.html.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%;background:${FOND};border-radius:8px;">${
      l.map(([k, v]) => `<tr><td style="padding:8px 14px;color:${GRIS};font-size:13px;white-space:nowrap;vertical-align:top;">${echapper(k)}</td><td style="padding:8px 14px 8px 0;font-weight:bold;">${echapper(v)}</td></tr>`).join("")
    }</table>`);
    this.texte.push(l.map(([k, v]) => `${k} : ${v}`).join("\n"));
    return this;
  }
  bouton(texte: string, chemin: string) {
    const url = this.lien(chemin);
    this.html.push(`<p style="margin:22px 0 8px;"><a href="${echapper(url)}" style="display:inline-block;padding:13px 24px;background:${VERT};color:#ffffff;border-radius:8px;font-weight:bold;text-decoration:none;">${echapper(texte)}</a></p>`);
    this.texte.push(`${texte} : ${url}`);
    return this;
  }
  /** cartes d'annonces ; alerte réglée dans la fenêtre : ses souhaits présents (✓) et absents (✗) */
  annonces(cartes: (CarteAnnonce & { souhaits?: Souhaits })[]) {
    for (const c of cartes) {
      const url = this.lien(lienAnnonce(c));
      const prix = `${formaterPrix(c.prix)} FCFA${c.loyer_par ? ` / ${uniteLoyer(c.loyer_par)}` : ""}`;
      const details = [lieuAnnonce(c), c.studio ? "Studio" : c.pieces ? `${c.pieces} pièce${c.pieces > 1 ? "s" : ""}` : null,
        c.surface ? `${formaterPrix(Number(c.surface))} m²` : null].filter(Boolean).join(" · ");
      const ok = c.souhaits?.ok ?? [], manque = c.souhaits?.manque ?? [];
      const souhaits = ok.length + manque.length
        ? `<div style="margin-top:6px;font-size:12.5px;line-height:1.7;">${[
          ...ok.map((x) => `<span style="color:${VERT};white-space:nowrap;">✓ ${echapper(x)}</span>`),
          ...manque.map((x) => `<span style="color:${GRIS};white-space:nowrap;text-decoration:line-through;">✗ ${echapper(x)}</span>`),
        ].join(" &nbsp;")}</div>`
        : "";
      const photo = c.photo
        ? `<td width="120" style="padding:0 14px 0 0;vertical-align:top;"><a href="${echapper(url)}"><img src="${echapper(urlPhotoPublique(c.photo))}" width="120" height="90" alt="" style="display:block;width:120px;height:90px;object-fit:cover;border-radius:6px;border:0;"></a></td>`
        : "";
      this.html.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;border:1px solid ${BORD};border-radius:10px;"><tr><td style="padding:12px;"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${photo}<td style="vertical-align:top;">`
        + `<a href="${echapper(url)}" style="color:${ENCRE};font-weight:bold;text-decoration:none;">${echapper(c.titre)}</a>`
        + `<div style="margin-top:4px;color:${VERT};font-weight:bold;">${echapper(prix)}</div>`
        + `<div style="margin-top:2px;color:${GRIS};font-size:13px;">${echapper(details)}</div>${souhaits}</td></tr></table></td></tr></table>`);
      const texteSouhaits = ok.length + manque.length ? `\n  ${[...ok.map((x) => `✓ ${x}`), ...manque.map((x) => `✗ ${x}`)].join(" · ")}` : "";
      this.texte.push(`- ${c.titre}\n  ${prix} · ${details}${texteSouhaits}\n  ${url}`);
    }
    return this;
  }
}

/** Mise en page commune : nom du site, carte blanche, pied de page (pourquoi cet e-mail, liens) */
function page(sujet: string, apercu: string, corps: Corps, pied: string[], site: string): { html: string; texte: string } {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(sujet)}</title></head>`
    + `<body style="margin:0;padding:0;background:${FOND};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${echapper(apercu)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FOND};"><tr><td align="center" style="padding:24px 12px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">`
    + `<tr><td style="padding:0 4px 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:${VERT};">`
    + `<a href="${echapper(site)}" style="color:${VERT};text-decoration:none;">360<span style="color:${OR};">-Immo</span>.ci</a></td></tr>`
    + `<tr><td style="background:#ffffff;border-radius:14px;padding:28px 24px;${POLICE}font-size:15px;line-height:1.6;color:${ENCRE};">${corps.html.join("")}</td></tr>`
    + `<tr><td style="padding:16px 8px;${POLICE}font-size:12px;line-height:1.6;color:${GRIS};">${pied.map((l) => `<p style="margin:0 0 6px;">${l}</p>`).join("")}</td></tr>`
    + `</table></td></tr></table></body></html>`;
  const texte = [...corps.texte, "—", ...pied.map((l) => l.replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "$2 : $1").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'))].join("\n\n");
  return { html, texte };
}

const lienPied = (texte: string, url: string) => `<a href="${echapper(url)}" style="color:${GRIS};">${echapper(texte)}</a>`;
const bonjour = (prenom: string | null) => `Bonjour${prenom?.trim() ? ` ${prenom.trim()}` : ""},`;
const s = (n: number) => (n > 1 ? "s" : "");

/** L'e-mail d'une notification de la file (site : adresse publique du site, sans « / » final) */
export function composerEmail(n: NotificationAEnvoyer, site: string): EmailPret {
  const d = n.donnees;
  const corps = new Corps(site);
  const parametres = `${site}/mon-espace?section=parametres`;
  const piedCompte = [
    "Vous recevez cet e-mail parce que vous avez un compte sur 360-Immo.ci.",
    `${lienPied("Choisir les e-mails que je reçois", parametres)}`,
  ];
  let sujet: string, apercu: string, pied = piedCompte, desabonnement: string | null = null;
  corps.p(bonjour(n.prenom));

  if (n.modele === "message") {
    const annonce = d.annonce as Annonce;
    const deLAnnonceur = d.pour === "client";
    sujet = `Nouveau message de ${d.de} — ${annonce.titre}`;
    apercu = String(d.extrait ?? "").slice(0, 120);
    corps.p(deLAnnonceur
      ? `**${d.de}** vous a répondu à propos de l'annonce « ${annonce.titre} » (réf. ${annonce.reference}) :`
      : `**${d.de}** vous a écrit à propos de votre annonce « ${annonce.titre} » (réf. ${annonce.reference}) :`)
      .citation(String(d.extrait ?? ""))
      .bouton("Lire et répondre", `/mon-espace?section=messages&conversation=${d.conversation}`);
  } else if (n.modele === "visite") {
    ({ sujet, apercu, pied } = visite(n, corps, piedCompte, site));
  } else if (n.modele === "rappel") {
    const annonce = d.annonce as Annonce;
    const nom = String(d.nom ?? "Une personne");
    sujet = `À rappeler : ${nom} — ${annonce.titre}`;
    apercu = `${nom} attend votre appel (${texteMoment(d.moment as MomentRappel).toLowerCase()}).`;
    corps.p(`**${nom}** attend votre appel au sujet de votre bien « ${annonce.titre} » (réf. ${annonce.reference}) :`)
      .infos([["Téléphone", String(d.telephone ?? "")], ["Quand", texteMoment(d.moment as MomentRappel)], ["Message", d.message ? String(d.message) : null]])
      .p("Appelez ou écrivez sur WhatsApp, puis indiquez « Rappelé » dans votre espace.")
      .bouton("Voir la demande", "/mon-espace?section=rappels");
  } else if (n.modele === "alerte") {
    const alerte = d.alerte as { nom: string; adresse: string; jeton: string; frequence: string };
    const total = Number(d.total);
    const cartes = (d.annonces as (CarteAnnonce & { souhaits?: Souhaits })[]) ?? [];
    sujet = total > 1 ? `${total} nouvelles annonces : ${alerte.nom}` : `Nouvelle annonce : ${alerte.nom}`;
    apercu = cartes.map((c) => c.titre).join(" · ").slice(0, 140);
    corps.p(`${total} nouvelle${s(total)} annonce${s(total)} pour votre alerte **« ${alerte.nom} »** :`);
    // Alerte avec des souhaits : les annonces qui en ont le plus sont en premier
    if (cartes.length > 1 && cartes.some((c) => (c.souhaits?.ok.length ?? 0) + (c.souhaits?.manque.length ?? 0) > 0)) {
      corps.p("Elles ont tout l'essentiel ; celles qui ont le plus de vos souhaits sont en premier.");
    }
    corps.annonces(cartes);
    if (total > cartes.length) corps.p(`… et ${total - cartes.length} autre${s(total - cartes.length)}.`);
    corps.bouton(total > 1 ? "Voir toutes les annonces" : "Voir les annonces de cette recherche", alerte.adresse);
    desabonnement = `${site}/alertes/arreter?jeton=${alerte.jeton}`;
    pied = [
      `Vous recevez cet e-mail ${alerte.frequence === "hebdomadaire" ? "chaque semaine" : "chaque jour"}, quand il y a de nouvelles annonces, parce que vous avez créé cette alerte sur 360-Immo.ci.`,
      `${lienPied("Gérer mes alertes", `${site}/mon-espace?section=alertes`)} · ${lienPied("Arrêter cette alerte", desabonnement)}`,
    ];
  } else if (n.modele === "moderation") {
    const annonce = d.annonce as Annonce & { id: string };
    const bien = `« ${annonce.titre} » (réf. ${annonce.reference})`;
    const corriger = `/publier?annonce=${annonce.id}`;
    if (d.decision === "publiee") {
      sujet = `Votre annonce est en ligne : ${annonce.titre}`;
      apercu = d.reverification ? "Vos changements ont été vérifiés : elle est de nouveau visible." : "Vérifiée par l'équipe, elle est visible pour 90 jours.";
      corps.p(d.reverification
        ? `Vos changements sur l'annonce **${bien}** ont été vérifiés par l'équipe 360-Immo.ci : elle est de nouveau en ligne, jusqu'à sa date de fin habituelle.`
        : `Bonne nouvelle : votre annonce **${bien}** a été vérifiée par l'équipe 360-Immo.ci. Elle est en ligne pour 90 jours.`)
        .p("Pour plus de visites, partagez-la sur WhatsApp et Facebook depuis Mon Espace → Mes annonces. Vous suivez ses vues et ses contacts dans Mon Espace → Statistiques.")
        .bouton("Voir mon annonce", lienAnnonce(annonce));
    } else {
      const retiree = d.decision === "retiree";
      sujet = retiree ? `Votre annonce a été retirée : ${annonce.titre}` : `Votre annonce n'a pas été publiée : ${annonce.titre}`;
      apercu = String(d.motif ?? "").slice(0, 120);
      corps.p(retiree
        ? `Après vérification, l'équipe 360-Immo.ci a retiré votre annonce **${bien}** du site, pour la raison suivante :`
        : `L'équipe 360-Immo.ci a vérifié votre annonce **${bien}**, mais ne peut pas la publier en l'état :`)
        .citation(String(d.motif ?? ""))
        .p("Corrigez-la depuis Mon Espace → Mes annonces (bouton « Corriger ») : elle sera vérifiée de nouveau, en général dans la journée.")
        .bouton("Corriger mon annonce", corriger);
    }
  } else if (n.modele === "compte") {
    switch (d.evenement) {
      case "agence_validee":
        sujet = `Votre compte agence est validé : ${d.agence}`;
        apercu = "Vos annonces et votre vitrine portent désormais le nom de l'agence.";
        corps.p(`Bonne nouvelle : l'équipe 360-Immo.ci a validé votre compte agence **« ${d.agence} »**.`)
          .p("Vos annonces et votre vitrine portent désormais le nom de l'agence. Pour obtenir le badge « Agence vérifiée » et afficher votre logo, envoyez le RCCM de l'agence depuis Mon Espace → Vérification.")
          .bouton("Faire vérifier mon agence", "/mon-espace?section=verification");
        break;
      case "agence_refusee":
        sujet = "Votre demande de compte agence n'a pas été acceptée";
        apercu = String(d.motif ?? "").slice(0, 120);
        corps.p(`L'équipe 360-Immo.ci n'a pas pu valider votre demande de compte agence pour **« ${d.agence} »** :`)
          .citation(String(d.motif ?? ""))
          .p("Vous pouvez la renouveler depuis Mon Espace → Mon profil, avec les informations demandées. Vos annonces restent publiées comme particulier.")
          .bouton("Ouvrir mon profil", "/mon-espace?section=profil");
        break;
      case "suspendu":
        sujet = "Votre compte 360-Immo.ci est suspendu";
        apercu = String(d.motif ?? "").slice(0, 120);
        corps.p("L'équipe 360-Immo.ci a suspendu votre compte, pour la raison suivante :")
          .citation(String(d.motif ?? ""))
          .p("Vos annonces ne sont plus visibles, et vous ne pouvez plus en publier, écrire aux annonceurs ni demander de visite. Si vous pensez qu'il s'agit d'une erreur, répondez à cet e-mail.");
        break;
      case "reactive":
        sujet = "Votre compte 360-Immo.ci est réactivé";
        apercu = "Vous pouvez de nouveau publier et contacter les annonceurs.";
        corps.p("L'équipe 360-Immo.ci a réactivé votre compte : vous pouvez de nouveau publier et contacter les annonceurs.")
          .p("Vos annonces retirées restent dans Mon Espace → Mes annonces : corrigez-les si besoin, puis renvoyez-les pour vérification.")
          .bouton("Voir mes annonces", "/mon-espace?section=annonces");
        break;
      case "verification_validee": {
        const quoi = String(d.quoi ?? "");
        sujet = d.type === "identite" ? "Votre identité est vérifiée" : d.type === "agence" ? "Votre agence est vérifiée" : "Votre bien est vérifié";
        apercu = d.type === "bien" ? "Votre annonce affiche le badge « Bien vérifié »." : "Le badge s'affiche sur vos annonces et votre vitrine.";
        corps.p(`Bonne nouvelle : l'équipe 360-Immo.ci a vérifié **${quoi}**.`)
          .p(d.type === "identite"
            ? `Le badge « Identité vérifiée » s'affiche sur vos annonces et votre vitrine${d.expire_le ? `, jusqu'au ${dateComplete(String(d.expire_le))} (fin de validité de votre pièce)` : ""} : les visiteurs vous font plus facilement confiance. Si vous changez de nom dans votre profil, il faudra renvoyer votre pièce.`
            : d.type === "agence"
              ? "Le badge « Agence vérifiée » et votre logo s'affichent sur vos annonces, votre vitrine et la page d'accueil, parmi les agences partenaires."
              : "Votre annonce affiche le badge « Bien vérifié », et apparaît quand les visiteurs choisissent « Biens vérifiés » dans la recherche.")
          .p(d.type === "identite"
            ? "Votre pièce reste dans un dossier privé, ouvert seulement par l'équipe en cas de plainte ; elle est supprimée un an après la fermeture de votre compte."
            : "Vos documents ont été supprimés de nos serveurs : ils ne servaient qu'à la vérification.")
          .bouton("Voir mes vérifications", "/mon-espace?section=verification");
        break;
      }
      case "verification_refusee":
        sujet = "Vérification : des documents à renvoyer";
        apercu = String(d.motif ?? "").slice(0, 120);
        corps.p(`L'équipe 360-Immo.ci n'a pas pu vérifier **${String(d.quoi ?? "")}** avec les documents envoyés :`)
          .citation(String(d.motif ?? ""))
          .p("Ces documents ont été supprimés de nos serveurs. Vous pouvez en envoyer de nouveaux depuis Mon Espace → Vérification.")
          .bouton("Renvoyer mes documents", "/mon-espace?section=verification");
        break;
      case "numero_libere":
        sujet = "Votre numéro de téléphone a été retiré de votre compte";
        apercu = String(d.motif ?? "").slice(0, 120);
        corps.p(`L'équipe 360-Immo.ci a retiré le numéro **${d.telephone}** de votre compte : un numéro ne sert qu'à un seul compte, et il a été réclamé.`)
          .citation(String(d.motif ?? ""))
          .p("Ajoutez votre propre numéro dans Mon Espace → Mon profil : les visiteurs en ont besoin pour vous contacter. Si c'est une erreur, répondez à cet e-mail.")
          .bouton("Ajouter mon numéro", "/mon-espace?section=profil");
        break;
      default:
        sujet = "Vous faites partie de l'équipe 360-Immo.ci";
        apercu = "Vous avez maintenant accès à l'espace Administration.";
        corps.p("Vous avez maintenant accès à l'espace **Administration** de 360-Immo.ci : vérifier les annonces avant leur publication, traiter les signalements, valider les agences et gérer les comptes.")
          .bouton("Ouvrir l'espace Administration", "/admin");
    }
    pied = ["Vous recevez cet e-mail parce que vous avez un compte sur 360-Immo.ci."];
  } else {
    const annonce = d.annonce as Annonce;
    const fin = texteDate(String(d.expire_le));
    sujet = `Votre annonce expire le ${fin} : renouvelez-la`;
    apercu = `« ${annonce.titre} » ne sera plus visible après le ${fin}.`;
    corps.p(`Votre annonce **« ${annonce.titre} »** (réf. ${annonce.reference}) ne sera plus visible sur 360-Immo.ci après le **${fin}**.`)
      .p("Si le bien est toujours disponible, renouvelez-la pour 90 jours en un clic depuis votre espace. S'il est vendu ou loué, indiquez-le : les visiteurs ne vous appelleront plus pour rien.")
      .bouton("Renouveler mon annonce", "/mon-espace?section=annonces");
  }

  const { html, texte } = page(sujet, apercu, corps, pied, site);
  return { a: String(n.email), nom: n.prenom?.trim() || null, sujet, html, texte, desabonnement, etiquette: n.modele };
}

/** Demande de visite et réponses : à l'annonceur, ou au visiteur (avec ou sans compte) */
function visite(n: NotificationAEnvoyer, corps: Corps, piedCompte: string[], site: string) {
  const d = n.donnees;
  const annonce = d.annonce as Annonce;
  const creneau = texteCreneau(String(d.creneau));
  const propose = d.creneau_propose ? texteCreneau(String(d.creneau_propose)) : null;
  const avecCompte = d.avec_compte === true;
  const bien = `« ${annonce.titre} » (réf. ${annonce.reference})`;
  const reponse = (qui: string) => {
    if (d.reponse) corps.p(`${qui} :`).citation(String(d.reponse));
  };
  const visites = "/mon-espace?section=visites";
  let sujet: string, apercu: string, pied = piedCompte;

  if (d.pour === "annonceur") {
    const nom = String(d.nom ?? "Un visiteur");
    switch (d.evenement) {
      case "demandee":
        sujet = `Demande de visite le ${creneau} — ${annonce.titre}`;
        apercu = `${nom} souhaite visiter votre bien.`;
        corps.p(`**${nom}** souhaite visiter votre bien ${bien} :`)
          .infos([["Quand", creneau], ["Téléphone", String(d.telephone ?? "")], ["Message", d.message ? String(d.message) : null]])
          .p(avecCompte
            ? "Confirmez, proposez un autre créneau ou refusez depuis votre espace : la réponse lui arrivera aussitôt."
            : `${nom} n'a pas de compte : appelez ou écrivez sur WhatsApp au ${d.telephone} pour lui répondre, puis notez votre réponse dans votre espace.`)
          .bouton("Répondre à la demande", visites);
        break;
      case "acceptee":
        sujet = `Visite confirmée le ${creneau} — ${annonce.titre}`;
        apercu = `${nom} a accepté le créneau que vous avez proposé.`;
        corps.p(`**${nom}** a accepté le créneau que vous avez proposé : la visite de votre bien ${bien} est confirmée le **${creneau}**.`)
          .infos([["Téléphone", String(d.telephone ?? "")]])
          .bouton("Voir mes visites", visites);
        break;
      default: // annulee
        sujet = `Visite annulée — ${annonce.titre}`;
        apercu = `${nom} a annulé sa visite du ${creneau}.`;
        corps.p(`**${nom}** a annulé sa visite du **${creneau}** pour votre bien ${bien}.`);
        reponse("Son explication");
        corps.bouton("Voir mes visites", visites);
    }
  } else {
    const annonceur = String(d.annonceur ?? "L'annonceur");
    const suite = avecCompte ? visites : lienAnnonce(annonce);
    const texteSuite = avecCompte ? "Voir ma demande" : "Revoir l'annonce";
    switch (d.evenement) {
      case "confirmee":
        sujet = `Visite confirmée le ${creneau} — ${annonce.titre}`;
        apercu = `${annonceur} vous attend le ${creneau}.`;
        corps.p(`Bonne nouvelle : **${annonceur}** a confirmé votre visite du bien ${bien} le **${creneau}**.`);
        reponse("Son message");
        corps.p("Ne versez jamais d'argent avant d'avoir visité le bien et vérifié les documents.").bouton(texteSuite, suite);
        break;
      case "proposee":
        sujet = `Autre créneau proposé pour votre visite — ${annonce.titre}`;
        apercu = `${annonceur} vous propose le ${propose}.`;
        corps.p(`**${annonceur}** ne peut pas vous recevoir le ${creneau} et vous propose de visiter le bien ${bien} le **${propose}**.`);
        reponse("Son message");
        if (avecCompte) corps.bouton("Accepter ou annuler", visites);
        else corps.p("Répondez-lui par téléphone ou sur WhatsApp, depuis l'annonce.").bouton("Revoir l'annonce", suite);
        break;
      case "refusee":
        sujet = `Demande de visite refusée — ${annonce.titre}`;
        apercu = `${annonceur} ne peut pas vous recevoir.`;
        corps.p(`**${annonceur}** ne peut pas vous recevoir pour visiter le bien ${bien}.`);
        reponse("Son explication");
        corps.p("D'autres biens vous attendent peut-être :").bouton("Voir les annonces", "/annonces");
        break;
      default: // annulee par l'annonceur
        sujet = `Visite annulée — ${annonce.titre}`;
        apercu = `${annonceur} a annulé la visite du ${creneau}.`;
        corps.p(`**${annonceur}** a annulé la visite du **${creneau}** pour le bien ${bien}.`);
        reponse("Son explication");
        corps.bouton(texteSuite, suite);
    }
    if (!avecCompte) {
      pied = [
        "Vous recevez cet e-mail parce que vous avez demandé une visite sur 360-Immo.ci en laissant cette adresse.",
        `${lienPied("360-Immo.ci", site)}`,
      ];
    }
  }
  return { sujet, apercu, pied };
}
