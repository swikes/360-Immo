-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 5 : recherche des annonces et fiche d'un bien
--
--   annonces_en_ligne        les annonces publiées et valides, avec les noms du lieu et les photos
--   rechercher_annonces()    liste filtrée (mêmes critères que la maquette), triée, par pages, avec les
--                            nombres par transaction et par type (onglets et filtres)
--   annonce_publique()       la fiche d'un bien (par sa référence IMM-2026-00001)
--   annonces_similaires()    quelques biens proches (même transaction, même type ou même commune)
--   chiffres_annonces()      nombres de l'accueil (annonces en ligne, par ville)
--   plan_du_site()           références des annonces en ligne (plan du site pour Google)
--   contact_annonce()        numéros et e-mail de l'annonceur, donnés seulement quand on les demande
--                            (bouton « Afficher le numéro ») : ils ne sont jamais écrits dans les pages
--
-- Les visiteurs sans compte ne lisent plus les numéros ni l'e-mail des annonces dans la base : seul
-- contact_annonce() les donne, annonce par annonce. La position exacte (latitude, longitude) n'est jamais
-- montrée : la fiche indique le quartier.
-- ════════════════════════════════════════════════════════════════════════════

-- « Modifiée le » ne bouge plus quand seule une vue est comptée (complète la version de l'étape 4)
create or replace function public.annonces_controler() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    if tg_op = 'INSERT' then
      if new.statut not in ('brouillon', 'en_attente') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.premium := false;
      new.premium_jusquau := null;
      new.verifiee := false;
      new.vues := 0;
      new.publiee_le := null;
      new.expire_le := null;
      new.motif_refus := null;
    else
      if new.statut is distinct from old.statut and new.statut not in ('brouillon', 'en_attente', 'archivee') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.reference := old.reference;
      new.auteur_id := old.auteur_id;
      new.premium := old.premium;
      new.premium_jusquau := old.premium_jusquau;
      new.verifiee := old.verifiee;
      new.vues := old.vues;
      new.publiee_le := old.publiee_le;
      new.expire_le := old.expire_le;
      new.motif_refus := old.motif_refus;
      -- Une annonce publiée qui change beaucoup repasse par la vérification de l'équipe
      if old.statut = 'publiee' and new.statut = 'publiee' and (
           new.transaction is distinct from old.transaction
        or new.type_bien is distinct from old.type_bien
        or new.commune_id is distinct from old.commune_id
        or new.quartier_id is distinct from old.quartier_id
        or new.quartier_texte is distinct from old.quartier_texte
        or abs(new.prix - old.prix) * 5 > old.prix            -- plus de 20 % d'écart
      ) then
        new.statut := 'en_attente';
      end if;
    end if;
  end if;
  if new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut <> 'publiee') then
    new.publiee_le := now();
    new.expire_le := now() + public.duree_validite();
    new.motif_refus := null;
  end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'vues' - 'modifie_le') is distinct from (to_jsonb(old) - 'vues' - 'modifie_le') then
    new.modifie_le := now();
  end if;
  return new;
end $$;

-- Une vue de plus : seulement sur une annonce en ligne (publiée et pas expirée)
create or replace function public.compter_vue(annonce uuid) returns void
language sql security definer set search_path = '' as $$
  update public.annonces set vues = vues + 1
   where id = annonce and statut = 'publiee' and (expire_le is null or expire_le > now());
$$;


-- ══ Ce que les visiteurs sans compte lisent des annonces : tout sauf le contact et la position exacte ══
revoke select on public.annonces from anon;
grant select (
  id, reference, agence_id, statut, transaction, type_bien, titre, description, prix, loyer_par, caution_mois,
  ville_id, commune_id, quartier_id, quartier_texte, adresse, surface, pieces, studio, chambres, sanitaires,
  meuble, dans_immeuble, etage, commodites, type_vendeur, contact_nom, contact_whatsapp,
  premium, premium_jusquau, verifiee, vues, publiee_le, expire_le
) on public.annonces to anon;


-- Texte comparable sans accents, majuscules, tirets ni apostrophes (« Port-Bouët » = « port bouet »),
-- comme la recherche de lieux du site (lib/choix-lieu.ts)
create function public.sans_accents(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(
    translate(lower(coalesce(t, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ-_''’`', 'aaaaaaceeeeiiiinooooouuuuyy  '),
    '\s+', ' ', 'g'));
$$;

-- Loyer ramené au mois (un loyer à la journée ou à la nuit compte pour 30 jours, un loyer à l'année pour 12 mois)
create function public.loyer_mensuel(prix bigint, loyer_par public.unite_loyer) returns numeric
language sql immutable set search_path = '' as $$
  select case loyer_par when 'jour' then prix * 30 when 'nuit' then prix * 30 when 'annee' then prix / 12.0 else prix end;
$$;


-- ══ Les annonces en ligne, avec les noms du lieu, les libellés du type et les photos dans l'ordre ══
create view public.annonces_en_ligne with (security_invoker = true) as
select
  a.id, a.reference, a.transaction, a.type_bien, t.nom as type_nom, a.titre, a.description,
  a.prix, a.loyer_par, a.caution_mois,
  v.nom as ville, c.nom as commune, coalesce(q.nom, a.quartier_texte) as quartier, a.adresse,
  a.ville_id, a.commune_id, a.quartier_id,
  a.surface, t.surface as surface_nom, a.pieces, a.studio, a.chambres, a.sanitaires, t.sanitaires as sanitaires_nom,
  a.meuble, a.dans_immeuble, a.etage, a.commodites,
  a.type_vendeur, a.contact_nom, a.contact_whatsapp,
  (a.premium and (a.premium_jusquau is null or a.premium_jusquau > now())) as premium,
  a.verifiee, a.vues, a.publiee_le, a.expire_le,
  coalesce(p.photos, '{}') as photos
from public.annonces a
join public.types_bien t on t.cle = a.type_bien
join public.villes v on v.id = a.ville_id
join public.communes c on c.id = a.commune_id
left join public.quartiers q on q.id = a.quartier_id
left join lateral (
  select array_agg(ph.chemin order by ph.ordre, ph.cree_le) as photos
  from public.photos_annonce ph where ph.annonce_id = a.id
) p on true
where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());

grant select on public.annonces_en_ligne to anon, authenticated;

-- Une annonce pour une carte (liste, accueil, biens similaires) : sans la description, avec la photo principale
create function public.carte_annonce(v public.annonces_en_ligne) returns jsonb
language sql stable set search_path = '' as $$
  select (to_jsonb(v) - 'description' - 'photos' - 'expire_le' - 'vues')
         || jsonb_build_object('photo', v.photos[1], 'nb_photos', coalesce(cardinality(v.photos), 0));
$$;


-- ══ Une annonce correspond-elle aux critères ? (mêmes règles que la maquette : 360-immo-resultats.html) ══
-- criteres (tous facultatifs) :
--   tx achat|location · duree jour|mois · types [cles] · ville, commune, quartier (noms) ou texte (recherche libre)
--   min, max (budget, avec une transaction : loyer ramené au mois, ou à la journée si duree = jour)
--   pieces ["studio","1".."4","5+"] · chambres ["1".."4","5+"] · sdb "1".."4+" (au moins) · caution "1".."4+" (au plus)
--   smin, smax (surface) · meuble · immeuble · etage "rdc"|"1".."4"|"5+" · com [commodités]
--   photos · recentes (7 jours) · verifiees
-- Un critère qui n'a pas de sens pour un type (pièces pour un terrain…) écarte ce type, sauf s'il a été coché.
-- sauf : critère à ignorer ('transaction' ou 'type'), pour compter les annonces de chaque onglet ou type.
create function public.annonce_correspond(v public.annonces_en_ligne, c jsonb, sauf text default '') returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select
      -- Transaction ; en location : à la journée (ou à la nuit) ou au mois (ou à l'année)
          (sauf = 'transaction' or c ->> 'tx' is null
            or (c ->> 'tx' = 'achat' and v.transaction = 'vente')
            or (c ->> 'tx' = 'location' and v.transaction = 'location'))
      and (v.transaction = 'vente' or c ->> 'duree' is null
            or (c ->> 'duree' = 'jour') = (v.loyer_par in ('jour', 'nuit')))
      -- Types de bien
      and (sauf = 'type' or x.tous_types or x.coche)
      -- Lieu : ville, commune, quartier (de la liste ou écrit à la main), ou recherche libre
      and (c ->> 'ville' is null or v.ville = c ->> 'ville')
      and (c ->> 'commune' is null or v.commune = c ->> 'commune')
      and (c ->> 'quartier' is null or public.sans_accents(v.quartier) = public.sans_accents(c ->> 'quartier'))
      and (c ->> 'texte' is null or position(public.sans_accents(c ->> 'texte') in
            public.sans_accents(concat_ws(' ', v.quartier, v.commune, v.ville, v.adresse, v.titre))) > 0)
      -- Budget (avec une transaction seulement : un loyer et un prix de vente ne se comparent pas)
      and (c ->> 'tx' is null or (
            (c ->> 'min' is null or x.prix_compare >= (c ->> 'min')::numeric)
        and (c ->> 'max' is null or x.prix_compare <= (c ->> 'max')::numeric)))
      -- Pièces et chambres : « 5+ » = 5 ou plus
      and (jsonb_array_length(coalesce(c -> 'pieces', '[]')) = 0
            or case when t.pieces <> 'non' then exists (
                 select 1 from jsonb_array_elements_text(c -> 'pieces') e
                 where (e = 'studio' and v.studio)
                    or (e ~ '^\d+\+$' and v.pieces >= left(e, -1)::integer)
                    or (e ~ '^\d+$' and v.pieces = e::integer and not v.studio))
               else x.coche end)
      and (jsonb_array_length(coalesce(c -> 'chambres', '[]')) = 0
            or case when t.chambres then exists (
                 select 1 from jsonb_array_elements_text(c -> 'chambres') e
                 where (e ~ '^\d+\+$' and v.chambres >= left(e, -1)::integer) or (e ~ '^\d+$' and v.chambres = e::integer))
               else x.coche end)
      -- Salles de bain ou toilettes : au moins ; caution : au plus (« 4+ » : peu importe)
      and (c ->> 'sdb' is null
            or case when t.sanitaires is not null then v.sanitaires >= rtrim(c ->> 'sdb', '+')::integer else x.coche end)
      and (c ->> 'caution' is null or c ->> 'caution' like '%+'
            or case when t.caution and v.transaction = 'location' then coalesce(v.caution_mois, 0) <= (c ->> 'caution')::integer
               else x.coche end)
      -- Surface
      and (c ->> 'smin' is null or (v.surface is not null and v.surface >= (c ->> 'smin')::numeric))
      and (c ->> 'smax' is null or (v.surface is not null and v.surface <= (c ->> 'smax')::numeric))
      -- Déjà meublé, dans un immeuble, étage
      and (not coalesce((c ->> 'meuble')::boolean, false) or case when t.meuble <> 'non' then v.meuble else x.coche end)
      and (not coalesce((c ->> 'immeuble')::boolean, false) or case when t.immeuble <> 'non' then v.dans_immeuble else x.coche end)
      and (c ->> 'etage' is null
            or case when t.immeuble <> 'non' then
                 case when c ->> 'etage' = 'rdc' then v.etage = 0
                      when c ->> 'etage' like '%+' then v.etage >= rtrim(c ->> 'etage', '+')::integer
                      else v.etage = (c ->> 'etage')::integer end
               else x.coche end)
      -- Commodités : chacune doit y être (si elle a un sens pour ce type)
      and not exists (
            select 1 from jsonb_array_elements_text(coalesce(c -> 'com', '[]')) e
            where not (case when e = any (t.commodites) then e = any (v.commodites) else x.coche end))
      -- Avec photos, récentes (7 jours), vérifiées
      and (not coalesce((c ->> 'photos')::boolean, false) or cardinality(v.photos) > 0)
      and (not coalesce((c ->> 'recentes')::boolean, false) or v.publiee_le > now() - interval '7 days')
      and (not coalesce((c ->> 'verifiees')::boolean, false) or v.verifiee)
    from public.types_bien t
    cross join lateral (
      select
        jsonb_array_length(coalesce(c -> 'types', '[]')) = 0 as tous_types,
        coalesce(c -> 'types' ? v.type_bien, false) as coche,
        case when v.transaction = 'location' and coalesce(c ->> 'duree', 'mois') <> 'jour'
             then public.loyer_mensuel(v.prix, v.loyer_par) else v.prix end as prix_compare
    ) x
    where t.cle = v.type_bien
  ), false);
$$;


-- ══ Recherche : une page d'annonces, le nombre total, et les nombres par transaction et par type ══
-- criteres : voir annonce_correspond(), plus tri (recent | prix_asc | prix_desc), page, par_page (48 au plus)
create function public.rechercher_annonces(criteres jsonb default '{}') returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  c jsonb := coalesce(criteres, '{}');
  par_page integer := least(48, greatest(1, coalesce((c ->> 'par_page')::integer, 24)));
  page integer := greatest(1, coalesce((c ->> 'page')::integer, 1));
  tri text := coalesce(c ->> 'tri', 'recent');
  total integer;
  cartes jsonb;
begin
  select count(*) into total from public.annonces_en_ligne v where public.annonce_correspond(v, c);
  select coalesce(jsonb_agg(public.carte_annonce(s.ligne) order by s.n), '[]') into cartes
  from (
    select v, row_number() over (
      order by
        -- Premium en tête, sauf quand on trie par prix
        case when tri = 'recent' then v.premium end desc,
        case when tri = 'prix_asc' then public.loyer_mensuel(v.prix, v.loyer_par) end asc,
        case when tri = 'prix_desc' then public.loyer_mensuel(v.prix, v.loyer_par) end desc,
        v.publiee_le desc, v.reference) as n
    from public.annonces_en_ligne v
    where public.annonce_correspond(v, c)
    order by n
    offset (page - 1) * par_page limit par_page
  ) s (ligne, n);
  return jsonb_build_object(
    'total', total, 'page', page, 'par_page', par_page, 'annonces', cartes,
    'par_transaction', (select coalesce(jsonb_object_agg(transaction, n), '{}') from (
        select v.transaction, count(*) as n from public.annonces_en_ligne v
        where public.annonce_correspond(v, c, 'transaction') group by v.transaction) x),
    'par_type', (select coalesce(jsonb_object_agg(type_bien, n), '{}') from (
        select v.type_bien, count(*) as n from public.annonces_en_ligne v
        where public.annonce_correspond(v, c, 'type') group by v.type_bien) x)
  );
end $$;

-- ══ La fiche d'un bien (référence IMM-2026-00001, majuscules ou minuscules) ; null si elle n'est pas en ligne ══
create function public.annonce_publique(numero text) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(v) from public.annonces_en_ligne v where v.reference = upper(trim(numero));
$$;

-- ══ Biens similaires : même transaction ; même type ou même commune d'abord, puis prix le plus proche ══
create function public.annonces_similaires(annonce uuid, nombre integer default 4) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.carte_annonce(s.v) order by s.rang), '[]')
  from (
    select v, row_number() over (order by
        (v.type_bien = a.type_bien)::integer * 4 + (v.commune_id = a.commune_id)::integer * 2 + (v.ville_id = a.ville_id)::integer desc,
        abs(public.loyer_mensuel(v.prix, v.loyer_par) - public.loyer_mensuel(a.prix, a.loyer_par)),
        v.publiee_le desc) as rang
    from public.annonces_en_ligne a
    join public.annonces_en_ligne v on v.id <> a.id and v.transaction = a.transaction
                                    and (v.type_bien = a.type_bien or v.commune_id = a.commune_id)
    where a.id = annonce
    order by rang limit least(greatest(nombre, 1), 12)
  ) s;
$$;

-- ══ Nombres de l'accueil ══
create function public.chiffres_annonces() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.annonces_en_ligne),
    'par_ville', (select coalesce(jsonb_object_agg(ville, n), '{}') from (
        select v.ville, count(*) as n from public.annonces_en_ligne v group by v.ville) x));
$$;

-- ══ Plan du site : les annonces en ligne ══
create function public.plan_du_site() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('reference', v.reference, 'titre', v.titre, 'publiee_le', v.publiee_le)
                            order by v.publiee_le desc), '[]')
  from public.annonces_en_ligne v;
$$;

-- ══ Contact de l'annonceur : sur demande seulement (bouton « Afficher le numéro »), annonce en ligne ══
create function public.contact_annonce(annonce uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nom', a.contact_nom, 'type_vendeur', a.type_vendeur,
    'telephone', a.contact_telephone, 'whatsapp', a.contact_whatsapp,
    'telephone2', a.contact_telephone2, 'whatsapp2', a.contact_telephone2_whatsapp,
    'email', a.contact_email)
  from public.annonces a
  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

grant execute on function
  public.sans_accents(text), public.loyer_mensuel(bigint, public.unite_loyer),
  public.carte_annonce(public.annonces_en_ligne), public.annonce_correspond(public.annonces_en_ligne, jsonb, text),
  public.rechercher_annonces(jsonb), public.annonce_publique(text), public.annonces_similaires(uuid, integer),
  public.chiffres_annonces(), public.plan_du_site(), public.contact_annonce(uuid)
to anon, authenticated;
