-- Surveillance du site (audit E6, étape 9e) : l'adresse de contrôle app/api/sante, appelée toutes les 5 minutes par
-- un service de surveillance (UptimeRobot, voir DEPANNAGE.md), vérifie que la base répond, que la tâche du matin est
-- passée et que les e-mails partent. La tâche du matin (app/api/notifications) note ici chacun de ses passages.

create table public.taches_programmees (
  nom text primary key,
  passee_le timestamptz not null default now()
);
alter table public.taches_programmees enable row level security;
revoke all on public.taches_programmees from anon, authenticated;
-- Point de départ : sans aucun passage de la tâche dans les 26 heures qui suivent la mise en ligne, le contrôle le signale
insert into public.taches_programmees (nom) values ('matin');

-- Passage d'une tâche programmée (clé secrète : la tâche du matin)
create function public.noter_tache(nom text) returns void
language sql security definer set search_path = '' as $$
  insert into public.taches_programmees (nom, passee_le) values (noter_tache.nom, now())
  on conflict on constraint taches_programmees_pkey do update set passee_le = excluded.passee_le;
$$;

-- Ce que l'adresse de contrôle regarde (clé secrète) : dernier passage de la tâche du matin, e-mails qui attendent
-- depuis plus de 26 heures (la tâche du matin vide la file chaque jour : s'il en reste, l'envoi est en panne)
create function public.etat_surveillance() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tache_du_matin', (select t.passee_le from public.taches_programmees t where t.nom = 'matin'),
    'emails_en_retard', (select count(*) from public.notifications n
                          where n.statut = 'a_envoyer' and n.cree_le < now() - interval '26 hours'));
$$;

revoke execute on function public.noter_tache(text), public.etat_surveillance() from public, anon, authenticated;
grant execute on function public.noter_tache(text), public.etat_surveillance() to service_role;
