-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — alertes de recherche, 2e version : essentiels et souhaits
--
-- L'alerte est réglée dans une fenêtre (« Créer une alerte ») ; ses critères (criteres, v = 2) se séparent en :
--   essentiels (bloquants)   transaction, type, lieu, budget (plafond strict, minimum s'il est donné), pièces au moins,
--                            surface au moins (terrain, bureau, commerce), titre foncier (ACD) pour un terrain
--   souhaits (non bloquants) commodités, meublé, chambres au moins, salles de bain au moins, surface au moins
--                            (logement) : ils classent les annonces de l'e-mail et y sont affichés (✓ / ✗)
--
--   alerte_correspond()   une annonce en ligne passe-t-elle les essentiels ?
--   alerte_souhaits()     ses souhaits présents (ok) et absents (manque), en clair
--   preparer_alertes()    mêmes passages qu'avant ; alertes v2 : essentiels, puis classement par souhaits
--                         (les alertes créées avant gardent la recherche d'origine : annonce_correspond)
-- ════════════════════════════════════════════════════════════════════════════

create function public.alerte_correspond(v public.annonces_en_ligne, c jsonb) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select
      -- Transaction ; en location : à la journée (ou à la nuit) ou au mois (ou à l'année)
          (c ->> 'tx' is null
            or (c ->> 'tx' = 'achat' and v.transaction = 'vente')
            or (c ->> 'tx' = 'location' and v.transaction = 'location'))
      and (v.transaction = 'vente' or c ->> 'duree' is null
            or (c ->> 'duree' = 'jour') = (v.loyer_par in ('jour', 'nuit')))
      -- Type de bien
      and (jsonb_array_length(coalesce(c -> 'types', '[]')) = 0 or coalesce(c -> 'types' ? v.type_bien, false))
      -- Lieu
      and (c ->> 'ville' is null or v.ville = c ->> 'ville')
      and (c ->> 'commune' is null or v.commune = c ->> 'commune')
      and (c ->> 'quartier' is null or public.sans_accents(v.quartier) = public.sans_accents(c ->> 'quartier'))
      and (c ->> 'texte' is null or position(public.sans_accents(c ->> 'texte') in
            public.sans_accents(concat_ws(' ', v.quartier, v.commune, v.ville, v.adresse, v.titre))) > 0)
      -- Budget : plafond strict ; minimum seulement s'il est donné
      and (c ->> 'max' is null or x.prix_compare <= (c ->> 'max')::numeric)
      and (c ->> 'min' is null or x.prix_compare >= (c ->> 'min')::numeric)
      -- Pièces : au moins (un studio compte pour une pièce)
      and (c ->> 'pieces_min' is null or coalesce(v.pieces, 0) >= (c ->> 'pieces_min')::integer)
      -- Surface au moins (terrain, bureau, commerce) ; un bureau ou un commerce sans surface indiquée n'est pas écarté
      and (c ->> 'surface_min' is null
            or (v.surface is null and v.type_bien <> 'terrain')
            or v.surface >= (c ->> 'surface_min')::numeric)
      -- Terrain : titre foncier (ACD) exigé (les autres types choisis avec lui ne sont pas concernés)
      and (not coalesce((c ->> 'acd')::boolean, false) or v.type_bien <> 'terrain' or 'Titre foncier (ACD)' = any (v.commodites))
    from (
      select case when v.transaction = 'location' and coalesce(c ->> 'duree', 'mois') <> 'jour'
                  then public.loyer_mensuel(v.prix, v.loyer_par) else v.prix end as prix_compare
    ) x
  ), false);
$$;

-- Souhaits de l'alerte présents dans l'annonce (ok) et absents (manque), écrits comme dans l'e-mail
create function public.alerte_souhaits(v public.annonces_en_ligne, c jsonb) returns jsonb
language sql stable set search_path = '' as $$
  with p as (select coalesce(c -> 'souhaits', '{}'::jsonb) as s),
  liste (ordre, libelle, ok) as (
    select 1, 'Meublé', v.meuble from p where coalesce((s ->> 'meuble')::boolean, false)
    union all
    select 2, (s ->> 'chambres') || ' chambre' || case when (s ->> 'chambres')::integer > 1 then 's' else '' end || ' et +',
           coalesce(v.chambres, 0) >= (s ->> 'chambres')::integer
    from p where s ? 'chambres'
    union all
    select 3, (s ->> 'sdb') || ' salle' || case when (s ->> 'sdb')::integer > 1 then 's' else '' end || ' de bain et +',
           coalesce(v.sanitaires, 0) >= (s ->> 'sdb')::integer
    from p where s ? 'sdb'
    union all
    select 4, (s ->> 'surface') || ' m² et +', coalesce(v.surface, 0) >= (s ->> 'surface')::numeric
    from p where s ? 'surface'
    union all
    select 5, e, e = any (v.commodites)
    from p, jsonb_array_elements_text(coalesce(s -> 'com', '[]')) e
  )
  select jsonb_build_object(
    'ok', coalesce(jsonb_agg(libelle order by ordre) filter (where ok), '[]'),
    'manque', coalesce(jsonb_agg(libelle order by ordre) filter (where not ok), '[]'))
  from liste;
$$;

-- Chaque matin : alertes v2 → essentiels, puis les annonces qui ont le plus de souhaits en premier
create or replace function public.preparer_alertes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  al public.alertes;
  maintenant timestamptz := now();
  v2 boolean;
  total integer;
  cartes jsonb;
  n integer := 0;
begin
  for al in
    select * from public.alertes x
    where x.active
      and x.verifiee_le < maintenant - case when x.frequence = 'hebdomadaire' then interval '6 days 20 hours'
                                            else interval '20 hours' end
    order by x.verifiee_le
    for update skip locked
  loop
    begin
      v2 := (al.criteres ->> 'v') = '2';
      select count(*)::integer,
             coalesce(jsonb_agg(public.carte_annonce(s.v)
                                || case when v2 then jsonb_build_object('souhaits', s.souhaits) else '{}'::jsonb end
                                order by s.rang) filter (where s.rang <= 6), '[]')
        into total, cartes
      from (
        select t.v, t.souhaits,
               row_number() over (order by jsonb_array_length(t.souhaits -> 'ok') desc, (t.v).publiee_le desc, (t.v).reference) as rang
        from (
          select v, case when v2 then public.alerte_souhaits(v, al.criteres) else '{"ok": []}'::jsonb end as souhaits
          from public.annonces_en_ligne v
          where v.publiee_le > al.verifiee_le and v.publiee_le <= maintenant
            and case when v2 then public.alerte_correspond(v, al.criteres) else public.annonce_correspond(v, al.criteres) end
        ) t
      ) s;
      if total > 0 then
        insert into public.notifications (modele, profil_id, cle, donnees)
        values ('alerte', al.profil_id, 'alerte:' || al.id, jsonb_build_object(
          'alerte', jsonb_build_object('id', al.id, 'nom', al.nom, 'adresse', al.adresse, 'jeton', al.jeton,
                                       'frequence', al.frequence),
          'total', total, 'annonces', cartes));
        n := n + 1;
      end if;
      update public.alertes set verifiee_le = maintenant,
             dernier_envoi = case when total > 0 then maintenant else dernier_envoi end
       where id = al.id;
    exception when others then
      update public.alertes set verifiee_le = maintenant where id = al.id;
    end;
  end loop;
  return n;
end $$;
