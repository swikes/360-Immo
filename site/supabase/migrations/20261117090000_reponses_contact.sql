-- Administration → Contact : répondre depuis le site, au nom de 360Immo.ci (adresse d'envoi du site, contact@360immo.ci),
-- et non plus depuis la boîte personnelle d'un membre de l'équipe.
--   reponses_contact            les réponses envoyées (texte, auteur, date) ; supprimées avec leur demande (un an après
--                               qu'elle a été traitée, comme avant)
--   repondre_contact(d, r)      l'équipe (connexion confirmée par le code) répond : e-mail à la personne (file des
--                               e-mails, modèle « reponse_contact », lib/emails.ts), demande marquée traitée
--   admin_contacts()            les demandes, avec l'historique de leurs réponses

create table public.reponses_contact (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_contact on delete cascade,
  auteur_id uuid references public.profils on delete set null,
  message text not null constraint reponse_contact_longueur check (char_length(btrim(message)) between 2 and 5000),
  cree_le timestamptz not null default now()
);
create index reponses_contact_demande on public.reponses_contact (demande_id, cree_le);
comment on table public.reponses_contact is 'Réponses de l''équipe aux messages du formulaire Contact ; supprimées avec leur demande';
-- jamais lue directement : seulement par admin_contacts()
alter table public.reponses_contact enable row level security;
revoke all on public.reponses_contact from public, anon, authenticated;

-- E-mail de la réponse (à l'adresse laissée dans le formulaire, avec ou sans compte)
alter table public.notifications drop constraint notifications_modele_check,
  add constraint notifications_modele_check
    check (modele in ('message', 'visite', 'rappel', 'alerte', 'fin_annonce', 'moderation', 'compte', 'contact', 'offre',
      'reponse_contact'));

create function public.repondre_contact(demande uuid, reponse text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_reponse text := btrim(coalesce(reponse, ''));
  d public.demandes_contact;
  v_id uuid;
begin
  perform public.exiger_admin();
  select * into d from public.demandes_contact c where c.id = demande for update;
  if not found then
    raise exception 'Demande introuvable.' using errcode = 'P0001';
  end if;
  if d.email is null then
    raise exception 'Cette personne n''a pas laissé d''adresse e-mail : rappelez-la au %.', d.telephone using errcode = 'P0001';
  end if;
  if char_length(v_reponse) < 2 then
    raise exception 'Écrivez votre réponse.' using errcode = 'P0001';
  end if;
  if char_length(v_reponse) > 5000 then
    raise exception 'Votre réponse est trop longue (5 000 caractères au plus).' using errcode = 'P0001';
  end if;

  insert into public.reponses_contact (demande_id, auteur_id, message)
  values (d.id, auth.uid(), v_reponse)
  returning id into v_id;

  insert into public.notifications (modele, email, cle, donnees)
  values ('reponse_contact', d.email, 'reponse_contact:' || v_id, jsonb_build_object(
    'demande', d.id, 'nom', d.nom, 'sujet', d.sujet, 'message', d.message, 'recue_le', d.cree_le, 'reponse', v_reponse));

  update public.demandes_contact c set statut = 'traitee', traitee_le = now(), traitee_par = auth.uid()
  where c.id = d.id;
  return v_id;
end $$;

-- Les demandes pour l'équipe : nouvelles d'abord, puis les 100 dernières traitées ; avec les réponses envoyées
create or replace function public.admin_contacts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(c) - 'traitee_par' || jsonb_build_object(
      'traitee_par', (select nullif(btrim(coalesce(x.prenom, '') || ' ' || coalesce(x.nom, '')), '') from public.profils x where x.id = c.traitee_par),
      'avec_compte', c.profil_id is not null,
      'reponses', (select coalesce(jsonb_agg(jsonb_build_object(
          'message', r.message, 'cree_le', r.cree_le,
          'par', (select nullif(btrim(coalesce(x.prenom, '') || ' ' || coalesce(x.nom, '')), '') from public.profils x where x.id = r.auteur_id))
          order by r.cree_le), '[]')
        from public.reponses_contact r where r.demande_id = c.id))
      order by c.statut = 'traitee', c.cree_le desc)
    from (
      select * from public.demandes_contact where statut = 'nouvelle'
      union all
      select * from (select * from public.demandes_contact where statut = 'traitee' order by traitee_le desc limit 100) t
    ) c
  ), '[]');
end $$;

revoke execute on function public.repondre_contact(uuid, text) from public, anon, authenticated;
grant execute on function public.repondre_contact(uuid, text) to authenticated;
