-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — qui voit et qui modifie quoi (sécurité ligne par ligne, « RLS »)
--
-- Chaque table est fermée par défaut ; seules les règles ci-dessous ouvrent l'accès.
--   · Tout le monde (même sans compte) : lieux, types de bien, agences, annonces PUBLIÉES
--     et leurs photos ; demander une visite.
--   · Chaque compte : son profil, ses annonces (même non publiées), ses favoris,
--     ses conversations, ses alertes, les visites de ses annonces.
--   · 360-Immo.ci (administrateurs) : tout, dont la publication des annonces.
-- Une annonce n'est publiée qu'après vérification par 360-Immo.ci : son auteur peut la
-- mettre « en attente », pas « publiée ».
-- ════════════════════════════════════════════════════════════════════════════

-- Compte administrateur de 360-Immo.ci ? Lu « security definer » : lire les profils depuis une règle
-- des profils sans repasser par cette règle (sinon elle s'appellerait elle-même sans fin).
create function public.compte_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'admin');
$$;

-- Administrateur de 360-Immo.ci, ou outil de maintenance (postgres, service_role) ?
-- Pas « security definer » : current_user doit rester celui qui fait la demande.
create function public.est_admin() returns boolean
language sql stable set search_path = '' as $$
  select current_user::text in ('postgres', 'service_role', 'supabase_admin') or public.compte_admin();
$$;

-- Toutes les tables : fermées par défaut
alter table public.villes enable row level security;
alter table public.communes enable row level security;
alter table public.quartiers enable row level security;
alter table public.types_bien enable row level security;
alter table public.agences enable row level security;
alter table public.profils enable row level security;
alter table public.annonces enable row level security;
alter table public.photos_annonce enable row level security;
alter table public.favoris enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.visites enable row level security;
alter table public.alertes enable row level security;


-- ══ Listes publiques : lieux, types de bien, agences ══
create policy "Lieux : lisibles par tous" on public.villes for select to anon, authenticated using (true);
create policy "Communes : lisibles par tous" on public.communes for select to anon, authenticated using (true);
create policy "Quartiers : lisibles par tous" on public.quartiers for select to anon, authenticated using (true);
create policy "Types de bien : lisibles par tous" on public.types_bien for select to anon, authenticated using (true);
create policy "Agences : lisibles par tous" on public.agences for select to anon, authenticated using (true);
create policy "Agences : gérées par 360-Immo.ci" on public.agences for all to authenticated
  using (public.est_admin()) with check (public.est_admin());


-- ══ Profils : chacun le sien ══
create policy "Profil : lu par son titulaire" on public.profils for select to authenticated
  using (id = auth.uid() or public.est_admin());
create policy "Profil : modifié par son titulaire" on public.profils for update to authenticated
  using (id = auth.uid() or public.est_admin()) with check (id = auth.uid() or public.est_admin());

-- Le rôle (particulier, agence, admin) et l'agence ne se choisissent pas soi-même
create function public.profils_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    new.role := old.role;
    new.agence_id := old.agence_id;
  end if;
  new.id := old.id;
  return new;
end $$;
create trigger profils_proteger before update on public.profils
  for each row execute function public.profils_proteger();


-- ══ Annonces ══
create policy "Annonces : publiées visibles par tous, les siennes par leur auteur" on public.annonces
  for select to anon, authenticated
  using (statut = 'publiee' or auteur_id = auth.uid() or public.est_admin());
create policy "Annonces : créées par un compte, en son nom" on public.annonces
  for insert to authenticated with check (auteur_id = auth.uid() or public.est_admin());
create policy "Annonces : modifiées par leur auteur" on public.annonces
  for update to authenticated
  using (auteur_id = auth.uid() or public.est_admin()) with check (auteur_id = auth.uid() or public.est_admin());
create policy "Annonces : supprimées par leur auteur" on public.annonces
  for delete to authenticated using (auteur_id = auth.uid() or public.est_admin());

-- Publication, mise en avant (Premium), vérification, compteur de vues : réservés à 360-Immo.ci
create function public.annonces_controler() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    if tg_op = 'INSERT' then
      if new.statut not in ('brouillon', 'en_attente') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.premium := false;
      new.premium_jusquau := null;
      new.verifiee := false;
      new.vues := 0;
      new.publiee_le := null;
      new.motif_refus := null;
    else
      if new.statut is distinct from old.statut and new.statut not in ('brouillon', 'en_attente', 'archivee') then
        raise exception 'Une annonce est vérifiée par 360-Immo.ci avant d''être publiée.' using errcode = 'insufficient_privilege';
      end if;
      new.reference := old.reference;
      new.auteur_id := old.auteur_id;
      new.premium := old.premium;
      new.premium_jusquau := old.premium_jusquau;
      new.verifiee := old.verifiee;
      new.vues := old.vues;
      new.publiee_le := old.publiee_le;
      new.motif_refus := old.motif_refus;
    end if;
  end if;
  if new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut <> 'publiee') then
    new.publiee_le := now();
  end if;
  if tg_op = 'UPDATE' then new.modifie_le := now(); end if;
  return new;
end $$;
create trigger annonces_controler before insert or update on public.annonces
  for each row execute function public.annonces_controler();

-- Une vue de plus sur une annonce publiée (appelé par la fiche du bien)
create function public.compter_vue(annonce uuid) returns void
language sql security definer set search_path = '' as $$
  update public.annonces set vues = vues + 1 where id = annonce and statut = 'publiee';
$$;
grant execute on function public.compter_vue(uuid) to anon, authenticated;


-- ══ Photos des annonces : visibles avec l'annonce, gérées par son auteur ══
create policy "Photos : visibles avec leur annonce" on public.photos_annonce for select to anon, authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id));   -- les règles des annonces s'appliquent
create policy "Photos : ajoutées par l'auteur de l'annonce" on public.photos_annonce for insert to authenticated
  with check (exists (select 1 from public.annonces a where a.id = annonce_id and (a.auteur_id = auth.uid() or public.est_admin())));
create policy "Photos : modifiées par l'auteur de l'annonce" on public.photos_annonce for update to authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id and (a.auteur_id = auth.uid() or public.est_admin())));
create policy "Photos : supprimées par l'auteur de l'annonce" on public.photos_annonce for delete to authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id and (a.auteur_id = auth.uid() or public.est_admin())));


-- ══ Favoris : chacun les siens ══
create policy "Favoris : ceux du compte" on public.favoris for all to authenticated
  using (profil_id = auth.uid()) with check (profil_id = auth.uid());


-- ══ Conversations et messages : seulement les deux personnes concernées ══
create policy "Conversations : lues par leurs participants" on public.conversations for select to authenticated
  using (auth.uid() in (client_id, annonceur_id) or public.est_admin());
create policy "Conversations : ouvertes par la personne intéressée" on public.conversations for insert to authenticated
  with check (client_id = auth.uid());

create policy "Messages : lus par les participants" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and (auth.uid() in (c.client_id, c.annonceur_id) or public.est_admin())));
create policy "Messages : envoyés par un participant, en son nom" on public.messages for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.conversations c
                          where c.id = conversation_id and auth.uid() in (c.client_id, c.annonceur_id)));
-- Noter un message comme lu : par son destinataire (le contenu, lui, ne change jamais)
create policy "Messages : marqués lus par leur destinataire" on public.messages for update to authenticated
  using (auteur_id <> auth.uid()
         and exists (select 1 from public.conversations c
                     where c.id = conversation_id and auth.uid() in (c.client_id, c.annonceur_id)));


-- ══ Demandes de visite ══
create policy "Visites : demandées par tous, pour une annonce publiée" on public.visites for insert to anon, authenticated
  with check ((demandeur_id is null or demandeur_id = auth.uid())
              and statut = 'demandee'
              and exists (select 1 from public.annonces a where a.id = annonce_id and a.statut = 'publiee'));
create policy "Visites : vues par le demandeur et l'annonceur" on public.visites for select to authenticated
  using (demandeur_id = auth.uid()
         or exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
         or public.est_admin());
create policy "Visites : confirmées ou annulées par l'annonceur ou le demandeur" on public.visites for update to authenticated
  using (demandeur_id = auth.uid()
         or exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
         or public.est_admin());


-- ══ Alertes : chacun les siennes ══
create policy "Alertes : celles du compte" on public.alertes for all to authenticated
  using (profil_id = auth.uid()) with check (profil_id = auth.uid());
