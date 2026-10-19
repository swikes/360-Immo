-- Règles d'accès plus rapides (audit M2) : dans les règles des tables du site, auth.uid() et est_admin() étaient
-- recalculés pour chaque ligne lue. Entourés d'un « select », PostgreSQL les calcule une fois par requête : c'est la
-- forme recommandée par Supabase (« Auth RLS Initialization Plan »). Les règles restent identiques : seuls ces
-- appels sont entourés, rien d'autre ne change. (Les règles du stockage des fichiers, storage.objects, appartiennent
-- à Supabase : elles ne sont pas touchées.)
-- Chaque règle est relue telle qu'enregistrée dans la base (noms complets, search_path vide), puis réécrite.

do $$
declare
  r record;
  usage_ text;
  controle text;
  ordre text;
begin
  perform set_config('search_path', '', true);
  for r in
    select c.relname as t, p.polname as nom,
           pg_get_expr(p.polqual, p.polrelid) as qual, pg_get_expr(p.polwithcheck, p.polrelid) as chk
      from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
  loop
    -- (?<!SELECT ) : un appel déjà entouré ne l'est pas une seconde fois
    usage_ := regexp_replace(regexp_replace(r.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g'),
                             '(?<!SELECT )public\.est_admin\(\)', '(select public.est_admin())', 'g');
    controle := regexp_replace(regexp_replace(r.chk, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g'),
                               '(?<!SELECT )public\.est_admin\(\)', '(select public.est_admin())', 'g');
    if usage_ is distinct from r.qual or controle is distinct from r.chk then
      ordre := format('alter policy %I on public.%I', r.nom, r.t);
      if usage_ is not null then ordre := ordre || format(' using (%s)', usage_); end if;
      if controle is not null then ordre := ordre || format(' with check (%s)', controle); end if;
      execute ordre;
    end if;
  end loop;
end $$;
