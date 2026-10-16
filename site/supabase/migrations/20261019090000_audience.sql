-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — audience du site (Administration → Audience)
--
-- Mesure sans cookie ni adresse IP : le navigateur dit seulement quel genre de page est vue, d'où vient la visite
-- (Google, Facebook, WhatsApp…) et sur quel appareil ; la base n'en garde que des compteurs, par heure d'Abidjan.
-- Rien n'est rattaché à une personne ni à un compte.
--
--   audience            pages vues et visites, par jour, heure, page, source et appareil
--   campagnes           visites venues d'un lien de campagne (?utm_source=…&utm_campaign=…), par jour
--   recherches          recherches de la liste des annonces, par jour : transaction, type, lieu, tranche de budget,
--                       et si elles n'ont rien trouvé
--   introuvables        adresses de pages introuvables (liens cassés), avec leur nombre
--   noter_page(), noter_recherche(), noter_introuvable()     appelés par le site, visiteurs compris
--   annonces.envoyee_le, moderations.envoyee_le              pour le délai de vérification des annonces
--   admin_audience(jours)                                    pour l'équipe : fréquentation, sources, parcours,
--                       classements (biens les plus aimés, annonceurs, recherches), demande et offre par commune,
--                       budgets, vérification des annonces, annonces sans contact, réactivité, comptes actifs
--   pages Cookies et Confidentialité    le passage sur la mesure d'audience (s'il n'a pas déjà été réécrit)
-- ════════════════════════════════════════════════════════════════════════════

-- ══ Les compteurs ══
create table public.audience (
  jour date not null,
  heure smallint not null check (heure between 0 and 23),
  page text not null check (page in ('accueil', 'liste', 'fiche', 'vitrine', 'carte_prix', 'prix_commune', 'estimation',
    'blog', 'article', 'publier', 'compte', 'mon_espace', 'contact', 'informations', 'introuvable', 'autre')),
  source text not null check (source in ('direct', 'google', 'autres_moteurs', 'facebook', 'instagram', 'whatsapp', 'tiktok',
    'youtube', 'x', 'linkedin', 'email', 'sms', 'autre_site')),
  appareil text not null check (appareil in ('telephone', 'tablette', 'ordinateur')),
  vues integer not null default 0,
  visites integer not null default 0,
  primary key (jour, heure, page, source, appareil)
);
comment on table public.audience is 'Pages vues et visites (compteurs anonymes, heure d''Abidjan) ; écrits par noter_page()';

create table public.campagnes (
  jour date not null,
  campagne text not null check (campagne ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  source text not null,
  visites integer not null default 0,
  primary key (jour, campagne, source)
);
comment on table public.campagnes is 'Visites venues d''un lien de campagne (utm_campaign), par jour ; écrites par noter_page()';

create table public.recherches (
  jour date not null,
  transaction text not null check (transaction in ('', 'location', 'achat')),
  duree text not null check (duree in ('', 'mois', 'jour')),
  type_bien text not null,                     -- '' : tous les types ; 'plusieurs' : plusieurs types cochés
  ville text not null,
  commune text not null,
  quartier text not null,
  libre text not null,                         -- lieu écrit à la main, pas reconnu dans la liste
  budget text not null,                        -- tranche du budget maximum ('' : sans budget)
  sans_resultat boolean not null,
  nombre integer not null default 0,
  primary key (jour, transaction, duree, type_bien, ville, commune, quartier, libre, budget, sans_resultat)
);
comment on table public.recherches is 'Recherches de la liste des annonces (compteurs anonymes, par jour) ; écrites par noter_recherche()';

create table public.introuvables (
  chemin text primary key check (chemin ~ '^/' and char_length(chemin) <= 200),
  nombre integer not null default 0,
  premier_le timestamptz not null default now(),
  dernier_le timestamptz not null default now()
);
comment on table public.introuvables is 'Pages introuvables demandées (liens cassés) ; écrites par noter_introuvable()';

-- Aucune lecture ni écriture directe : seulement par les fonctions ci-dessous
alter table public.audience enable row level security;
alter table public.campagnes enable row level security;
alter table public.recherches enable row level security;
alter table public.introuvables enable row level security;
revoke all on public.audience, public.campagnes, public.recherches, public.introuvables from public, anon, authenticated;

-- Heure d'Abidjan (0 à 23) d'un instant
create function public.heure_abidjan(t timestamptz) returns smallint
language sql immutable set search_path = '' as $$
  select extract(hour from t at time zone 'Africa/Abidjan')::smallint;
$$;

-- Mot court et sans risque pour une campagne ou sa source (« Pub Octobre 2026 » → « pub-octobre-2026 ») ; null si vide
create function public.mot_campagne(t text) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(trim(both '-' from regexp_replace(lower(public.sans_accents(coalesce(t, ''))), '[^a-z0-9_]+', '-', 'g')), 40), '');
$$;


-- ══ Ce que le site envoie ══

-- Une page vue ; « visite » : première page d'une visite (arrivée sur le site). Valeurs inconnues : « autre »…
create function public.noter_page(page text, source text default 'direct', appareil text default 'ordinateur',
  visite boolean default false, campagne text default null, campagne_source text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p text := case when page in ('accueil', 'liste', 'fiche', 'vitrine', 'carte_prix', 'prix_commune', 'estimation', 'blog', 'article',
    'publier', 'compte', 'mon_espace', 'contact', 'informations', 'introuvable') then page else 'autre' end;
  s text := case when source in ('direct', 'google', 'autres_moteurs', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'youtube', 'x',
    'linkedin', 'email', 'sms') then source else 'autre_site' end;
  a text := case when appareil in ('telephone', 'tablette') then appareil else 'ordinateur' end;
  v integer := case when coalesce(visite, false) then 1 else 0 end;
  c text := public.mot_campagne(campagne);
begin
  insert into public.audience as x (jour, heure, page, source, appareil, vues, visites)
  values (public.jour_abidjan(now()), public.heure_abidjan(now()), p, s, a, 1, v)
  on conflict on constraint audience_pkey do update set vues = x.vues + 1, visites = x.visites + excluded.visites;
  if v = 1 and c is not null then
    insert into public.campagnes as x (jour, campagne, source, visites)
    values (public.jour_abidjan(now()), c, coalesce(public.mot_campagne(campagne_source), s), 1)
    on conflict on constraint campagnes_pkey do update set visites = x.visites + 1;
  end if;
end $$;

-- Tranche d'un budget maximum : loyer au mois, à la journée, ou prix de vente
create function public.tranche_budget(transaction text, duree text, budget numeric) returns text
language sql immutable set search_path = '' as $$
  select case
    when budget is null or budget <= 0 then ''
    when transaction = 'location' and duree = 'jour' then case
      when budget < 25000 then 'moins de 25 000 / jour' when budget < 50000 then '25 000 à 50 000 / jour'
      when budget < 100000 then '50 000 à 100 000 / jour' else '100 000 et plus / jour' end
    when transaction = 'location' then case
      when budget < 100000 then 'moins de 100 000 / mois' when budget < 200000 then '100 000 à 200 000 / mois'
      when budget < 300000 then '200 000 à 300 000 / mois' when budget < 500000 then '300 000 à 500 000 / mois'
      when budget < 1000000 then '500 000 à 1 million / mois' else '1 million et plus / mois' end
    when transaction = 'achat' then case
      when budget < 10000000 then 'moins de 10 millions' when budget < 25000000 then '10 à 25 millions'
      when budget < 50000000 then '25 à 50 millions' when budget < 100000000 then '50 à 100 millions'
      else '100 millions et plus' end
    else '' end;
$$;

-- Une recherche de la liste des annonces (critères comme ceux de rechercher_annonces) et son nombre de résultats
create function public.noter_recherche(criteres jsonb, resultats integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := case when jsonb_typeof(criteres) = 'object' then criteres else '{}' end;
  tx text := case when c ->> 'tx' in ('location', 'achat') then c ->> 'tx' else '' end;
  duree text := case when tx = 'location' and c ->> 'duree' in ('mois', 'jour') then c ->> 'duree' else '' end;
  types jsonb := case when jsonb_typeof(c -> 'types') = 'array' then c -> 'types' else '[]' end;
  type_bien text;
  ville text := '';
  commune text := '';
  quartier text := '';
  -- lieu écrit à la main : jamais un numéro de téléphone ni une adresse e-mail (tapés par erreur dans le champ du lieu)
  libre text := case when coalesce(c ->> 'texte', '') ~ '@|[0-9][0-9 .-]{6,}[0-9]' then '(texte masqué)'
                     else left(lower(btrim(coalesce(c ->> 'texte', ''))), 40) end;
  budget numeric;
begin
  type_bien := case jsonb_array_length(types)
    when 0 then ''
    when 1 then coalesce((select t.cle from public.types_bien t where t.cle = types ->> 0), '')
    else 'plusieurs' end;
  -- lieu reconnu : seulement les noms de la liste (ville, commune, quartier)
  select v.nom into ville from public.villes v where v.nom = c ->> 'ville';
  ville := coalesce(ville, '');
  if ville <> '' then
    select co.nom into commune from public.communes co join public.villes v on v.id = co.ville_id
     where v.nom = ville and co.nom = c ->> 'commune';
    commune := coalesce(commune, '');
  end if;
  if commune <> '' then
    select q.nom into quartier from public.quartiers q join public.communes co on co.id = q.commune_id join public.villes v on v.id = co.ville_id
     where v.nom = ville and co.nom = commune and public.sans_accents(q.nom) = public.sans_accents(c ->> 'quartier');
    quartier := coalesce(quartier, left(btrim(coalesce(c ->> 'quartier', '')), 40));
  end if;
  begin
    budget := (c ->> 'max')::numeric;
  exception when others then
    budget := null;
  end;
  insert into public.recherches as r (jour, transaction, duree, type_bien, ville, commune, quartier, libre, budget, sans_resultat, nombre)
  values (public.jour_abidjan(now()), tx, duree, type_bien, ville, commune, quartier, libre,
          public.tranche_budget(tx, duree, budget), coalesce(resultats, 0) = 0, 1)
  on conflict on constraint recherches_pkey do update set nombre = r.nombre + 1;
end $$;

-- Une page introuvable : l'adresse seulement (sans ce qui suit « ? » ou « # ») ; 2 000 adresses différentes au plus
create function public.noter_introuvable(chemin text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ch text := left(split_part(split_part(coalesce(chemin, ''), '?', 1), '#', 1), 200);
begin
  if ch !~ '^/' then
    return;
  end if;
  update public.introuvables i set nombre = i.nombre + 1, dernier_le = now() where i.chemin = ch;
  if not found and (select count(*) from public.introuvables) < 2000 then
    insert into public.introuvables as i (chemin, nombre) values (ch, 1) on conflict on constraint introuvables_pkey do update
      set nombre = i.nombre + 1, dernier_le = now();
  end if;
end $$;


-- ══ Délai de vérification des annonces ══
-- Moment où l'annonce a été envoyée pour vérification (la dernière fois), et repris dans le journal de l'équipe
alter table public.annonces add column envoyee_le timestamptz;
comment on column public.annonces.envoyee_le is 'Dernier envoi pour vérification (statut en_attente)';
alter table public.moderations add column envoyee_le timestamptz;
comment on column public.moderations.envoyee_le is 'Envoi de l''annonce pour vérification, pour le délai de la décision';

create function public.annonces_date_envoi() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.statut = 'en_attente' and (tg_op = 'INSERT' or old.statut is distinct from 'en_attente') then
    new.envoyee_le := now();
  end if;
  return new;
end $$;
-- « zz » : après les autres contrôles (les déclencheurs « before » passent par ordre alphabétique), qui peuvent
-- remettre une annonce modifiée en attente de vérification
create trigger annonces_zz_date_envoi before insert or update on public.annonces
  for each row execute function public.annonces_date_envoi();

create function public.moderations_date_envoi() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.annonce_id is not null and new.envoyee_le is null then
    select a.envoyee_le into new.envoyee_le from public.annonces a where a.id = new.annonce_id;
  end if;
  return new;
end $$;
create trigger moderations_date_envoi before insert on public.moderations
  for each row execute function public.moderations_date_envoi();


-- ══ Pour l'équipe ══
-- Tout sur une période de 7, 30, 90 ou 365 jours (jusqu'à aujourd'hui, heure d'Abidjan), comparée à celle d'avant
create function public.admin_audience(jours integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := case when jours in (7, 30, 90, 365) then jours else 30 end;
  fin date := public.jour_abidjan(now());
  debut date := public.jour_abidjan(now()) - (case when jours in (7, 30, 90, 365) then jours else 30 end - 1);
  avant date := public.jour_abidjan(now()) - (2 * case when jours in (7, 30, 90, 365) then jours else 30 end - 1);
  depuis timestamptz;
  resultat jsonb;
begin
  perform public.exiger_admin();
  depuis := (debut::timestamp at time zone 'Africa/Abidjan');

  with
  periode as (select * from public.audience where jour between debut and fin),
  en_ligne as (select * from public.annonces where statut = 'publiee' and (expire_le is null or expire_le > now())),
  stats as (select * from public.statistiques where jour between debut and fin),
  rech as (select * from public.recherches where jour between debut and fin),
  -- contacts reçus par annonce sur la période : gestes sur la fiche, messages, demandes de visite, rappels
  contacts as (
    select annonce_id, sum(nb)::integer as nb from (
      select annonce_id, numeros + appels + whatsapp + emails as nb from stats
      union all select annonce_id, 1 from public.conversations where cree_le >= depuis
      union all select annonce_id, 1 from public.visites where cree_le >= depuis
      union all select annonce_id, 1 from public.rappels where cree_le >= depuis
    ) x group by annonce_id),
  lieu_recherche as (
    select r.*, case
      when r.quartier <> '' then r.quartier || ' (' || r.commune || ')'
      when r.commune <> '' then case when r.commune = r.ville then r.ville else r.commune || ' (' || r.ville || ')' end
      when r.ville <> '' then r.ville
      when r.libre <> '' then '« ' || r.libre || ' »'
      else '' end as lieu
    from rech r)
  select jsonb_build_object(
    'jours', n, 'du', debut, 'au', fin,

    -- ── Fréquentation ──
    'totaux', jsonb_build_object(
      'vues', (select coalesce(sum(vues), 0) from periode), 'visites', (select coalesce(sum(visites), 0) from periode),
      'vues_avant', (select coalesce(sum(vues), 0) from public.audience where jour between avant and debut - 1),
      'visites_avant', (select coalesce(sum(visites), 0) from public.audience where jour between avant and debut - 1),
      'vues_aujourdhui', (select coalesce(sum(vues), 0) from public.audience where jour = fin),
      'visites_aujourdhui', (select coalesce(sum(visites), 0) from public.audience where jour = fin)),
    'par_jour', (select coalesce(jsonb_agg(jsonb_build_object('jour', d.jour, 'vues', coalesce(x.vues, 0), 'visites', coalesce(x.visites, 0))
        order by d.jour), '[]')
      from (select g::date as jour from generate_series(debut, fin, interval '1 day') g) d
      left join (select jour, sum(vues) as vues, sum(visites) as visites from periode group by jour) x on x.jour = d.jour),
    'par_heure', (select jsonb_agg(jsonb_build_object('heure', h, 'vues', coalesce(x.vues, 0), 'visites', coalesce(x.visites, 0)) order by h)
      from generate_series(0, 23) h
      left join (select heure, sum(vues) as vues, sum(visites) as visites from periode group by heure) x on x.heure = h),
    'par_jour_semaine', (select jsonb_agg(jsonb_build_object('jour', g.js, 'vues', coalesce(x.vues, 0), 'visites', coalesce(x.visites, 0))
        order by g.js)
      from generate_series(1, 7) as g(js)
      left join (select extract(isodow from jour)::integer as js, sum(vues) as vues, sum(visites) as visites from periode group by 1) x
        on x.js = g.js),
    'par_mois', (select jsonb_agg(jsonb_build_object('mois', to_char(m, 'YYYY-MM'), 'vues', coalesce(x.vues, 0), 'visites', coalesce(x.visites, 0))
        order by m)
      from generate_series(date_trunc('month', fin::timestamp) - interval '11 months', date_trunc('month', fin::timestamp), interval '1 month') m
      left join (select date_trunc('month', jour::timestamp) as mois, sum(vues) as vues, sum(visites) as visites
                   from public.audience where jour >= (date_trunc('month', fin::timestamp) - interval '11 months')::date group by 1) x
        on x.mois = m),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', page, 'vues', vues) order by vues desc, page), '[]')
      from (select page, sum(vues) as vues from periode group by page) x),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'visites', visites) order by visites desc, source), '[]')
      from (select source, sum(visites) as visites from periode group by source having sum(visites) > 0) x),
    'appareils', (select coalesce(jsonb_agg(jsonb_build_object('appareil', appareil, 'visites', visites) order by visites desc), '[]')
      from (select appareil, sum(visites) as visites from periode group by appareil having sum(visites) > 0) x),
    'campagnes', (select coalesce(jsonb_agg(jsonb_build_object('campagne', campagne, 'source', source, 'visites', visites)
        order by visites desc, campagne), '[]')
      from (select campagne, source, sum(visites) as visites from public.campagnes where jour between debut and fin
             group by campagne, source order by 3 desc limit 15) x),

    -- ── Ce que font les visiteurs ──
    'parcours', jsonb_build_object(
      'visites', (select coalesce(sum(visites), 0) from periode),
      'recherches', (select coalesce(sum(nombre), 0) from rech),
      'fiches', (select coalesce(sum(vues), 0) from stats),
      'numeros', (select coalesce(sum(numeros), 0) from stats),
      'appels', (select coalesce(sum(appels), 0) from stats),
      'whatsapp', (select coalesce(sum(whatsapp), 0) from stats),
      'emails', (select coalesce(sum(emails), 0) from stats),
      'partages', (select coalesce(sum(partages), 0) from stats),
      'messages', (select count(*) from public.conversations where cree_le >= depuis),
      'visites_demandees', (select count(*) from public.visites where cree_le >= depuis),
      'rappels', (select count(*) from public.rappels where cree_le >= depuis),
      'favoris', (select count(*) from public.favoris where cree_le >= depuis),
      'alertes', (select count(*) from public.alertes where cree_le >= depuis),
      'inscriptions', (select count(*) from public.profils where cree_le >= depuis),
      'annonces_envoyees', (select count(*) from public.annonces where envoyee_le >= depuis),
      'annonces_publiees', (select count(*) from public.moderations where decision = 'publiee' and cree_le >= depuis)),

    -- ── Classements ──
    'favoris', (select coalesce(jsonb_agg(x order by x.favoris desc, x.vues desc), '[]') from (
      select a.reference, a.titre, a.transaction, a.prix, a.loyer_par, co.nom as commune,
             a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()) as en_ligne,
             count(*)::integer as favoris, count(*) filter (where f.cree_le >= depuis)::integer as nouveaux, a.vues
        from public.favoris f join public.annonces a on a.id = f.annonce_id join public.communes co on co.id = a.commune_id
       group by a.id, co.nom order by count(*) desc, a.vues desc limit 10) x),
    'annonceurs', (select coalesce(jsonb_agg(x order by x.en_ligne desc, x.annonces desc, x.vues desc), '[]') from (
      select case when p.role = 'agence' and ag.nom is not null then ag.nom else btrim(p.prenom || ' ' || p.nom) end as nom,
             p.role = 'agence' as agence,
             count(*) filter (where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now()))::integer as en_ligne,
             count(*)::integer as annonces, coalesce(sum(a.vues), 0)::integer as vues,
             coalesce(sum(c.nb), 0)::integer as contacts
        from public.annonces a join public.profils p on p.id = a.auteur_id left join public.agences ag on ag.id = p.agence_id
        left join contacts c on c.annonce_id = a.id
       where a.statut <> 'brouillon'
       group by p.id, ag.nom order by 3 desc, 4 desc, 5 desc limit 10) x),

    -- ── Recherches ──
    'recherches', jsonb_build_object(
      'total', (select coalesce(sum(nombre), 0) from rech),
      'sans_resultat', (select coalesce(sum(nombre), 0) from rech where sans_resultat),
      'lieux', (select coalesce(jsonb_agg(x order by x.nombre desc, x.lieu), '[]') from (
        select lieu, sum(nombre)::integer as nombre, coalesce(sum(nombre) filter (where sans_resultat), 0)::integer as sans_resultat
          from lieu_recherche where lieu <> '' group by lieu order by 2 desc, 1 limit 10) x),
      'types', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
        select r.type_bien, coalesce(t.nom, case r.type_bien when '' then 'Tous les types' else 'Plusieurs types' end) as nom,
               sum(r.nombre)::integer as nombre
          from rech r left join public.types_bien t on t.cle = r.type_bien group by r.type_bien, t.nom) x),
      'transactions', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
        select transaction, duree, sum(nombre)::integer as nombre from rech group by transaction, duree) x),
      'budgets', (select coalesce(jsonb_agg(x), '[]') from (
        select transaction, duree, budget, sum(nombre)::integer as nombre
          from rech where budget <> '' group by transaction, duree, budget) x),
      'combinaisons', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
        select r.transaction, r.duree, coalesce(t.nom, case r.type_bien when '' then null else 'Plusieurs types' end) as type_nom,
               r.lieu, r.budget, sum(r.nombre)::integer as nombre
          from lieu_recherche r left join public.types_bien t on t.cle = r.type_bien
         group by 1, 2, 3, 4, 5 order by 6 desc limit 10) x),
      'sans_resultat_detail', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
        select r.transaction, r.duree, coalesce(t.nom, case r.type_bien when '' then null else 'Plusieurs types' end) as type_nom,
               r.lieu, r.budget, sum(r.nombre)::integer as nombre
          from lieu_recherche r left join public.types_bien t on t.cle = r.type_bien
         where r.sans_resultat group by 1, 2, 3, 4, 5 order by 6 desc limit 10) x)),

    -- ── Demande et offre par commune : recherches de la période, annonces en ligne aujourd'hui ──
    'demande_offre', (select coalesce(jsonb_agg(x order by x.recherches desc, x.commune), '[]') from (
      select d.ville, d.commune, d.recherches, d.location, d.achat,
             (select count(*) from public.annonces_en_ligne v where v.ville = d.ville and v.commune = d.commune)::integer as offre,
             (select count(*) from public.annonces_en_ligne v where v.ville = d.ville and v.commune = d.commune and v.transaction = 'location')::integer as offre_location,
             (select count(*) from public.annonces_en_ligne v where v.ville = d.ville and v.commune = d.commune and v.transaction = 'vente')::integer as offre_achat
        from (select ville, commune, sum(nombre)::integer as recherches,
                     coalesce(sum(nombre) filter (where transaction = 'location'), 0)::integer as location,
                     coalesce(sum(nombre) filter (where transaction = 'achat'), 0)::integer as achat
                from rech where commune <> '' group by ville, commune order by 3 desc limit 12) d) x),

    -- ── Budgets recherchés et prix des annonces en ligne, par tranche ──
    'prix_en_ligne', (select coalesce(jsonb_agg(x), '[]') from (
      select transaction, duree, budget, count(*)::integer as annonces from (
        select case v.transaction when 'vente' then 'achat' else 'location' end as transaction,
               case when v.transaction = 'location' then case when v.loyer_par in ('jour', 'nuit') then 'jour' else 'mois' end else '' end as duree,
               public.tranche_budget(case v.transaction when 'vente' then 'achat' else 'location' end,
                 case when v.loyer_par in ('jour', 'nuit') then 'jour' else 'mois' end,
                 case when v.loyer_par in ('jour', 'nuit') then v.prix when v.transaction = 'location' then public.loyer_mensuel(v.prix, v.loyer_par)
                      else v.prix end) as budget
          from public.annonces_en_ligne v) y
       group by 1, 2, 3) x),

    -- ── Vérification des annonces ──
    'verification', jsonb_build_object(
      'publiees', (select count(*) from public.moderations where decision = 'publiee' and cree_le >= depuis),
      'refusees', (select count(*) from public.moderations where decision = 'refusee' and cree_le >= depuis),
      'retirees', (select count(*) from public.moderations where decision = 'retiree' and cree_le >= depuis),
      'delai_median_heures', (select round((percentile_cont(0.5) within group (order by extract(epoch from cree_le - envoyee_le)) / 3600)::numeric, 1)
        from public.moderations where decision in ('publiee', 'refusee') and cree_le >= depuis and envoyee_le is not null and envoyee_le <= cree_le),
      'en_attente', (select count(*) from public.annonces where statut = 'en_attente'),
      'plus_ancienne_heures', (select round((extract(epoch from now() - min(coalesce(envoyee_le, modifie_le))) / 3600)::numeric, 1)
        from public.annonces where statut = 'en_attente'),
      'motifs', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
        select left(btrim(motif), 80) as motif, count(*)::integer as nombre from public.moderations
         where decision in ('refusee', 'retiree') and cree_le >= depuis and coalesce(btrim(motif), '') <> ''
         group by 1 order by 2 desc, 1 limit 5) x)),

    -- ── Annonces en ligne depuis 14 jours ou plus, sans aucun contact depuis leur publication ──
    'sans_contact', (with dormantes as (
        select a.reference, a.titre, co.nom as commune, a.vues, a.publiee_le
          from en_ligne a join public.communes co on co.id = a.commune_id
         where a.publiee_le <= now() - interval '14 days'
           and not exists (select 1 from public.statistiques s where s.annonce_id = a.id and s.numeros + s.appels + s.whatsapp + s.emails > 0)
           and not exists (select 1 from public.conversations c where c.annonce_id = a.id)
           and not exists (select 1 from public.visites v where v.annonce_id = a.id)
           and not exists (select 1 from public.rappels r where r.annonce_id = a.id))
      select jsonb_build_object('nombre', (select count(*) from dormantes), 'en_ligne', (select count(*) from en_ligne),
        'annonces', (select coalesce(jsonb_agg(d order by d.publiee_le), '[]') from (select * from dormantes order by publiee_le limit 10) d))),

    -- ── Réactivité des annonceurs (demandes reçues sur la période) ──
    'reactivite', jsonb_build_object(
      'messages', (select count(*) from public.conversations where cree_le >= depuis),
      'messages_repondus', (select count(*) from public.conversations c where c.cree_le >= depuis
        and exists (select 1 from public.messages m where m.conversation_id = c.id and m.auteur_id = c.annonceur_id)),
      'premiere_reponse_heures', (select round((percentile_cont(0.5) within group (order by extract(epoch from r.le - c.cree_le)) / 3600)::numeric, 1)
        from public.conversations c
        join lateral (select min(m.cree_le) as le from public.messages m where m.conversation_id = c.id and m.auteur_id = c.annonceur_id) r on r.le is not null
        where c.cree_le >= depuis),
      'visites', (select count(*) from public.visites where cree_le >= depuis),
      'visites_traitees', (select count(*) from public.visites where cree_le >= depuis and statut <> 'demandee'),
      'rappels', (select count(*) from public.rappels where cree_le >= depuis),
      'rappels_faits', (select count(*) from public.rappels where cree_le >= depuis and statut = 'rappele')),

    -- ── Comptes ──
    'comptes', jsonb_build_object(
      'total', (select count(*) from public.profils),
      'inscriptions', (select count(*) from public.profils where cree_le >= depuis),
      'inscriptions_avant', (select count(*) from public.profils where cree_le >= depuis - make_interval(days => n) and cree_le < depuis),
      'actifs_7', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'actifs_30', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days')),

    -- ── Pages introuvables (liens cassés), les plus demandées ──
    'introuvables', (select coalesce(jsonb_agg(x order by x.nombre desc), '[]') from (
      select chemin, nombre, dernier_le from public.introuvables order by nombre desc, dernier_le desc limit 10) x)
  ) into resultat;
  return resultat;
end $$;

revoke execute on function public.noter_page(text, text, text, boolean, text, text), public.noter_recherche(jsonb, integer),
  public.noter_introuvable(text), public.admin_audience(integer)
  from public, anon, authenticated;
grant execute on function public.noter_page(text, text, text, boolean, text, text), public.noter_recherche(jsonb, integer),
  public.noter_introuvable(text) to anon, authenticated;
grant execute on function public.admin_audience(integer) to authenticated;


-- ══ Pages Cookies et Confidentialité : la mesure d'audience, anonyme et sans cookie ══
-- Seulement si l'équipe n'a pas déjà réécrit ces passages (sinon, rien ne change : à mettre à jour dans l'Administration)
update public.pages_site set
  resume = case when resume = '360-Immo.ci n''utilise ni cookies publicitaires ni mesure d''audience : seulement ce qu''il faut pour que le site fonctionne.'
    then '360-Immo.ci n''utilise ni cookies publicitaires ni traceurs : seulement ce qu''il faut pour que le site fonctionne, et une mesure d''audience anonyme, sans cookie.'
    else resume end,
  contenu = replace(replace(contenu,
    $a$360-Immo.ci **n'utilise pas de cookies publicitaires ni d'outil de mesure d'audience**. C'est pourquoi aucun bandeau ne vous demande d'accepter des cookies.$a$,
    $b$360-Immo.ci **n'utilise pas de cookies publicitaires**, et sa mesure d'audience **n'enregistre rien sur votre appareil** (ni cookie, ni autre traceur). C'est pourquoi aucun bandeau ne vous demande d'accepter des cookies.$b$),
    $a$Si nous ajoutons un jour un outil de mesure d'audience, cette page sera mise à jour et, si la loi le demande, votre accord vous sera demandé d'abord.$a$,
    $b$Pour savoir combien de personnes visitent le site et ce qui les intéresse, chaque page vue est comptée **de façon anonyme**. Le site envoie seulement le genre de page (accueil, liste des annonces, fiche d'un bien…), d'où vient la visite (Google, Facebook, WhatsApp, lien d'une de nos campagnes…) et le type d'appareil (téléphone, tablette ou ordinateur). Les recherches de la liste des annonces (lieu, type de bien, tranche de budget) sont comptées de la même façon, ainsi que les adresses de pages introuvables.

Ces informations sont aussitôt regroupées en totaux, par heure : **ni cookie, ni adresse IP, ni identifiant**, rien qui permette de vous reconnaître ou de vous suivre d'une page ou d'un site à l'autre. Si votre navigateur demande de ne pas être suivi (réglage « Ne pas me suivre » ou « Global Privacy Control »), rien n'est compté.$b$),
  notes = case when contenu like '%Si nous ajoutons un jour un outil de mesure d''audience%'
    then coalesce(notes || E'\n', '') || '- Mesure d''audience anonyme ajoutée (totaux par heure, sans cookie ni adresse IP, « Ne pas me suivre » respecté) : vérifier qu''aucun accord des visiteurs n''est nécessaire (loi n° 2013-450, ARTCI).'
    else notes end
where slug = 'cookies';

update public.pages_site set
  contenu = replace(contenu,
    $a$360-Immo.ci n'utilise pas de cookies publicitaires ni de mesure d'audience : voir la page [Cookies](/cookies).$a$,
    $b$360-Immo.ci n'utilise pas de cookies publicitaires. Sa mesure d'audience est anonyme et n'enregistre rien sur votre appareil : voir la page [Cookies](/cookies).$b$)
where slug = 'confidentialite';
