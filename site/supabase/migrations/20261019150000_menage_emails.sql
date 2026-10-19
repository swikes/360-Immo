-- Ménage des e-mails (audit M7) : la file des e-mails (notifications) garde le contenu de chaque e-mail préparé
-- (noms, numéros, messages, copie des demandes de contact). Chaque matin, la tâche programmée (app/api/notifications)
-- efface ceux de plus de 6 mois, quel que soit leur état.
-- 6 mois couvrent tout ce qui relit la file : les statistiques des annonceurs (alertes envoyées, sur 90 jours comparés
-- aux 90 jours d'avant), les regroupements (1 heure pour les messages) et les rappels de fin d'annonce (une date de fin).
-- Durée à confirmer par le juriste ; la politique de confidentialité l'annonce (brouillon, mis à jour ci-dessous).

create index if not exists notifications_date on public.notifications (cree_le);

create function public.effacer_vieux_emails() returns integer
language sql security definer set search_path = '' as $$
  with effaces as (
    delete from public.notifications n where n.cree_le < now() - interval '6 months' returning 1
  )
  select count(*)::integer from effaces;
$$;
revoke execute on function public.effacer_vieux_emails() from public, anon, authenticated;
grant execute on function public.effacer_vieux_emails() to service_role;

-- Politique de confidentialité : la durée est ajoutée à la liste, si cette liste n'a pas été réécrite dans
-- l'Administration (sinon la page n'est pas touchée)
update public.pages_site set
  contenu = replace(contenu,
    '- **Messages du formulaire de contact** : supprimés un an après avoir été traités.',
    '- **Messages du formulaire de contact** : supprimés un an après avoir été traités.' || E'\n' ||
    '- **E-mails envoyés par le site** (alertes, messages reçus, demandes de visite, rappels) : une copie est gardée 6 mois pour suivre les envois, puis effacée.')
where slug = 'confidentialite'
  and position('- **Messages du formulaire de contact** : supprimés un an après avoir été traités.' in contenu) > 0
  and position('**E-mails envoyés par le site**' in contenu) = 0;
