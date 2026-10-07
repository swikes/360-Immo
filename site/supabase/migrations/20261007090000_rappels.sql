-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 6 : « Être rappelé »
--
--   rappels              demande de rappel sur une annonce en ligne, avec ou sans compte : nom, numéro, moment
--                        souhaité, message ; vue par l'annonceur (et par le demandeur s'il a un compte)
--   rappels_controler    annonce en ligne, pas la sienne, 5 demandes par jour et par numéro, une seule en attente
--                        par bien et par numéro
--   traiter_rappel()     l'annonceur marque « rappelé » (ou remet « à rappeler ») ; le demandeur annule
--   mes_rappels()        ses demandes reçues (avec le numéro) et envoyées, des 60 derniers jours
--   compteurs()          + rappels à faire (pastille du menu)
--   e-mail               à l'annonceur pour chaque demande (s'il veut les e-mails des visites)
-- ════════════════════════════════════════════════════════════════════════════

create table public.rappels (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces on delete cascade,
  demandeur_id uuid default auth.uid() references public.profils on delete set null,
  nom text not null check (char_length(btrim(nom)) between 2 and 80),
  telephone text not null constraint rappels_telephone_format check (telephone ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$'),
  -- quand rappeler : dès que possible, le matin, l'après-midi, en fin de journée
  moment text not null default 'vite' check (moment in ('vite', 'matin', 'apres_midi', 'soir')),
  message text constraint rappels_message_longueur check (message is null or char_length(message) <= 500),
  statut text not null default 'a_rappeler' check (statut in ('a_rappeler', 'rappele', 'annule')),
  cree_le timestamptz not null default now(),
  traite_le timestamptz
);
create index rappels_annonce on public.rappels (annonce_id, cree_le);
create index rappels_telephone on public.rappels (telephone, cree_le);

alter table public.rappels enable row level security;
create policy "Rappels : demandés par tous, en leur propre nom" on public.rappels for insert to anon, authenticated
  with check (demandeur_id is not distinct from auth.uid());
create policy "Rappels : vus par l'annonceur et le demandeur" on public.rappels for select to authenticated
  using (demandeur_id = auth.uid()
         or exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = auth.uid()));
-- Une demande ne se modifie que par traiter_rappel()
revoke update, delete on public.rappels from anon, authenticated;

create function public.rappels_controler() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.annonces_en_ligne v where v.id = new.annonce_id) then
    raise exception 'Cette annonce n''est plus en ligne.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.annonces a where a.id = new.annonce_id and a.auteur_id = auth.uid()) then
    raise exception 'C''est votre annonce : vous ne pouvez pas demander à être rappelé.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.rappels where telephone = new.telephone and cree_le > now() - interval '1 day') >= 5 then
    raise exception 'Vous avez déjà demandé beaucoup de rappels aujourd''hui : réessayez demain.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rappels
              where annonce_id = new.annonce_id and telephone = new.telephone and statut = 'a_rappeler'
                and cree_le > now() - interval '7 days') then
    raise exception 'Vous avez déjà demandé à être rappelé pour ce bien : l''annonceur va vous appeler.' using errcode = 'P0001';
  end if;
  new.nom := btrim(new.nom);
  new.message := nullif(btrim(new.message), '');
  new.statut := 'a_rappeler';
  new.cree_le := now();
  new.traite_le := null;
  return new;
end $$;
create trigger rappels_controler before insert on public.rappels
  for each row execute function public.rappels_controler();

-- Nouvelle demande : e-mail à l'annonceur (s'il veut les e-mails des visites)
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce'));

create function public.rappels_notifier() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.annonces;
begin
  select * into a from public.annonces where id = new.annonce_id;
  if coalesce((select p.emails_visites from public.profils p where p.id = a.auteur_id), false) then
    insert into public.notifications (modele, profil_id, cle, donnees)
    values ('rappel', a.auteur_id, 'rappel:' || new.id, jsonb_build_object(
      'rappel', new.id, 'annonce', jsonb_build_object('titre', a.titre, 'reference', a.reference),
      'nom', new.nom, 'telephone', new.telephone, 'moment', new.moment, 'message', new.message,
      'avec_compte', new.demandeur_id is not null));
  end if;
  return null;
end $$;
create trigger rappels_notifier after insert on public.rappels
  for each row execute function public.rappels_notifier();

-- L'annonceur : « rappelé » ou de nouveau « à rappeler » ; le demandeur : annuler sa demande en attente
create function public.traiter_rappel(rappel uuid, action text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rappels;
  annonceur boolean;
begin
  select * into r from public.rappels where id = rappel for update;
  if r.id is null then
    raise exception 'Demande de rappel introuvable.' using errcode = 'P0001';
  end if;
  annonceur := exists (select 1 from public.annonces a where a.id = r.annonce_id and a.auteur_id = auth.uid());
  if auth.uid() is null or (not annonceur and r.demandeur_id is distinct from auth.uid()) then
    raise exception 'Action non autorisée pour ce compte.' using errcode = '42501';
  end if;
  if action = 'fait' and annonceur and r.statut = 'a_rappeler' then
    update public.rappels set statut = 'rappele', traite_le = now() where id = r.id;
  elsif action = 'a_faire' and annonceur and r.statut = 'rappele' then
    update public.rappels set statut = 'a_rappeler', traite_le = null where id = r.id;
  elsif action = 'annuler' and not annonceur and r.statut = 'a_rappeler' then
    update public.rappels set statut = 'annule', traite_le = now() where id = r.id;
  else
    raise exception 'Cette action n''est plus possible pour cette demande.' using errcode = 'P0001';
  end if;
end $$;

-- Ses demandes de rappel des 60 derniers jours : reçues (avec le numéro) et envoyées (l'annonceur sous son nom discret)
create function public.mes_rappels() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.cree_le desc), '[]'::jsonb)
  from (
    select r.cree_le, jsonb_build_object(
      'id', r.id,
      'role', case when a.auteur_id = auth.uid() then 'annonceur' else 'demandeur' end,
      'annonce', jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre,
        'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())),
      'nom', r.nom,
      'telephone', case when a.auteur_id = auth.uid() then r.telephone end,
      'moment', r.moment, 'message', r.message, 'statut', r.statut, 'cree_le', r.cree_le, 'traite_le', r.traite_le,
      'avec_compte', r.demandeur_id is not null,
      'annonceur', case when a.auteur_id = auth.uid() then null else public.nom_annonceur(a.id) end
    ) as j
    from public.rappels r
    join public.annonces a on a.id = r.annonce_id
    where (a.auteur_id = auth.uid() or r.demandeur_id = auth.uid())
      and r.cree_le > now() - interval '60 days'
  ) x;
$$;

-- Ce qui attend le compte : messages non lus, visites à traiter, rappels à faire (30 derniers jours)
create or replace function public.compteurs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
                  where auth.uid() in (c.client_id, c.annonceur_id) and m.auteur_id <> auth.uid() and m.lu_le is null),
    'visites', (select count(*) from public.visites v join public.annonces a on a.id = v.annonce_id
                 where v.statut = 'demandee' and v.creneau > now()
                   and ((a.auteur_id = auth.uid() and v.creneau_propose is null)
                        or (v.demandeur_id = auth.uid() and v.creneau_propose is not null))),
    'rappels', (select count(*) from public.rappels r join public.annonces a on a.id = r.annonce_id
                 where a.auteur_id = auth.uid() and r.statut = 'a_rappeler' and r.cree_le > now() - interval '30 days'));
$$;

revoke execute on function public.traiter_rappel(uuid, text), public.mes_rappels() from public, anon;
grant execute on function public.traiter_rappel(uuid, text), public.mes_rappels() to authenticated;
