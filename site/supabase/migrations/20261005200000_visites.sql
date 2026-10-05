-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 6, 2e partie : demandes de visite
--
-- La table des visites et ses droits existent depuis l'étape 2 (demandée par tous, même sans compte, pour une annonce
-- publiée ; vue par le demandeur et l'annonceur). Ici :
--
--   visites                + e-mail (facultatif), créneau proposé par l'annonceur, sa réponse, qui a annulé
--   visites_controler       annonce en ligne, pas la sienne, créneau dans les 60 jours, 5 demandes par jour et par
--                           numéro au plus, une seule demande en cours par bien et par numéro
--   repondre_visite()       confirmer, proposer un autre créneau, refuser (annonceur) ; accepter le créneau proposé
--                           (demandeur) ; annuler (l'un ou l'autre) — seul moyen de modifier une demande
--   mes_visites()           ses demandes reçues (avec les coordonnées du demandeur) et envoyées
--   creneaux_pris()         créneaux déjà confirmés d'un bien (sans rien sur les personnes), pour les griser
--   compteurs()             messages non lus et visites à traiter (pastille du menu)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.visites
  add column email text constraint visites_email_format
    check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column creneau_propose timestamptz,
  add column reponse text constraint visites_reponse_longueur check (reponse is null or char_length(reponse) <= 500),
  add column annulee_par text check (annulee_par in ('annonceur', 'demandeur')),
  add column modifie_le timestamptz not null default now(),
  -- numéro avec l'indicatif, comme partout sur le site (les demandes déjà enregistrées ne sont pas revérifiées)
  add constraint visites_telephone_format check (telephone ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$') not valid;

-- Une demande : pour une annonce en ligne, pas la sienne, à un créneau à venir ; contre les abus, 5 demandes par jour
-- et par numéro au plus, et une seule demande en cours par bien et par numéro
create function public.visites_controler() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.annonces_en_ligne v where v.id = new.annonce_id) then
    raise exception 'Cette annonce n''est plus en ligne.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.annonces a where a.id = new.annonce_id and a.auteur_id = auth.uid()) then
    raise exception 'C''est votre annonce : vous ne pouvez pas demander à la visiter.' using errcode = 'P0001';
  end if;
  if new.creneau < now() + interval '1 hour' or new.creneau > now() + interval '60 days' then
    raise exception 'Choisissez un créneau à venir, dans les 60 prochains jours.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.visites where telephone = new.telephone and cree_le > now() - interval '1 day') >= 5 then
    raise exception 'Vous avez déjà demandé beaucoup de visites aujourd''hui : réessayez demain.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.visites
              where annonce_id = new.annonce_id and telephone = new.telephone
                and statut in ('demandee', 'confirmee') and creneau > now()) then
    raise exception 'Vous avez déjà une demande de visite en cours pour ce bien.' using errcode = 'P0001';
  end if;
  new.nom := btrim(new.nom);
  new.email := nullif(btrim(new.email), '');
  new.message := nullif(btrim(new.message), '');
  new.statut := 'demandee';
  new.creneau_propose := null;
  new.reponse := null;
  new.annulee_par := null;
  return new;
end $$;
create trigger visites_controler before insert on public.visites
  for each row execute function public.visites_controler();

-- Une demande ne se modifie plus que par repondre_visite (règles ci-dessous)
revoke update on public.visites from authenticated;

create function public.repondre_visite(visite uuid, action text, le_creneau timestamptz default null, la_reponse text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.visites;
  annonceur boolean;
  demandeur boolean;
  mot text := nullif(btrim(la_reponse), '');
begin
  select * into v from public.visites where id = visite for update;
  if v.id is null then
    raise exception 'Demande de visite introuvable.' using errcode = 'P0001';
  end if;
  annonceur := exists (select 1 from public.annonces a where a.id = v.annonce_id and a.auteur_id = auth.uid());
  demandeur := v.demandeur_id is not null and v.demandeur_id = auth.uid();
  if not (annonceur or demandeur) then
    raise exception 'Action non autorisée pour ce compte.' using errcode = '42501';
  end if;
  if char_length(mot) > 500 then
    raise exception 'Votre réponse fait 500 caractères au plus.' using errcode = 'P0001';
  end if;
  if le_creneau is not null and (le_creneau < now() + interval '1 hour' or le_creneau > now() + interval '60 days') then
    raise exception 'Choisissez un créneau à venir, dans les 60 prochains jours.' using errcode = 'P0001';
  end if;

  if action = 'confirmer' and annonceur and v.statut = 'demandee' then
    -- le créneau demandé, ou celui convenu par téléphone
    update public.visites set statut = 'confirmee', creneau = coalesce(le_creneau, v.creneau), creneau_propose = null,
           reponse = coalesce(mot, v.reponse), modifie_le = now()
     where id = v.id;
  elsif action = 'proposer' and annonceur and v.statut = 'demandee' and le_creneau is not null then
    update public.visites set creneau_propose = le_creneau, reponse = mot, modifie_le = now() where id = v.id;
  elsif action = 'refuser' and annonceur and v.statut = 'demandee' then
    update public.visites set statut = 'annulee', annulee_par = 'annonceur', reponse = mot, modifie_le = now() where id = v.id;
  elsif action = 'accepter' and demandeur and v.statut = 'demandee' and v.creneau_propose is not null then
    update public.visites set statut = 'confirmee', creneau = v.creneau_propose, creneau_propose = null, modifie_le = now()
     where id = v.id;
  elsif action = 'annuler' and v.statut in ('demandee', 'confirmee') then
    update public.visites
       set statut = 'annulee', annulee_par = case when annonceur then 'annonceur' else 'demandeur' end,
           reponse = coalesce(mot, v.reponse), modifie_le = now()
     where id = v.id;
  else
    raise exception 'Cette action n''est plus possible pour cette demande.' using errcode = 'P0001';
  end if;
end $$;

-- Ses demandes de visite : reçues (ses annonces ; avec les coordonnées laissées par le demandeur pour être rappelé)
-- et envoyées (l'annonceur sous son nom discret, comme dans les messages)
create function public.mes_visites() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.creneau), '[]'::jsonb)
  from (
    select v.creneau, jsonb_build_object(
      'id', v.id,
      'role', case when a.auteur_id = auth.uid() then 'annonceur' else 'demandeur' end,
      'annonce', jsonb_build_object(
        'id', a.id, 'reference', a.reference, 'titre', a.titre,
        'photo', (select ph.chemin from public.photos_annonce ph where ph.annonce_id = a.id
                  order by ph.ordre, ph.cree_le limit 1),
        'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())),
      'creneau', v.creneau, 'creneau_propose', v.creneau_propose, 'statut', v.statut, 'annulee_par', v.annulee_par,
      'message', v.message, 'reponse', v.reponse, 'cree_le', v.cree_le, 'modifie_le', v.modifie_le,
      'nom', case when a.auteur_id = auth.uid() then v.nom end,
      'telephone', case when a.auteur_id = auth.uid() then v.telephone end,
      'email', case when a.auteur_id = auth.uid() then v.email end,
      'avec_compte', v.demandeur_id is not null,
      'annonceur', case when a.auteur_id = auth.uid() then null
        when a.type_vendeur = 'agence' and nullif(btrim(a.contact_nom), '') is not null then btrim(a.contact_nom)
        else public.nom_vitrine(p.prenom, p.nom, ag.nom) end
    ) as j
    from public.visites v
    join public.annonces a on a.id = v.annonce_id
    join public.profils p on p.id = a.auteur_id
    left join public.agences ag on ag.id = p.agence_id
    where a.auteur_id = auth.uid() or v.demandeur_id = auth.uid()
  ) x;
$$;

-- Créneaux déjà confirmés d'un bien (à venir) : la fenêtre « Planifier une visite » les grise
create function public.creneaux_pris(annonce uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(v.creneau order by v.creneau), '[]'::jsonb)
  from public.visites v
  where v.annonce_id = annonce and v.statut = 'confirmee' and v.creneau > now();
$$;

-- Ce qui attend le compte : messages non lus ; visites à traiter (demandes reçues sans réponse, créneaux proposés
-- en attente de son accord)
create function public.compteurs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
                  where auth.uid() in (c.client_id, c.annonceur_id) and m.auteur_id <> auth.uid() and m.lu_le is null),
    'visites', (select count(*) from public.visites v join public.annonces a on a.id = v.annonce_id
                 where v.statut = 'demandee' and v.creneau > now()
                   and ((a.auteur_id = auth.uid() and v.creneau_propose is null)
                        or (v.demandeur_id = auth.uid() and v.creneau_propose is not null))));
$$;

revoke execute on function public.repondre_visite(uuid, text, timestamptz, text), public.mes_visites(), public.compteurs()
  from public, anon;
grant execute on function public.repondre_visite(uuid, text, timestamptz, text), public.mes_visites(), public.compteurs()
  to authenticated;
grant execute on function public.creneaux_pris(uuid) to anon, authenticated;
