// Base de données (supabase/migrations) : données, règles des biens, droits d'accès.
// Les tests tournent sur une vraie base PostgreSQL (PGlite), sans Supabase ni Docker.
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { expect, test } from "@playwright/test";
import { FICHIER_REFERENCES, sqlReferences } from "../supabase/references";
import { annonceType, creerAnnonce, en, inscrire, lieu, nouvelleBase } from "./base/outils-base";

test.describe.configure({ mode: "serial" });
test.beforeEach(() => test.skip(test.info().project.name !== "ordinateur", "une seule fois"));

let db: PGlite;
let awa: string, koffi: string, admin: string;

test.beforeAll(async () => {
  if (test.info().project.name !== "ordinateur") return; // une seule fois
  test.setTimeout(120_000);
  db = await nouvelleBase();
  awa = await inscrire(db, { prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90" });
  koffi = await inscrire(db, { prenom: "Koffi", nom: "Yao" });
  admin = await inscrire(db, { prenom: "Équipe", nom: "360-Immo.ci" }, "admin");
});
test.afterAll(async () => {
  await db?.close();
});

const lignes = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

test("Toutes les tables sont protégées (règles d'accès actives)", async () => {
  const ouvertes = await lignes<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
  );
  expect(ouvertes).toEqual([]);
});

test("Fonctions à pleins droits (security definer) : seules celles prévues sont appelables depuis le site", async () => {
  // Supabase donne d'office le droit d'appeler une nouvelle fonction aux visiteurs et aux comptes : chaque ajout se décide ici
  const appelables = async (role: string) => (await lignes<{ f: string }>(
    `select p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
        and has_function_privilege($1, p.oid, 'execute') order by 1`, [role])).map((x) => x.f);
  // pour tous (visiteurs compris) ; les fonctions de l'équipe vérifient elles-mêmes le compte (exiger_admin)
  const publiques = ["admin_a_verifier", "admin_agences", "admin_chercher_comptes", "admin_demandes_agence", "admin_equipe",
    "admin_journal", "admin_signalements", "admin_tableau", "admin_verifications", "agences_partenaires", "alerte_par_jeton",
    "annonceur_public", "arreter_alerte", "cartes_annonces", "changer_acces_admin", "compte_admin", "compte_suspendu", "compter_vue",
    "contact_annonce", "creneaux_pris", "demander_verification", "exiger_admin", "inscription_possible", "logo_annonceur",
    "mes_verifications", "moderer_annonce", "modifier_agence", "nom_agence_annonce", "noter_action", "reactiver_compte",
    "refuser_agence", "signaler_annonce", "statistiques_annonceur", "suspendre_compte", "traiter_signalements", "valider_agence", "vitrine"];
  const comptes = ["admin_numeros_partages", "admin_pieces_conservees", "annonces_semblables", "compteurs", "consulter_pieces", "document_dans_une_demande",
    "document_ouvert_a_l_equipe", "liberer_numero", "mes_annonces", "mes_conversations", "mes_rappels", "mes_visites", "piece_a_conserver",
    "renouveler_annonce", "repondre_visite", "traiter_rappel", "traiter_verification"];
  expect(await appelables("anon")).toEqual(publiques);
  expect(await appelables("authenticated")).toEqual([...publiques, ...comptes].sort());
  // jamais depuis le site : e-mails, journal, fiche d'un compte, envoi des e-mails et ménage du matin (clé secrète)
  for (const interne of ["prevenir_compte", "noter_action_equipe", "fiche_compte", "notifications_a_envoyer", "documents_a_supprimer",
    "semblables", "photos_ailleurs"]) {
    expect(await appelables("authenticated")).not.toContain(interne);
  }
});

test("Données de référence : identiques aux listes du site", async () => {
  expect(readFileSync(FICHIER_REFERENCES, "utf8"), "fichier à regénérer : npm run base:references").toBe(sqlReferences());
  const [n] = await lignes<Record<string, number>>(`select
    (select count(*)::int from public.types_bien) as types,
    (select count(*)::int from public.villes) as villes,
    (select count(*)::int from public.communes c join public.villes v on v.id = c.ville_id where v.nom = 'Abidjan') as abidjan,
    (select count(*)::int from public.quartiers) as quartiers`);
  expect(n).toEqual({ types: 9, villes: 188, abidjan: 13, quartiers: 119 });
  expect((await lieu(db, "Abidjan", "Marcory", "Remblais")).quartier_id).not.toBeNull();
  expect(await lignes("select cle from public.types_bien order by ordre")).toEqual(
    ["appartement", "maison", "villa", "terrain", "bureau", "commerce", "immeuble", "hotel", "autres"].map((cle) => ({ cle })),
  );
});

test("Inscription : le profil est créé avec le prénom, le nom et le téléphone", async () => {
  const [p] = await lignes("select prenom, nom, telephone, role from public.profils where id = $1", [awa]);
  expect(p).toEqual({ prenom: "Awa", nom: "Koné", telephone: "+225 07 48 32 11 90", role: "particulier" });
});

test("Inscription complète : WhatsApp, second numéro, demande d'agence (qui ne donne pas le rôle d'agence)", async () => {
  const aya = await inscrire(db, {
    prenom: " Aya ", nom: "Bamba", telephone: "+225 05 11 22 33 44", whatsapp: false,
    telephone2: "+225 27 22 44 55 66", whatsapp2: true, telephone2_type: "bureau", agence: " Kamika Immobilier ",
  });
  const profil = async (id: string) => (await lignes<Record<string, unknown>>(
    `select prenom, role, telephone_whatsapp, telephone2, telephone2_whatsapp, telephone2_type, demande_agence,
            demande_agence_le is not null as date_demande from public.profils where id = $1`, [id]))[0];
  expect(await profil(aya)).toEqual({
    prenom: "Aya", role: "particulier", telephone_whatsapp: false, telephone2: "+225 27 22 44 55 66",
    telephone2_whatsapp: true, telephone2_type: "bureau", demande_agence: "Kamika Immobilier", date_demande: true,
  });
  // Par défaut : numéro principal sur WhatsApp, pas de second numéro, pas de demande d'agence
  expect(await profil(awa)).toMatchObject({ telephone_whatsapp: true, telephone2: null, demande_agence: null, date_demande: false });

  // La personne peut retirer ou refaire sa demande, mais pas se donner le rôle d'agence ni changer la date
  await en(db, aya, () => db.query("update public.profils set demande_agence = null, role = 'agence' where id = $1", [aya]));
  expect(await profil(aya)).toMatchObject({ role: "particulier", demande_agence: null, date_demande: false });
  await en(db, aya, () => db.query("update public.profils set demande_agence = 'Aya Immo' where id = $1", [aya]));
  await en(db, aya, () => db.query("update public.profils set demande_agence_le = '2020-01-01' where id = $1", [aya]));
  const [d] = await lignes<{ an: number }>("select extract(year from demande_agence_le)::int as an from public.profils where id = $1", [aya]);
  expect(d.an).toBe(new Date().getFullYear());

  // Numéro enregistré sans son indicatif : refusé
  await expect(en(db, aya, () => db.query("update public.profils set telephone = '0511223344' where id = $1", [aya])))
    .rejects.toThrow(/telephone_format/);
});

test("Annonce : enregistrée en brouillon, avec sa référence ; un appartement est toujours dans un immeuble", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db)));
  expect(a).toMatchObject({ statut: "brouillon", auteur_id: awa, dans_immeuble: true, premium: false });
  expect(a.reference).toMatch(new RegExp(`^IMM-${new Date().getFullYear()}-\\d{5}$`));
  // Chambre d'hôtel : toujours meublée, à la nuit
  const h = await en(db, awa, async () =>
    creerAnnonce(db, await annonceType(db, {
      type_bien: "hotel", titre: "Chambre double au Plateau", prix: 35000, loyer_par: "nuit", caution_mois: null,
      pieces: null, chambres: null, meuble: false, etage: null, commodites: ["Air conditionné"],
    })));
  expect(h).toMatchObject({ meuble: true, loyer_par: "nuit" });
});

test("Règles des biens : une annonce incohérente est refusée, avec un message clair", async () => {
  const cas: [string, Record<string, unknown>, RegExp][] = [
    ["terrain meublé", { type_bien: "terrain", pieces: null, chambres: null, sanitaires: null, etage: null, commodites: [], meuble: true }, /Terrain.*déjà meublé/],
    ["terrain avec des pièces", { type_bien: "terrain", chambres: null, sanitaires: null, etage: null, commodites: [], meuble: false }, /Pas de nombre de pièces pour « Terrain »/],
    ["chambre d'hôtel à vendre", { type_bien: "hotel", transaction: "vente", loyer_par: null, caution_mois: null, pieces: null, chambres: null, etage: null, commodites: [] }, /ne se vend pas/],
    ["vente avec un loyer par mois", { transaction: "vente", caution_mois: null }, /loyer_selon_transaction/],
    ["location sans unité de loyer", { loyer_par: null }, /loyer_selon_transaction/],
    ["terrain loué à la journée", { type_bien: "terrain", loyer_par: "jour", pieces: null, chambres: null, sanitaires: null, etage: null, commodites: [], meuble: false }, /ne se loue pas à la journée/],
    ["3 pièces et 3 chambres", { chambres: 3 }, /chambres_selon_pieces/],
    ["villa à un étage d'immeuble", { type_bien: "villa", etage: 2 }, /Villa.*jamais dans un immeuble/],
    ["piscine sur un terrain", { type_bien: "terrain", pieces: null, chambres: null, sanitaires: null, etage: null, meuble: false, commodites: ["Piscine", "Titre foncier (ACD)"] }, /Commodités sans objet pour « Terrain » : Piscine/],
    ["studio pour une maison", { type_bien: "maison", pieces: 1, chambres: 0, studio: true, etage: null }, /Studio.*appartements/],
    ["caution sur une vente", { transaction: "vente", loyer_par: null }, /caution_en_location/],
  ];
  for (const [nom, changements, message] of cas) {
    const champs = await annonceType(db, changements);
    await expect(en(db, awa, () => creerAnnonce(db, champs)), nom).rejects.toThrow(message);
  }
  // Le lieu : quartier d'une autre commune, commune d'une autre ville
  const marcory = await lieu(db, "Abidjan", "Marcory", "Biétry");
  await expect(en(db, awa, async () => creerAnnonce(db, await annonceType(db, { quartier_id: marcory.quartier_id }))))
    .rejects.toThrow(/quartier n'est pas dans cette commune/);
  const bouake = await lieu(db, "Bouaké", "Bouaké");
  await expect(en(db, awa, async () => creerAnnonce(db, await annonceType(db, { ville_id: bouake.ville_id, quartier_id: null }))))
    .rejects.toThrow(/commune n'est pas dans cette ville/);
});

test("Droits : un visiteur ne voit que les annonces publiées ; l'auteur voit ses brouillons ; personne d'autre ne les modifie", async () => {
  const brouillon = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { titre: "Brouillon d'Awa à Cocody" })));
  const publiee = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { titre: "Annonce publiée d'Awa", statut: "en_attente" })));
  await db.query("update public.annonces set statut = 'publiee' where id = $1", [publiee.id]); // par 360-Immo.ci

  const titres = async (compte: string | null) =>
    en(db, compte, async () => (await lignes<{ titre: string }>("select titre from public.annonces where id in ($1, $2) order by titre", [brouillon.id, publiee.id])).map((r) => r.titre));
  expect(await titres(null)).toEqual(["Annonce publiée d'Awa"]);
  expect(await titres(koffi)).toEqual(["Annonce publiée d'Awa"]);
  expect(await titres(awa)).toEqual(["Annonce publiée d'Awa", "Brouillon d'Awa à Cocody"]);

  // Koffi ne modifie ni ne supprime l'annonce d'Awa (aucune ligne touchée)
  const touchees = await en(db, koffi, async () => (await db.query("update public.annonces set prix = 1 where id = $1", [publiee.id])).affectedRows);
  expect(touchees).toBe(0);
  const supprimees = await en(db, koffi, async () => (await db.query("delete from public.annonces where id = $1", [publiee.id])).affectedRows);
  expect(supprimees).toBe(0);
  // Un visiteur sans compte ne publie rien
  await expect(en(db, null, async () => creerAnnonce(db, await annonceType(db)))).rejects.toThrow(/row-level security|permission denied/);
  // Personne ne publie une annonce au nom d'un autre
  await expect(en(db, koffi, async () => creerAnnonce(db, await annonceType(db, { auteur_id: awa })))).rejects.toThrow(/row-level security/);
});

test("Publication : réservée à 360-Immo.ci ; Premium, vérification et vues ne se modifient pas soi-même", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { titre: "Appartement à faire vérifier", statut: "en_attente" })));
  await expect(en(db, awa, () => db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id])))
    .rejects.toThrow(/vérifiée par 360-Immo.ci avant d'être publiée/);
  await expect(en(db, awa, async () => creerAnnonce(db, await annonceType(db, { statut: "publiee" }))))
    .rejects.toThrow(/vérifiée par 360-Immo.ci/);
  // Premium, vérification, vues : ignorés quand l'auteur les change
  await en(db, awa, () => db.query("update public.annonces set premium = true, verifiee = true, vues = 999, prix = 160000 where id = $1", [a.id]));
  const [apres] = await lignes("select premium, verifiee, vues, prix from public.annonces where id = $1", [a.id]);
  expect(apres).toEqual({ premium: false, verifiee: false, vues: 0, prix: 160000 });
  // Un administrateur publie : date de publication notée ; les vues se comptent
  await en(db, admin, () => db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]));
  await en(db, null, () => db.query("select public.compter_vue($1)", [a.id]));
  const [publiee] = await lignes<{ statut: string; publiee_le: Date | null; vues: number }>(
    "select statut, publiee_le, vues from public.annonces where id = $1", [a.id]);
  expect(publiee.statut).toBe("publiee");
  expect(publiee.publiee_le).not.toBeNull();
  expect(publiee.vues).toBe(1);
  // L'auteur peut encore archiver son annonce
  await en(db, awa, () => db.query("update public.annonces set statut = 'archivee' where id = $1", [a.id]));
  expect((await lignes("select statut from public.annonces where id = $1", [a.id]))[0]).toEqual({ statut: "archivee" });
});

test("Validité : publiée pour 90 jours, cachée des visiteurs une fois expirée, renouvelée par son auteur", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { titre: "Appartement valable 90 jours", statut: "en_attente" })));
  await en(db, admin, () => db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]));
  const jours = async () => (await lignes<{ j: number }>(
    "select round(extract(epoch from expire_le - now()) / 86400)::int as j from public.annonces where id = $1", [a.id]))[0].j;
  expect(await jours()).toBe(90);
  const visible = (compte: string | null) => en(db, compte, async () => (await lignes("select id from public.annonces where id = $1", [a.id])).length === 1);
  expect(await visible(null)).toBe(true);
  // Trop tôt pour renouveler
  await expect(en(db, awa, () => db.query("select public.renouveler_annonce($1)", [a.id]))).rejects.toThrow(/15 derniers jours/);
  // Expirée : plus visible des visiteurs ni des autres comptes, toujours visible de son auteur
  await db.query("update public.annonces set expire_le = now() - interval '1 day' where id = $1", [a.id]);
  expect([await visible(null), await visible(koffi), await visible(awa)]).toEqual([false, false, true]);
  // Seul l'auteur la renouvelle (pour 90 jours) ; l'auteur ne change pas la date lui-même
  await expect(en(db, koffi, () => db.query("select public.renouveler_annonce($1)", [a.id]))).rejects.toThrow(/renouvelée/);
  await en(db, awa, () => db.query("update public.annonces set expire_le = now() + interval '5 years' where id = $1", [a.id]));
  expect(await jours()).toBeLessThan(0);
  await en(db, awa, () => db.query("select public.renouveler_annonce($1)", [a.id]));
  expect(await jours()).toBe(90);
  expect(await visible(null)).toBe(true);
  await expect(en(db, null, () => db.query("select public.renouveler_annonce($1)", [a.id]))).rejects.toThrow(/permission denied/);
});

test("Annonce publiée retouchée : petits changements en ligne ; gros changements ou nouvelle photo → nouvelle vérification", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { titre: "Appartement à retoucher", statut: "en_attente", prix: 100000 })));
  const publier = () => en(db, admin, () => db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]));
  const statut = async () => (await lignes<{ statut: string }>("select statut from public.annonces where id = $1", [a.id]))[0].statut;
  const modifier = (sql: string) => en(db, awa, () => db.query(`update public.annonces set ${sql} where id = $1`, [a.id]));
  await publier();
  await modifier("description = 'Cuisine refaite, très lumineux', commodites = '{Parking}', prix = 110000"); // +10 %
  expect(await statut()).toBe("publiee");
  await modifier("prix = 140000"); // +27 %
  expect(await statut()).toBe("en_attente");
  await publier();
  const l = await lieu(db, "Abidjan", "Cocody", "Angré");
  await modifier(`quartier_id = ${l.quartier_id}`);
  expect(await statut()).toBe("en_attente");
  await publier();
  await en(db, awa, () => db.query("insert into public.photos_annonce (annonce_id, chemin, ordre) values ($1, $2, 1)", [a.id, `${a.id}/salon.webp`]));
  expect(await statut()).toBe("en_attente");
  // 20 photos au plus
  for (let i = 2; i <= 20; i++) {
    await en(db, awa, () => db.query("insert into public.photos_annonce (annonce_id, chemin, ordre) values ($1, $2, $3)", [a.id, `${a.id}/p${i}.webp`, i]));
  }
  await expect(en(db, awa, () => db.query("insert into public.photos_annonce (annonce_id, chemin, ordre) values ($1, $2, 21)", [a.id, `${a.id}/p21.webp`])))
    .rejects.toThrow(/20 photos au plus/);
});

test("Contact de l'annonce : particulier ou agence, e-mail et numéros au bon format, quartier écrit à la main", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, {
    titre: "Maison à Bouaké, quartier Air France", type_vendeur: "agence", contact_email: "contact@kamika.ci",
    contact_whatsapp: false, contact_telephone2: "+33 6 12 34 56 78", contact_telephone2_whatsapp: true,
    type_bien: "maison", etage: null, ...(await lieu(db, "Bouaké", "Bouaké")), quartier_texte: "Air France 2",
  })));
  expect(a).toMatchObject({ type_vendeur: "agence", contact_whatsapp: false, contact_telephone2_whatsapp: true, quartier_texte: "Air France 2", expire_le: null });
  for (const [champ, valeur, erreur] of [
    ["contact_email", "kamika.ci", /contact_email_format/], ["contact_telephone", "0748321190", /contact_telephone_format/],
    ["type_vendeur", "promoteur", /type_vendeur_connu/],
  ] as const) {
    await expect(en(db, awa, () => db.query(`update public.annonces set ${champ} = $2 where id = $1`, [a.id, valeur]))).rejects.toThrow(erreur);
  }
});

test("Profils : chacun ne voit que le sien et ne se donne pas le rôle d'administrateur", async () => {
  const vus = await en(db, koffi, async () => lignes<{ prenom: string }>("select prenom from public.profils"));
  expect(vus).toEqual([{ prenom: "Koffi" }]);
  expect(await en(db, null, () => lignes("select * from public.profils"))).toEqual([]);
  await en(db, koffi, () => db.query("update public.profils set role = 'admin', telephone = '+225 01 02 03 04 05' where id = $1", [koffi]));
  expect((await lignes("select role, telephone from public.profils where id = $1", [koffi]))[0])
    .toEqual({ role: "particulier", telephone: "+225 01 02 03 04 05" });
});

test("Favoris et alertes : privés", async () => {
  const [a] = await lignes<{ id: string }>("select id from public.annonces where statut = 'publiee' limit 1");
  await en(db, koffi, async () => {
    await db.query("insert into public.favoris (annonce_id) values ($1)", [a.id]);
    await db.query("insert into public.alertes (nom, criteres) values ('Appartements à Cocody', $1)", [JSON.stringify({ tx: "location", type: "appartement", q: "Cocody" })]);
  });
  expect(await en(db, koffi, () => lignes("select annonce_id from public.favoris"))).toEqual([{ annonce_id: a.id }]);
  expect(await en(db, awa, () => lignes("select * from public.favoris"))).toEqual([]);
  expect(await en(db, awa, () => lignes("select * from public.alertes"))).toEqual([]);
  expect(await en(db, koffi, () => lignes("select nom from public.alertes"))).toEqual([{ nom: "Appartements à Cocody" }]);
});

test("Messages : seulement entre la personne intéressée et l'annonceur ; un message envoyé ne change plus", async () => {
  const [a] = await lignes<{ id: string }>("select id from public.annonces where statut = 'publiee' and auteur_id = $1 limit 1", [awa]);
  const conversation = await en(db, koffi, async () => {
    const [c] = (await db.query<{ id: string; annonceur_id: string }>(
      "insert into public.conversations (annonce_id) values ($1) returning id, annonceur_id", [a.id])).rows;
    await db.query("insert into public.messages (conversation_id, contenu) values ($1, 'Bonjour, est-il toujours disponible ?')", [c.id]);
    return c;
  });
  expect(conversation.annonceur_id).toBe(awa);
  // Awa (l'annonceuse) lit et répond ; un troisième compte ne voit rien
  const intrus = await inscrire(db, { prenom: "Intrus", nom: "Curieux" });
  expect(await en(db, intrus, () => lignes("select * from public.messages"))).toEqual([]);
  await en(db, awa, async () => {
    await db.query("update public.messages set lu_le = now(), contenu = 'modifié' where conversation_id = $1", [conversation.id]);
    await db.query("insert into public.messages (conversation_id, contenu) values ($1, 'Oui, visite possible samedi.')", [conversation.id]);
  });
  const fil = await en(db, koffi, () => lignes<{ contenu: string; lu: boolean }>(
    "select contenu, lu_le is not null as lu from public.messages where conversation_id = $1 order by cree_le, contenu", [conversation.id]));
  expect(fil).toEqual([
    { contenu: "Bonjour, est-il toujours disponible ?", lu: true },
    { contenu: "Oui, visite possible samedi.", lu: false },
  ]);
  // On n'écrit pas dans la conversation des autres
  await expect(en(db, intrus, () => db.query("insert into public.messages (conversation_id, contenu) values ($1, 'spam')", [conversation.id])))
    .rejects.toThrow(/row-level security/);
});

test("Visites : demandées même sans compte pour une annonce publiée ; vues par l'annonceur seulement", async () => {
  const [a] = await lignes<{ id: string }>("select id from public.annonces where statut = 'publiee' and auteur_id = $1 limit 1", [awa]);
  await en(db, null, () => db.query(
    "insert into public.visites (annonce_id, nom, telephone, creneau) values ($1, 'Awa Traoré', '+225 05 11 22 33 44', now() + interval '2 days')", [a.id]));
  expect(await en(db, awa, () => lignes("select nom from public.visites where annonce_id = $1", [a.id]))).toEqual([{ nom: "Awa Traoré" }]);
  expect(await en(db, koffi, () => lignes("select * from public.visites where annonce_id = $1", [a.id]))).toEqual([]);
  // Pas de visite pour un brouillon
  const [b] = await lignes<{ id: string }>("select id from public.annonces where statut = 'brouillon' limit 1");
  await expect(en(db, null, () => db.query(
    "insert into public.visites (annonce_id, nom, telephone, creneau) values ($1, 'Test', '+225 01 02 03 04 05', now() + interval '1 day')", [b.id])))
    .rejects.toThrow(/n'est plus en ligne|row-level security/);
});

test("Photos : rangées sous l'annonce, ajoutées seulement par son auteur", async () => {
  const [a] = await lignes<{ id: string }>("select id from public.annonces where auteur_id = $1 limit 1", [awa]);
  const ajouter = (compte: string) => en(db, compte, () => db.query(
    "insert into storage.objects (bucket_id, name) values ('photos-annonces', $1)", [`${a.id}/${compte}.webp`]));
  await ajouter(awa);
  await expect(ajouter(koffi)).rejects.toThrow(/row-level security/);
  const [dossier] = await lignes("select public, file_size_limit from storage.buckets where id = 'photos-annonces'");
  expect(dossier).toEqual({ public: true, file_size_limit: 5242880 });
  // Retrait du fichier : par l'auteur seulement (il doit pouvoir le « voir » pour le supprimer)
  const retirer = (compte: string) => en(db, compte, () => db.query(
    "delete from storage.objects where bucket_id = 'photos-annonces' and name = $1", [`${a.id}/${awa}.webp`]));
  expect((await retirer(koffi)).affectedRows).toBe(0);
  expect(await en(db, koffi, () => lignes("select name from storage.objects where name like $1", [`${a.id}/%`]))).toEqual([]);
  expect((await retirer(awa)).affectedRows).toBe(1);
});

// ══ Étape 5 : recherche des annonces en ligne, fiche d'un bien, contact sur demande ══
type Carte = { id: string; reference: string; titre: string; photo: string | null; nb_photos: number; [cle: string]: unknown };
type Resultat = { total: number; annonces: Carte[]; par_transaction: Record<string, number>; par_type: Record<string, number> };
const R5: Record<string, Carte & Record<string, unknown>> = {};

/** Recherche comme un visiteur sans compte ; titres des annonces de ces tests (« R5 … ») */
async function chercher(criteres: Record<string, unknown>) {
  const [{ r }] = await en(db, null, () => lignes<{ r: Resultat }>("select public.rechercher_annonces($1) as r", [criteres]));
  return { ...r, titres: r.annonces.map((a) => a.titre).filter((t) => t.startsWith("R5 ")).sort() };
}
const titres = (...cles: string[]) => cles.map((k) => R5[k].titre).sort();

test("Recherche : annonces en ligne seulement, critères de la maquette, tri, pages, nombres par onglet et par type", async () => {
  const marcory = (quartier?: string) => lieu(db, "Abidjan", "Marcory", quartier);
  const texte = async (q: string) => ({ ...(await marcory()), quartier_id: null, quartier_texte: q });
  const nouvelles: [string, Record<string, unknown>, "publier" | "brouillon" | "attente" | "expiree"][] = [
    ["A1", { titre: "R5 Appartement 3 pièces Zone 4", transaction: "location", type_bien: "appartement", prix: 300000, loyer_par: "mois",
      caution_mois: 2, ...(await marcory("Zone 4")), pieces: 3, chambres: 2, sanitaires: 2, meuble: true, etage: 2, surface: 90,
      commodites: ["Piscine", "Parking"] }, "publier"],
    ["A2", { titre: "R5 Studio meublé Biétry", transaction: "location", type_bien: "appartement", prix: 25000, loyer_par: "jour",
      caution_mois: null, ...(await marcory("Biétry")), pieces: 1, studio: true, chambres: 0, sanitaires: 1, meuble: true, etage: 0,
      surface: 30, commodites: [] }, "publier"],
    ["A3", { titre: "R5 Villa 6 pièces Marcory", transaction: "vente", type_bien: "villa", prix: 250000000, loyer_par: null,
      caution_mois: null, ...(await texte("Cité Sainte-Thérèse")), pieces: 6, chambres: 5, sanitaires: 4, meuble: false,
      etage: null, surface: 400, commodites: ["Piscine", "Jardin"] }, "publier"],
    ["A4", { titre: "R5 Terrain 500 m² Marcory", transaction: "vente", type_bien: "terrain", prix: 40000000, loyer_par: null,
      caution_mois: null, ...(await marcory()), pieces: null, chambres: null, sanitaires: null, meuble: false, etage: null,
      surface: 500, commodites: ["Titre foncier (ACD)"] }, "publier"],
    ["A5", { titre: "R5 Bureau Zone 4", transaction: "location", type_bien: "bureau", prix: 12000000, loyer_par: "annee",
      caution_mois: null, ...(await marcory("Zone 4")), pieces: 4, chambres: null, sanitaires: 2, meuble: false,
      dans_immeuble: true, etage: 5, surface: 120, commodites: [] }, "publier"],
    ["A6", { titre: "R5 Chambre d'hôtel Biétry", transaction: "location", type_bien: "hotel", prix: 40000, loyer_par: "nuit",
      caution_mois: null, ...(await marcory("Biétry")), pieces: null, chambres: null, sanitaires: 1, etage: null, surface: null,
      commodites: [] }, "publier"],
    ["A7", { titre: "R5 Maison 4 pièces Korhogo", transaction: "location", type_bien: "maison", prix: 80000, loyer_par: "mois",
      ...(await lieu(db, "Korhogo", "Korhogo")), quartier_texte: "Petit-Paris", pieces: 4, chambres: 3, sanitaires: 1,
      meuble: false, etage: null, surface: 150, commodites: [] }, "publier"],
    ["A8", { titre: "R5 Brouillon à Marcory" }, "brouillon"],
    ["A9", { titre: "R5 Expirée à Marcory" }, "expiree"],
    ["A10", { titre: "R5 En vérification à Marcory" }, "attente"],
  ];
  for (const [cle, champs, suite] of nouvelles) {
    const base = await annonceType(db, { ...(await marcory("Zone 4")), contact_telephone: "+225 07 48 32 11 90" });
    const a = await en(db, awa, async () => creerAnnonce(db, { ...base, ...champs, statut: suite === "brouillon" ? "brouillon" : "en_attente" }));
    if (cle === "A1") {
      // photos ajoutées par l'équipe (une photo ajoutée par l'auteur renverrait l'annonce en vérification)
      await db.query("insert into public.photos_annonce (annonce_id, chemin, ordre) values ($1, $2, 1), ($1, $3, 0)",
        [a.id, `${a.id}/salon.webp`, `${a.id}/facade.webp`]);
    }
    if (suite === "publier" || suite === "expiree") await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
    if (suite === "expiree") await db.query("update public.annonces set expire_le = now() - interval '1 day' where id = $1", [a.id]);
    R5[cle] = a as Carte & Record<string, unknown>;
  }
  // Villa publiée il y a 30 jours, terrain en Premium, appartement vérifié par un agent
  await db.query("update public.annonces set publiee_le = now() - interval '30 days' where id = $1", [R5.A3.id]);
  await db.query("update public.annonces set premium = true where id = $1", [R5.A4.id]);
  await db.query("update public.annonces set verifiee = true where id = $1", [R5.A1.id]);

  const aMarcory = { ville: "Abidjan", commune: "Marcory" };
  // En ligne seulement : ni brouillon, ni en vérification, ni expirée
  const toutes = await chercher(aMarcory);
  expect(toutes.titres).toEqual(titres("A1", "A2", "A3", "A4", "A5", "A6"));
  expect(toutes.total).toBe(6);
  // Transaction, types ; nombres des onglets (sans tenir compte de la transaction) et des types
  const achat = await chercher({ ...aMarcory, tx: "achat" });
  expect(achat.titres).toEqual(titres("A3", "A4"));
  expect(achat.par_transaction).toEqual({ vente: 2, location: 4 });
  expect(achat.par_type).toEqual({ villa: 1, terrain: 1 });
  expect((await chercher({ ...aMarcory, tx: "location" })).titres).toEqual(titres("A1", "A2", "A5", "A6"));
  expect((await chercher({ ...aMarcory, types: ["appartement"] })).titres).toEqual(titres("A1", "A2"));
  // Lieu : quartier de la liste (sans accents ni majuscules), quartier écrit à la main, recherche libre, autre ville
  expect((await chercher({ ...aMarcory, quartier: "zone 4" })).titres).toEqual(titres("A1", "A5"));
  expect((await chercher({ ...aMarcory, quartier: "Bietry" })).titres).toEqual(titres("A2", "A6"));
  expect((await chercher({ ...aMarcory, quartier: "cite sainte therese" })).titres).toEqual(titres("A3"));
  expect((await chercher({ texte: "sainte-thérèse" })).titres).toEqual(titres("A3"));
  expect((await chercher({ ville: "Korhogo", quartier: "petit paris" })).titres).toEqual(titres("A7"));
  // Location à la journée (ou à la nuit) ou au mois (ou à l'année)
  expect((await chercher({ ...aMarcory, tx: "location", duree: "jour" })).titres).toEqual(titres("A2", "A6"));
  expect((await chercher({ ...aMarcory, tx: "location", duree: "mois" })).titres).toEqual(titres("A1", "A5"));
  // Budget : loyer ramené au mois (12 000 000 par an = 1 000 000 par mois) ou à la journée
  expect((await chercher({ ...aMarcory, tx: "location", duree: "mois", max: 500000 })).titres).toEqual(titres("A1"));
  expect((await chercher({ ...aMarcory, tx: "location", duree: "mois", min: 900000 })).titres).toEqual(titres("A5"));
  expect((await chercher({ ...aMarcory, tx: "location", duree: "jour", max: 30000 })).titres).toEqual(titres("A2"));
  expect((await chercher({ ...aMarcory, tx: "achat", max: 50000000 })).titres).toEqual(titres("A4"));
  // Budget sans transaction : ignoré (un loyer et un prix de vente ne se comparent pas)
  expect((await chercher({ ...aMarcory, max: 1 })).total).toBe(6);
  // Pièces, chambres : « 5+ » = 5 ou plus ; un terrain n'a pas de pièces, sauf s'il est coché, il est écarté
  expect((await chercher({ ...aMarcory, pieces: ["studio"] })).titres).toEqual(titres("A2"));
  expect((await chercher({ ...aMarcory, pieces: ["3"] })).titres).toEqual(titres("A1"));
  expect((await chercher({ ...aMarcory, pieces: ["2", "5+"] })).titres).toEqual(titres("A3"));
  expect((await chercher({ ...aMarcory, types: ["appartement", "terrain"], pieces: ["3"] })).titres).toEqual(titres("A1", "A4"));
  expect((await chercher({ ...aMarcory, chambres: ["5+"] })).titres).toEqual(titres("A3"));
  // Salles de bain au moins ; caution au plus ; surface
  expect((await chercher({ ...aMarcory, sdb: "2" })).titres).toEqual(titres("A1", "A3", "A5"));
  expect((await chercher({ ...aMarcory, tx: "location", duree: "mois", caution: "1" })).titres).toEqual(titres("A5"));
  expect((await chercher({ ...aMarcory, smin: 100 })).titres).toEqual(titres("A3", "A4", "A5"));
  expect((await chercher({ ...aMarcory, smax: 50 })).titres).toEqual(titres("A2"));
  // Meublé (une chambre d'hôtel l'est toujours), dans un immeuble, étage
  expect((await chercher({ ...aMarcory, meuble: true })).titres).toEqual(titres("A1", "A2", "A6"));
  expect((await chercher({ ...aMarcory, immeuble: true })).titres).toEqual(titres("A1", "A2", "A5"));
  expect((await chercher({ ...aMarcory, etage: "rdc" })).titres).toEqual(titres("A2"));
  expect((await chercher({ ...aMarcory, etage: "5+" })).titres).toEqual(titres("A5"));
  // Commodités ; avec photos, récentes (7 jours), vérifiées
  expect((await chercher({ ...aMarcory, com: ["Piscine"] })).titres).toEqual(titres("A1", "A3"));
  expect((await chercher({ ...aMarcory, com: ["Titre foncier (ACD)"] })).titres).toEqual(titres("A4"));
  expect((await chercher({ ...aMarcory, photos: true })).titres).toEqual(titres("A1"));
  expect((await chercher({ ...aMarcory, recentes: true })).titres).toEqual(titres("A1", "A2", "A4", "A5", "A6"));
  expect((await chercher({ ...aMarcory, verifiees: true })).titres).toEqual(titres("A1"));
  // Tri : Premium en tête puis les plus récentes ; prix (loyer ramené au mois) ; pages
  const recentes = await chercher(aMarcory);
  expect(recentes.annonces[0].titre).toBe(R5.A4.titre);
  expect(recentes.annonces.at(-1)!.titre).toBe(R5.A3.titre);
  const parPrix = async (tri: string) => (await chercher({ ...aMarcory, tx: "location", duree: "mois", tri })).annonces.map((a) => a.titre);
  expect(await parPrix("prix_asc")).toEqual([R5.A1.titre, R5.A5.titre]);
  expect(await parPrix("prix_desc")).toEqual([R5.A5.titre, R5.A1.titre]);
  const page2 = await chercher({ ...aMarcory, par_page: 4, page: 2 });
  expect(page2.total).toBe(6);
  expect(page2.annonces).toHaveLength(2);
  // Carte d'une annonce : photo principale et nombre de photos ; ni description ni contact
  const a1 = (await chercher({ ...aMarcory, photos: true })).annonces[0];
  expect(a1).toMatchObject({ photo: `${R5.A1.id}/facade.webp`, nb_photos: 2, commune: "Marcory", quartier: "Zone 4", type_nom: "Appartement" });
  expect(Object.keys(a1)).not.toContain("description");
  expect(JSON.stringify(a1)).not.toContain("07 48 32");
});

test("Fiche d'un bien : en ligne seulement, similaires, contact sur demande, numéros cachés aux visiteurs, vues", async () => {
  const fiche = async (numero: string) =>
    (await en(db, null, () => lignes<{ f: Record<string, unknown> | null }>("select public.annonce_publique($1) as f", [numero])))[0].f;
  const a1 = (await fiche(String(R5.A1.reference).toLowerCase()))!;
  expect(a1).toMatchObject({
    titre: R5.A1.titre, type_nom: "Appartement", ville: "Abidjan", commune: "Marcory", quartier: "Zone 4",
    photos: [`${R5.A1.id}/facade.webp`, `${R5.A1.id}/salon.webp`], sanitaires_nom: "Salles de bain", surface_nom: "Surface",
    contact_nom: "Awa K.", contact_whatsapp: true, // particulier : le nom discret de sa vitrine
  });
  expect(JSON.stringify(a1)).not.toContain("07 48 32");
  for (const cle of ["A8", "A9", "A10"]) expect(await fiche(String(R5[cle].reference))).toBeNull();

  // Numéros : jamais lisibles directement par un visiteur sans compte ; donnés sur demande pour une annonce en ligne
  for (const colonne of ["contact_telephone", "contact_nom"]) {
    await expect(en(db, null, () => lignes(`select ${colonne} from public.annonces where id = $1`, [R5.A1.id])))
      .rejects.toThrow(/permission denied/);
  }
  expect(await en(db, null, () => lignes("select titre from public.annonces where id = $1", [R5.A1.id]))).toEqual([{ titre: R5.A1.titre }]);
  const contact = async (cle: string) =>
    (await en(db, null, () => lignes<{ c: Record<string, unknown> | null }>("select public.contact_annonce($1) as c", [R5[cle].id])))[0].c;
  expect(await contact("A1")).toMatchObject({ nom: null, telephone: "+225 07 48 32 11 90", whatsapp: true, telephone2: null });
  expect(await contact("A8")).toBeNull();
  expect(await contact("A9")).toBeNull();
  // Un autre compte non plus ; l'auteur lit tout de ses annonces par mes_annonces (Mes annonces, modification)
  await expect(en(db, koffi, () => lignes("select contact_telephone from public.annonces where id = $1", [R5.A1.id])))
    .rejects.toThrow(/permission denied/);
  expect(await en(db, awa, () => lignes("select contact_telephone from public.mes_annonces() where id = $1", [R5.A1.id])))
    .toEqual([{ contact_telephone: "+225 07 48 32 11 90" }]);

  // Biens similaires : même transaction ; même type et même commune d'abord, puis le prix le plus proche
  // (les annonces des tests précédents comptent aussi : on ne regarde que celles de ce test)
  const similaires = async (nombre: number) => (await en(db, null, () =>
    lignes<{ s: Carte[] }>("select public.annonces_similaires($1, $2) as s", [R5.A1.id, nombre])))[0].s.map((a) => a.titre);
  expect((await similaires(12)).filter((t) => t.startsWith("R5 "))).toEqual([R5.A2.titre, R5.A5.titre, R5.A6.titre]);
  expect(await similaires(1)).toEqual([R5.A2.titre]);

  // Une vue de plus : compte, sans changer la date de modification ; rien sur une annonce expirée
  const etat = async (cle: string) =>
    (await lignes<{ vues: number; modifie_le: Date }>("select vues, modifie_le from public.annonces where id = $1", [R5[cle].id]))[0];
  const avant = await etat("A1");
  await en(db, null, () => db.query("select public.compter_vue($1)", [R5.A1.id]));
  const apres = await etat("A1");
  expect(apres.vues).toBe(avant.vues + 1);
  expect(apres.modifie_le).toEqual(avant.modifie_le);
  await en(db, null, () => db.query("select public.compter_vue($1)", [R5.A9.id]));
  expect((await etat("A9")).vues).toBe(0);

  // Accueil et plan du site
  const [{ c }] = await en(db, null, () => lignes<{ c: { total: number; par_ville: Record<string, number> } }>("select public.chiffres_annonces() as c"));
  expect(c.par_ville.Korhogo).toBe(1);
  expect(c.total).toBeGreaterThanOrEqual(7);
  const [{ p }] = await en(db, null, () => lignes<{ p: { reference: string }[] }>("select public.plan_du_site() as p"));
  expect(p.map((x) => x.reference)).toContain(R5.A1.reference);
  expect(p.map((x) => x.reference)).not.toContain(R5.A8.reference);
});

// ══ Vitrine de chaque annonceur ══
test("Vitrine : code propre à chaque compte, nom discret (« Awa K. ») ou nom de l'agence, filtre de la recherche", async () => {
  const code = async (compte: string) => (await lignes<{ c: string }>("select code_vitrine as c from public.profils where id = $1", [compte]))[0].c;
  const [cAwa, cKoffi] = [await code(awa), await code(koffi)];
  expect(cAwa).toMatch(/^[a-z0-9]{6}$/);
  expect(cAwa).not.toBe(cKoffi);
  // Le code ne se change pas soi-même
  await en(db, awa, () => db.query("update public.profils set code_vitrine = 'abcdef', prenom = 'Awa' where id = $1", [awa]));
  expect(await code(awa)).toBe(cAwa);

  // Les annonces en ligne disent qui les publie, sans révéler le compte
  const vue = async (id: string) => (await en(db, null, () => lignes<Record<string, unknown>>(
    "select annonceur, annonceur_nom, annonceur_agence from public.annonces_en_ligne where id = $1", [id])))[0];
  expect(await vue(String(R5.A1.id))).toEqual({ annonceur: cAwa, annonceur_nom: "Awa K.", annonceur_agence: false });

  // Recherche dans la vitrine : seulement les annonces de ce compte
  const koffiA = await en(db, koffi, async () => creerAnnonce(db, await annonceType(db, { titre: "R5 Annonce de Koffi à Riviera 2", statut: "en_attente" })));
  await db.query("update public.annonces set statut = 'publiee' where id = $1", [koffiA.id]);
  const deKoffi = await chercher({ annonceur: cKoffi });
  expect(deKoffi.annonces.map((a) => a.titre)).toEqual(["R5 Annonce de Koffi à Riviera 2"]);
  expect((await chercher({ annonceur: cAwa, ville: "Abidjan", commune: "Marcory" })).titres).toEqual(titres("A1", "A2", "A3", "A4", "A5", "A6"));

  // En-tête de la vitrine ; code inconnu : rien
  const vitrine = async (c: string) => (await en(db, null, () => lignes<{ v: Record<string, unknown> | null }>("select public.vitrine($1) as v", [c])))[0].v;
  expect(await vitrine(cKoffi.toUpperCase())).toMatchObject({ code: cKoffi, nom: "Koffi Y.", agence: false, total: 1 });
  expect(await vitrine("zzzzzz")).toBeNull();

  // Compte rattaché à une agence par 360-Immo.ci : le nom de l'agence
  const [ag] = await lignes<{ id: string }>(
    "insert into public.agences (nom, slug, verifiee) values ('Yao Immobilier', 'yao-immobilier', true) returning id");
  await db.query("update public.profils set role = 'agence', agence_id = $2 where id = $1", [koffi, ag.id]);
  expect(await vitrine(cKoffi)).toMatchObject({ nom: "Yao Immobilier", agence: true, verifiee: true });
  expect(await vue(String(koffiA.id))).toMatchObject({ annonceur_nom: "Yao Immobilier", annonceur_agence: true });
  // Les profils restent privés
  expect(await en(db, null, () => lignes("select * from public.profils"))).toEqual([]);
});

test("Nom du contact : discret pour un particulier (« Awa K. »), celui de l'annonce pour une agence, complet sur demande", async () => {
  const publier = async (champs: Record<string, unknown>) => {
    const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, { statut: "en_attente", ...champs })));
    await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
    return String(a.id);
  };
  const particulier = await publier({ titre: "R6 Studio d'Awa", contact_nom: "Awa Koné" });
  const agence = await publier({ titre: "R6 Villa de l'agence", type_vendeur: "agence", contact_nom: "Koné Immobilier" });
  const nom = async (id: string) => (await en(db, null, () => lignes<{ n: string | null }>(
    "select contact_nom as n from public.annonces_en_ligne where id = $1", [id])))[0].n;
  expect(await nom(particulier)).toBe("Awa K.");
  expect(await nom(agence)).toBe("Koné Immobilier");
  // Recherche et fiche : jamais le nom complet d'un particulier
  const cartes = (await chercher({})).annonces.filter((x) => x.titre.startsWith("R6 ")); // les plus récentes
  expect(cartes.map((x) => [x.titre, x.contact_nom])).toEqual([
    ["R6 Villa de l'agence", "Koné Immobilier"], ["R6 Studio d'Awa", "Awa K."],
  ]);
  const [{ f }] = await en(db, null, () => lignes<{ f: Record<string, unknown> }>(
    "select public.annonce_publique((select reference from public.annonces where id = $1)) as f", [particulier]));
  expect(f.contact_nom).toBe("Awa K.");
  expect(JSON.stringify(f)).not.toContain("Koné");
  // « Afficher le numéro » : le nom complet avec les numéros
  const [{ c }] = await en(db, null, () => lignes<{ c: Record<string, unknown> }>("select public.contact_annonce($1) as c", [particulier]));
  expect(c).toMatchObject({ nom: "Awa Koné", telephone: expect.any(String) });
});

test("Coordonnées d'une annonce : réservées à son auteur, même pour un compte connecté ; le reste reste lisible", async () => {
  const a = await en(db, awa, async () => creerAnnonce(db, await annonceType(db, {
    titre: "R7 Appartement d'Awa", statut: "en_attente", contact_nom: "Awa Koné", contact_email: "awa@exemple.ci",
    contact_telephone2: "+225 27 22 44 55 66", latitude: 5.36, longitude: -3.98,
  })));
  await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
  // Un autre compte : ce que montre la page publique, mais ni nom complet, ni numéros, ni e-mail, ni position exacte
  expect(await en(db, koffi, () => lignes("select titre, prix, type_vendeur from public.annonces where id = $1", [a.id])))
    .toEqual([{ titre: "R7 Appartement d'Awa", prix: 150000, type_vendeur: "particulier" }]);
  for (const colonne of ["contact_nom", "contact_telephone", "contact_telephone2", "contact_email", "latitude", "longitude", "*"]) {
    await expect(en(db, koffi, () => lignes(`select ${colonne} from public.annonces where id = $1`, [a.id])), colonne)
      .rejects.toThrow(/permission denied/);
  }
  // mes_annonces : seulement les siennes, complètes
  expect(await en(db, koffi, () => lignes("select id from public.mes_annonces() where id = $1", [a.id]))).toEqual([]);
  expect(await en(db, awa, () => lignes("select contact_nom, contact_email, latitude from public.mes_annonces() where id = $1", [a.id])))
    .toEqual([{ contact_nom: "Awa Koné", contact_email: "awa@exemple.ci", latitude: 5.36 }]);
  await expect(en(db, null, () => lignes("select id from public.mes_annonces()"))).rejects.toThrow(/permission denied/);
  // L'auteur modifie toujours ses coordonnées ; un autre compte ne touche à rien
  await en(db, awa, () => db.query("update public.annonces set contact_email = 'contact@awa.ci' where id = $1", [a.id]));
  expect((await lignes<{ e: string }>("select contact_email as e from public.annonces where id = $1", [a.id]))[0].e).toBe("contact@awa.ci");
  expect(await en(db, koffi, async () => (await db.query("update public.annonces set contact_email = 'x@y.ci' where id = $1", [a.id])).affectedRows)).toBe(0);
  // « Afficher le numéro » : le nom complet et les numéros d'une annonce en ligne, pour tout le monde
  const [{ c }] = await en(db, koffi, () => lignes<{ c: Record<string, unknown> }>("select public.contact_annonce($1) as c", [a.id]));
  expect(c).toMatchObject({ nom: "Awa Koné", telephone: "+225 07 48 32 11 90", telephone2: "+225 27 22 44 55 66", email: "contact@awa.ci" });
});

// ══ Étape 6 : favoris et messages ══

test("Favoris : cartes des annonces demandées, dans l'ordre ; annonce expirée avec son titre ; brouillon jamais", async () => {
  const cartes = async (ids: unknown[]) => (await en(db, null, () => lignes<{ c: Record<string, unknown>[] }>(
    "select public.cartes_annonces($1::uuid[]) as c", [ids])))[0].c;
  const c = await cartes([R5.A3.id, R5.A9.id, R5.A8.id, R5.A1.id, "00000000-0000-4000-8000-00000000dead"]);
  expect(c.map((x) => [x.titre, x.en_ligne])).toEqual([
    [R5.A3.titre, true], [R5.A9.titre, false], [R5.A1.titre, true],
  ]);
  expect(c[0]).toMatchObject({ prix: 250000000, commune: "Marcory", type_nom: "Villa" });
  expect(Object.keys(c[1]).sort()).toEqual(["en_ligne", "id", "reference", "titre"]);
  expect(JSON.stringify(c)).not.toContain("07 48 32");
  expect(await cartes([])).toEqual([]);
});

test("Messages : écrire à l'annonceur, conversations (nom discret, non lus), lecture, limite contre le démarchage", async () => {
  const jean = await inscrire(db, { prenom: "Jean", nom: "Kouassi" });
  const ecrire = (compte: string, annonce: unknown, texte: string) =>
    en(db, compte, async () => (await lignes<{ c: string }>("select public.ecrire_annonceur($1, $2) as c", [annonce, texte]))[0].c);
  const conversations = (compte: string) =>
    en(db, compte, async () => (await lignes<{ l: Record<string, unknown>[] }>("select public.mes_conversations() as l"))[0].l);
  const nonLus = (compte: string) =>
    en(db, compte, async () => (await lignes<{ n: number }>("select public.messages_non_lus() as n"))[0].n);

  // Premier message : la conversation s'ouvre ; le deuxième va dans la même
  const c1 = await ecrire(jean, R5.A1.id, "Bonjour, l'appartement est-il toujours disponible ?");
  expect(await ecrire(jean, R5.A1.id, "Je peux visiter samedi.")).toBe(c1);
  // Côté annonceuse (Awa) : le client sous un nom discret, 2 non lus
  const [chezAwa] = (await conversations(awa)).filter((x) => x.id === c1);
  expect(chezAwa).toMatchObject({
    role: "annonceur", autre: "Jean K.", non_lus: 2,
    annonce: { id: R5.A1.id, titre: R5.A1.titre, photo: `${R5.A1.id}/facade.webp`, en_ligne: true },
    dernier: { contenu: "Je peux visiter samedi.", de_moi: false },
  });
  expect(await nonLus(awa)).toBeGreaterThanOrEqual(2);
  const avant = await nonLus(awa);
  // Awa lit : plus de non lus dans cette conversation ; elle répond
  expect(await en(db, awa, async () => (await lignes<{ n: number }>("select public.marquer_lus($1) as n", [c1]))[0].n)).toBe(2);
  expect(await nonLus(awa)).toBe(avant - 2);
  await en(db, awa, () => db.query("insert into public.messages (conversation_id, contenu) values ($1, 'Oui, samedi 10 h ?')", [c1]));
  // Côté client (Jean) : l'annonceuse sous son nom de vitrine, 1 non lu
  expect(await conversations(jean)).toEqual([expect.objectContaining({
    id: c1, role: "client", autre: "Awa K.", non_lus: 1, dernier: expect.objectContaining({ contenu: "Oui, samedi 10 h ?", de_moi: false }),
  })]);
  expect(await nonLus(jean)).toBe(1);
  // Un troisième compte ne voit ni la conversation ni les messages, et ne peut pas les marquer lus
  expect(await conversations(koffi)).not.toContainEqual(expect.objectContaining({ id: c1 }));
  expect(await en(db, koffi, async () => (await lignes<{ n: number }>("select public.marquer_lus($1) as n", [c1]))[0].n)).toBe(0);
  expect(await nonLus(jean)).toBe(1);

  // Refus : sa propre annonce, une annonce plus en ligne, un message vide, sans compte
  await expect(ecrire(awa, R5.A1.id, "Moi-même")).rejects.toThrow(/C'est votre annonce/);
  await expect(ecrire(jean, R5.A9.id, "Encore là ?")).rejects.toThrow(/n'est plus en ligne/);
  await expect(ecrire(jean, R5.A8.id, "Brouillon ?")).rejects.toThrow(/n'est plus en ligne/);
  await expect(ecrire(jean, R5.A2.id, "   ")).rejects.toThrow(/messages_contenu_check/);
  await expect(en(db, null, () => lignes("select public.ecrire_annonceur($1, 'Bonjour')", [R5.A2.id]))).rejects.toThrow(/permission denied/);
  await expect(en(db, null, () => lignes("select public.mes_conversations()"))).rejects.toThrow(/permission denied/);

  // Démarchage : 20 nouvelles conversations par jour au plus
  const demarcheur = await inscrire(db, { prenom: "Marc", nom: "Démarcheur" });
  const annonces = await en(db, awa, async () => {
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) ids.push(String((await creerAnnonce(db, await annonceType(db, { titre: `R6 Démarchage ${i}`, statut: "en_attente" }))).id));
    return ids;
  });
  await db.query("update public.annonces set statut = 'publiee' where id = any($1::uuid[])", [annonces]);
  for (const a of annonces.slice(0, 20)) await ecrire(demarcheur, a, "Vendez-vous ?");
  await expect(ecrire(demarcheur, annonces[20], "Vendez-vous ?")).rejects.toThrow(/beaucoup d'annonceurs aujourd'hui/);
  // … mais on peut toujours répondre dans une conversation déjà ouverte
  await ecrire(demarcheur, annonces[0], "Merci de votre réponse.");
});

test("Visites : demande sans compte, contrôles, réponses de l'annonceur, accord du demandeur, compteurs", async () => {
  const jean = await inscrire(db, { prenom: "Jean", nom: "Kouassi" });
  const demain = (heures: number) => `now() + interval '1 day' + interval '${heures} hours'`;
  const demander = (compte: string | null, annonce: unknown, telephone: string, quand = demain(2), email: string | null = null) =>
    en(db, compte, () => db.query(
      `insert into public.visites (annonce_id, nom, telephone, email, message, creneau) values ($1, ' Mariam Traoré ', $2, $3, 'Après 17 h si possible', ${quand})`,
      [annonce, telephone, email]));
  const visites = (compte: string) =>
    en(db, compte, async () => (await lignes<{ l: Record<string, unknown>[] }>("select public.mes_visites() as l"))[0].l);
  const repondre = (compte: string, visite: unknown, action: string, creneau: string | null = null, reponse: string | null = null) =>
    en(db, compte, () => db.query("select public.repondre_visite($1, $2, $3::timestamptz, $4)", [visite, action, creneau, reponse]));
  const compteurs = (compte: string) =>
    en(db, compte, async () => (await lignes<{ c: { messages: number; visites: number } }>("select public.compteurs() as c"))[0].c);

  // Sans compte : demande enregistrée ; l'annonceuse (Awa) la voit avec les coordonnées, à traiter
  await demander(null, R5.A2.id, "+225 05 44 33 22 11", demain(2), "mariam@exemple.ci");
  const avant = (await compteurs(awa)).visites;
  const recue = (await visites(awa)).find((v) => (v.annonce as { id: string }).id === R5.A2.id)!;
  expect(recue).toMatchObject({
    role: "annonceur", nom: "Mariam Traoré", telephone: "+225 05 44 33 22 11", email: "mariam@exemple.ci",
    message: "Après 17 h si possible", statut: "demandee", creneau_propose: null, avec_compte: false,
    annonce: { titre: R5.A2.titre, en_ligne: true },
  });
  expect(avant).toBeGreaterThanOrEqual(1);
  // Personne d'autre ne la voit ; sans compte, on ne relit pas les demandes
  expect(await visites(koffi)).toEqual([]);
  expect(await en(db, null, () => lignes("select * from public.visites"))).toEqual([]);

  // Contrôles : même numéro, même bien ; créneau passé ; annonce plus en ligne ; numéro mal écrit ; sa propre annonce
  await expect(demander(null, R5.A2.id, "+225 05 44 33 22 11", demain(5))).rejects.toThrow(/déjà une demande de visite en cours/);
  await expect(demander(null, R5.A3.id, "+225 05 44 33 22 12", "now() - interval '1 day'")).rejects.toThrow(/créneau à venir/);
  await expect(demander(null, R5.A9.id, "+225 05 44 33 22 13")).rejects.toThrow(/n'est plus en ligne/);
  await expect(demander(null, R5.A3.id, "0544332211")).rejects.toThrow(/visites_telephone_format/);
  await expect(demander(awa, R5.A3.id, "+225 07 48 32 11 90")).rejects.toThrow(/C'est votre annonce/);
  // 5 demandes par jour et par numéro au plus
  for (const cle of ["A1", "A3", "A4", "A5"]) await demander(null, R5[cle].id, "+225 01 01 01 01 01");
  await demander(null, R5.A6.id, "+225 01 01 01 01 01");
  await expect(demander(null, R5.A7.id, "+225 01 01 01 01 01")).rejects.toThrow(/beaucoup de visites aujourd'hui/);

  // Annonceuse : propose un autre créneau à un demandeur avec compte (Jean), qui l'accepte
  await demander(jean, R5.A7.id, "+225 05 11 22 33 44");
  const deJean = (await visites(awa)).find((v) => (v.annonce as { id: string }).id === R5.A7.id && v.avec_compte)!;
  await repondre(awa, deJean.id, "proposer", new Date(Date.now() + 3 * 86_400_000).toISOString(), "Plutôt mercredi matin ?");
  expect((await compteurs(jean)).visites).toBe(1);   // un créneau proposé attend son accord
  const chezJean = (await visites(jean)).find((v) => v.id === deJean.id)!;
  expect(chezJean).toMatchObject({ role: "demandeur", annonceur: "Awa K.", reponse: "Plutôt mercredi matin ?", nom: null, telephone: null });
  expect(chezJean.creneau_propose).not.toBeNull();
  await expect(repondre(jean, deJean.id, "confirmer")).rejects.toThrow(/n'est plus possible/);   // pas son rôle
  await repondre(jean, deJean.id, "accepter");
  const acceptee = (await visites(jean)).find((v) => v.id === deJean.id)!;
  expect(acceptee).toMatchObject({ statut: "confirmee", creneau_propose: null });
  expect(acceptee.creneau).toBe(chezJean.creneau_propose);
  expect((await compteurs(jean)).visites).toBe(0);
  // Créneau confirmé : grisé pour les visiteurs (sans rien sur les personnes)
  const [{ p }] = await en(db, null, () => lignes<{ p: string[] }>("select public.creneaux_pris($1) as p", [R5.A7.id]));
  expect(p).toEqual([acceptee.creneau]);

  // Confirmer, refuser, annuler ; un autre compte ne touche à rien ; plus de modification directe
  await repondre(awa, recue.id, "confirmer", null, "À demain !");
  expect((await visites(awa)).find((v) => v.id === recue.id)).toMatchObject({ statut: "confirmee", reponse: "À demain !" });
  await expect(repondre(koffi, recue.id, "annuler")).rejects.toThrow(/non autorisée/);
  await expect(en(db, awa, () => db.query("update public.visites set statut = 'demandee' where id = $1", [recue.id]))).rejects.toThrow(/permission denied/);
  await repondre(jean, deJean.id, "annuler");
  expect((await visites(awa)).find((v) => v.id === deJean.id)).toMatchObject({ statut: "annulee", annulee_par: "demandeur" });
  const autre = (await visites(awa)).find((v) => v.statut === "demandee")!;
  await repondre(awa, autre.id, "refuser", null, "Déjà loué, désolée.");
  expect((await visites(awa)).find((v) => v.id === autre.id)).toMatchObject({ statut: "annulee", annulee_par: "annonceur" });
  await expect(repondre(awa, autre.id, "confirmer")).rejects.toThrow(/n'est plus possible/);
  expect((await compteurs(awa)).visites).toBe(avant - 1 + 4);  // reçues sans réponse : celles des 5 demandes moins la refusée
});


test("Alertes et e-mails : file des e-mails (messages, visites), alertes, rappels de fin, envoi réservé à la clé secrète", async () => {
  type Notification = { id: string; modele: string; profil_id: string | null; email: string | null; statut: string; donnees: Record<string, unknown> };
  const file = () => lignes<Notification>("select id, modele, profil_id, email, statut, donnees from public.notifications order by cree_le, id");
  const service = async <T>(sql: string, params: unknown[] = []) => {
    await db.exec("set role service_role");
    try {
      return await lignes<T>(sql, params);
    } finally {
      await db.exec("reset role");
    }
  };
  await db.query("delete from public.notifications");
  const ama = await inscrire(db, { prenom: "Ama", nom: "Bamba" });

  // Personne d'autre que le programme d'envoi (clé secrète) ne lit la file ni ne l'utilise
  for (const compte of [null, ama]) {
    await expect(en(db, compte, () => lignes("select * from public.notifications"))).rejects.toThrow(/permission denied/);
    await expect(en(db, compte, () => lignes("select public.notifications_a_envoyer(10)"))).rejects.toThrow(/permission denied/);
    await expect(en(db, compte, () => lignes("select public.preparer_alertes()"))).rejects.toThrow(/permission denied/);
  }

  // Messages : un e-mail au destinataire, un par conversation et par heure au plus ; pas s'il n'en veut pas
  const ecrire = (compte: string, annonce: unknown, texte: string) =>
    en(db, compte, () => lignes<{ c: string }>("select public.ecrire_annonceur($1, $2) as c", [annonce, texte]));
  const [{ c: conversation }] = await ecrire(ama, R5.A1.id, "Bonjour, l'appartement est-il libre ?");
  await ecrire(ama, R5.A1.id, "Je peux visiter demain.");
  let n = await file();
  expect(n).toHaveLength(1);
  expect(n[0]).toMatchObject({ modele: "message", profil_id: awa, statut: "a_envoyer", donnees: {
    conversation, de: "Ama B.", pour: "annonceur", extrait: "Bonjour, l'appartement est-il libre ?",
    annonce: { titre: R5.A1.titre, reference: R5.A1.reference } } });
  await en(db, awa, () => db.query("update public.profils set emails_messages = false where id = $1", [awa]));
  await ecrire(ama, R5.A3.id, "La villa est-elle toujours à vendre ?");
  expect(await file()).toHaveLength(1);
  await en(db, awa, () => db.query("update public.profils set emails_messages = true where id = $1", [awa]));

  // Visites : demande sans compte → l'annonceuse ; sa confirmation → l'adresse laissée par le visiteur
  const demain = "now() + interval '1 day' + interval '3 hours'";
  await en(db, null, () => db.query(
    `insert into public.visites (annonce_id, nom, telephone, email, creneau) values ($1, 'Paul Kra', '+225 02 02 02 02 02', 'paul@exemple.ci', ${demain})`,
    [R5.A4.id]));
  const [{ id: visitePaul }] = await lignes<{ id: string }>("select id from public.visites where telephone = '+225 02 02 02 02 02'");
  await en(db, awa, () => db.query("select public.repondre_visite($1, 'confirmer', null, 'À demain')", [visitePaul]));
  // Avec un compte : créneau proposé à Ama, qui l'accepte → l'annonceuse est prévenue
  await en(db, ama, () => db.query(
    `insert into public.visites (annonce_id, nom, telephone, creneau) values ($1, 'Ama Bamba', '+225 03 03 03 03 03', ${demain})`, [R5.A5.id]));
  const [{ id: visiteAma }] = await lignes<{ id: string }>("select id from public.visites where telephone = '+225 03 03 03 03 03'");
  const apresDemain = new Date(Date.now() + 2 * 86_400_000).toISOString();
  await en(db, awa, () => db.query("select public.repondre_visite($1, 'proposer', $2::timestamptz)", [visiteAma, apresDemain]));
  await en(db, ama, () => db.query("select public.repondre_visite($1, 'accepter')", [visiteAma]));
  n = (await file()).filter((x) => x.modele === "visite");
  expect(n.map((x) => [x.donnees.evenement, x.donnees.pour, x.profil_id ?? x.email])).toEqual([
    ["demandee", "annonceur", awa], ["confirmee", "demandeur", "paul@exemple.ci"],
    ["demandee", "annonceur", awa], ["proposee", "demandeur", ama], ["acceptee", "annonceur", awa],
  ]);
  expect(n[0].donnees).toMatchObject({ nom: "Paul Kra", telephone: "+225 02 02 02 02 02", avec_compte: false, annonce: { titre: R5.A4.titre } });
  expect(n[1].donnees).toMatchObject({ annonceur: "Awa K.", nom: "Paul Kra", reponse: "À demain" });
  expect(n[1].donnees).not.toHaveProperty("telephone");

  // Envoi (clé secrète) : adresse et prénom du destinataire ; un message lu entre-temps n'est plus envoyé
  await en(db, awa, () => db.query("select public.marquer_lus($1)", [conversation]));
  const [{ l: aEnvoyer }] = await service<{ l: { id: string; modele: string; email: string; prenom: string | null; donnees: Record<string, unknown> }[] }>(
    "select public.notifications_a_envoyer(50) as l");
  expect(aEnvoyer.map((x) => x.modele)).toEqual(["visite", "visite", "visite", "visite", "visite"]);
  expect(aEnvoyer[0]).toMatchObject({ prenom: "Awa", email: expect.stringMatching(/@exemple\.ci$/) });
  expect(aEnvoyer[1]).toMatchObject({ email: "paul@exemple.ci", prenom: null });
  expect((await file()).find((x) => x.modele === "message")!.statut).toBe("inutile");
  // Déjà pris : pas redonnés à un second envoi simultané
  expect((await service<{ l: unknown[] }>("select public.notifications_a_envoyer(50) as l"))[0].l).toEqual([]);
  await service("select public.notification_envoyee($1)", [aEnvoyer[0].id]);
  await service("select public.notification_envoyee($1, 'Brevo : 503')", [aEnvoyer[1].id]);
  const apres = await lignes<{ id: string; statut: string; essais: number; erreur: string | null; envoyee_le: string | null }>(
    "select id, statut, essais, erreur, envoyee_le from public.notifications where id = any($1)", [[aEnvoyer[0].id, aEnvoyer[1].id]]);
  expect(apres.find((x) => x.id === aEnvoyer[0].id)).toMatchObject({ statut: "envoyee", erreur: null });
  expect(apres.find((x) => x.id === aEnvoyer[1].id)).toMatchObject({ statut: "a_envoyer", essais: 1, erreur: "Brevo : 503", envoyee_le: null });
  expect((await service<{ l: { id: string }[] }>("select public.notifications_a_envoyer(50) as l"))[0].l.map((x) => x.id)).toEqual([aEnvoyer[1].id]);

  // Alertes : créées par le compte (jeton et dates fixés par la base), pas deux fois la même, 10 au plus
  const treichville = { tx: "location", types: ["appartement"], ville: "Abidjan", commune: "Treichville" };
  const creer = (adresse: string, criteres: Record<string, unknown>, frequence = "quotidienne") =>
    en(db, ama, () => db.query(
      "insert into public.alertes (nom, adresse, criteres, frequence, verifiee_le) values ('  Appartements à louer à Treichville ', $1, $2, $3, '2000-01-01')",
      [adresse, JSON.stringify(criteres), frequence]));
  await creer("/annonces?tx=location&duree=mois&type=appartement&q=Treichville", treichville);
  const [alerte] = await en(db, ama, () => lignes<{ id: string; nom: string; jeton: string; verifiee_le: string }>("select * from public.alertes"));
  expect(alerte.nom).toBe("Appartements à louer à Treichville");
  expect(new Date(alerte.verifiee_le).getTime()).toBeGreaterThan(Date.now() - 60_000);
  await expect(creer("/annonces?tx=location&duree=mois&type=appartement&q=Treichville", treichville)).rejects.toThrow(/alertes_une_fois/);
  await expect(creer("/ailleurs", treichville)).rejects.toThrow(/alertes_adresse_format/);
  await creer("/annonces?tx=achat&q=Treichville", { tx: "achat", ville: "Abidjan", commune: "Treichville" }, "hebdomadaire");
  await creer("/annonces?tx=location&min=abc", { tx: "location", min: "abc" });   // recherche illisible : ne bloque rien
  for (let i = 0; i < 7; i++) await creer(`/annonces?q=Zone${i}`, { texte: `Zone${i}` });
  await expect(creer("/annonces?q=Zone99", { texte: "Zone99" })).rejects.toThrow(/déjà 10 alertes/);
  // Le compte ne change pas ses dates ; réactivée : nouvelles annonces à partir de maintenant
  await en(db, ama, () => db.query("update public.alertes set verifiee_le = '2000-01-01', jeton = gen_random_uuid() where id = $1", [alerte.id]));
  expect((await lignes<{ jeton: string }>("select jeton from public.alertes where id = $1", [alerte.id]))[0].jeton).toBe(alerte.jeton);

  // Chaque matin : seulement les alertes dont c'est le moment, avec les annonces publiées depuis
  expect((await service<{ n: number }>("select public.preparer_alertes() as n"))[0].n).toBe(0);
  await db.query("update public.alertes set verifiee_le = now() - interval '21 hours' where profil_id = $1", [ama]);
  const t = await lieu(db, "Abidjan", "Treichville");
  for (const [titre, transaction] of [["Appartement neuf à Treichville", "location"], ["Villa à vendre à Treichville", "vente"]] as const) {
    const base = await annonceType(db, { ...t, quartier_id: null, titre, transaction, type_bien: transaction === "vente" ? "villa" : "appartement",
      loyer_par: transaction === "vente" ? null : "mois", caution_mois: transaction === "vente" ? null : 2, etage: transaction === "vente" ? null : 2 });
    const a = await en(db, awa, () => creerAnnonce(db, { ...base, statut: "en_attente" }));
    await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
  }
  expect((await service<{ n: number }>("select public.preparer_alertes() as n"))[0].n).toBe(1);   // l'hebdomadaire attend
  const alertes = (await file()).filter((x) => x.modele === "alerte");
  expect(alertes).toHaveLength(1);
  expect(alertes[0]).toMatchObject({ profil_id: ama, donnees: { total: 1, alerte: { nom: "Appartements à louer à Treichville", jeton: alerte.jeton } } });
  expect((alertes[0].donnees.annonces as { titre: string }[]).map((x) => x.titre)).toEqual(["Appartement neuf à Treichville"]);
  expect((await service<{ n: number }>("select public.preparer_alertes() as n"))[0].n).toBe(0);   // déjà passé aujourd'hui
  await db.query("update public.alertes set verifiee_le = now() - interval '7 days' where profil_id = $1 and frequence = 'hebdomadaire'", [ama]);
  expect((await service<{ n: number }>("select public.preparer_alertes() as n"))[0].n).toBe(1);   // la villa, pour l'hebdomadaire

  // Lien « Arrêter cette alerte » : sans connexion, avec le jeton seulement
  expect((await en(db, null, () => lignes<{ a: unknown }>("select public.alerte_par_jeton($1) as a", [alerte.jeton])))[0].a)
    .toMatchObject({ nom: "Appartements à louer à Treichville", active: true });
  expect((await en(db, null, () => lignes<{ ok: boolean }>("select public.arreter_alerte($1) as ok", [alerte.jeton])))[0].ok).toBe(true);
  expect((await en(db, null, () => lignes<{ ok: boolean }>("select public.arreter_alerte(gen_random_uuid()) as ok")))[0].ok).toBe(false);
  expect((await lignes<{ active: boolean }>("select active from public.alertes where id = $1", [alerte.id]))[0].active).toBe(false);
  await en(db, ama, () => db.query("update public.alertes set active = true where id = $1", [alerte.id]));
  expect(new Date((await lignes<{ v: string }>("select verifiee_le as v from public.alertes where id = $1", [alerte.id]))[0].v).getTime())
    .toBeGreaterThan(Date.now() - 60_000);

  // Rappels : annonces qui expirent dans les 3 jours, une fois par date de fin ; pas si l'annonceur n'en veut pas
  await db.query("update public.annonces set expire_le = now() + interval '2 days' where id = $1", [R5.A1.id]);
  expect((await service<{ n: number }>("select public.preparer_rappels() as n"))[0].n).toBe(1);
  expect((await service<{ n: number }>("select public.preparer_rappels() as n"))[0].n).toBe(0);
  expect((await file()).find((x) => x.modele === "fin_annonce")).toMatchObject({ profil_id: awa, donnees: { annonce: { titre: R5.A1.titre } } });
  await db.query("update public.profils set emails_annonces = false where id = $1", [awa]);
  await db.query("update public.annonces set expire_le = now() + interval '1 day' where id = $1", [R5.A4.id]);
  expect((await service<{ n: number }>("select public.preparer_rappels() as n"))[0].n).toBe(0);
});

test("Être rappelé : demande sans compte, contrôles, rappel fait par l'annonceur, annulation, compteurs, e-mail", async () => {
  const fanta = await inscrire(db, { prenom: "Fanta", nom: "Diaby" });
  const demander = (compte: string | null, annonce: unknown, telephone: string, champs: Record<string, unknown> = {}) =>
    en(db, compte, () => db.query(
      "insert into public.rappels (annonce_id, nom, telephone, moment, message, demandeur_id) values ($1, $2, $3, $4, $5, $6)",
      [annonce, champs.nom ?? " Paul Kra ", telephone, champs.moment ?? "matin", "message" in champs ? champs.message : " Après 18 h ",
        champs.demandeur_id ?? compte]));
  const rappels = (compte: string) =>
    en(db, compte, async () => (await lignes<{ l: Record<string, unknown>[] }>("select public.mes_rappels() as l"))[0].l);
  const traiter = (compte: string | null, rappel: unknown, action: string) =>
    en(db, compte, () => db.query("select public.traiter_rappel($1, $2)", [rappel, action]));
  const aFaire = async (compte: string) =>
    (await en(db, compte, async () => (await lignes<{ c: { rappels: number } }>("select public.compteurs() as c"))[0].c)).rappels;
  await db.query("delete from public.notifications");

  // Sans compte : enregistrée ; l'annonceuse la voit avec le numéro ; un visiteur ne relit rien
  const avant = await aFaire(awa);
  await demander(null, R5.A2.id, "+225 04 04 04 04 04");
  const recue = (await rappels(awa)).find((r) => r.telephone === "+225 04 04 04 04 04")!;
  expect(recue).toMatchObject({
    role: "annonceur", nom: "Paul Kra", moment: "matin", message: "Après 18 h", statut: "a_rappeler", avec_compte: false,
    annonce: { titre: R5.A2.titre, en_ligne: true }, annonceur: null,
  });
  expect(await aFaire(awa)).toBe(avant + 1);
  expect(await en(db, null, () => lignes("select * from public.rappels"))).toEqual([]);
  expect(await rappels(koffi)).toEqual([]);
  // E-mail à l'annonceuse
  const [n] = await lignes<{ modele: string; profil_id: string; donnees: Record<string, unknown> }>("select modele, profil_id, donnees from public.notifications");
  expect(n).toMatchObject({ modele: "rappel", profil_id: awa, donnees: { nom: "Paul Kra", telephone: "+225 04 04 04 04 04", moment: "matin", annonce: { titre: R5.A2.titre } } });

  // Contrôles : déjà en attente, sa propre annonce, plus en ligne, numéro mal écrit, moment inconnu, au nom d'un autre
  await expect(demander(null, R5.A2.id, "+225 04 04 04 04 04")).rejects.toThrow(/déjà demandé à être rappelé pour ce bien/);
  await expect(demander(awa, R5.A3.id, "+225 07 48 32 11 90")).rejects.toThrow(/C'est votre annonce/);
  await expect(demander(null, R5.A9.id, "+225 04 04 04 04 05")).rejects.toThrow(/n'est plus en ligne/);
  await expect(demander(null, R5.A3.id, "0404040405")).rejects.toThrow(/rappels_telephone_format/);
  await expect(demander(null, R5.A3.id, "+225 04 04 04 04 05", { moment: "minuit" })).rejects.toThrow(/rappels_moment_check/);
  await expect(demander(fanta, R5.A3.id, "+225 05 05 05 05 06", { demandeur_id: koffi })).rejects.toThrow(/row-level security/);
  // 5 demandes par jour et par numéro au plus
  for (const cle of ["A1", "A3", "A4", "A5", "A6"]) await demander(null, R5[cle].id, "+225 06 06 06 06 06");
  await expect(demander(null, R5.A7.id, "+225 06 06 06 06 06")).rejects.toThrow(/beaucoup de rappels aujourd'hui/);

  // Avec un compte : la demandeuse suit sa demande (l'annonceuse sous son nom discret, sans numéro) et peut l'annuler
  await demander(fanta, R5.A3.id, "+225 05 05 05 05 06", { nom: "Fanta Diaby", moment: "vite", message: null });
  const deFanta = (await rappels(fanta))[0];
  expect(deFanta).toMatchObject({ role: "demandeur", annonceur: "Awa K.", telephone: null, statut: "a_rappeler", avec_compte: true, message: null });
  await expect(traiter(fanta, deFanta.id, "fait")).rejects.toThrow(/n'est plus possible/);   // pas son rôle
  await expect(traiter(koffi, deFanta.id, "annuler")).rejects.toThrow(/non autorisée/);
  await expect(traiter(null, recue.id, "annuler")).rejects.toThrow(/permission denied|non autorisée/);
  await traiter(fanta, deFanta.id, "annuler");
  expect((await rappels(awa)).find((r) => r.id === deFanta.id)).toMatchObject({ statut: "annule" });

  // L'annonceuse : rappelé, puis de nouveau à rappeler ; pas de modification directe
  const enAttente = await aFaire(awa);
  await traiter(awa, recue.id, "fait");
  expect((await rappels(awa)).find((r) => r.id === recue.id)).toMatchObject({ statut: "rappele" });
  expect((await rappels(awa)).find((r) => r.id === recue.id)!.traite_le).not.toBeNull();
  expect(await aFaire(awa)).toBe(enAttente - 1);
  await expect(traiter(awa, recue.id, "fait")).rejects.toThrow(/n'est plus possible/);
  await traiter(awa, recue.id, "a_faire");
  expect(await aFaire(awa)).toBe(enAttente);
  await expect(en(db, awa, () => db.query("update public.rappels set statut = 'rappele' where id = $1", [recue.id]))).rejects.toThrow(/permission denied/);

  // Pas d'e-mail si l'annonceuse n'en veut pas
  await db.query("delete from public.notifications");
  await db.query("update public.profils set emails_visites = false where id = $1", [awa]);
  await demander(null, R5.A4.id, "+225 08 08 08 08 08");
  expect(await lignes("select * from public.notifications")).toEqual([]);
  await db.query("update public.profils set emails_visites = true where id = $1", [awa]);
});

test("Alertes v2 : essentiels bloquants (budget plafond, pièces au moins, surface, ACD), souhaits non bloquants et classement", async () => {
  const koumassi = await lieu(db, "Abidjan", "Koumassi");
  const publier = async (titre: string, champs: Record<string, unknown>) => {
    const base = await annonceType(db, { ...koumassi, quartier_id: null, titre, ...champs });
    const a = await en(db, awa, () => creerAnnonce(db, { ...base, statut: "en_attente" }));
    await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
    return String(a.id);
  };
  const villa = { type_bien: "villa", etage: null, dans_immeuble: false };
  const terrain = { type_bien: "terrain", transaction: "vente", loyer_par: null, caution_mois: null, pieces: null, chambres: null,
    sanitaires: null, meuble: false, etage: null, dans_immeuble: false };
  const k1 = await publier("Koumassi 3 pièces 120 000", { pieces: 3, chambres: 2, prix: 120000, meuble: false, commodites: ["Parking"] });
  const k2 = await publier("Koumassi 4 pièces 140 000", { pieces: 4, chambres: 3, prix: 140000, meuble: true, commodites: ["Parking", "Piscine"] });
  const k3 = await publier("Koumassi 2 pièces 100 000", { pieces: 2, chambres: 1, prix: 100000 });
  const k4 = await publier("Koumassi 3 pièces 160 000", { pieces: 3, chambres: 2, prix: 160000 });
  const k5 = await publier("Koumassi villa 3 pièces 120 000", { ...villa, pieces: 3, chambres: 2, prix: 120000 });
  const t1 = await publier("Koumassi terrain 500 m² ACD", { ...terrain, prix: 30000000, surface: 500, commodites: ["Titre foncier (ACD)", "Viabilisé (eau, électricité)"] });
  const t2 = await publier("Koumassi terrain 500 m² sans ACD", { ...terrain, prix: 30000000, surface: 500, commodites: ["Viabilisé (eau, électricité)"] });
  const t3 = await publier("Koumassi terrain 300 m² ACD", { ...terrain, prix: 20000000, surface: 300, commodites: ["Titre foncier (ACD)"] });

  const appart = {
    v: 2, tx: "location", duree: "mois", types: ["appartement"], ville: "Abidjan", commune: "Koumassi", max: 150000, pieces_min: 3,
    souhaits: { meuble: true, chambres: 3, com: ["Parking", "Piscine"] },
  };
  const correspond = async (id: string, c: unknown) =>
    (await lignes<{ ok: boolean }>("select public.alerte_correspond(v, $2) as ok from public.annonces_en_ligne v where v.id = $1", [id, JSON.stringify(c)]))[0].ok;
  const souhaits = async (id: string, c: unknown) =>
    (await lignes<{ s: unknown }>("select public.alerte_souhaits(v, $2) as s from public.annonces_en_ligne v where v.id = $1", [id, JSON.stringify(c)]))[0].s;
  // Budget plafond (120 000 et 140 000 pour 150 000), pièces au moins (3 et 4), souhaits sans effet sur le choix
  expect([await correspond(k1, appart), await correspond(k2, appart)]).toEqual([true, true]);
  expect(await correspond(k3, appart)).toBe(false);   // 2 pièces
  expect(await correspond(k4, appart)).toBe(false);   // au-dessus du budget
  expect(await correspond(k5, appart)).toBe(false);   // une villa
  // Minimum seulement s'il est donné
  expect(await correspond(k1, { ...appart, min: 130000 })).toBe(false);
  expect(await correspond(k2, { ...appart, min: 130000 })).toBe(true);
  // Souhaits : présents et absents, en clair
  expect(await souhaits(k2, appart)).toEqual({ ok: ["Meublé", "3 chambres et +", "Parking", "Piscine"], manque: [] });
  expect(await souhaits(k1, appart)).toEqual({ ok: ["Parking"], manque: ["Meublé", "3 chambres et +", "Piscine"] });
  // Terrain : superficie au moins et titre foncier exigé
  const terrains = { v: 2, tx: "achat", types: ["terrain"], ville: "Abidjan", commune: "Koumassi", max: 40000000, surface_min: 400, acd: true,
    souhaits: { com: ["Viabilisé (eau, électricité)"] } };
  expect([await correspond(t1, terrains), await correspond(t2, terrains), await correspond(t3, terrains)]).toEqual([true, false, false]);
  expect(await correspond(t2, { ...terrains, acd: false })).toBe(true);
  expect(await correspond(k1, { ...appart, types: ["appartement", "terrain"], acd: true })).toBe(true);   // ACD : terrains seulement

  // Chaque matin : les annonces qui ont le plus de souhaits en premier, avec leurs souhaits ; les anciennes alertes inchangées
  await db.query("delete from public.notifications");
  const fanta = await inscrire(db, { prenom: "Fanta", nom: "Koné" });
  await en(db, fanta, () => db.query("insert into public.alertes (nom, adresse, criteres) values ('Appartements à Koumassi', '/annonces?q=Koumassi&pmin=3', $1)",
    [JSON.stringify(appart)]));
  await db.query("update public.alertes set verifiee_le = now() - interval '21 hours' where profil_id = $1", [fanta]);
  await db.query("update public.annonces set publiee_le = now() - interval '1 hour' where id = any($1)", [[k1, k2, k3, k4, k5]]);
  await db.exec("set role service_role");
  try {
    await db.query("select public.preparer_alertes()");
  } finally {
    await db.exec("reset role");
  }
  const [n] = await lignes<{ donnees: { total: number; annonces: { titre: string; souhaits: { ok: string[]; manque: string[] } }[] } }>(
    "select donnees from public.notifications where profil_id = $1", [fanta]);
  expect(n.donnees.total).toBe(2);
  expect(n.donnees.annonces.map((a) => a.titre)).toEqual(["Koumassi 4 pièces 140 000", "Koumassi 3 pièces 120 000"]);
  expect(n.donnees.annonces[1].souhaits).toEqual({ ok: ["Parking"], manque: ["Meublé", "3 chambres et +", "Piscine"] });
});

test("Statistiques de l'annonceur : vues et gestes par jour, contacts, favoris, alertes, période d'avant, prix des annonces semblables", async () => {
  type Stats = { totaux: Record<string, number>; avant: Record<string, number>; par_jour: { jour: string; vues: number; contacts: number }[];
    annonces: Record<string, unknown>[] };
  const anyama = await lieu(db, "Abidjan", "Anyama");
  const zeina = await inscrire(db, { prenom: "Zeina", nom: "Bamba" });
  const ali = await inscrire(db, { prenom: "Ali", nom: "Traoré" });
  const publier = async (auteur: string, titre: string, prix: number, champs: Record<string, unknown> = {}) => {
    const base = await annonceType(db, { ...anyama, quartier_id: null, titre, prix, ...champs });
    const a = await en(db, auteur, () => creerAnnonce(db, { ...base, statut: "en_attente" }));
    await db.query("update public.annonces set statut = 'publiee' where id = $1", [a.id]);
    return String(a.id);
  };
  const z1 = await publier(zeina, "Anyama 3 pièces à 200 000", 200000);
  const z2 = await publier(zeina, "Anyama 3 pièces à 150 000", 150000);
  // Annonces semblables d'autres annonceurs (3 pièces à louer au mois à Anyama) ; un 4 pièces ne compte pas
  for (const prix of [140000, 150000, 160000]) await publier(ali, `Anyama 3 pièces chez Ali à ${prix}`, prix);
  await publier(ali, "Anyama 4 pièces chez Ali", 400000, { pieces: 4, chambres: 3 });

  const vue = (compte: string | null, id: string) => en(db, compte, () => db.query("select public.compter_vue($1)", [id]));
  const geste = (compte: string | null, id: string, action: string) =>
    en(db, compte, () => db.query("select public.noter_action($1, $2)", [id, action]));
  for (let i = 0; i < 5; i++) await vue(null, z1);
  await vue(ali, z1);
  await vue(zeina, z1);   // l'auteur ne compte pas
  await vue(null, z2);
  for (const action of ["numero", "numero", "whatsapp", "appel", "email"]) await geste(null, z1, action);
  await geste(ali, z1, "partage");
  await geste(zeina, z1, "numero");   // l'auteur ne compte pas
  await expect(geste(null, z1, "pirater")).rejects.toThrow(/Action inconnue/);
  // Les relevés ne se lisent ni ne s'écrivent directement
  await expect(en(db, zeina, () => lignes("select * from public.statistiques"))).rejects.toThrow(/permission denied/);
  await expect(en(db, null, () => db.query("insert into public.statistiques (annonce_id, jour, vues) values ($1, current_date, 99)", [z2])))
    .rejects.toThrow(/permission denied/);

  // Contacts venus d'ailleurs : une conversation, une visite, un rappel ; un favori ; deux envois par une alerte
  await db.query("insert into public.conversations (annonce_id, client_id, annonceur_id) values ($1, $2, $3)", [z1, ali, zeina]);
  await db.query(`insert into public.visites (annonce_id, nom, telephone, creneau) values ($1, 'Paul Kra', '+225 01 11 11 11 11',
    ((public.jour_abidjan(now()) + 1)::timestamp + interval '9 hours') at time zone 'Africa/Abidjan')`, [z1]);
  await db.query("insert into public.rappels (annonce_id, nom, telephone) values ($1, 'Paul Kra', '+225 01 11 11 11 11')", [z1]);
  await db.query("insert into public.favoris (profil_id, annonce_id) values ($1, $2)", [ali, z1]);
  await db.query("insert into public.notifications (modele, profil_id, cle, donnees, statut) values ('alerte', $1, 'alerte:stats', $2, 'envoyee')",
    [ali, JSON.stringify({ annonces: [{ id: z1 }, { id: z2 }] })]);
  // Relevé d'il y a 10 jours : dans la période d'avant sur 7 jours, dans la période sur 30 jours
  await db.query("insert into public.statistiques (annonce_id, jour, vues, numeros) values ($1, public.jour_abidjan(now()) - 10, 4, 1)", [z1]);

  const stats = (compte: string | null, jours: number) =>
    en(db, compte, async () => (await lignes<{ s: Stats }>("select public.statistiques_annonceur($1) as s", [jours]))[0].s);
  const s7 = await stats(zeina, 7);
  expect(s7.totaux).toMatchObject({
    vues: 7, numeros: 2, whatsapp: 1, appels: 1, emails: 1, partages: 1, messages: 1, visites: 1, rappels: 1, favoris: 1, alertes: 2,
  });
  expect(s7.avant).toMatchObject({ vues: 4, numeros: 1, messages: 0 });
  expect(s7.par_jour).toHaveLength(7);
  expect(s7.par_jour[6]).toMatchObject({ vues: 7, contacts: 5 });   // 2 numéros affichés, 1 message, 1 visite, 1 rappel
  expect(s7.par_jour[0]).toMatchObject({ vues: 0, contacts: 0 });
  expect(s7.annonces.map((a) => a.id)).toEqual([z1, z2]);
  expect(s7.annonces[0]).toMatchObject({
    titre: "Anyama 3 pièces à 200 000", en_ligne: true, type_nom: "Appartement", commune: "Anyama", vues_total: 6, vues: 6,
    numeros: 2, messages: 1, visites: 1, rappels: 1, favoris: 1, favoris_total: 1, alertes: 1, photos: 0,
    // prix médian des 4 autres 3 pièces à louer au mois à Anyama (150 000, 140 000, 150 000, 160 000)
    prix_compare: 200000, comparables: 4, mediane: 150000,
  });
  expect(s7.annonces[1]).toMatchObject({ vues: 1, alertes: 1, comparables: 4, mediane: 155000 });
  expect((await stats(zeina, 30)).totaux).toMatchObject({ vues: 11, numeros: 3 });
  // Chacun ses statistiques ; sans compte : non
  expect((await stats(ali, 30)).annonces.map((a) => a.id)).not.toContain(z1);
  await expect(stats(null, 7)).rejects.toThrow(/Connectez-vous/);
  // Une annonce plus en ligne ne compte plus de vues
  await db.query("update public.annonces set expire_le = now() - interval '1 day' where id = $1", [z2]);
  await vue(null, z2);
  expect((await stats(zeina, 7)).annonces[1]).toMatchObject({ vues: 1, en_ligne: false, mediane: null });
});

test("Modération : réservée à l'équipe, file à vérifier, publier, refuser, revérifier, signaler, classer, retirer, journal, e-mails", async () => {
  type Ligne = Record<string, unknown> & { auteur?: Record<string, unknown> };
  const songon = await lieu(db, "Abidjan", "Songon");
  const mariam = await inscrire(db, { prenom: "Mariam", nom: "Diallo", telephone: "+225 07 07 07 07 07" });
  const yves = await inscrire(db, { prenom: "Yves", nom: "Gnagne" });
  const creer = async (titre: string) => {
    const base = await annonceType(db, { ...songon, quartier_id: null, titre });
    return String((await en(db, mariam, () => creerAnnonce(db, { ...base, statut: "en_attente" }))).id);
  };
  const a1 = await creer("Songon villa à vérifier");
  const a2 = await creer("Songon appartement à refuser");
  const appel = async <T,>(compte: string | null, sql: string, params: unknown[] = []) =>
    en(db, compte, async () => (await lignes<{ r: T }>(sql, params))[0]?.r);
  const moderer = (compte: string, id: string, decision: string, motif: string | null = null) =>
    en(db, compte, () => db.query("select public.moderer_annonce($1, $2, $3)", [id, decision, motif]));
  const etat = async (id: string) =>
    (await lignes<{ statut: string; motif_refus: string | null; publiee_le: Date | null; expire_le: Date | null }>(
      "select statut, motif_refus, publiee_le, expire_le from public.annonces where id = $1", [id]))[0];

  // Réservé à l'équipe : sans compte, un visiteur, l'annonceur
  for (const compte of [null, yves, mariam]) {
    await expect(en(db, compte, () => db.query("select public.admin_a_verifier()"))).rejects.toThrow(/Réservé à l'équipe|permission denied/);
    await expect(en(db, compte, () => db.query("select public.admin_tableau()"))).rejects.toThrow(/Réservé à l'équipe|permission denied/);
  }
  await expect(moderer(mariam, a1, "publier")).rejects.toThrow(/Réservé à l'équipe/);
  await expect(en(db, yves, () => lignes("select * from public.moderations"))).rejects.toThrow(/permission denied/);

  // La file à vérifier : l'annonce, son contact et son auteur
  const file = await appel<Ligne[]>(admin, "select public.admin_a_verifier() as r");
  expect(file.find((x) => x.id === a1)).toMatchObject({
    titre: "Songon villa à vérifier", commune: "Songon", type_nom: "Appartement", contact_telephone: "+225 07 48 32 11 90",
    publiee_le: null, signalements: 0, derniere_decision: null, photos: [],
    auteur: { prenom: "Mariam", nom: "Diallo", telephone: "+225 07 07 07 07 07", role: "particulier", en_ligne: 0, refusees: 0 },
  });
  expect(String(file.find((x) => x.id === a1)!.auteur!.email)).toMatch(/@exemple\.ci$/);
  const compteurs = (compte: string) => appel<Record<string, number>>(compte, "select public.compteurs() as r");
  expect((await compteurs(admin)).moderation).toBeGreaterThanOrEqual(2);
  expect((await compteurs(mariam)).moderation).toBe(0);

  // Publier, refuser (motif obligatoire)
  await db.query("delete from public.notifications");
  await expect(moderer(admin, a2, "refuser", " ")).rejects.toThrow(/Écrivez le motif/);
  await moderer(admin, a1, "publier");
  await moderer(admin, a2, "refuser", "Photos floues : ajoutez des photos nettes du salon.");
  await expect(moderer(admin, a1, "publier")).rejects.toThrow(/plus en attente/);
  await expect(moderer(admin, a2, "retirer", "Doublon d'une autre annonce")).rejects.toThrow(/pas en ligne/);
  expect(await etat(a1)).toMatchObject({ statut: "publiee", motif_refus: null });
  expect((await etat(a1)).expire_le).not.toBeNull();
  expect(await etat(a2)).toMatchObject({ statut: "refusee", motif_refus: "Photos floues : ajoutez des photos nettes du salon." });
  const emails = async () => (await lignes<{ d: { decision: string; motif: string | null; reverification: boolean; annonce: { titre: string } } }>(
    "select donnees as d from public.notifications where modele = 'moderation' and profil_id = $1 order by cree_le", [mariam]))
    .map(({ d }) => [d.decision, d.annonce.titre, d.motif, d.reverification]);
  expect(await emails()).toEqual([
    ["publiee", "Songon villa à vérifier", null, false],
    ["refusee", "Songon appartement à refuser", "Photos floues : ajoutez des photos nettes du salon.", false],
  ]);

  // Revérification : une annonce en ligne qui change beaucoup repasse en attente, puis garde ses dates
  await db.query("update public.annonces set publiee_le = now() - interval '10 days', expire_le = now() + interval '80 days' where id = $1", [a1]);
  const dates = await etat(a1);
  await en(db, mariam, () => db.query("update public.annonces set prix = prix * 2 where id = $1", [a1]));
  expect((await etat(a1)).statut).toBe("en_attente");
  expect((await appel<Ligne[]>(admin, "select public.admin_a_verifier() as r")).find((x) => x.id === a1)!.publiee_le).not.toBeNull();
  await moderer(admin, a1, "publier");
  const apres = await etat(a1);
  expect(apres.statut).toBe("publiee");
  expect([apres.publiee_le!.getTime(), apres.expire_le!.getTime()]).toEqual([dates.publiee_le!.getTime(), dates.expire_le!.getTime()]);
  expect((await emails())[2]).toEqual(["publiee", "Songon villa à vérifier", null, true]);

  // Signaler : sans compte, avec un compte (une fois), pas sa propre annonce, raison, annonce en ligne seulement
  const signaler = (compte: string | null, id: string, motif: string, message: string | null = null) =>
    en(db, compte, () => db.query("select public.signaler_annonce($1, $2, $3)", [id, motif, message]));
  await signaler(null, a1, "arnaque", "On me demande une avance avant la visite.");
  await signaler(yves, a1, "indisponible");
  await expect(signaler(yves, a1, "photos")).rejects.toThrow(/déjà signalé/);
  await expect(signaler(mariam, a1, "prix")).rejects.toThrow(/C'est votre annonce/);
  await expect(signaler(null, a1, "autre", "bof")).rejects.toThrow(/quelques mots/);
  await expect(signaler(null, a1, "n'importe quoi")).rejects.toThrow(/raison/);
  await expect(signaler(null, a2, "arnaque")).rejects.toThrow(/plus en ligne/);
  await expect(en(db, yves, () => lignes("select * from public.signalements"))).rejects.toThrow(/permission denied/);
  const signalees = () => appel<{ nombre: number; annonce: Ligne; signalements: Ligne[] }[]>(admin, "select public.admin_signalements() as r");
  const [s1] = await signalees();
  expect(s1).toMatchObject({ nombre: 2, annonce: { id: a1, en_ligne: true, annonceur: "Mariam D.", commune: "Songon" } });
  expect(s1.signalements.map((s) => [s.motif, s.message, s.avec_compte])).toEqual([
    ["arnaque", "On me demande une avance avant la visite.", false], ["indisponible", null, true],
  ]);
  expect((await appel<Record<string, number>>(admin, "select public.admin_tableau() as r")).signalees).toBe(1);

  // Classer (rien à reprocher), puis retirer après un nouveau signalement
  const traiter = (decision: string, motif: string | null) =>
    en(db, admin, () => db.query("select public.traiter_signalements($1, $2, $3)", [a1, decision, motif]));
  await traiter("classer", "Vérifiée par téléphone avec l'annonceur");
  expect(await signalees()).toEqual([]);
  await expect(traiter("classer", null)).rejects.toThrow(/Plus de signalement/);
  await signaler(null, a1, "arnaque", "Encore une demande d'avance.");
  await expect(traiter("retirer", null)).rejects.toThrow(/Écrivez le motif/);
  await traiter("retirer", "Arnaque confirmée : argent demandé avant la visite.");
  expect(await etat(a1)).toMatchObject({ statut: "refusee", motif_refus: "Arnaque confirmée : argent demandé avant la visite." });
  expect(await lignes("select statut from public.signalements where annonce_id = $1 order by cree_le", [a1]))
    .toEqual([{ statut: "classe" }, { statut: "classe" }, { statut: "retiree" }]);
  expect((await emails())[3]).toEqual(["retiree", "Songon villa à vérifier", "Arnaque confirmée : argent demandé avant la visite.", false]);

  // Journal de l'équipe et tableau de bord
  const journal = await appel<Ligne[]>(admin, "select public.admin_journal(10) as r");
  expect(journal.slice(0, 5).map((j) => j.decision)).toEqual(["retiree", "classee", "publiee", "refusee", "publiee"]);
  expect(journal[0]).toMatchObject({ titre: "Songon villa à vérifier", motif: "Arnaque confirmée : argent demandé avant la visite.", par: "Équipe 360-Immo.ci" });
  const tableau = await appel<Record<string, number> & { semaine: Record<string, number> }>(admin, "select public.admin_tableau() as r");
  expect(tableau.signalees).toBe(0);
  expect(tableau.semaine.signalements).toBeGreaterThanOrEqual(3);
  expect(tableau.semaine.refusees).toBeGreaterThanOrEqual(2);
  // Sans e-mail pour qui n'en veut pas
  await db.query("update public.profils set emails_annonces = false where id = $1", [mariam]);
  const a3 = await creer("Songon troisième annonce");
  await moderer(admin, a3, "publier");
  expect(await emails()).toHaveLength(4);
});

test("Équipe, comptes et agences : accès administrateur, recherche, suspension, demandes d'agence, agences, accueil, journal", async () => {
  type Fiche = Record<string, unknown>;
  const portBouet = await lieu(db, "Abidjan", "Port-Bouët");
  const kone = await inscrire(db, { prenom: "Ibrahim", nom: "Koné", telephone: "+225 05 55 55 55 55", agence: "Soleil Immobilier" });
  const fraude = await inscrire(db, { prenom: "Faux", nom: "Proprio", telephone: "+225 01 99 99 99 99" });
  const nadia = await inscrire(db, { prenom: "Nadia", nom: "Touré" });
  const [{ email: emailFraude }] = await lignes<{ email: string }>("select email from auth.users where id = $1", [fraude]);
  const appel = async <T,>(compte: string | null, sql: string, params: unknown[] = []) =>
    en(db, compte, async () => (await lignes<{ r: T }>(sql, params))[0]?.r);
  const faire = (compte: string | null, sql: string, params: unknown[] = []) => en(db, compte, () => db.query(sql, params));
  const publier = async (auteur: string, titre: string) => {
    const base = await annonceType(db, { ...portBouet, quartier_id: null, titre });
    const a = String((await en(db, auteur, () => creerAnnonce(db, { ...base, statut: "en_attente" }))).id);
    await faire(admin, "select public.moderer_annonce($1, 'publier')", [a]);
    return a;
  };
  const role = async (id: string) => (await lignes<{ role: string; suspendu_le: Date | null; agence_id: string | null }>(
    "select role, suspendu_le, agence_id from public.profils where id = $1", [id]))[0];
  const prevenu = async (id: string) => (await lignes<{ e: string }>(
    "select donnees ->> 'evenement' as e from public.notifications where modele = 'compte' and profil_id = $1 order by cree_le", [id])).map((x) => x.e);

  // Réservé à l'équipe
  for (const sql of ["select public.admin_chercher_comptes('')", "select public.admin_equipe()", "select public.admin_agences()",
    "select public.admin_demandes_agence()"]) {
    await expect(faire(koffi, sql)).rejects.toThrow(/Réservé à l'équipe/);
  }
  await expect(faire(koffi, "select public.changer_acces_admin($1, true)", [koffi])).rejects.toThrow(/Réservé à l'équipe/);

  // Chercher un compte : e-mail, nom (sans accents), téléphone
  const chercher = (texte: string) => appel<Fiche[]>(admin, "select public.admin_chercher_comptes($1) as r", [texte]);
  for (const texte of [emailFraude.toUpperCase(), "proprio", "99 99 99"]) {
    expect((await chercher(texte)).map((c) => c.id)).toContain(fraude);
  }
  expect((await chercher("toure"))[0]).toMatchObject({ id: nadia, prenom: "Nadia", role: "particulier", annonces: 0, suspendu_le: null, moi: false });
  expect((await chercher("koné")).find((c) => c.id === kone)).toMatchObject({ demande_agence: "Soleil Immobilier", telephone: "+225 05 55 55 55 55" });

  // Équipe : donner puis retirer l'accès ; jamais le sien
  await expect(faire(admin, "select public.changer_acces_admin($1, false)", [admin])).rejects.toThrow(/propre accès/);
  await faire(admin, "select public.changer_acces_admin($1, true)", [nadia]);
  expect((await role(nadia)).role).toBe("admin");
  await expect(faire(admin, "select public.changer_acces_admin($1, true)", [nadia])).rejects.toThrow(/déjà administrateur/);
  const equipe = await appel<Fiche[]>(nadia, "select public.admin_equipe() as r");
  expect(equipe.map((c) => c.id)).toEqual(expect.arrayContaining([admin, nadia]));
  expect(equipe[0]).toMatchObject({ id: nadia, moi: true });
  expect(equipe.find((c) => c.id === nadia)!.depuis).not.toBeNull();
  await faire(admin, "select public.changer_acces_admin($1, false)", [nadia]);
  expect((await role(nadia)).role).toBe("particulier");
  await expect(faire(nadia, "select public.admin_equipe()")).rejects.toThrow(/Réservé à l'équipe/);
  expect(await prevenu(nadia)).toEqual(["admin_donne"]);

  // Suspendre : motif, pas soi-même ni un administrateur ; annonces retirées, plus rien de nouveau
  const enLigne = await publier(fraude, "Port-Bouët faux appartement");
  const chezKoffi = await publier(koffi, "Port-Bouët appartement de Koffi");
  const base = await annonceType(db, { ...portBouet, quartier_id: null, titre: "Port-Bouët faux studio" });
  const attente = String((await en(db, fraude, () => creerAnnonce(db, { ...base, statut: "en_attente" }))).id);
  await faire(null, "select public.signaler_annonce($1, 'arnaque', 'Avance demandée')", [enLigne]);
  await expect(faire(admin, "select public.suspendre_compte($1, '')", [fraude])).rejects.toThrow(/Écrivez le motif/);
  await expect(faire(admin, "select public.suspendre_compte($1, 'Essai motif')", [admin])).rejects.toThrow(/propre compte/);
  const motif = "Arnaques répétées : avances demandées avant les visites.";
  await faire(admin, "select public.suspendre_compte($1, $2)", [fraude, motif]);
  await expect(faire(admin, "select public.suspendre_compte($1, $2)", [fraude, motif])).rejects.toThrow(/déjà suspendu/);
  expect((await role(fraude)).suspendu_le).not.toBeNull();
  expect(await lignes("select statut, motif_refus from public.annonces where id = any($1) order by titre", [[enLigne, attente]])).toEqual([
    { statut: "refusee", motif_refus: `Compte suspendu : ${motif}` }, { statut: "refusee", motif_refus: `Compte suspendu : ${motif}` },
  ]);
  expect(await lignes("select statut from public.signalements where annonce_id = $1", [enLigne])).toEqual([{ statut: "retiree" }]);
  const bloque = /Votre compte est suspendu/;
  await expect(en(db, fraude, () => creerAnnonce(db, { ...base, titre: "Port-Bouët encore", statut: "brouillon" }))).rejects.toThrow(bloque);
  await expect(faire(fraude, "update public.annonces set statut = 'en_attente' where id = $1", [attente])).rejects.toThrow(bloque);
  await expect(faire(fraude, "select public.ecrire_annonceur($1, 'Bonjour, est-ce disponible ?')", [chezKoffi])).rejects.toThrow(bloque);
  await expect(faire(fraude, "insert into public.alertes (nom, adresse, criteres) values ('Tout', '/annonces?q=Cocody', '{}')")).rejects.toThrow(bloque);
  await expect(faire(fraude, `insert into public.rappels (annonce_id, nom, telephone) values ($1, 'Faux Proprio', '+225 01 99 99 99 99')`, [chezKoffi]))
    .rejects.toThrow(bloque);
  await faire(fraude, "update public.profils set suspendu_le = null, suspension_motif = null where id = $1", [fraude]);
  expect((await role(fraude)).suspendu_le).not.toBeNull();   // pas soi-même
  expect((await lignes<{ motif: string }>("select suspension_motif as motif from public.profils where id = $1", [fraude]))[0].motif).toBe(motif);
  await faire(admin, "select public.reactiver_compte($1)", [fraude]);
  expect((await role(fraude)).suspendu_le).toBeNull();
  await en(db, fraude, () => creerAnnonce(db, { ...base, titre: "Port-Bouët de retour", statut: "brouillon" }));
  expect(await prevenu(fraude)).toEqual(["suspendu", "reactive"]);

  // Demandes d'agence : nouvelle agence, rattachement à une agence existante, refus
  await db.query("insert into public.agences (nom, slug) values ('Soleil Immo', 'soleil-immo')");
  const compteurs = async () => (await appel<Record<string, number>>(admin, "select public.compteurs() as r")).moderation;
  const avant = await compteurs();
  await faire(nadia, "update public.profils set demande_agence = 'Soleil Immo' where id = $1", [nadia]);
  await faire(fraude, "update public.profils set demande_agence = 'Agence Fantôme' where id = $1", [fraude]);
  expect(await compteurs()).toBe(avant + 2);
  const demandes = await appel<(Fiche & { semblables: { nom: string }[] })[]>(admin, "select public.admin_demandes_agence() as r");
  expect(demandes.find((d) => d.id === kone)).toMatchObject({ demande_agence: "Soleil Immobilier", semblables: [{ nom: "Soleil Immo" }] });
  const agenceKone = await appel<string>(admin, "select public.valider_agence($1) as r", [kone]);
  expect(await role(kone)).toMatchObject({ role: "agence", agence_id: agenceKone });
  expect(await lignes("select nom, slug, telephone, verifiee from public.agences where id = $1", [agenceKone]))
    .toEqual([{ nom: "Soleil Immobilier", slug: "soleil-immobilier", telephone: "+225 05 55 55 55 55", verifiee: false }]);
  expect((await lignes<{ s: string }>("select public.slug_agence('Soleil Immobilier !') as s"))[0].s).toBe("soleil-immobilier-2");
  const [{ id: soleilImmo }] = await lignes<{ id: string }>("select id from public.agences where slug = 'soleil-immo'");
  await faire(admin, "select public.valider_agence($1, null, $2)", [nadia, soleilImmo]);
  expect(await role(nadia)).toMatchObject({ role: "agence", agence_id: soleilImmo });
  await expect(faire(admin, "select public.refuser_agence($1, '')", [fraude])).rejects.toThrow(/Écrivez le motif/);
  await faire(admin, "select public.refuser_agence($1, 'RCCM introuvable : envoyez-le à l''équipe.')", [fraude]);
  expect((await lignes<{ d: string | null }>("select demande_agence as d from public.profils where id = $1", [fraude]))[0].d).toBeNull();
  expect(await compteurs()).toBe(avant - 1);   // les 3 demandes traitées (dont celle d'Ibrahim, comptée avant)
  expect(await prevenu(kone)).toEqual(["agence_validee"]);
  expect((await prevenu(fraude)).at(-1)).toBe("agence_refusee");

  // Agences : modifier, badge « vérifiée » ; accueil : les agences vérifiées avec des annonces en ligne
  await expect(faire(admin, "select public.modifier_agence($1, 'Soleil Immobilier', '0555', null, true)", [agenceKone])).rejects.toThrow(/indicatif/);
  await faire(admin, "select public.modifier_agence($1, 'Soleil Immobilier CI', '+225 05 55 55 55 55', 'contact@soleil.ci', true)", [agenceKone]);
  const agences = await appel<Fiche[]>(admin, "select public.admin_agences() as r");
  expect(agences.find((x) => x.id === agenceKone)).toMatchObject({
    nom: "Soleil Immobilier CI", email: "contact@soleil.ci", verifiee: true, annonces_en_ligne: 0, comptes: [{ id: kone, nom: "Ibrahim Koné" }],
  });
  const partenaires = () => appel<{ nom: string; annonces: number; vitrine: { code: string } }[]>(null, "select public.agences_partenaires() as r");
  expect((await partenaires()).map((x) => x.nom)).not.toContain("Soleil Immobilier CI");   // pas encore d'annonce en ligne
  await publier(kone, "Port-Bouët villa de Soleil");
  const soleil = (await partenaires()).find((x) => x.nom === "Soleil Immobilier CI")!;
  expect(soleil.annonces).toBe(1);
  expect(soleil.vitrine.code).toMatch(/^[a-z0-9]{6}$/);
  expect((await partenaires()).map((x) => x.nom)).not.toContain("Soleil Immo");   // pas vérifiée

  // Journal : annonces, comptes et agences ensemble
  const journal = await appel<Fiche[]>(admin, "select public.admin_journal(30) as r");
  const actions = journal.map((j) => j.decision);
  for (const a of ["admin_donne", "admin_retire", "compte_suspendu", "compte_reactive", "agence_validee", "agence_refusee", "agence_modifiee"]) {
    expect(actions).toContain(a);
  }
  expect(journal.find((j) => j.decision === "agence_modifiee")).toMatchObject({
    titre: "Soleil Immobilier CI", reference: null, par: "Équipe 360-Immo.ci",
    motif: "nom : Soleil Immobilier → Soleil Immobilier CI ; e-mail : contact@soleil.ci ; badge « vérifiée » donné",   // même téléphone
  });
  expect(journal.find((j) => j.decision === "compte_suspendu")).toMatchObject({ titre: "Faux Proprio", motif });
  const tableau = await appel<Record<string, number>>(admin, "select public.admin_tableau() as r");
  expect(tableau.suspendus).toBe(0);
  expect(tableau.administrateurs).toBeGreaterThanOrEqual(1);
  expect(tableau.agences_verifiees).toBeGreaterThanOrEqual(1);
});

test("Documents et vérifications : dossier privé, demandes (identité, bien, agence), décisions de l'équipe, badges, logo, e-mails", async () => {
  type Ligne = Record<string, unknown>;
  const treichville = await lieu(db, "Abidjan", "Treichville");
  const mamadou = await inscrire(db, { prenom: "Mamadou", nom: "Cissé", telephone: "+225 07 12 12 12 12" });
  const curieux = await inscrire(db, { prenom: "Curieux", nom: "Voisin" });
  const appel = async <T,>(compte: string | null, sql: string, params: unknown[] = []) =>
    en(db, compte, async () => (await lignes<{ r: T }>(sql, params))[0]?.r);
  const faire = (compte: string | null, sql: string, params: unknown[] = []) => en(db, compte, () => db.query(sql, params));
  const envoyer = (compte: string, dossier: string, chemin: string) =>
    faire(compte, "insert into storage.objects (bucket_id, name) values ($1, $2)", [dossier, chemin]);
  const fichier = (piece: string, chemin: string, type = "image/jpeg", dossier = "documents") =>
    ({ piece, dossier, chemin, nom: chemin.split("/")[1], type, taille: 250000 });
  const demander = (type: string, annonce: string | null, fichiers: unknown[], note: string | null = null) =>
    appel<string>(mamadou, "select public.demander_verification($1, $2, $3, $4) as r", [type, annonce, JSON.stringify(fichiers), note]);
  const traiter = (id: string, decision: string, motif: string | null = null, numero: string | null = null, fin: string | null = null) =>
    appel<string[]>(admin, "select public.traiter_verification($1, $2, $3, $4, $5) as r", [id, decision, motif, numero, fin]);
  const prevenu = async () => (await lignes<{ e: string }>(
    "select donnees ->> 'evenement' as e from public.notifications where modele = 'compte' and profil_id = $1 order by cree_le", [mamadou])).map((x) => x.e);

  // Dossier privé : chacun le sien, l'équipe lit tout, personne d'autre
  const [dossier] = await lignes("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents'");
  expect(dossier).toEqual({ public: false, file_size_limit: 10485760, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] });
  const recto = `${mamadou}/recto.jpg`, verso = `${mamadou}/verso.jpg`, selfie = `${mamadou}/selfie.jpg`, titre = `${mamadou}/titre.pdf`;
  for (const chemin of [recto, verso, selfie, titre]) await envoyer(mamadou, "documents", chemin);
  await expect(envoyer(curieux, "documents", `${mamadou}/faux.jpg`)).rejects.toThrow(/row-level security/);
  expect(await en(db, curieux, () => lignes("select name from storage.objects where bucket_id = 'documents' and name like $1", [`${mamadou}/%`]))).toEqual([]);
  // l'équipe : seulement les documents d'une demande (aucune pour l'instant)
  expect(await en(db, admin, () => lignes("select name from storage.objects where bucket_id = 'documents' and name like $1 order by name", [`${mamadou}/%`])))
    .toEqual([]);

  // Identité : pièces obligatoires, fichiers envoyés dans son dossier, une demande à la fois
  await expect(demander("identite", null, [fichier("piece_recto", recto), fichier("piece_verso", verso)])).rejects.toThrow(/photo de vous tenant la pièce/);
  await expect(demander("identite", null, [fichier("piece_recto", `${mamadou}/absent.jpg`), fichier("selfie", selfie)])).rejects.toThrow(/pas été envoyé/);
  await expect(demander("identite", null, [fichier("piece_recto", recto), fichier("rccm", selfie)])).rejects.toThrow(/Document inattendu/);
  await expect(demander("identite", null, [fichier("piece_recto", recto, "text/html"), fichier("selfie", selfie)])).rejects.toThrow(/Format non accepté/);
  const identite = await demander("identite", null, [fichier("piece_recto", recto), fichier("piece_verso", verso), fichier("selfie", selfie)], "Carte nationale d'identité");
  await expect(demander("identite", null, [fichier("piece_recto", recto), fichier("piece_verso", verso), fichier("selfie", selfie)])).rejects.toThrow(/déjà en cours/);
  expect(await en(db, admin, () => lignes("select name from storage.objects where bucket_id = 'documents' and name like $1 order by name", [`${mamadou}/%`])))
    .toEqual([{ name: recto }, { name: selfie }, { name: verso }]);
  await expect(demander("agence", null, [fichier("rccm", titre, "application/pdf")])).rejects.toThrow(/Réservé aux comptes agence/);
  await expect(en(db, mamadou, () => lignes("select * from public.verifications"))).rejects.toThrow(/permission denied/);

  // Bien : une de ses annonces
  const base = await annonceType(db, { ...treichville, quartier_id: null, titre: "Treichville appartement de Mamadou" });
  const annonce = String((await en(db, mamadou, () => creerAnnonce(db, { ...base, statut: "en_attente" }))).id);
  await faire(admin, "select public.moderer_annonce($1, 'publier')", [annonce]);
  await expect(demander("bien", crypto.randomUUID(), [fichier("titre", titre, "application/pdf")])).rejects.toThrow(/une de vos annonces/);
  const bien = await demander("bien", annonce, [fichier("titre", titre, "application/pdf")]);
  const mes = await appel<{ identite: Ligne; agence: Ligne | null; biens: Ligne[] }>(mamadou, "select public.mes_verifications() as r");
  expect(mes.identite).toMatchObject({ verifiee_le: null, demande: { statut: "soumise", motif: null } });
  expect(mes.agence).toBeNull();
  expect(mes.biens.find((b) => b.id === annonce)).toMatchObject({ verifiee: false, demande: { statut: "soumise" } });

  // L'équipe : liste, décisions ; réservé à l'équipe
  await expect(faire(mamadou, "select public.admin_verifications()")).rejects.toThrow(/Réservé à l'équipe/);
  await expect(faire(mamadou, "select public.traiter_verification($1, 'valider')", [identite])).rejects.toThrow(/Réservé à l'équipe/);
  const liste = await appel<Ligne[]>(admin, "select public.admin_verifications() as r");
  expect(liste.find((x) => x.id === identite)).toMatchObject({
    type: "identite", note: "Carte nationale d'identité", annonce: null, compte: { prenom: "Mamadou", telephone: "+225 07 12 12 12 12" },
  });
  expect(liste.find((x) => x.id === bien)).toMatchObject({ type: "bien", annonce: { id: annonce, en_ligne: true, commune: "Treichville" } });
  await expect(traiter(identite, "valider")).rejects.toThrow(/numéro de la pièce/);
  expect(await traiter(identite, "valider", null, "CI 0012 3456", "2031-05-01")).toEqual([]);   // pièce gardée (plainte)
  await expect(traiter(identite, "valider", null, "CI 0012 3456", "2031-05-01")).rejects.toThrow(/déjà été traitée/);
  expect((await lignes<{ le: Date | null }>("select identite_verifiee_le as le from public.profils where id = $1", [mamadou]))[0].le).not.toBeNull();
  expect((await lignes<{ verifiee: boolean }>("select verifiee from public.annonceur_public($1)", [annonce]))[0].verifiee).toBe(true);
  await faire(mamadou, "update public.profils set identite_verifiee_le = null where id = $1", [mamadou]);
  expect((await lignes<{ le: Date | null }>("select identite_verifiee_le as le from public.profils where id = $1", [mamadou]))[0].le).not.toBeNull();
  await expect(demander("identite", null, [fichier("piece_recto", recto), fichier("selfie", selfie)])).rejects.toThrow(/déjà vérifiée/);

  // Bien : refusé (motif), puis nouvelle demande validée → « Bien vérifié »
  await expect(traiter(bien, "refuser", "")).rejects.toThrow(/Écrivez le motif/);
  await traiter(bien, "refuser", "Le titre ne correspond pas au bien de l'annonce.");
  expect((await appel<{ biens: Ligne[] }>(mamadou, "select public.mes_verifications() as r")).biens.find((b) => b.id === annonce))
    .toMatchObject({ verifiee: false, demande: { statut: "refusee", motif: "Le titre ne correspond pas au bien de l'annonce." } });
  const bien2 = await demander("bien", annonce, [fichier("titre", titre, "application/pdf")], "Voici le bon titre foncier.");
  expect(await traiter(bien2, "valider")).toEqual([titre]);
  expect((await lignes<{ verifiee: boolean }>("select verifiee from public.annonces_en_ligne where id = $1", [annonce]))[0].verifiee).toBe(true);
  await expect(demander("bien", annonce, [fichier("titre", titre, "application/pdf")])).rejects.toThrow(/déjà vérifié/);

  // Agence : RCCM (dossier privé) et logo (dossier public) ; validée → agence vérifiée, logo sur la vitrine, la fiche et l'accueil
  await faire(mamadou, "update public.profils set demande_agence = 'Cissé Immobilier' where id = $1", [mamadou]);
  await faire(admin, "select public.valider_agence($1)", [mamadou]);
  expect((await lignes<{ verifiee: boolean }>("select verifiee from public.annonceur_public($1)", [annonce]))[0].verifiee).toBe(false);   // l'agence d'abord
  const rccm = `${mamadou}/rccm.pdf`, logo = `${mamadou}/logo.png`;
  await envoyer(mamadou, "documents", rccm);
  await envoyer(mamadou, "logos", logo);
  await expect(demander("agence", null, [fichier("rccm", rccm, "application/pdf"), fichier("logo", logo, "image/png")])).rejects.toThrow(/pas été envoyé/);
  const agence = await demander("agence", null, [fichier("rccm", rccm, "application/pdf"), fichier("logo", logo, "image/png", "logos")]);
  expect((await appel<{ agence: Ligne }>(mamadou, "select public.mes_verifications() as r")).agence)
    .toMatchObject({ nom: "Cissé Immobilier", verifiee: false, logo: null, demande: { statut: "soumise" } });
  expect(await traiter(agence, "valider")).toEqual([rccm]);   // pas le logo
  expect(await lignes("select verifiee, logo from public.agences where nom = 'Cissé Immobilier'")).toEqual([{ verifiee: true, logo }]);
  const [{ code }] = await lignes<{ code: string }>("select code_vitrine as code from public.profils where id = $1", [mamadou]);
  expect(await appel(null, "select public.vitrine($1) as r", [code])).toMatchObject({ nom: "Cissé Immobilier", agence: true, verifiee: true, logo });
  expect(await appel(null, "select public.logo_annonceur($1) as r", [annonce])).toBe(logo);
  expect((await appel<Ligne[]>(null, "select public.agences_partenaires() as r")).find((x) => x.nom === "Cissé Immobilier")).toMatchObject({ logo, annonces: 1 });

  // E-mails et journal
  expect(await prevenu()).toEqual(["verification_validee", "verification_refusee", "verification_validee", "agence_validee", "verification_validee"]);
  const journal = await appel<Ligne[]>(admin, "select public.admin_journal(10) as r");
  expect(journal[0]).toMatchObject({ decision: "verification_validee", titre: "Mamadou Cissé", motif: "Votre agence « Cissé Immobilier »" });
  expect(journal.find((j) => j.decision === "verification_refusee")).toMatchObject({
    motif: "Votre bien « Treichville appartement de Mamadou » : Le titre ne correspond pas au bien de l'annonce.",
  });
  expect((await appel<Record<string, number>>(admin, "select public.admin_tableau() as r")).documents).toBe(0);
});

test("Identité (plaintes) : CNI recto et verso ou passeport, numéro et date de fin, une pièce par compte, conservation, consultation avec motif, nom changé, compte supprimé", async () => {
  type Ligne = Record<string, unknown>;
  const fatou = await inscrire(db, { prenom: "Fatou", nom: "Bamba", telephone: "+225 07 21 21 21 21" });
  const clone = await inscrire(db, { prenom: "Fatou", nom: "Bamba", telephone: "+225 07 22 22 22 22" });
  const appel = async <T,>(compte: string | null, sql: string, params: unknown[] = []) =>
    en(db, compte, async () => (await lignes<{ r: T }>(sql, params))[0]?.r);
  const faire = (compte: string | null, sql: string, params: unknown[] = []) => en(db, compte, () => db.query(sql, params));
  const envoyer = async (compte: string, nom: string) => {
    await faire(compte, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${compte}/${nom}`]);
    return `${compte}/${nom}`;
  };
  const fichier = (piece: string, chemin: string) => ({ piece, dossier: "documents", chemin, nom: chemin.split("/")[1], type: "image/jpeg", taille: 250000 });
  const demander = (compte: string, fichiers: unknown[]) =>
    appel<string>(compte, "select public.demander_verification('identite', null, $1) as r", [JSON.stringify(fichiers)]);
  const traiter = (id: string, decision: string, motif: string | null, numero: string | null = null, fin: string | null = null) =>
    appel<string[]>(admin, "select public.traiter_verification($1, $2, $3, $4, $5) as r", [id, decision, motif, numero, fin]);
  const visibles = (compte: string, qui: string) =>
    en(db, compte, async () => (await lignes<{ name: string }>("select name from storage.objects where bucket_id = 'documents' and name like $1 order by name", [`${qui}/%`])).map((x) => x.name));
  const [{ code }] = await lignes<{ code: string }>("select code_vitrine as code from public.profils where id = $1", [fatou]);
  const badge = async () => (await appel<{ verifiee: boolean }>(null, "select public.vitrine($1) as r", [code])).verifiee;

  // Pièces : CNI recto ET verso, ou passeport ; jamais les deux ; toujours la photo de soi tenant la pièce
  const recto = await envoyer(fatou, "recto.jpg"), verso = await envoyer(fatou, "verso.jpg");
  const passeport = await envoyer(fatou, "passeport.jpg"), selfie = await envoyer(fatou, "selfie.jpg");
  await expect(demander(fatou, [fichier("piece_recto", recto), fichier("selfie", selfie)])).rejects.toThrow(/Document manquant : le verso de la CNI/);
  await expect(demander(fatou, [fichier("piece_verso", verso), fichier("selfie", selfie)])).rejects.toThrow(/le recto de la CNI/);
  await expect(demander(fatou, [fichier("selfie", selfie)])).rejects.toThrow(/la CNI \(recto et verso\) ou la page photo du passeport/);
  await expect(demander(fatou, [fichier("passeport", passeport)])).rejects.toThrow(/photo de vous tenant la pièce/);
  await expect(demander(fatou, [fichier("piece_recto", recto), fichier("passeport", passeport), fichier("selfie", selfie)])).rejects.toThrow(/pas les deux/);
  await expect(demander(fatou, [fichier("passeport", passeport), fichier("passeport", recto), fichier("selfie", selfie)])).rejects.toThrow(/Un seul fichier par document/);
  const demande = await demander(fatou, [fichier("passeport", passeport), fichier("selfie", selfie)]);
  expect((await appel<Ligne[]>(admin, "select public.admin_verifications() as r")).find((x) => x.id === demande)).toMatchObject({ type_piece: "passeport" });
  expect(await visibles(admin, fatou)).toEqual([passeport, selfie]);   // l'équipe : les documents de la demande seulement

  // Validation : numéro et date de fin notés par l'équipe ; pièce gardée
  await expect(traiter(demande, "valider", null)).rejects.toThrow(/Notez le numéro de la pièce/);
  await expect(traiter(demande, "valider", null, "AB 123 456", "2020-01-01")).rejects.toThrow(/date de fin de validité/);
  expect(await traiter(demande, "valider", null, "ab-123 456", "2030-12-31")).toEqual([]);
  expect(await lignes("select identite_expire_le::text as fin from public.profils where id = $1", [fatou])).toEqual([{ fin: "2030-12-31" }]);
  expect(await lignes("select type_piece, numero_piece, piece_expire_le::text as fin, titulaire, conserver_jusqu_au from public.verifications where id = $1", [demande]))
    .toEqual([{ type_piece: "passeport", numero_piece: "AB123456", fin: "2030-12-31", conserver_jusqu_au: null,
      titulaire: { prenom: "Fatou", nom: "Bamba", email: expect.stringMatching(/@exemple\.ci$/), telephone: "+225 07 21 21 21 21" } }]);
  expect(await badge()).toBe(true);
  expect(await appel<Ligne>(fatou, "select public.mes_verifications() as r")).toMatchObject({ identite: { expire_le: "2030-12-31", valide: true } });
  const journal = await appel<Ligne[]>(admin, "select public.admin_journal(5) as r");
  expect(journal[0]).toMatchObject({ decision: "verification_validee", titre: "Fatou Bamba", motif: "Votre identité : PASSEPORT n° AB123456, jusqu'au 31/12/2030" });
  expect((await lignes<{ d: Ligne }>("select donnees as d from public.notifications where profil_id = $1 and modele = 'compte' order by cree_le desc limit 1", [fatou]))[0].d)
    .toMatchObject({ evenement: "verification_validee", type: "identite", expire_le: "2030-12-31" });

  // Pièce conservée : fermée à l'équipe (sauf plainte), ni l'équipe ni la personne ne la suppriment
  expect(await visibles(admin, fatou)).toEqual([]);
  await faire(admin, "delete from storage.objects where name = $1", [passeport]);
  await faire(fatou, "delete from storage.objects where name = $1", [passeport]);
  await faire(fatou, "delete from storage.objects where name = $1", [recto]);   // resté hors d'une demande : oui
  expect((await lignes<{ name: string }>("select name from storage.objects where name like $1 order by name", [`${fatou}/%`])).map((x) => x.name))
    .toEqual([passeport, selfie, verso]);
  await expect(faire(fatou, "update public.profils set identite_expire_le = '2040-01-01' where id = $1", [fatou]).then(() =>
    lignes("select identite_expire_le::text as fin from public.profils where id = $1", [fatou]))).resolves.toEqual([{ fin: "2030-12-31" }]);

  // Une pièce ne vérifie qu'un compte
  const passeport2 = await envoyer(clone, "passeport.jpg"), selfie2 = await envoyer(clone, "selfie.jpg");
  const double = await demander(clone, [fichier("passeport", passeport2), fichier("selfie", selfie2)]);
  await expect(traiter(double, "valider", null, "AB123456", "2030-12-31")).rejects.toThrow(/déjà servi à vérifier le compte de Fatou Bamba/);
  expect(await traiter(double, "refuser", "Pièce déjà utilisée par un autre compte.")).toEqual([passeport2, selfie2]);

  // Plainte : retrouver la pièce, l'ouvrir avec un motif (noté au journal), pendant une heure
  const trouvees = await appel<Ligne[]>(admin, "select public.admin_pieces_conservees('bamba') as r");
  expect(trouvees).toEqual([expect.objectContaining({ id: demande, compte: fatou, compte_supprime: false, type_piece: "passeport",
    numero_piece: "AB123456", piece_expire_le: "2030-12-31", badge: true, consultations: 0 })]);
  expect((await appel<Ligne[]>(admin, "select public.admin_pieces_conservees('AB 1234') as r")).map((x) => x.id)).toEqual([demande]);
  expect((await appel<Ligne[]>(admin, "select public.admin_pieces_conservees('07 21 21') as r")).map((x) => x.id)).toEqual([demande]);
  await expect(faire(fatou, "select public.admin_pieces_conservees()")).rejects.toThrow(/Réservé à l'équipe/);
  await expect(faire(fatou, "select public.consulter_pieces($1, 'curiosité')", [demande])).rejects.toThrow(/Réservé à l'équipe/);
  await expect(faire(admin, "select public.consulter_pieces($1, '')", [demande])).rejects.toThrow(/Écrivez le motif/);
  const ouverts = await appel<Ligne[]>(admin, "select public.consulter_pieces($1, 'Plainte de M. Traoré du 12 octobre') as r", [demande]);
  expect(ouverts.map((x) => x.chemin)).toEqual([passeport, selfie]);
  expect(await visibles(admin, fatou)).toEqual([passeport, selfie]);
  expect((await appel<Ligne[]>(admin, "select public.admin_journal(1) as r"))[0])
    .toMatchObject({ decision: "piece_consultee", titre: "Fatou Bamba", motif: "Plainte de M. Traoré du 12 octobre" });
  await db.query("update public.consultations_pieces set cree_le = now() - interval '2 hours'");
  expect(await visibles(admin, fatou)).toEqual([]);   // une heure seulement

  // Nom changé (pas la simple casse) : badge retiré, il faut renvoyer sa pièce ; l'ancienne reste conservée
  await faire(fatou, "update public.profils set prenom = 'FATOU ' where id = $1", [fatou]);
  expect(await badge()).toBe(true);
  await faire(fatou, "update public.profils set nom = 'Diallo' where id = $1", [fatou]);
  expect(await badge()).toBe(false);
  const recto2 = await envoyer(fatou, "recto2.jpg"), verso2 = await envoyer(fatou, "verso2.jpg"), selfie3 = await envoyer(fatou, "selfie3.jpg");
  const nouvelle = await demander(fatou, [fichier("piece_recto", recto2), fichier("piece_verso", verso2), fichier("selfie", selfie3)]);
  expect(await traiter(nouvelle, "valider", null, "C 0099 8877 66", "2033-06-30")).toEqual([]);
  expect(await badge()).toBe(true);
  const [ancienne] = await lignes<{ garde: boolean }>("select conserver_jusqu_au between now() + interval '364 days' and now() + interval '366 days' as garde from public.verifications where id = $1", [demande]);
  expect(ancienne.garde).toBe(true);   // remplacée : gardée encore 1 an

  // Pièce expirée : plus de badge ; une nouvelle demande est possible
  await db.query("update public.profils set identite_expire_le = current_date - 1 where id = $1", [fatou]);
  expect(await badge()).toBe(false);
  expect(await appel<Ligne>(fatou, "select public.mes_verifications() as r")).toMatchObject({ identite: { valide: false } });
  await db.query("update public.profils set identite_expire_le = '2033-06-30' where id = $1", [fatou]);

  // Compte supprimé : la pièce reste 1 an, retrouvable ; la tâche du matin supprime ce qui a fait son temps
  await db.query("delete from auth.users where id = $1", [fatou]);
  const apres = await appel<Ligne[]>(admin, "select public.admin_pieces_conservees('diallo') as r");
  expect(apres).toEqual([expect.objectContaining({ id: nouvelle, compte: null, compte_supprime: true, numero_piece: "C0099887766", badge: false })]);
  await expect(faire(admin, "select public.documents_a_supprimer()")).rejects.toThrow(/permission denied/);
  const aSupprimer = async () => {
    await db.exec("set role service_role");
    try {
      return (await lignes<{ r: { id: string; fichiers: { dossier: string; chemin: string }[] }[] }>("select public.documents_a_supprimer() as r"))[0].r;
    } finally {
      await db.exec("reset role");
    }
  };
  const maintenant = await aSupprimer();
  expect(maintenant.find((x) => x.id === double)?.fichiers).toEqual([{ dossier: "documents", chemin: passeport2 }, { dossier: "documents", chemin: selfie2 }]);
  expect(maintenant.some((x) => x.id === demande || x.id === nouvelle)).toBe(false);   // encore gardées
  await db.exec("set role service_role");
  expect((await lignes<{ n: number }>("select public.documents_supprimes($1) as n", [maintenant.map((x) => x.id)]))[0].n).toBe(maintenant.length);
  await db.exec("reset role");
  expect((await aSupprimer()).some((x) => x.id === double)).toBe(false);
  await db.query("update public.verifications set conserver_jusqu_au = now() - interval '1 day' where id in ($1, $2)", [demande, nouvelle]);
  expect((await aSupprimer()).map((x) => x.id).sort()).toEqual([demande, nouvelle].sort());
});

test("Un compte par numéro et par e-mail : numéro principal, Gmail sans points ni « +… », adresses jetables, numéros partagés, libérer un numéro", async () => {
  type Ligne = Record<string, unknown>;
  const creer = (email: string, infos: Record<string, unknown>) =>
    lignes<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify(infos)]);
  const possible = (email: string, numero: string | null = null) =>
    en(db, null, async () => (await lignes<{ r: Ligne }>("select public.inscription_possible($1, $2) as r", [email, numero]))[0].r);

  // E-mail : comparé sans les points de Gmail ni « +… » ; adresses jetables refusées
  const [{ id: aya }] = await creer("Aya.Kouame@gmail.com", { prenom: "Aya", nom: "Kouamé", telephone: "+225 05 31 31 31 31" });
  expect(await possible("ayakouame+immo@gmail.com")).toEqual({ email: "deja", telephone: null });
  expect(await possible("aya.kouame@googlemail.com")).toEqual({ email: "deja", telephone: null });
  expect(await possible("aya.kouame@yahoo.fr")).toEqual({ email: null, telephone: null });
  expect(await possible("test@yopmail.com")).toEqual({ email: "jetable", telephone: null });
  await expect(creer("a.y.a.kouame+2@gmail.com", { prenom: "Aya", nom: "Bis" })).rejects.toThrow(/Cet e-mail est déjà utilisé/);
  await expect(creer("fraude@yopmail.com", { prenom: "X", nom: "Y" })).rejects.toThrow(/Adresse e-mail jetable/);

  // Numéro principal : pas deux comptes (quelle que soit l'écriture) ; le second numéro reste libre
  expect(await possible("autre@exemple.ci", "+225 0531313131")).toEqual({ email: null, telephone: "deja" });
  await expect(creer("double@exemple.ci", { prenom: "Double", nom: "Compte", telephone: "+225 05 31 31 31 31" })).rejects.toThrow(/Ce numéro est déjà utilisé/);
  const [{ id: yao }] = await creer("yao@exemple.ci", { prenom: "Yao", nom: "N'Guessan", telephone: "+225 05 32 32 32 32", telephone2: "+225 05 31 31 31 31" });
  await expect(en(db, yao, () => db.query("update public.profils set telephone = '+225 05 31 31 31 31' where id = $1", [yao])))
    .rejects.toThrow(/déjà utilisé par un autre compte.*l'équipe 360-Immo\.ci : elle peut le libérer/);
  await en(db, yao, () => db.query("update public.profils set prenom = 'Yao Jean' where id = $1", [yao]));   // le reste du profil se modifie

  // Comptes d'avant la règle qui partagent un numéro : signalés à l'équipe, qui libère le numéro
  await db.query("alter table public.profils disable trigger profils_numero_unique");
  await db.query("update public.profils set telephone = '+225 05 31 31 31 31' where id = $1", [yao]);
  await db.query("alter table public.profils enable trigger profils_numero_unique");
  await en(db, yao, () => db.query("update public.profils set nom = 'Nguessan' where id = $1", [yao]));   // pas bloqué pour autant
  await expect(en(db, yao, () => db.query("select public.admin_numeros_partages()"))).rejects.toThrow(/Réservé à l'équipe/);
  const partages = await en(db, admin, async () => (await lignes<{ r: { numero: string; comptes: Ligne[] }[] }>("select public.admin_numeros_partages() as r"))[0].r);
  expect(partages).toEqual([{ numero: "+225 05 31 31 31 31", comptes: [expect.objectContaining({ id: aya, meme_numero: 1 }), expect.objectContaining({ id: yao, meme_numero: 1 })] }]);
  await expect(en(db, admin, () => db.query("select public.liberer_numero($1, '')", [yao]))).rejects.toThrow(/Écrivez le motif/);
  await en(db, admin, () => db.query("select public.liberer_numero($1, 'Numéro réclamé par Aya Kouamé, sa propriétaire.')", [yao]));
  expect(await lignes("select telephone from public.profils where id = $1", [yao])).toEqual([{ telephone: null }]);
  expect(await en(db, admin, async () => (await lignes<{ r: unknown[] }>("select public.admin_numeros_partages() as r"))[0].r)).toEqual([]);
  expect((await lignes<{ d: Ligne }>("select donnees as d from public.notifications where profil_id = $1 and modele = 'compte' order by cree_le desc limit 1", [yao]))[0].d)
    .toMatchObject({ evenement: "numero_libere", telephone: "+225 05 31 31 31 31", motif: "Numéro réclamé par Aya Kouamé, sa propriétaire." });
  expect((await en(db, admin, async () => (await lignes<{ r: Ligne[] }>("select public.admin_journal(1) as r"))[0].r))[0])
    .toMatchObject({ decision: "numero_libere", titre: "Yao Jean Nguessan", motif: "+225 05 31 31 31 31 : Numéro réclamé par Aya Kouamé, sa propriétaire." });
});

test("Doublons : annonces semblables de l'auteur (caractéristiques, photos, annonces supprimées), jamais celles des autres ; file de l'équipe ; refus pour doublon comptés", async () => {
  type Ligne = Record<string, unknown>;
  const attecoube = await lieu(db, "Abidjan", "Attécoubé");
  const bintou = await inscrire(db, { prenom: "Bintou", nom: "Sylla" });
  const seydou = await inscrire(db, { prenom: "Seydou", nom: "Traoré" });
  const bien = (changements: Ligne = {}) =>
    annonceType(db, { ...attecoube, quartier_id: null, prix: 200000, surface: 90, etage: 1, titre: "Appartement 3 pièces à Attécoubé", ...changements });
  const creer = async (compte: string, champs: Ligne) => String((await en(db, compte, () => creerAnnonce(db, champs))).id);
  const photo = (compte: string, annonce: string, nom: string, empreinte: string | null, ordre = 0) =>
    en(db, compte, () => db.query("insert into public.photos_annonce (annonce_id, chemin, ordre, empreinte) values ($1, $2, $3, $4)",
      [annonce, `${annonce}/${nom}.webp`, ordre, empreinte]));
  const semblables = async (compte: string | null, champs: Ligne, empreintes: string[] = [], sauf: string | null = null) =>
    en(db, compte, async () => (await lignes<{ r: Ligne[] }>("select public.annonces_semblables($1::jsonb, $2::text[], $3) as r",
      [JSON.stringify(champs), empreintes, sauf]))[0].r);
  const references = (liste: Ligne[]) => liste.map((x) => x.reference);

  // Annonce en ligne de Bintou, avec une photo (empreinte : 64 bits en hexadécimal)
  const a = await creer(bintou, { ...(await bien()), statut: "en_attente" });
  await photo(bintou, a, "salon", "f0f0f0f0f0f0f0f0");
  await photo(bintou, a, "mur-blanc", "0000000000000000", 1);   // image presque unie : empreinte jamais comparée
  await expect(photo(bintou, a, "mauvaise", "pas-une-empreinte")).rejects.toThrow(/photos_annonce_empreinte/);
  await en(db, admin, () => db.query("select public.moderer_annonce($1, 'publier')", [a]));
  const [{ reference: refA }] = await lignes<{ reference: string }>("select reference from public.annonces where id = $1", [a]);

  // Même bien : prix à 10 % près, surface à 15 % près, mêmes pièces et étage
  const trouve = await semblables(bintou, await bien({ prix: 215000, surface: 100 }));
  expect(trouve).toEqual([expect.objectContaining({
    id: a, reference: refA, statut: "publiee", expiree: false, prix: 200000, loyer_par: "mois", commune: "Attécoubé", pieces: 3,
    surface: 90, etage: 1, photo: `${a}/salon.webp`, caracteristiques: true, photos: 0,
  })]);
  // Autre bien : prix trop différent, autre nombre de pièces, autre étage, autre transaction
  for (const autre of [{ prix: 260000 }, { pieces: 4, chambres: 3 }, { etage: 3 }, { transaction: "vente", loyer_par: null, caution_mois: null, prix: 25000000 }]) {
    expect(await semblables(bintou, await bien(autre))).toEqual([]);
  }
  // Mêmes photos (même légèrement différentes) : repérées, même si tout le reste change ; une image presque unie, jamais
  const terrain = { ...(await bien()), type_bien: "terrain", transaction: "vente", prix: 9000000, pieces: null, surface: 500, etage: null };
  expect(await semblables(bintou, terrain, ["f0f0f0f0f0f0f0f7", "0f0f0f0f0f0f0f0f"])).toEqual([expect.objectContaining({ id: a, caracteristiques: false, photos: 1 })]);
  expect(await semblables(bintou, terrain, ["0000000000000000"])).toEqual([]);
  // L'annonce elle-même (en cours de modification) n'est pas un doublon d'elle-même ; jamais les annonces des autres
  expect(await semblables(bintou, await bien(), [], a)).toEqual([]);
  expect(await semblables(seydou, await bien(), ["f0f0f0f0f0f0f0f0"])).toEqual([]);
  await expect(semblables(null, await bien())).rejects.toThrow(/Connectez-vous|permission denied/);

  // Supprimer puis republier : la trace de l'annonce supprimée (30 jours) se voit ; un brouillon supprimé, non
  const b = await creer(bintou, { ...(await bien({ type_bien: "maison", dans_immeuble: false, etage: null, prix: 400000 })), statut: "en_attente" });
  await photo(bintou, b, "facade", "3c3c3c3c3c3c3c3c");
  const brouillon = await creer(bintou, { ...(await bien({ type_bien: "bureau", pieces: null, chambres: null, meuble: false, etage: null, prix: 500000 })), statut: "brouillon" });
  await en(db, bintou, () => db.query("delete from public.annonces where id = any($1)", [[b, brouillon]]));
  await expect(en(db, bintou, () => lignes("select * from public.annonces_effacees"))).rejects.toThrow(/permission denied/);
  const maison = await bien({ type_bien: "maison", dans_immeuble: false, etage: null, prix: 390000 });
  expect(await semblables(bintou, maison)).toEqual([expect.objectContaining({ id: null, statut: "effacee", prix: 400000, caracteristiques: true })]);
  expect(await semblables(bintou, terrain, ["3c3c3c3c3c3c3c3d"])).toEqual([expect.objectContaining({ statut: "effacee", photos: 1 })]);
  expect(await semblables(bintou, await bien({ type_bien: "bureau", pieces: null, chambres: null, meuble: false, etage: null, prix: 500000 }))).toEqual([]);
  await db.query("update public.annonces_effacees set efface_le = now() - interval '31 days' where id = $1", [b]);
  expect(await semblables(bintou, maison)).toEqual([]);

  // La file de l'équipe : annonce semblable du même auteur, photo déjà utilisée par un autre annonceur
  const s1 = await creer(seydou, { ...(await bien({ titre: "Studio de Seydou à Attécoubé", type_bien: "appartement", pieces: 1, chambres: 0, studio: true, prix: 80000 })), statut: "en_attente" });
  await photo(seydou, s1, "piscine", "a5a5a5a5a5a5a5a5");
  const c = await creer(bintou, { ...(await bien({ prix: 205000 })), statut: "en_attente" });
  await photo(bintou, c, "salon-bis", "f0f0f0f0f0f0f0f1");
  await photo(bintou, c, "piscine-volee", "a5a5a5a5a5a5a5a4", 1);
  const file = async () => en(db, admin, async () => (await lignes<{ r: (Ligne & { doublons: Ligne; auteur: Ligne })[] }>("select public.admin_a_verifier() as r"))[0].r);
  const fiche = (await file()).find((x) => x.id === c)!;
  expect(references(fiche.doublons.semblables as Ligne[])).toEqual([refA]);
  expect((fiche.doublons.semblables as Ligne[])[0]).toMatchObject({ caracteristiques: true, photos: 1 });
  expect(fiche.doublons.photos_ailleurs).toEqual([expect.objectContaining({
    id: s1, auteur: "Seydou Traoré", paires: [{ ma_photo: `${c}/piscine-volee.webp`, sa_photo: `${s1}/piscine.webp` }],
  })]);
  expect(fiche.auteur).toMatchObject({ id: bintou, doublons_refuses: 0 });
  expect((await file()).find((x) => x.id === s1)!.doublons).toEqual({ semblables: [], photos_ailleurs: [expect.objectContaining({ id: c, auteur: "Bintou Sylla" })] });

  // Refus pour doublon : compté sur le compte ; l'e-mail le dit (avertissement au 2e)
  const refuser = (id: string, doublon: boolean) =>
    en(db, admin, () => db.query("select public.moderer_annonce($1, 'refuser', 'Annonce en double : ce bien est déjà publié.', $2)", [id, doublon]));
  const email = async (id: string) =>
    (await lignes<{ d: Ligne }>("select donnees as d from public.notifications where modele = 'moderation' and cle = $1 order by cree_le desc limit 1", [`moderation:${id}`]))[0].d;
  await refuser(c, true);
  expect(await email(c)).toMatchObject({ decision: "refusee", doublon: true, doublons: 1 });
  const d = await creer(bintou, { ...(await bien({ prix: 198000 })), statut: "en_attente" });
  expect((await file()).find((x) => x.id === d)!.auteur).toMatchObject({ doublons_refuses: 1 });
  await refuser(d, true);
  expect(await email(d)).toMatchObject({ doublon: true, doublons: 2 });
  // Un refus pour une autre raison ne compte pas ; un retrait après signalement « pour doublon » compte
  await refuser(s1, false);
  expect(await email(s1)).toMatchObject({ doublon: false, doublons: 0 });
  await en(db, null, () => db.query("select public.signaler_annonce($1, 'doublon')", [a]));
  await en(db, admin, () => db.query("select public.traiter_signalements($1, 'retirer', 'Annonce en double : ce bien est déjà publié.', true)", [a]));
  expect(await email(a)).toMatchObject({ decision: "retiree", doublon: true, doublons: 3 });
  expect(await lignes("select count(*)::int as n from public.moderations where auteur_id = $1 and doublon", [bintou])).toEqual([{ n: 3 }]);
});

test("Biens identiques disponibles : 1 d'office, de 1 à 99, jamais pour un immeuble ; lisible de tous, dans la fiche et les cartes", async () => {
  const yasmine = await inscrire(db, { prenom: "Yasmine", nom: "Ouattara" });
  const plateau = await lieu(db, "Abidjan", "Plateau");
  const champs = await annonceType(db, { ...plateau, quartier_id: null, titre: "Appartements neufs au Plateau", prix: 450000 });
  const id = String((await en(db, yasmine, () => creerAnnonce(db, { ...champs, statut: "en_attente" }))).id);
  expect(await lignes("select disponibles from public.annonces where id = $1", [id])).toEqual([{ disponibles: 1 }]);
  await en(db, yasmine, () => db.query("update public.annonces set disponibles = 6 where id = $1", [id]));
  for (const faux of [0, 100]) {
    await expect(en(db, yasmine, () => db.query("update public.annonces set disponibles = $2 where id = $1", [id, faux]))).rejects.toThrow(/annonces_disponibles/);
  }
  const immeuble = await annonceType(db, { ...plateau, quartier_id: null, type_bien: "immeuble", transaction: "vente", loyer_par: null, caution_mois: null,
    prix: 900000000, pieces: null, chambres: null, sanitaires: null, meuble: false, etage: null, commodites: [], titre: "Immeuble R+4 au Plateau", disponibles: 2 });
  await expect(en(db, yasmine, () => creerAnnonce(db, immeuble))).rejects.toThrow(/annonces_disponibles_immeuble/);
  await en(db, admin, () => db.query("select public.moderer_annonce($1, 'publier')", [id]));
  // Visiteur sans compte : la fiche et les cartes ; l'équipe : la file à vérifier
  const [{ reference }] = await lignes<{ reference: string }>("select reference from public.annonces where id = $1", [id]);
  const fiche = await en(db, null, async () => (await lignes<{ r: Record<string, unknown> }>("select public.annonce_publique($1) as r", [reference]))[0].r);
  expect(fiche).toMatchObject({ reference, disponibles: 6 });
  const cartes = await en(db, null, async () => (await lignes<{ r: { annonces: Record<string, unknown>[] } }>(
    "select public.rechercher_annonces($1::jsonb) as r", [JSON.stringify({ ville: "Abidjan", commune: "Plateau" })]))[0].r);
  expect(cartes.annonces.find((x) => x.reference === reference)).toMatchObject({ disponibles: 6 });
  await en(db, yasmine, () => db.query("update public.annonces set prix = 900000 where id = $1", [id]));   // gros changement : revérification
  const file = await en(db, admin, async () => (await lignes<{ r: Record<string, unknown>[] }>("select public.admin_a_verifier() as r"))[0].r);
  expect(file.find((x) => x.id === id)).toMatchObject({ disponibles: 6 });
});
