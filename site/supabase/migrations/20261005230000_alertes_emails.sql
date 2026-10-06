-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 6, 3e partie : alertes de recherche et e-mails
--
--   alertes                 + adresse de la recherche (/annonces?…), jeton du lien « Arrêter cette alerte » (sans
--                           connexion), date à partir de laquelle une annonce est nouvelle ; 10 alertes par compte,
--                           pas deux fois la même recherche
--   profils                 + e-mails souhaités : nouveaux messages, demandes de visite, fin des annonces
--   notifications           file des e-mails à envoyer ; lue et vidée par le site avec la clé secrète (jamais par les
--                           visiteurs ni par les comptes)
--   déclencheurs            nouveau message (un e-mail par conversation et par heure au plus), demande de visite et
--                           réponses (au visiteur sans compte aussi, s'il a laissé son e-mail)
--   preparer_alertes()      chaque matin : nouvelles annonces de chaque alerte (chaque jour ou chaque semaine)
--   preparer_rappels()      chaque matin : annonces qui expirent dans les 3 jours
--   notifications_a_envoyer(), notification_envoyee()   pour le programme d'envoi (app/api/notifications)
--   alerte_par_jeton(), arreter_alerte()                lien « Arrêter cette alerte » des e-mails
-- ════════════════════════════════════════════════════════════════════════════

-- ══ Alertes ══
alter table public.alertes
  add column adresse text not null default '/annonces'
    constraint alertes_adresse_format check (adresse ~ '^/annonces(\?.*)?$' and char_length(adresse) <= 600),
  add column jeton uuid not null default gen_random_uuid() unique,
  add column verifiee_le timestamptz not null default now(),   -- annonces publiées après : nouvelles
  add column dernier_envoi timestamptz;
create unique index alertes_une_fois on public.alertes (profil_id, adresse);

-- 10 alertes par compte ; le jeton et les dates ne se choisissent pas soi-même
create function public.alertes_controler() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.alertes where profil_id = new.profil_id) >= 10 then
      raise exception 'Vous avez déjà 10 alertes : supprimez-en une pour en créer une autre.' using errcode = 'P0001';
    end if;
    new.jeton := gen_random_uuid();
    new.verifiee_le := now();
    new.dernier_envoi := null;
    new.cree_le := now();
  elsif current_user in ('anon', 'authenticated') then
    new.profil_id := old.profil_id;
    new.jeton := old.jeton;
    new.verifiee_le := old.verifiee_le;
    new.dernier_envoi := old.dernier_envoi;
    new.cree_le := old.cree_le;
    -- réactivée, ou recherche changée : seulement les annonces publiées à partir de maintenant
    if (new.active and not old.active) or new.criteres is distinct from old.criteres then
      new.verifiee_le := now();
    end if;
  end if;
  new.nom := btrim(new.nom);
  return new;
end $$;
create trigger alertes_controler before insert or update on public.alertes
  for each row execute function public.alertes_controler();

-- ══ E-mails souhaités (Mon Espace → Paramètres) ══
alter table public.profils
  add column emails_messages boolean not null default true,
  add column emails_visites boolean not null default true,
  add column emails_annonces boolean not null default true;

-- ══ File des e-mails ══
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  modele text not null check (modele in ('message', 'visite', 'alerte', 'fin_annonce')),
  -- destinataire : un compte, ou une adresse laissée sans compte (demande de visite)
  profil_id uuid references public.profils on delete cascade,
  email text,
  -- regroupement : « message:<conversation> », « alerte:<alerte> », « fin:<annonce>:<date de fin> »
  cle text,
  donnees jsonb not null default '{}',
  statut text not null default 'a_envoyer' check (statut in ('a_envoyer', 'envoyee', 'inutile', 'echec', 'perimee')),
  essais integer not null default 0,
  prise_le timestamptz,
  envoyee_le timestamptz,
  erreur text,
  cree_le timestamptz not null default now(),
  constraint notifications_destinataire check (profil_id is not null or email is not null)
);
create index notifications_en_attente on public.notifications (cree_le) where statut = 'a_envoyer';
create index notifications_cle on public.notifications (profil_id, cle, cree_le);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

-- Nom affiché de l'annonceur d'une annonce : l'agence (nom de l'annonce), sinon « Awa K. »
create function public.nom_annonceur(annonce uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when a.type_vendeur = 'agence' and nullif(btrim(a.contact_nom), '') is not null then btrim(a.contact_nom)
              else public.nom_vitrine(p.prenom, p.nom, ag.nom) end
  from public.annonces a
  join public.profils p on p.id = a.auteur_id
  left join public.agences ag on ag.id = p.agence_id
  where a.id = annonce;
$$;
revoke execute on function public.nom_annonceur(uuid) from public, anon, authenticated;

-- Nouveau message : e-mail au destinataire (s'il le souhaite), un par conversation et par heure au plus
create function public.messages_notifier() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  a public.annonces;
  dest uuid;
  de text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  dest := case when new.auteur_id = c.client_id then c.annonceur_id else c.client_id end;
  if not coalesce((select p.emails_messages from public.profils p where p.id = dest), false)
     or exists (select 1 from public.notifications n
                 where n.profil_id = dest and n.cle = 'message:' || c.id and n.cree_le > now() - interval '1 hour') then
    return null;
  end if;
  select * into a from public.annonces where id = c.annonce_id;
  de := case when new.auteur_id = c.annonceur_id then public.nom_annonceur(a.id)
             else (select public.nom_vitrine(p.prenom, p.nom, null) from public.profils p where p.id = new.auteur_id) end;
  insert into public.notifications (modele, profil_id, cle, donnees)
  values ('message', dest, 'message:' || c.id, jsonb_build_object(
    'conversation', c.id, 'de', de, 'pour', case when dest = c.annonceur_id then 'annonceur' else 'client' end,
    'annonce', jsonb_build_object('titre', a.titre, 'reference', a.reference),
    'extrait', left(new.contenu, 300)));
  return null;
end $$;
create trigger messages_notifier after insert on public.messages
  for each row execute function public.messages_notifier();

-- Demande de visite et réponses : e-mail à l'autre partie (le visiteur sans compte, à l'adresse qu'il a laissée)
create function public.visites_notifier() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
  evenement text;
  pour text;
  donnees jsonb;
begin
  select * into a from public.annonces where id = new.annonce_id;
  if tg_op = 'INSERT' then
    evenement := 'demandee';
    pour := 'annonceur';
  else
    if new.statut = 'confirmee' and old.statut = 'demandee' then
      evenement := case when a.auteur_id = auth.uid() then 'confirmee' else 'acceptee' end;
    elsif new.statut = 'annulee' and old.statut <> 'annulee' then
      evenement := case when new.annulee_par = 'annonceur' and old.statut = 'demandee' then 'refusee' else 'annulee' end;
    elsif new.statut = 'demandee' and new.creneau_propose is not null and new.creneau_propose is distinct from old.creneau_propose then
      evenement := 'proposee';
    else
      return null;
    end if;
    -- l'autre partie : celle qui n'a pas agi
    pour := case when a.auteur_id = auth.uid() then 'demandeur' else 'annonceur' end;
  end if;

  donnees := jsonb_build_object(
    'visite', new.id, 'evenement', evenement, 'pour', pour,
    'annonce', jsonb_build_object('titre', a.titre, 'reference', a.reference),
    'creneau', new.creneau, 'creneau_propose', new.creneau_propose, 'reponse', new.reponse,
    'avec_compte', new.demandeur_id is not null);
  if pour = 'annonceur' then
    if coalesce((select p.emails_visites from public.profils p where p.id = a.auteur_id), false) then
      insert into public.notifications (modele, profil_id, cle, donnees)
      values ('visite', a.auteur_id, 'visite:' || new.id,
              donnees || jsonb_build_object('nom', new.nom, 'telephone', new.telephone, 'message', new.message));
    end if;
  elsif new.demandeur_id is not null then
    if coalesce((select p.emails_visites from public.profils p where p.id = new.demandeur_id), false) then
      insert into public.notifications (modele, profil_id, cle, donnees)
      values ('visite', new.demandeur_id, 'visite:' || new.id,
              donnees || jsonb_build_object('annonceur', public.nom_annonceur(a.id)));
    end if;
  elsif new.email is not null then
    insert into public.notifications (modele, email, cle, donnees)
    values ('visite', new.email, 'visite:' || new.id,
            donnees || jsonb_build_object('annonceur', public.nom_annonceur(a.id), 'nom', new.nom));
  end if;
  return null;
end $$;
create trigger visites_notifier after insert or update on public.visites
  for each row execute function public.visites_notifier();

-- ══ Chaque matin : alertes ══
-- Pour chaque alerte dont c'est le moment (chaque jour, ou chaque semaine), les annonces publiées depuis le dernier
-- passage qui correspondent à la recherche : un e-mail avec les 6 plus récentes et leur nombre.
create function public.preparer_alertes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  al public.alertes;
  maintenant timestamptz := now();
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
      select count(*)::integer,
             coalesce(jsonb_agg(public.carte_annonce(s.v) order by s.rang) filter (where s.rang <= 6), '[]')
        into total, cartes
      from (select v, row_number() over (order by v.publiee_le desc, v.reference) as rang
              from public.annonces_en_ligne v
             where v.publiee_le > al.verifiee_le and v.publiee_le <= maintenant
               and public.annonce_correspond(v, al.criteres)) s;
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
      -- recherche illisible : passée, sans bloquer les autres alertes
      update public.alertes set verifiee_le = maintenant where id = al.id;
    end;
  end loop;
  return n;
end $$;

-- ══ Chaque matin : annonces qui expirent dans les 3 jours (un rappel par date de fin) ══
create function public.preparer_rappels() returns integer
language sql security definer set search_path = '' as $$
  with a_prevenir as (
    select a.id, a.auteur_id, a.titre, a.reference, a.expire_le,
           'fin:' || a.id || ':' || to_char(a.expire_le at time zone 'UTC', 'YYYY-MM-DD') as cle
    from public.annonces a
    join public.profils p on p.id = a.auteur_id
    where a.statut = 'publiee' and a.expire_le > now() and a.expire_le <= now() + interval '3 days'
      and p.emails_annonces
  ), ajout as (
    insert into public.notifications (modele, profil_id, cle, donnees)
    select 'fin_annonce', x.auteur_id, x.cle, jsonb_build_object(
             'annonce', jsonb_build_object('id', x.id, 'titre', x.titre, 'reference', x.reference), 'expire_le', x.expire_le)
    from a_prevenir x
    where not exists (select 1 from public.notifications n where n.profil_id = x.auteur_id and n.cle = x.cle)
    returning 1
  )
  select count(*)::integer from ajout;
$$;

-- ══ Pour le programme d'envoi ══
-- Prend jusqu'à « nombre » e-mails à envoyer (sans les donner deux fois à deux envois simultanés), avec l'adresse et
-- le prénom du destinataire. Écarte les messages déjà lus entre-temps et les e-mails de plus de 3 jours.
create function public.notifications_a_envoyer(nombre integer default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  update public.notifications set statut = 'perimee'
   where statut = 'a_envoyer' and cree_le < now() - interval '3 days';
  update public.notifications n set statut = 'inutile'
   where n.statut = 'a_envoyer' and n.modele = 'message'
     and not exists (select 1 from public.messages m
                      where m.conversation_id = (n.donnees ->> 'conversation')::uuid
                        and m.auteur_id <> n.profil_id and m.lu_le is null);
  with choisies as (
    select id from public.notifications
     where statut = 'a_envoyer' and essais < 5 and (prise_le is null or prise_le < now() - interval '10 minutes')
     order by cree_le
     limit greatest(1, least(coalesce(nombre, 50), 200))
     for update skip locked
  ), prises as (
    update public.notifications n set prise_le = now(), essais = n.essais + 1
      from choisies where n.id = choisies.id
    returning n.id, n.modele, n.donnees, n.email, n.profil_id, n.cree_le
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'modele', p.modele, 'donnees', p.donnees,
           'email', coalesce(p.email, u.email), 'prenom', pr.prenom) order by p.cree_le), '[]')
    into r
  from prises p
  left join auth.users u on u.id = p.profil_id
  left join public.profils pr on pr.id = p.profil_id;
  return r;
end $$;

-- Résultat d'un envoi : envoyé, ou erreur (nouvel essai plus tard, 5 au plus)
create function public.notification_envoyee(notification uuid, probleme text default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set
    statut = case when probleme is null then 'envoyee' when essais >= 5 then 'echec' else 'a_envoyer' end,
    envoyee_le = case when probleme is null then now() end,
    erreur = left(probleme, 500),
    prise_le = null
  where id = notification;
$$;

-- ══ Lien « Arrêter cette alerte » des e-mails (sans connexion) ══
create function public.alerte_par_jeton(jeton uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nom', a.nom, 'active', a.active, 'adresse', a.adresse)
  from public.alertes a where a.jeton = alerte_par_jeton.jeton;
$$;
create function public.arreter_alerte(jeton uuid) returns boolean
language sql security definer set search_path = '' as $$
  with arretee as (
    update public.alertes a set active = false where a.jeton = arreter_alerte.jeton returning 1
  )
  select exists (select 1 from arretee);
$$;

revoke execute on function public.preparer_alertes(), public.preparer_rappels(), public.notifications_a_envoyer(integer),
  public.notification_envoyee(uuid, text) from public, anon, authenticated;
grant execute on function public.preparer_alertes(), public.preparer_rappels(), public.notifications_a_envoyer(integer),
  public.notification_envoyee(uuid, text) to service_role;
revoke execute on function public.alerte_par_jeton(uuid), public.arreter_alerte(uuid) from public;
grant execute on function public.alerte_par_jeton(uuid), public.arreter_alerte(uuid) to anon, authenticated;
