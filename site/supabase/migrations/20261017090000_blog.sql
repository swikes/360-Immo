-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — étape 9 : le blog « Guide & Blog »
--
--   articles                          les articles : brouillon (vu de l'équipe seulement) ou publié ; un seul « à la une » ;
--                                     des notes de l'équipe jamais publiées (points à faire vérifier par un juriste…)
--   Dossier « blog » (public)         photos de couverture (<article>/<fichier>), ajoutées et supprimées par l'équipe seulement
--   blog_articles(), blog_article()   pages publiques /blog et /blog/<adresse> : articles publiés seulement, durée de
--                                     lecture, « À lire aussi »
--   admin_articles(), enregistrer_article(), publier_article(), supprimer_article()
--                                     onglet « Blog » de l'Administration (exiger_admin)
--   Journal de l'équipe               article publié, retiré du blog, supprimé
-- ════════════════════════════════════════════════════════════════════════════

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  -- adresse de la page (/blog/<slug>) : tirée du titre, fixe après la première publication (liens déjà partagés)
  slug text not null unique constraint articles_slug_forme check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  titre text not null constraint articles_titre_longueur check (char_length(btrim(titre)) between 5 and 120),
  resume text not null default '' constraint articles_resume_longueur check (char_length(resume) <= 300),
  categorie text not null check (categorie in ('acheteur', 'locataire', 'marche', 'juridique', 'vendeur', 'quartiers')),
  -- texte en Markdown simple (titres, listes, gras, liens, encadrés) : lib/blog.ts
  contenu text not null default '' constraint articles_contenu_longueur check (char_length(contenu) <= 100000),
  couverture text constraint articles_couverture_forme check (couverture is null or (couverture ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' and couverture !~ '\.\.')),
  auteur_nom text not null default 'L''équipe 360-Immo.ci' constraint articles_auteur_longueur check (char_length(btrim(auteur_nom)) between 2 and 80),
  auteur_fonction text constraint articles_fonction_longueur check (auteur_fonction is null or char_length(auteur_fonction) <= 80),
  a_la_une boolean not null default false,
  notes text constraint articles_notes_longueur check (notes is null or char_length(notes) <= 10000),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  publie_le timestamptz,                       -- première publication (gardée si l'article est retiré puis republié)
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid references public.profils on delete set null,
  constraint article_publie_complet check (statut = 'brouillon'
    or (publie_le is not null and char_length(btrim(resume)) > 0 and char_length(btrim(contenu)) > 0))
);
create unique index articles_une_seule_a_la_une on public.articles ((true)) where a_la_une;
create index articles_publies on public.articles (publie_le desc) where statut = 'publie';
comment on table public.articles is 'Articles du blog (Guide & Blog) ; écrits et publiés par l''équipe depuis l''Administration';
alter table public.articles enable row level security;
revoke all on public.articles from public, anon, authenticated;

-- ══ Photos de couverture ══
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog', 'blog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Blog : images ajoutées par l'équipe" on storage.objects
  for insert to authenticated with check (bucket_id = 'blog' and public.compte_admin());
create policy "Blog : images vues par l'équipe" on storage.objects
  for select to authenticated using (bucket_id = 'blog' and public.compte_admin());
create policy "Blog : images supprimées par l'équipe" on storage.objects
  for delete to authenticated using (bucket_id = 'blog' and public.compte_admin());

-- ══ Journal de l'équipe : articles publiés, retirés, supprimés ══
alter table public.actions_equipe drop constraint actions_equipe_action_check,
  add constraint actions_equipe_action_check check (action in ('admin_donne', 'admin_retire', 'compte_suspendu', 'compte_reactive',
    'agence_validee', 'agence_refusee', 'agence_modifiee', 'verification_validee', 'verification_refusee', 'piece_consultee',
    'numero_libere', 'article_publie', 'article_retire', 'article_supprime'));


-- ══ Outils ══

-- « Titre foncier : 5 vérifications » → « titre-foncier-5-verifications »
create function public.adresse_de(t text) returns text
language sql immutable set search_path = '' as $$
  select btrim(left(btrim(regexp_replace(
    translate(lower(replace(replace(replace(replace(coalesce(t, ''), 'œ', 'oe'), 'Œ', 'oe'), 'æ', 'ae'), 'Æ', 'ae')),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ', 'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', '-', 'g'), '-'), 80), '-');
$$;

-- Durée de lecture : 200 mots par minute, 1 minute au moins
create function public.minutes_lecture(contenu text) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, round(coalesce(array_length(regexp_split_to_array(nullif(btrim(contenu), ''), '\s+'), 1), 0) / 200.0)::integer);
$$;

-- Un article tel que le public le voit (sans les notes de l'équipe)
create function public.article_public(a public.articles, avec_contenu boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'slug', a.slug, 'titre', a.titre, 'resume', a.resume, 'categorie', a.categorie,
    'couverture', a.couverture, 'auteur_nom', a.auteur_nom, 'auteur_fonction', a.auteur_fonction, 'a_la_une', a.a_la_une,
    'publie_le', a.publie_le, 'modifie_le', a.modifie_le, 'minutes', public.minutes_lecture(a.contenu))
    || case when avec_contenu then jsonb_build_object('contenu', a.contenu) else '{}'::jsonb end;
$$;

-- Un article tel que l'équipe le voit : tout, avec le nom de la dernière personne qui l'a modifié
create function public.article_admin(a public.articles) returns jsonb
language sql stable set search_path = '' as $$
  select to_jsonb(a) || jsonb_build_object('minutes', public.minutes_lecture(a.contenu),
    'modifie_par', (select nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '') from public.profils p where p.id = a.modifie_par));
$$;


-- ══ Pages publiques ══

-- Articles publiés, les plus récents d'abord (une catégorie, ou toutes) ; sans leur texte
create function public.blog_articles(categorie text default null, nombre integer default 100) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.article_public(a, false) order by a.publie_le desc), '[]')
  from (select * from public.articles x
         where x.statut = 'publie' and (blog_articles.categorie is null or x.categorie = blog_articles.categorie)
         order by x.publie_le desc limit greatest(1, least(coalesce(nombre, 100), 200))) a;
$$;

-- Un article publié, avec son texte et 3 articles « À lire aussi » (même catégorie d'abord) ; null s'il n'est pas publié
create function public.blog_article(adresse text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.article_public(a, true) || jsonb_build_object('a_lire_aussi', coalesce((
      select jsonb_agg(public.article_public(b, false) order by b.categorie = a.categorie desc, b.publie_le desc)
      from (select * from public.articles y where y.statut = 'publie' and y.id <> a.id
             order by y.categorie = a.categorie desc, y.publie_le desc limit 3) b), '[]'))
  from public.articles a where a.slug = adresse and a.statut = 'publie';
$$;


-- ══ Onglet « Blog » de l'Administration ══

-- Tous les articles : brouillons d'abord, puis les publiés ; les plus récemment modifiés d'abord
create function public.admin_articles() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((select jsonb_agg(public.article_admin(a) order by a.statut = 'publie', a.modifie_le desc) from public.articles a), '[]');
end $$;

-- Nouvel article (sans id) ou article modifié : { id?, titre, resume, categorie, contenu, couverture, auteur_nom,
-- auteur_fonction, a_la_une, notes, slug? }. Ne change pas son état (brouillon ou publié) : publier_article.
create function public.enregistrer_article(article jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.articles;
  nouveau boolean := nullif(article ->> 'id', '') is null;
  v_titre text := btrim(coalesce(article ->> 'titre', ''));
  v_resume text := btrim(coalesce(article ->> 'resume', ''));
  v_contenu text := btrim(coalesce(article ->> 'contenu', ''));
  v_categorie text := article ->> 'categorie';
  v_auteur text := coalesce(nullif(btrim(article ->> 'auteur_nom'), ''), 'L''équipe 360-Immo.ci');
  v_une boolean := coalesce((article ->> 'a_la_une')::boolean, false);
  v_slug text;
  base text;
  n integer := 1;
begin
  perform public.exiger_admin();
  if not nouveau then
    select * into a from public.articles x where x.id = (article ->> 'id')::uuid for update;
    if a.id is null then
      raise exception 'Article introuvable : il a peut-être été supprimé.' using errcode = 'P0001';
    end if;
  end if;
  if char_length(v_titre) < 5 then
    raise exception 'Donnez un titre à l''article (5 caractères au moins).' using errcode = 'P0001';
  end if;
  if v_categorie is null or v_categorie not in ('acheteur', 'locataire', 'marche', 'juridique', 'vendeur', 'quartiers') then
    raise exception 'Choisissez la catégorie de l''article.' using errcode = 'P0001';
  end if;
  if a.statut = 'publie' and (v_resume = '' or v_contenu = '') then
    raise exception 'Un article publié garde un résumé et un texte. Retirez-le d''abord du blog pour le vider.' using errcode = 'P0001';
  end if;

  -- Adresse de la page : celle demandée, ou tirée du titre pour un nouvel article ; jamais changée après publication
  v_slug := public.adresse_de(nullif(btrim(article ->> 'slug'), ''));
  if nouveau or (v_slug <> '' and v_slug <> a.slug) then
    if not nouveau and a.publie_le is not null then
      raise exception 'L''adresse d''un article déjà publié ne change plus : les liens déjà partagés ne marcheraient plus.' using errcode = 'P0001';
    end if;
    base := coalesce(nullif(v_slug, ''), nullif(public.adresse_de(v_titre), ''), 'article');
    v_slug := base;
    while exists (select 1 from public.articles x where x.slug = v_slug and x.id is distinct from a.id) loop
      n := n + 1;
      v_slug := left(base, 76) || '-' || n;
    end loop;
  else
    v_slug := a.slug;
  end if;

  -- Un seul article à la une
  if v_une then
    update public.articles x set a_la_une = false where x.a_la_une and x.id is distinct from a.id;
  end if;

  if nouveau then
    insert into public.articles (slug, titre, resume, categorie, contenu, couverture, auteur_nom, auteur_fonction, a_la_une, notes, modifie_par)
    values (v_slug, v_titre, v_resume, v_categorie, v_contenu, nullif(article ->> 'couverture', ''), v_auteur,
            nullif(btrim(article ->> 'auteur_fonction'), ''), v_une, nullif(btrim(article ->> 'notes'), ''), auth.uid())
    returning * into a;
  else
    update public.articles x set slug = v_slug, titre = v_titre, resume = v_resume, categorie = v_categorie, contenu = v_contenu,
      couverture = nullif(article ->> 'couverture', ''), auteur_nom = v_auteur, auteur_fonction = nullif(btrim(article ->> 'auteur_fonction'), ''),
      a_la_une = v_une, notes = nullif(btrim(article ->> 'notes'), ''), modifie_le = now(), modifie_par = auth.uid()
    where x.id = a.id
    returning * into a;
  end if;
  return public.article_admin(a);
end $$;

-- Publier (visible de tous) ou retirer du blog (redevient un brouillon)
create function public.publier_article(article uuid, publier boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.articles;
begin
  perform public.exiger_admin();
  select * into a from public.articles x where x.id = article for update;
  if a.id is null then
    raise exception 'Article introuvable : il a peut-être été supprimé.' using errcode = 'P0001';
  end if;
  if publier then
    if char_length(btrim(a.resume)) = 0 or char_length(btrim(a.contenu)) = 0 then
      raise exception 'Ajoutez un résumé et le texte de l''article avant de le publier.' using errcode = 'P0001';
    end if;
    if a.statut <> 'publie' then
      perform public.noter_action_equipe('article_publie', null, null, a.titre, null);
    end if;
    update public.articles x set statut = 'publie', publie_le = coalesce(x.publie_le, now()), modifie_par = auth.uid()
    where x.id = a.id returning * into a;
  else
    if a.statut = 'publie' then
      perform public.noter_action_equipe('article_retire', null, null, a.titre, null);
    end if;
    update public.articles x set statut = 'brouillon', modifie_par = auth.uid() where x.id = a.id returning * into a;
  end if;
  return public.article_admin(a);
end $$;

-- Supprimer un article ; renvoie le chemin de sa photo de couverture, que le site supprime ensuite du dossier « blog »
create function public.supprimer_article(article uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  a public.articles;
begin
  perform public.exiger_admin();
  delete from public.articles x where x.id = article returning * into a;
  if a.id is null then
    raise exception 'Article introuvable : il a peut-être déjà été supprimé.' using errcode = 'P0001';
  end if;
  perform public.noter_action_equipe('article_supprime', null, null, a.titre,
    case when a.statut = 'publie' then 'Était publié sur le blog' else 'Brouillon' end);
  return a.couverture;
end $$;

revoke execute on function public.adresse_de(text), public.minutes_lecture(text), public.article_public(public.articles, boolean),
  public.article_admin(public.articles), public.blog_articles(text, integer), public.blog_article(text), public.admin_articles(),
  public.enregistrer_article(jsonb), public.publier_article(uuid, boolean), public.supprimer_article(uuid)
  from public, anon, authenticated;
grant execute on function public.blog_articles(text, integer), public.blog_article(text) to anon, authenticated;
grant execute on function public.admin_articles(), public.enregistrer_article(jsonb), public.publier_article(uuid, boolean),
  public.supprimer_article(uuid) to authenticated;
