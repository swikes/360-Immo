-- ════════════════════════════════════════════════════════════════════════════
-- 360-Immo.ci — plusieurs biens identiques dans une seule annonce (même résidence, même lotissement)
--
--   annonces.disponibles  nombre de biens identiques proposés (1 à 99 ; 1 : un seul bien) ; pas pour un immeuble
--                         entier. Un bien = une seule annonce (…_doublons.sql) : 5 appartements identiques d'une
--                         résidence font une annonce « 5 appartements identiques disponibles », pas cinq annonces.
--   annonces_en_ligne     + disponibles (cartes, fiche, biens similaires, favoris, alertes : tout ce qui la lit)
--   admin_a_verifier()    + disponibles
-- ════════════════════════════════════════════════════════════════════════════

alter table public.annonces add column disponibles smallint not null default 1
  constraint annonces_disponibles check (disponibles between 1 and 99),
  add constraint annonces_disponibles_immeuble check (disponibles = 1 or type_bien <> 'immeuble');
comment on column public.annonces.disponibles is
  'Nombre de biens identiques proposés par l''annonce (même résidence, même lotissement) ; 1 : un seul bien';

-- Lisible de tous, comme les autres caractéristiques (voir …_recherche.sql et …_coordonnees_privees.sql)
grant select (disponibles) on public.annonces to anon, authenticated;

-- Les annonces en ligne : même vue, avec le nombre de biens identiques (ajouté à la fin)
create or replace view public.annonces_en_ligne with (security_invoker = true) as
select
  a.id, a.reference, a.transaction, a.type_bien, t.nom as type_nom, a.titre, a.description,
  a.prix, a.loyer_par, a.caution_mois,
  v.nom as ville, c.nom as commune, coalesce(q.nom, a.quartier_texte) as quartier, a.adresse,
  a.ville_id, a.commune_id, a.quartier_id,
  a.surface, t.surface as surface_nom, a.pieces, a.studio, a.chambres, a.sanitaires, t.sanitaires as sanitaires_nom,
  a.meuble, a.dans_immeuble, a.etage, a.commodites,
  a.type_vendeur,
  case when a.type_vendeur = 'agence' then public.nom_agence_annonce(a.id) else an.nom end as contact_nom,
  a.contact_whatsapp,
  (a.premium and (a.premium_jusquau is null or a.premium_jusquau > now())) as premium,
  a.verifiee, a.vues, a.publiee_le, a.expire_le,
  coalesce(p.photos, '{}') as photos,
  an.code as annonceur, an.nom as annonceur_nom, an.agence as annonceur_agence, an.verifiee as annonceur_verifie,
  a.disponibles
from public.annonces a
join public.types_bien t on t.cle = a.type_bien
join public.villes v on v.id = a.ville_id
join public.communes c on c.id = a.commune_id
left join public.quartiers q on q.id = a.quartier_id
left join lateral (
  select array_agg(ph.chemin order by ph.ordre, ph.cree_le) as photos
  from public.photos_annonce ph where ph.annonce_id = a.id
) p on true
left join lateral public.annonceur_public(a.id) an on true
where a.statut = 'publiee' and (a.expire_le is null or a.expire_le > now());

-- La file « À vérifier » de l'équipe : même fonction, avec le nombre de biens identiques
create or replace function public.admin_a_verifier() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'reference', a.reference, 'titre', a.titre, 'description', a.description,
      'transaction', a.transaction, 'type_bien', a.type_bien, 'type_nom', t.nom,
      'prix', a.prix, 'loyer_par', a.loyer_par, 'caution_mois', a.caution_mois,
      'ville', v.nom, 'commune', c.nom, 'quartier', coalesce(q.nom, a.quartier_texte), 'quartier_hors_liste', a.quartier_texte is not null,
      'adresse', a.adresse, 'surface', a.surface, 'pieces', a.pieces, 'studio', a.studio, 'chambres', a.chambres,
      'sanitaires', a.sanitaires, 'meuble', a.meuble, 'dans_immeuble', a.dans_immeuble, 'etage', a.etage, 'commodites', a.commodites,
      'disponibles', a.disponibles,
      'type_vendeur', a.type_vendeur, 'contact_nom', a.contact_nom, 'contact_telephone', a.contact_telephone,
      'contact_whatsapp', a.contact_whatsapp, 'contact_telephone2', a.contact_telephone2,
      'contact_telephone2_whatsapp', a.contact_telephone2_whatsapp, 'contact_email', a.contact_email,
      'photos', coalesce((select jsonb_agg(ph.chemin order by ph.ordre, ph.cree_le) from public.photos_annonce ph where ph.annonce_id = a.id), '[]'),
      'cree_le', a.cree_le, 'modifie_le', a.modifie_le, 'publiee_le', a.publiee_le, 'expire_le', a.expire_le,
      'signalements', (select count(*) from public.signalements s where s.annonce_id = a.id and s.statut = 'a_traiter'),
      'derniere_decision', (select jsonb_build_object('decision', m.decision, 'motif', m.motif, 'le', m.cree_le)
                              from public.moderations m where m.annonce_id = a.id order by m.cree_le desc limit 1),
      'doublons', jsonb_build_object(
        'semblables', public.semblables(a.auteur_id, to_jsonb(a),
          coalesce((select array_agg(ph.empreinte) from public.photos_annonce ph where ph.annonce_id = a.id and ph.empreinte is not null), '{}'),
          a.id),
        'photos_ailleurs', public.photos_ailleurs(a.id)),
      'auteur', jsonb_build_object(
        'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'email', u.email, 'telephone', p.telephone, 'role', p.role,
        'agence', ag.nom, 'inscrit_le', p.cree_le,
        'en_ligne', (select count(*) from public.annonces o where o.auteur_id = a.auteur_id and o.statut = 'publiee'
                       and (o.expire_le is null or o.expire_le > now())),
        'refusees', (select count(*) from public.moderations m join public.annonces o on o.id = m.annonce_id
                      where o.auteur_id = a.auteur_id and m.decision in ('refusee', 'retiree')),
        'doublons_refuses', (select count(*) from public.moderations m where m.auteur_id = a.auteur_id and m.doublon)))
      order by a.modifie_le, a.cree_le)
    from public.annonces a
    join public.types_bien t on t.cle = a.type_bien
    join public.villes v on v.id = a.ville_id
    join public.communes c on c.id = a.commune_id
    left join public.quartiers q on q.id = a.quartier_id
    join public.profils p on p.id = a.auteur_id
    left join auth.users u on u.id = p.id
    left join public.agences ag on ag.id = p.agence_id
    where a.statut = 'en_attente'
  ), '[]');
end $$;
