-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — vitrine de chaque annonceur (particulier ou agence)
--
-- Chaque compte a une vitrine : une page avec toutes ses annonces en ligne, que l'on peut filtrer et partager
-- (/annonceur/awa-k-k7p2qx). Elle est désignée par un petit code (profils.code_vitrine), qui ne dit rien du compte.
-- Nom affiché : celui de l'agence quand le compte est rattaché à une agence (validée par 360-Immo.ci), sinon le
-- prénom et l'initiale du nom (« Awa K. »), par discrétion.
--
--   annonceur_public()   code, nom affiché, agence ou non, d'une annonce en ligne (pour la vue annonces_en_ligne)
--   annonces_en_ligne    + annonceur, annonceur_nom, annonceur_agence, annonceur_verifie
--   rechercher_annonces  + critère « annonceur » (code de vitrine)
--   vitrine()            l'en-tête d'une vitrine : nom, agence, nombre d'annonces en ligne, membre depuis
-- ════════════════════════════════════════════════════════════════════════════

-- Code de vitrine : 6 lettres ou chiffres faciles à lire (sans i, l, o, 0, 1)
create function public.nouveau_code_vitrine() returns text
language plpgsql volatile set search_path = '' as $$
declare
  code text;
begin
  loop
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::integer, 1), '')
      into code from generate_series(1, 6);
    exit when not exists (select 1 from public.profils where code_vitrine = code);
  end loop;
  return code;
end $$;

alter table public.profils add column code_vitrine text unique check (code_vitrine ~ '^[a-z0-9]{6}$');
update public.profils set code_vitrine = public.nouveau_code_vitrine() where code_vitrine is null;
alter table public.profils
  alter column code_vitrine set default public.nouveau_code_vitrine(),
  alter column code_vitrine set not null;

-- Le code ne se change pas soi-même (complète la version de l'étape 3)
create or replace function public.profils_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.role := old.role;
    new.agence_id := old.agence_id;
    new.demande_agence_le := old.demande_agence_le;
    new.code_vitrine := old.code_vitrine;
  end if;
  if new.demande_agence is distinct from old.demande_agence then
    new.demande_agence := nullif(btrim(new.demande_agence), '');
    new.demande_agence_le := case when new.demande_agence is null then null else now() end;
  end if;
  new.id := old.id;
  return new;
end $$;

-- Nom affiché sur la vitrine et les annonces : l'agence (rattachée par 360-Immo.ci), sinon « Prénom I. »
create function public.nom_vitrine(prenom text, nom text, agence text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    nullif(btrim(agence), ''),
    nullif(btrim(btrim(prenom) || ' ' || coalesce(nullif(upper(left(btrim(nom), 1)), '') || '.', '')), ''),
    'Annonceur');
$$;

-- L'annonceur d'une annonce en ligne, tel que les visiteurs le voient (le compte lui-même reste caché)
create function public.annonceur_public(annonce uuid)
returns table (code text, nom text, agence boolean, verifiee boolean)
language sql stable security definer set search_path = '' as $$
  select p.code_vitrine, public.nom_vitrine(p.prenom, p.nom, ag.nom),
         p.agence_id is not null or p.role = 'agence', coalesce(ag.verifiee, false)
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  left join public.agences ag on ag.id = p.agence_id
  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());
$$;

-- Les annonces en ligne, avec leur annonceur (colonnes ajoutées à la fin)
create or replace view public.annonces_en_ligne with (security_invoker = true) as
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
  coalesce(p.photos, '{}') as photos,
  an.code as annonceur, an.nom as annonceur_nom, an.agence as annonceur_agence, an.verifiee as annonceur_verifie
from public.annonces a
join public.types_bien t on t.cle = a.type_bien
join public.villes v on v.id = a.ville_id
join public.communes c on c.id = a.commune_id
left join public.quartiers q on q.id = a.quartier_id
left join lateral (
  select array_agg(ph.chemin order by ph.ordre, ph.cree_le) as photos
  from public.photos_annonce ph where ph.annonce_id = a.id
) p on true
left join lateral public.annonceur_public(a.id) an on true
where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());

-- La recherche, avec le critère « annonceur » (code de vitrine)
create or replace function public.annonce_correspond(v public.annonces_en_ligne, c jsonb, sauf text default '') returns boolean
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
      -- Annonceur (sa vitrine)
      and (c ->> 'annonceur' is null or v.annonceur = c ->> 'annonceur')
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

-- En-tête d'une vitrine (null si le code n'existe pas)
create function public.vitrine(code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', p.code_vitrine,
    'nom', public.nom_vitrine(p.prenom, p.nom, ag.nom),
    'agence', p.agence_id is not null or p.role = 'agence',
    'verifiee', coalesce(ag.verifiee, false),
    'membre_depuis', p.cree_le,
    'total', (select count(*) from public.annonces a
              where a.auteur_id = p.id and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())))
  from public.profils p
  left join public.agences ag on ag.id = p.agence_id
  where p.code_vitrine = lower(btrim(code));
$$;

grant execute on function public.nom_vitrine(text, text, text), public.annonceur_public(uuid), public.vitrine(text)
to anon, authenticated;
