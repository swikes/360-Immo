-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — stockage des photos des annonces (Supabase Storage)
--
-- Dossier « photos-annonces » : une photo par fichier, rangée sous l'identifiant de
-- son annonce (<id de l'annonce>/<fichier>.webp). Lecture publique (les photos sont
-- affichées sur le site) ; ajout et suppression par l'auteur de l'annonce seulement.
-- 5 Mo au plus par photo, formats JPEG, PNG ou WebP.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-annonces', 'photos-annonces', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- L'annonce du dossier appartient-elle à la personne connectée ?
create function public.photo_de_mon_annonce(chemin text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.annonces a
    where a.id::text = split_part(chemin, '/', 1) and (a.auteur_id = auth.uid() or public.est_admin())
  );
$$;

create policy "Photos d'annonces : ajoutées par l'auteur de l'annonce" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos-annonces' and public.photo_de_mon_annonce(name));
create policy "Photos d'annonces : remplacées par l'auteur de l'annonce" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos-annonces' and public.photo_de_mon_annonce(name));
create policy "Photos d'annonces : supprimées par l'auteur de l'annonce" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos-annonces' and public.photo_de_mon_annonce(name));
