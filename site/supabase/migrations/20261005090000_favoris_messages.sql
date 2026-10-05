-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 6, 1re partie : favoris et messages
--
-- Les tables (favoris, conversations, messages) et leurs droits existent depuis l'étape 2 : chacun ses favoris ;
-- une conversation par annonce et par personne intéressée, lue et écrite par ses deux participants seulement ;
-- un message envoyé ne change plus. Ici, ce qu'il faut au site pour s'en servir :
--
--   cartes_annonces(ids)    cartes des annonces demandées (favoris) : en ligne, ou titre seul si retirée depuis
--   conversations_limite    20 nouvelles conversations par jour et par compte au plus (contre le démarchage)
--   ecrire_annonceur()      message à l'annonceur d'une annonce (ouvre la conversation au premier message)
--   mes_conversations()     ses conversations : annonce, l'autre personne (nom discret), dernier message, non lus
--   marquer_lus()           les messages reçus dans une conversation sont lus
--   messages_non_lus()      nombre de messages reçus non lus (pastille du menu)
-- ════════════════════════════════════════════════════════════════════════════

-- Cartes d'annonces, dans l'ordre demandé (200 au plus). Une annonce retirée ou expirée garde son titre (on l'a vue en
-- ligne) ; un brouillon jamais publié n'est pas renvoyé.
create function public.cartes_annonces(ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.carte order by x.rang), '[]'::jsonb)
  from (
    select i.rang,
           coalesce(public.carte_annonce(v) || jsonb_build_object('en_ligne', true),
                    jsonb_build_object('id', a.id, 'reference', a.reference, 'titre', a.titre, 'en_ligne', false)) as carte
    from unnest(ids[1:200]) with ordinality as i(id, rang)
    join public.annonces a on a.id = i.id
    left join public.annonces_en_ligne v on v.id = a.id
    where v.id is not null or a.publiee_le is not null
  ) x;
$$;

-- Contre le démarchage : 20 nouvelles conversations par jour et par compte au plus
create function public.conversations_limite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.conversations
       where client_id = new.client_id and cree_le > now() - interval '1 day') >= 20 then
    raise exception 'Vous avez écrit à beaucoup d''annonceurs aujourd''hui : réessayez demain.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger conversations_limite before insert on public.conversations
  for each row execute function public.conversations_limite();

-- Écrire à l'annonceur : la conversation s'ouvre au premier message (annonce en ligne) ; ensuite, on y ajoute.
-- Avec les droits de la personne qui écrit (règles d'accès des conversations et des messages).
create function public.ecrire_annonceur(annonce uuid, contenu text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  c uuid;
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour envoyer un message.' using errcode = '42501';
  end if;
  if exists (select 1 from public.annonces a where a.id = annonce and a.auteur_id = auth.uid()) then
    raise exception 'C''est votre annonce : vous ne pouvez pas vous écrire.' using errcode = 'P0001';
  end if;
  select id into c from public.conversations where annonce_id = annonce and client_id = auth.uid();
  if c is null then
    if not exists (select 1 from public.annonces_en_ligne v where v.id = annonce) then
      raise exception 'Cette annonce n''est plus en ligne.' using errcode = 'P0001';
    end if;
    insert into public.conversations (annonce_id) values (annonce) returning id into c;
  end if;
  insert into public.messages (conversation_id, contenu) values (c, contenu);
  return c;
end $$;

-- Ses conversations, la plus récente d'abord. L'autre personne apparaît sous un nom discret : « Awa K. », le nom de
-- son agence, ou (côté client) le nom écrit dans une annonce d'agence, comme sur la fiche.
create function public.mes_conversations() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.quand desc), '[]'::jsonb)
  from (
    select coalesce(c.dernier_message_le, c.cree_le) as quand, jsonb_build_object(
      'id', c.id,
      'role', case when c.client_id = auth.uid() then 'client' else 'annonceur' end,
      'annonce', jsonb_build_object(
        'id', a.id, 'reference', a.reference, 'titre', a.titre,
        'photo', (select ph.chemin from public.photos_annonce ph where ph.annonce_id = a.id
                  order by ph.ordre, ph.cree_le limit 1),
        'en_ligne', a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now())),
      'autre', case
        when c.client_id = auth.uid() and a.type_vendeur = 'agence' and nullif(btrim(a.contact_nom), '') is not null
          then btrim(a.contact_nom)
        else public.nom_vitrine(p.prenom, p.nom, ag.nom) end,
      'dernier', (select jsonb_build_object('contenu', left(m.contenu, 140), 'cree_le', m.cree_le,
                                            'de_moi', m.auteur_id = auth.uid())
                  from public.messages m where m.conversation_id = c.id order by m.cree_le desc limit 1),
      'non_lus', (select count(*) from public.messages m
                  where m.conversation_id = c.id and m.auteur_id <> auth.uid() and m.lu_le is null)
    ) as j
    from public.conversations c
    join public.annonces a on a.id = c.annonce_id
    join public.profils p on p.id = case when c.client_id = auth.uid() then c.annonceur_id else c.client_id end
    left join public.agences ag on ag.id = p.agence_id
    where auth.uid() in (c.client_id, c.annonceur_id)
  ) x;
$$;

-- Messages reçus d'une conversation : lus (renvoie leur nombre)
create function public.marquer_lus(conversation uuid) returns integer
language sql volatile security invoker set search_path = '' as $$
  with lus as (
    update public.messages set lu_le = now()
     where conversation_id = conversation and auteur_id <> auth.uid() and lu_le is null
    returning 1)
  select count(*)::int from lus;
$$;

-- Nombre de messages reçus non lus, dans ses conversations
create function public.messages_non_lus() returns integer
language sql stable security invoker set search_path = '' as $$
  select count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where auth.uid() in (c.client_id, c.annonceur_id) and m.auteur_id <> auth.uid() and m.lu_le is null;
$$;

revoke execute on function public.ecrire_annonceur(uuid, text), public.mes_conversations(), public.marquer_lus(uuid),
  public.messages_non_lus() from public, anon;
grant execute on function public.ecrire_annonceur(uuid, text), public.mes_conversations(), public.marquer_lus(uuid),
  public.messages_non_lus() to authenticated;
grant execute on function public.cartes_annonces(uuid[]) to anon, authenticated;
