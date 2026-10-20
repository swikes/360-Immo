-- ══════════════════════════════════════════════════════════════════════════════
--  360-Immo.ci — Les vrais chiffres de l'accueil (étape 9, lancement)
-- ══════════════════════════════════════════════════════════════════════════════
--  Le bandeau de l'accueil montrait les chiffres de la maquette (3 842 annonces, 48 agences…). Il montre maintenant
--  ceux de la base, lus dans les annonces en ligne : annonces, annonceurs (une agence compte une fois, tous ses
--  comptes compris), agences vérifiées, villes. Le site ne l'affiche qu'à partir d'un nombre d'annonces suffisant
--  (lib/annonces-en-ligne.ts : bandeauChiffres).

create or replace function public.chiffres_annonces() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.annonces_en_ligne),
    'par_ville', (select coalesce(jsonb_object_agg(ville, n), '{}') from (
        select v.ville, count(*) as n from public.annonces_en_ligne v group by v.ville) x),
    'annonceurs', (select count(distinct v.groupe) from public.annonces_en_ligne v),
    'agences', (select count(distinct v.groupe) from public.annonces_en_ligne v where v.type_vendeur = 'agence' and v.annonceur_verifie),
    'villes', (select count(distinct v.ville_id) from public.annonces_en_ligne v));
$$;
