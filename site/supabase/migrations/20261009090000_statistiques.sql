-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 6, dernière partie : statistiques de l'annonceur (Mon Espace → Statistiques)
--
--   statistiques               relevé par annonce et par jour (heure d'Abidjan) : vues de la fiche, numéros affichés,
--                              appels, WhatsApp, e-mails, partages ; lu seulement par statistiques_annonceur()
--   compter_vue()              une vue de plus : total de l'annonce et relevé du jour (l'auteur ne compte pas)
--   noter_action()             un geste sur la fiche : numero, appel, whatsapp, email, partage (l'auteur ne compte pas)
--   prix_comparable()          prix ramené à une base commune : loyer au mois, prix au m² d'un terrain
--   statistiques_annonceur()   pour l'auteur : sur 7, 30 ou 90 jours (et la période d'avant, pour comparer) les
--                              vues, contacts (numéros, messages, visites, rappels), favoris et envois par les alertes,
--                              jour par jour et annonce par annonce, avec le prix médian des annonces semblables en
--                              ligne (même type, transaction, commune et nombre de pièces ; 3 au moins)
-- ════════════════════════════════════════════════════════════════════════════

-- Jour d'Abidjan d'un instant (les statistiques se comptent par jour, à l'heure d'Abidjan)
create function public.jour_abidjan(t timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (t at time zone 'Africa/Abidjan')::date;
$$;

create table public.statistiques (
  annonce_id uuid not null references public.annonces on delete cascade,
  jour date not null,
  vues integer not null default 0,
  numeros integer not null default 0,
  appels integer not null default 0,
  whatsapp integer not null default 0,
  emails integer not null default 0,
  partages integer not null default 0,
  primary key (annonce_id, jour)
);
comment on table public.statistiques is 'Vues et gestes sur la fiche, par annonce et par jour ; lus par statistiques_annonceur()';
-- Aucune lecture ni écriture directe : seulement par les fonctions ci-dessous
alter table public.statistiques enable row level security;
revoke all on public.statistiques from public, anon, authenticated;

-- Une vue de plus : annonce en ligne seulement, et pas son auteur
create or replace function public.compter_vue(annonce uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.annonces set vues = vues + 1
   where id = annonce and statut = 'publiee' and (expire_le is null or expire_le > now())
     and auteur_id is distinct from auth.uid();
  if found then
    insert into public.statistiques as s (annonce_id, jour, vues) values (annonce, public.jour_abidjan(now()), 1)
    on conflict (annonce_id, jour) do update set vues = s.vues + 1;
  end if;
end $$;

-- Un geste sur la fiche : « Afficher le numéro », appeler, WhatsApp, e-mail, partager
create function public.noter_action(annonce uuid, action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if action is null or action not in ('numero', 'appel', 'whatsapp', 'email', 'partage') then
    raise exception 'Action inconnue : %', action using errcode = '22023';
  end if;
  if not exists (select 1 from public.annonces a
                  where a.id = annonce and a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())
                    and a.auteur_id is distinct from auth.uid()) then
    return;
  end if;
  insert into public.statistiques as s (annonce_id, jour, numeros, appels, whatsapp, emails, partages)
  values (annonce, public.jour_abidjan(now()), (action = 'numero')::integer, (action = 'appel')::integer,
          (action = 'whatsapp')::integer, (action = 'email')::integer, (action = 'partage')::integer)
  on conflict (annonce_id, jour) do update set
    numeros = s.numeros + excluded.numeros, appels = s.appels + excluded.appels, whatsapp = s.whatsapp + excluded.whatsapp,
    emails = s.emails + excluded.emails, partages = s.partages + excluded.partages;
end $$;

-- Prix ramené à une base commune : loyer au mois (à la journée : tel quel), prix au m² d'un terrain
create function public.prix_comparable(a public.annonces) returns numeric
language sql stable set search_path = '' as $$
  select case
    when a.type_bien = 'terrain' then case when a.surface > 0 then a.prix / a.surface end
    when a.transaction = 'location' and a.loyer_par not in ('jour', 'nuit') then public.loyer_mensuel(a.prix, a.loyer_par)
    else a.prix::numeric
  end;
$$;

create function public.statistiques_annonceur(jours integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  n integer := least(greatest(coalesce(jours, 30), 1), 365);
  fin date := public.jour_abidjan(now());
  debut date := fin - (n - 1);
  avant date := debut - n;
  resultat jsonb;
begin
  if moi is null then
    raise exception 'Connectez-vous pour voir vos statistiques.' using errcode = '42501';
  end if;

  with mes as (
    select a.*, (a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())) as en_ligne
    from public.annonces a
    where a.auteur_id = moi and a.publiee_le is not null and a.statut in ('publiee', 'archivee')
  ),
  -- Relevés du jour (vues et gestes), sur la période et celle d'avant
  releves as (
    select s.* from public.statistiques s join mes on mes.id = s.annonce_id where s.jour between avant and fin
  ),
  -- Contacts et intérêt venus d'ailleurs : messages (nouvelles conversations), visites, rappels, favoris, alertes
  evenements as (
    select c.annonce_id, public.jour_abidjan(c.cree_le) as jour, 'messages' as genre
      from public.conversations c join mes on mes.id = c.annonce_id
    union all
    select v.annonce_id, public.jour_abidjan(v.cree_le), 'visites' from public.visites v join mes on mes.id = v.annonce_id
    union all
    select r.annonce_id, public.jour_abidjan(r.cree_le), 'rappels' from public.rappels r join mes on mes.id = r.annonce_id
    union all
    select f.annonce_id, public.jour_abidjan(f.cree_le), 'favoris' from public.favoris f join mes on mes.id = f.annonce_id
    union all
    select mes.id, public.jour_abidjan(nt.cree_le), 'alertes'
      from public.notifications nt
      cross join lateral jsonb_array_elements(coalesce(nt.donnees -> 'annonces', '[]')) el
      join mes on mes.id::text = el ->> 'id'
     where nt.modele = 'alerte' and nt.statut = 'envoyee' and nt.cree_le >= (avant::timestamp at time zone 'Africa/Abidjan')
  ),
  -- Par annonce et par période (actuelle : true ; celle d'avant : false)
  r as (
    select annonce_id, jour >= debut as actuelle, sum(vues) as vues, sum(numeros) as numeros, sum(appels) as appels,
           sum(whatsapp) as whatsapp, sum(emails) as emails, sum(partages) as partages
    from releves group by 1, 2
  ),
  e as (
    select annonce_id, jour >= debut as actuelle,
           count(*) filter (where genre = 'messages') as messages, count(*) filter (where genre = 'visites') as visites,
           count(*) filter (where genre = 'rappels') as rappels, count(*) filter (where genre = 'favoris') as favoris,
           count(*) filter (where genre = 'alertes') as alertes
    from evenements where jour between avant and fin group by 1, 2
  ),
  chiffres as (
    select mes.id, p.actuelle,
           coalesce(r.vues, 0) as vues, coalesce(r.numeros, 0) as numeros, coalesce(r.appels, 0) as appels,
           coalesce(r.whatsapp, 0) as whatsapp, coalesce(r.emails, 0) as emails, coalesce(r.partages, 0) as partages,
           coalesce(e.messages, 0) as messages, coalesce(e.visites, 0) as visites, coalesce(e.rappels, 0) as rappels,
           coalesce(e.favoris, 0) as favoris, coalesce(e.alertes, 0) as alertes
    from mes cross join (values (true), (false)) p (actuelle)
    left join r on r.annonce_id = mes.id and r.actuelle = p.actuelle
    left join e on e.annonce_id = mes.id and e.actuelle = p.actuelle
  ),
  totaux as (
    select actuelle, jsonb_build_object(
      'vues', sum(vues), 'numeros', sum(numeros), 'appels', sum(appels), 'whatsapp', sum(whatsapp), 'emails', sum(emails),
      'partages', sum(partages), 'messages', sum(messages), 'visites', sum(visites), 'rappels', sum(rappels),
      'favoris', sum(favoris), 'alertes', sum(alertes)) as t
    from chiffres group by actuelle
  ),
  -- Jour par jour : vues, et contacts (numéros affichés, messages, visites, rappels)
  quotidien as (
    select d::date as jour,
           coalesce((select sum(x.vues) from releves x where x.jour = d::date), 0) as vues,
           coalesce((select sum(x.numeros) from releves x where x.jour = d::date), 0)
             + (select count(*) from evenements y where y.jour = d::date and y.genre in ('messages', 'visites', 'rappels')) as contacts
    from generate_series(debut, fin, interval '1 day') d
  ),
  -- Prix médian des annonces semblables en ligne (3 au moins)
  marche as (
    select mes.id, public.prix_comparable(a) as prix_compare, c.comparables, c.mediane
    from mes
    join public.annonces a on a.id = mes.id
    cross join lateral (
      select count(*) as comparables, percentile_cont(0.5) within group (order by public.prix_comparable(o)) as mediane
      from public.annonces o
      where o.id <> mes.id and o.statut = 'publiee' and (o.expire_le is null or o.expire_le > now())
        and o.type_bien = mes.type_bien and o.transaction = mes.transaction and o.commune_id = mes.commune_id
        and (o.loyer_par in ('jour', 'nuit')) is not distinct from (mes.loyer_par in ('jour', 'nuit'))
        and (mes.pieces is null or o.pieces = mes.pieces)
        and public.prix_comparable(o) is not null
    ) c
    where mes.en_ligne
  )
  select jsonb_build_object(
    'jours', n, 'du', debut, 'au', fin,
    'totaux', coalesce((select t from totaux where actuelle), '{}'),
    'avant', coalesce((select t from totaux where not actuelle), '{}'),
    'par_jour', (select jsonb_agg(jsonb_build_object('jour', jour, 'vues', vues, 'contacts', contacts) order by jour) from quotidien),
    'annonces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mes.id, 'reference', mes.reference, 'titre', mes.titre, 'statut', mes.statut, 'en_ligne', mes.en_ligne,
        'type_bien', mes.type_bien, 'type_nom', t.nom, 'transaction', mes.transaction, 'loyer_par', mes.loyer_par,
        'prix', mes.prix, 'surface', mes.surface, 'pieces', mes.pieces, 'commune', co.nom,
        'publiee_le', mes.publiee_le, 'expire_le', mes.expire_le,
        'photos', (select count(*) from public.photos_annonce ph where ph.annonce_id = mes.id),
        'description', char_length(coalesce(mes.description, '')),
        'vues_total', mes.vues,
        'vues', ch.vues, 'numeros', ch.numeros, 'appels', ch.appels, 'whatsapp', ch.whatsapp, 'emails', ch.emails,
        'partages', ch.partages, 'messages', ch.messages, 'visites', ch.visites, 'rappels', ch.rappels,
        'favoris', ch.favoris, 'alertes', ch.alertes,
        'favoris_total', (select count(*) from public.favoris f where f.annonce_id = mes.id),
        'prix_compare', round(m.prix_compare), 'comparables', coalesce(m.comparables, 0),
        'mediane', case when m.comparables >= 3 then round(m.mediane::numeric) end)
        order by mes.en_ligne desc, ch.vues desc, mes.publiee_le desc)
      from mes
      join chiffres ch on ch.id = mes.id and ch.actuelle
      join public.types_bien t on t.cle = mes.type_bien
      join public.communes co on co.id = mes.commune_id
      left join marche m on m.id = mes.id
    ), '[]')
  ) into resultat;
  return resultat;
end $$;

revoke execute on function public.noter_action(uuid, text), public.statistiques_annonceur(integer),
  public.prix_comparable(public.annonces), public.jour_abidjan(timestamptz) from public;
grant execute on function public.noter_action(uuid, text) to anon, authenticated;
grant execute on function public.statistiques_annonceur(integer) to authenticated;
grant execute on function public.jour_abidjan(timestamptz) to anon, authenticated;
