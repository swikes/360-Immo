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
    "insert into public.visites (annonce_id, nom, telephone, creneau) values ($1, 'Test', '0102030405', now())", [b.id])))
    .rejects.toThrow(/row-level security/);
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
