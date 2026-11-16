-- =====================================================================================================================
--  360Immo.ci — Nouveau nom, sans tiret : « 360-Immo.ci » devient « 360Immo.ci »
-- =====================================================================================================================
--  Les textes rangés dans la base prennent le nouveau nom :
--   - les pages du site (À propos, aide, pages légales…) et les articles du blog : seul le nom change (et le nom de
--     domaine prévu, 360immo.ci) ; les modifications faites par l'équipe dans l'Administration sont gardées, et la
--     date de modification ne bouge pas (le contenu, lui, n'a pas changé) ;
--   - l'auteur proposé d'office pour un nouvel article (« L'équipe 360Immo.ci ») ;
--   - les messages que la base renvoie au site (« Une annonce est vérifiée par 360Immo.ci avant d'être publiée »…) :
--     chaque fonction qui contient l'ancien nom est recréée telle qu'elle est aujourd'hui dans la base, avec le
--     nouveau nom (« create or replace » garde ses droits d'accès).
--  Les noms techniques ne changent pas : projet Supabase « 360-immo », noms des règles d'accès.
-- =====================================================================================================================

update public.pages_site set
  titre = replace(titre, '360-Immo', '360Immo'),
  resume = replace(resume, '360-Immo', '360Immo'),
  contenu = replace(replace(contenu, '360-Immo', '360Immo'), '360-immo.ci', '360immo.ci'),
  notes = replace(replace(notes, '360-Immo', '360Immo'), '360-immo.ci', '360immo.ci')
where concat_ws(' ', titre, resume, contenu, notes) ~* '360-immo';

update public.articles set
  titre = replace(titre, '360-Immo', '360Immo'),
  resume = replace(resume, '360-Immo', '360Immo'),
  contenu = replace(replace(contenu, '360-Immo', '360Immo'), '360-immo.ci', '360immo.ci'),
  auteur_nom = replace(auteur_nom, '360-Immo', '360Immo'),
  auteur_fonction = replace(auteur_fonction, '360-Immo', '360Immo'),
  notes = replace(replace(notes, '360-Immo', '360Immo'), '360-immo.ci', '360immo.ci')
where concat_ws(' ', titre, resume, contenu, auteur_nom, auteur_fonction, notes) ~* '360-immo';

alter table public.articles alter column auteur_nom set default 'L''équipe 360Immo.ci';

-- Messages des fonctions : chaque fonction est recréée à partir de sa définition actuelle
do $$
declare
  f record;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prosrc like '%360-Immo%'
  loop
    execute replace(pg_get_functiondef(f.oid), '360-Immo', '360Immo');
  end loop;
end $$;
