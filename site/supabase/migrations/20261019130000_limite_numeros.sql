-- « Afficher le numéro » : contre les robots qui récoltent les numéros des annonceurs, un nombre limité de numéros
-- par compte, ou par connexion internet (adresse IP) pour un visiteur sans compte.
--   afficher_numero(annonce, adresse)   remplace contact_annonce() pour le site :
--     - compte connecté : appelé directement par le navigateur, compté pour le compte (40 en 10 minutes, 200 par jour) ;
--     - visiteur sans compte : seulement par le serveur du site (app/api/numero, clé secrète), qui donne l'adresse IP
--       posée par Vercel (impossible à falsifier) ; 20 en 10 minutes, 100 par jour. Plusieurs abonnés d'un même
--       opérateur mobile peuvent partager une adresse : le message propose alors de se connecter.
--   contact_annonce()                   n'est plus appelable depuis le site (usage interne)
-- Une annonce qui n'est plus en ligne ne compte pas. Les compteurs ne gardent ni l'annonce ni l'heure exacte, et
-- s'effacent après 2 jours.

create table public.numeros_affiches (
  cle text not null,             -- « compte:<id> » ou « adresse:<IP> »
  tranche timestamptz not null,  -- tranche de 5 minutes
  nombre integer not null default 0,
  primary key (cle, tranche)
);
alter table public.numeros_affiches enable row level security;
revoke all on public.numeros_affiches from anon, authenticated;

create function public.afficher_numero(annonce uuid, adresse text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  qui text;
  max_dix integer;
  max_jour integer;
  dix integer;
  jour integer;
  maintenant timestamptz := now();
  contact jsonb;
begin
  if moi is not null then
    qui := 'compte:' || moi;
    max_dix := 40;
    max_jour := 200;
  else
    -- (sans compte : seul le serveur du site appelle cette fonction, avec l'adresse IP du visiteur)
    if nullif(btrim(adresse), '') is null then
      raise exception 'Adresse du visiteur manquante.' using errcode = '22023';
    end if;
    qui := 'adresse:' || left(btrim(adresse), 64);
    max_dix := 20;
    max_jour := 100;
  end if;
  select coalesce(sum(n.nombre) filter (where n.tranche > maintenant - interval '10 minutes'), 0), coalesce(sum(n.nombre), 0)
    into dix, jour
    from public.numeros_affiches n
   where n.cle = qui and n.tranche > maintenant - interval '1 day';
  if dix >= max_dix then
    raise exception '%', case when moi is null
      then 'Vous avez affiché beaucoup de numéros en peu de temps : réessayez dans quelques minutes, ou connectez-vous pour continuer.'
      else 'Vous avez affiché beaucoup de numéros en peu de temps : réessayez dans quelques minutes.' end
      using errcode = 'P0001';
  end if;
  if jour >= max_jour then
    raise exception '%', case when moi is null
      then 'Vous avez affiché beaucoup de numéros aujourd''hui depuis cette connexion : connectez-vous pour continuer, ou réessayez demain.'
      else 'Vous avez affiché beaucoup de numéros aujourd''hui : réessayez demain.' end
      using errcode = 'P0001';
  end if;
  contact := public.contact_annonce(annonce);
  if contact is null then
    return null;   -- plus en ligne : rien à compter
  end if;
  insert into public.numeros_affiches as n (cle, tranche, nombre)
  values (qui, date_bin('5 minutes', maintenant, timestamptz '2000-01-01'), 1)
  on conflict on constraint numeros_affiches_pkey do update set nombre = n.nombre + 1;
  -- ménage, de temps en temps : les compteurs de plus de 2 jours
  if random() < 0.02 then
    delete from public.numeros_affiches n where n.tranche < maintenant - interval '2 days';
  end if;
  return contact;
end $$;

revoke execute on function public.afficher_numero(uuid, text) from public, anon;
grant execute on function public.afficher_numero(uuid, text) to authenticated, service_role;
revoke execute on function public.contact_annonce(uuid) from public, anon, authenticated;
