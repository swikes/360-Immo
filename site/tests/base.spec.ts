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
