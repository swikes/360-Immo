-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — prix du marché : estimation d'un bien, carte des prix, pages « Prix de l'immobilier à Cocody »
--
-- Les seuls prix connus sont ceux DEMANDÉS dans les annonces : les prix de vente réels ne sont publiés nulle part en
-- Côte d'Ivoire. Chaque page le dit. Annonces prises en compte : celles en ligne, et celles mises en ligne depuis moins
-- de 6 mois puis terminées (expirées, louées, vendues, retirées par leur auteur) ; jamais un brouillon, une annonce en
-- attente, refusée ou retirée par l'équipe.
--
-- Un bien se compare à un bien entier (« un 3 pièces à Cocody se loue autour de 300 000 FCFA par mois ») : c'est ainsi
-- qu'on raisonne ici, et la surface est facultative sauf pour un terrain. Seul un terrain à vendre se compte au m².
--
--   unite_marche(), valeur_marche()  le prix ramené à une base commune : loyer au mois (à la nuit, au jour pour un
--                                    court séjour), prix total, ou prix au m² d'un terrain à vendre
--   annonces_marche()   (interne) les annonces prises en compte, rangées par groupe : transaction, type, unité,
--                       pièces (1 à 4, puis « 5 et plus » ; un studio compte pour 1), meublé (location)
--   statistiques_prix() nombre, prix du milieu et fourchette habituelle (du quart le moins cher au quart le plus cher),
--                       après avoir écarté les prix aberrants (3 fois plus haut ou plus bas que le prix du milieu)
--   seuil_prix()        5 annonces au moins pour donner un prix ; en dessous : « pas encore assez d'annonces »
--   estimer_bien()      pour tous : le prix des biens semblables dans le quartier, sinon la commune, sinon la ville
--   prix_communes()     pour tous : carte des prix (un type de bien, commune par commune)
--   prix_commune()      pour tous : page d'une commune (tous les types de bien)
--   communes_avec_prix() pour tous : les communes qui ont au moins un prix (plan du site pour Google)
--   releves_prix        relevé de chaque mois, pour montrer l'évolution des prix dans quelques mois ;
--                       relever_prix() le fait chaque matin s'il manque (tâche de 7 h, clé secrète)
-- ════════════════════════════════════════════════════════════════════════════

create function public.seuil_prix() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;

-- 'prix' (vente), 'm2' (terrain à vendre), 'mois' (location au mois ou à l'année), 'jour' ou 'nuit' (court séjour)
create function public.unite_marche(a public.annonces) returns text
language sql immutable set search_path = '' as $$
  select case
    when a.transaction = 'vente' then case when a.type_bien = 'terrain' then 'm2' else 'prix' end
    when a.loyer_par in ('jour', 'nuit') then a.loyer_par::text
    else 'mois'
  end;
$$;

create function public.valeur_marche(a public.annonces) returns numeric
language sql immutable set search_path = '' as $$
  select case
    when a.transaction = 'vente' and a.type_bien = 'terrain' then case when a.surface > 0 then round(a.prix / a.surface) end
    when a.transaction = 'location' and a.loyer_par in ('mois', 'annee') then round(public.loyer_mensuel(a.prix, a.loyer_par))
    else a.prix::numeric
  end;
$$;

create function public.annonces_marche() returns table (
  id uuid, reference text, en_ligne boolean, transaction public.transaction_bien, type_bien text, unite text,
  pieces smallint, meuble boolean, ville_id smallint, commune_id integer, quartier_id integer, valeur numeric
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.reference,
         a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()),
         a.transaction, a.type_bien, public.unite_marche(a),
         case when t.pieces <> 'non' then least(a.pieces, 5)::smallint end,
         case when a.transaction = 'location' and t.meuble = 'option' then a.meuble end,
         a.ville_id, a.commune_id, a.quartier_id, public.valeur_marche(a)
    from public.annonces a
    join public.types_bien t on t.cle = a.type_bien
   where a.publiee_le is not null
     and ((a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()))
          or (a.statut in ('publiee', 'archivee') and a.publiee_le > now() - interval '6 months'))
     and public.valeur_marche(a) > 0;
$$;

create function public.statistiques_prix(valeurs numeric[]) returns jsonb
language sql immutable set search_path = '' as $$
  with v as (select x from unnest(valeurs) x where x > 0),
       m as (select percentile_cont(0.5) within group (order by x) as milieu from v),
       g as (select x from v, m where x between m.milieu / 3 and m.milieu * 3)
  select jsonb_build_object(
    'nombre', (select count(*) from g),
    'mediane', (select round((percentile_cont(0.5) within group (order by x))::numeric) from g),
    'bas', (select round((percentile_cont(0.25) within group (order by x))::numeric) from g),
    'haut', (select round((percentile_cont(0.75) within group (order by x))::numeric) from g)
  );
$$;

-- Ville, commune et quartier d'après leurs noms (ceux de lib/lieux.ts) ; quartier ignoré s'il n'est pas de la commune
create function public.lieu_marche(ville text, commune text, quartier text default null)
returns table (ville_id smallint, commune_id integer, quartier_id integer, communes_de_la_ville integer)
language sql stable set search_path = '' as $$
  select v.id, c.id, q.id, (select count(*)::integer from public.communes c2 where c2.ville_id = v.id)
    from public.villes v
    join public.communes c on c.ville_id = v.id and c.nom = commune
    left join public.quartiers q on q.commune_id = c.id and q.nom = quartier
   where v.nom = ville;
$$;

-- ══ Estimation d'un bien ══
-- bien : { transaction, type_bien (clé : appartement…), unite ('mois', 'jour' ou 'nuit' en location), ville, commune,
--          quartier, pieces, meuble }
-- Réponse : le prix du milieu et la fourchette des biens semblables au niveau le plus proche qui a assez d'annonces
-- (niveau null : pas assez nulle part), les niveaux essayés, et jusqu'à 6 annonces en ligne proches du prix du milieu
-- (leurs identifiants, pour cartes_annonces() ; jamais une annonce au prix aberrant).
create function public.estimer_bien(bien jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.types_bien;
  l record;
  tx public.transaction_bien;
  u text;
  nb_pieces smallint;
  avec_meuble boolean;
  niveau text;
  nom_lieu text;
  s jsonb;
  essais jsonb := '[]';
  references_proches jsonb := '[]';
begin
  if coalesce(bien ->> 'transaction', '') not in ('vente', 'location') then return null; end if;
  tx := (bien ->> 'transaction')::public.transaction_bien;
  select * into t from public.types_bien where cle = bien ->> 'type_bien';
  if t.cle is null or (tx = 'vente' and not t.vendable) then return null; end if;
  select * into l from public.lieu_marche(bien ->> 'ville', bien ->> 'commune', bien ->> 'quartier');
  if l.commune_id is null then return null; end if;

  u := case
    when tx = 'vente' then case when t.cle = 'terrain' then 'm2' else 'prix' end
    when t.cle = 'hotel' then 'nuit'
    when bien ->> 'unite' in ('jour', 'nuit') and bien ->> 'unite' = any (t.loyer_par::text[]) then bien ->> 'unite'
    else 'mois'
  end;
  if t.pieces <> 'non' and bien ->> 'pieces' ~ '^[0-9]{1,2}$' and (bien ->> 'pieces')::integer >= 1 then
    nb_pieces := least((bien ->> 'pieces')::integer, 5);
  end if;
  if tx = 'location' and t.meuble = 'option' then
    avec_meuble := case when jsonb_typeof(bien -> 'meuble') = 'boolean' then (bien ->> 'meuble')::boolean else false end;
  end if;

  foreach niveau in array array['quartier', 'commune', 'ville'] loop
    continue when niveau = 'quartier' and l.quartier_id is null;
    -- une ville d'une seule commune : la ville, c'est la commune
    continue when niveau = 'ville' and l.communes_de_la_ville = 1;
    select public.statistiques_prix(array_agg(m.valeur)) into s
      from public.annonces_marche() m
     where m.transaction = tx and m.type_bien = t.cle and m.unite = u
       and (nb_pieces is null or m.pieces = nb_pieces)
       and (avec_meuble is null or m.meuble = avec_meuble)
       and case niveau when 'quartier' then m.quartier_id = l.quartier_id
                       when 'commune' then m.commune_id = l.commune_id
                       else m.ville_id = l.ville_id end;
    nom_lieu := case niveau
      when 'quartier' then (select q.nom from public.quartiers q where q.id = l.quartier_id)
      when 'commune' then (select c.nom from public.communes c where c.id = l.commune_id)
      else (select v.nom from public.villes v where v.id = l.ville_id) end;
    essais := essais || jsonb_build_object('niveau', niveau, 'lieu', nom_lieu, 'nombre', (s ->> 'nombre')::integer);
    if (s ->> 'nombre')::integer >= public.seuil_prix() then
      select coalesce(jsonb_agg(r.id order by r.ecart, r.reference), '[]') into references_proches
        from (select m.id, m.reference, abs(m.valeur - (s ->> 'mediane')::numeric) as ecart
                from public.annonces_marche() m
               where m.en_ligne and m.transaction = tx and m.type_bien = t.cle and m.unite = u
                 and m.valeur between (s ->> 'mediane')::numeric / 3 and (s ->> 'mediane')::numeric * 3
                 and (nb_pieces is null or m.pieces = nb_pieces)
                 and (avec_meuble is null or m.meuble = avec_meuble)
                 and case niveau when 'quartier' then m.quartier_id = l.quartier_id
                                 when 'commune' then m.commune_id = l.commune_id
                                 else m.ville_id = l.ville_id end
               order by 3, 2 limit 6) r;
      return jsonb_build_object(
        'unite', u, 'niveau', niveau, 'lieu', nom_lieu, 'nombre', (s ->> 'nombre')::integer,
        'mediane', (s ->> 'mediane')::numeric, 'bas', (s ->> 'bas')::numeric, 'haut', (s ->> 'haut')::numeric,
        'essais', essais, 'annonces', references_proches);
    end if;
  end loop;
  return jsonb_build_object('unite', u, 'niveau', null, 'lieu', null, 'nombre', 0,
    'mediane', null, 'bas', null, 'haut', null, 'essais', essais, 'annonces', '[]'::jsonb);
end $$;

-- ══ Carte des prix : un type de bien, commune par commune ══
-- choix : { transaction, type_bien, unite, pieces, meuble } (mêmes clés que estimer_bien ; pieces et meuble facultatifs :
-- sans eux, toutes les tailles, meublés ou non). Une ligne par commune qui a au moins une annonce ; le prix seulement à
-- partir de seuil_prix() annonces.
create function public.prix_communes(choix jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.types_bien;
  tx public.transaction_bien;
  u text;
  nb_pieces smallint;
  avec_meuble boolean;
begin
  if coalesce(choix ->> 'transaction', '') not in ('vente', 'location') then return '[]'; end if;
  tx := (choix ->> 'transaction')::public.transaction_bien;
  select * into t from public.types_bien where cle = choix ->> 'type_bien';
  if t.cle is null or (tx = 'vente' and not t.vendable) then return '[]'; end if;
  u := case
    when tx = 'vente' then case when t.cle = 'terrain' then 'm2' else 'prix' end
    when t.cle = 'hotel' then 'nuit'
    when choix ->> 'unite' in ('jour', 'nuit') and choix ->> 'unite' = any (t.loyer_par::text[]) then choix ->> 'unite'
    else 'mois'
  end;
  if t.pieces <> 'non' and choix ->> 'pieces' ~ '^[0-9]{1,2}$' and (choix ->> 'pieces')::integer >= 1 then
    nb_pieces := least((choix ->> 'pieces')::integer, 5);
  end if;
  if tx = 'location' and t.meuble = 'option' and choix ? 'meuble' and jsonb_typeof(choix -> 'meuble') = 'boolean' then
    avec_meuble := (choix ->> 'meuble')::boolean;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'ville', v.nom, 'commune', c.nom, 'nombre', (g.s ->> 'nombre')::integer,
             'mediane', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'mediane')::numeric end,
             'bas', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'bas')::numeric end,
             'haut', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'haut')::numeric end)
           order by v.nom, c.nom)
      from (select m.commune_id, public.statistiques_prix(array_agg(m.valeur)) as s
              from public.annonces_marche() m
             where m.transaction = tx and m.type_bien = t.cle and m.unite = u
               and (nb_pieces is null or m.pieces = nb_pieces)
               and (avec_meuble is null or m.meuble = avec_meuble)
             group by m.commune_id) g
      join public.communes c on c.id = g.commune_id
      join public.villes v on v.id = c.ville_id
     where (g.s ->> 'nombre')::integer > 0
  ), '[]');
end $$;

-- ══ Page d'une commune : tous les types de bien, par transaction, unité, nombre de pièces et meublé ══
-- null si la commune n'existe pas ; « en_ligne » : annonces de la commune en ligne aujourd'hui (tous types)
create function public.prix_commune(ville text, commune text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'ville', ville, 'commune', commune,
    'en_ligne', (select count(*) from public.annonces_marche() m where m.en_ligne and m.commune_id = l.commune_id),
    'groupes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'transaction', g.transaction, 'type_bien', g.type_bien, 'unite', g.unite, 'pieces', g.pieces, 'meuble', g.meuble,
               'nombre', (g.s ->> 'nombre')::integer,
               'mediane', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'mediane')::numeric end,
               'bas', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'bas')::numeric end,
               'haut', case when (g.s ->> 'nombre')::integer >= public.seuil_prix() then (g.s ->> 'haut')::numeric end)
             order by g.transaction desc, t.ordre, g.unite, g.pieces nulls first, g.meuble nulls first)
        from (select m.transaction, m.type_bien, m.unite, m.pieces, m.meuble, public.statistiques_prix(array_agg(m.valeur)) as s
                from public.annonces_marche() m
               where m.commune_id = l.commune_id
               group by m.transaction, m.type_bien, m.unite, m.pieces, m.meuble) g
        join public.types_bien t on t.cle = g.type_bien
       where (g.s ->> 'nombre')::integer > 0
    ), '[]'))
  from public.lieu_marche(ville, commune) l;
$$;

-- ══ Communes qui ont au moins un prix (5 annonces semblables) : leur page va dans le plan du site pour Google ══
create function public.communes_avec_prix() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('ville', v.nom, 'commune', c.nom) order by v.nom, c.nom), '[]')
    from public.communes c
    join public.villes v on v.id = c.ville_id
   where c.id in (
     select g.commune_id
       from (select m.commune_id, public.statistiques_prix(array_agg(m.valeur)) as s
               from public.annonces_marche() m
              group by m.commune_id, m.transaction, m.type_bien, m.unite, m.pieces, m.meuble) g
      where (g.s ->> 'nombre')::integer >= public.seuil_prix());
$$;

-- ══ Relevé de chaque mois (évolution des prix) ══
create table public.releves_prix (
  mois date not null,                                   -- premier jour du mois (heure d'Abidjan)
  commune_id integer not null references public.communes on delete cascade,
  transaction public.transaction_bien not null,
  type_bien text not null references public.types_bien,
  unite text not null check (unite in ('prix', 'm2', 'mois', 'jour', 'nuit')),
  pieces smallint,                                      -- 1 à 5 (5 : 5 et plus) ; null : type sans pièces
  meuble boolean,                                       -- location ; null : vente, ou type jamais ou toujours meublé
  nombre integer not null,
  mediane numeric,
  bas numeric,
  haut numeric,
  constraint releves_prix_groupe unique nulls not distinct (mois, commune_id, transaction, type_bien, unite, pieces, meuble)
);
comment on table public.releves_prix is 'Prix demandés relevés une fois par mois, par commune et par groupe de biens (relever_prix)';
alter table public.releves_prix enable row level security;
revoke all on public.releves_prix from public, anon, authenticated;

-- Une fois par mois : le premier appel du mois relève les prix ; les suivants ne font rien (renvoie le nombre de groupes)
create function public.relever_prix() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  debut date := date_trunc('month', now() at time zone 'Africa/Abidjan')::date;
  n integer;
begin
  if exists (select 1 from public.releves_prix where mois = debut) then return 0; end if;
  insert into public.releves_prix (mois, commune_id, transaction, type_bien, unite, pieces, meuble, nombre, mediane, bas, haut)
  select debut, g.commune_id, g.transaction, g.type_bien, g.unite, g.pieces, g.meuble, (g.s ->> 'nombre')::integer,
         (g.s ->> 'mediane')::numeric, (g.s ->> 'bas')::numeric, (g.s ->> 'haut')::numeric
    from (select m.commune_id, m.transaction, m.type_bien, m.unite, m.pieces, m.meuble,
                 public.statistiques_prix(array_agg(m.valeur)) as s
            from public.annonces_marche() m
           group by m.commune_id, m.transaction, m.type_bien, m.unite, m.pieces, m.meuble) g
   where (g.s ->> 'nombre')::integer > 0;
  get diagnostics n = row_count;
  return n;
end $$;

-- ══ Droits ══
revoke execute on function public.annonces_marche(), public.relever_prix() from public, anon, authenticated;
grant execute on function public.relever_prix() to service_role;
revoke execute on function public.estimer_bien(jsonb), public.prix_communes(jsonb), public.prix_commune(text, text),
  public.communes_avec_prix() from public;
grant execute on function public.estimer_bien(jsonb), public.prix_communes(jsonb), public.prix_commune(text, text),
  public.communes_avec_prix() to anon, authenticated;
