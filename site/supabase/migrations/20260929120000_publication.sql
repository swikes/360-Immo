-- ══════════════════════════════════════════════════════════════════════════════
--  360-Immo.ci — Publication des annonces (étape 4)
-- ══════════════════════════════════════════════════════════════════════════════
--  - Contact de l'annonce : particulier ou agence, e-mail, chaque numéro « sur WhatsApp » ou non.
--  - Quartier écrit à la main quand il n'est pas dans la liste (quartier_texte).
--  - Validité : une annonce publiée reste visible 90 jours (expire_le) ; son auteur peut la renouveler
--    dans les 15 derniers jours ou une fois expirée (renouveler_annonce).
--  - Nouvelle vérification par l'équipe quand une annonce publiée change beaucoup : transaction, type de
--    bien, lieu, prix (plus de 20 % d'écart) ou nouvelle photo. Les autres retouches restent en ligne.
--  - 20 photos au plus par annonce.

alter table public.annonces
  add column type_vendeur text not null default 'particulier'
    constraint type_vendeur_connu check (type_vendeur in ('particulier', 'agence')),
  add column contact_email text
    constraint contact_email_format check (contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column contact_whatsapp boolean not null default true,
  add column contact_telephone2_whatsapp boolean not null default false,
  add column quartier_texte text
    constraint quartier_texte_longueur check (quartier_texte is null or char_length(btrim(quartier_texte)) between 2 and 80),
  add column expire_le timestamptz,
  -- Numéros enregistrés avec l'indicatif, comme dans les profils : « +225 07 48 32 11 90 »
  add constraint contact_telephone_format
    check (contact_telephone is null or contact_telephone ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$'),
  add constraint contact_telephone2_format
    check (contact_telephone2 is null or contact_telephone2 ~ '^\+[0-9]{1,4} [0-9][0-9 ]{3,22}$');

create index annonces_expire_le on public.annonces (expire_le);

-- Durée de visibilité d'une annonce publiée (une seule valeur pour tout le site)
create function public.duree_validite() returns interval
language sql immutable set search_path = '' as $$ select interval '90 days' $$;

-- Publication, Premium, vérification, vues, validité : réservés à 360-Immo.ci (complète la version de l'étape 2)
create or replace function public.annonces_controler() returns trigger
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
      new.expire_le := null;
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
      new.expire_le := old.expire_le;
      new.motif_refus := old.motif_refus;
      -- Une annonce publiée qui change beaucoup repasse par la vérification de l'équipe
      if old.statut = 'publiee' and new.statut = 'publiee' and (
           new.transaction is distinct from old.transaction
        or new.type_bien is distinct from old.type_bien
        or new.commune_id is distinct from old.commune_id
        or new.quartier_id is distinct from old.quartier_id
        or new.quartier_texte is distinct from old.quartier_texte
        or abs(new.prix - old.prix) * 5 > old.prix            -- plus de 20 % d'écart
      ) then
        new.statut := 'en_attente';
      end if;
    end if;
  end if;
  if new.statut = 'publiee' and (tg_op = 'INSERT' or old.statut <> 'publiee') then
    new.publiee_le := now();
    new.expire_le := now() + public.duree_validite();
    new.motif_refus := null;
  end if;
  if tg_op = 'UPDATE' then new.modifie_le := now(); end if;
  return new;
end $$;

-- Visibles de tous : les annonces publiées et pas encore expirées (l'auteur et l'équipe voient tout)
drop policy "Annonces : publiées visibles par tous, les siennes par leur auteur" on public.annonces;
create policy "Annonces : publiées et valides visibles par tous, les siennes par leur auteur" on public.annonces
  for select to anon, authenticated
  using ((statut = 'publiee' and (expire_le is null or expire_le > now())) or auteur_id = auth.uid() or public.est_admin());

-- Renouveler une annonce publiée : dans les 15 derniers jours, ou une fois expirée
create function public.renouveler_annonce(annonce uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  fin timestamptz;
begin
  update public.annonces set expire_le = now() + public.duree_validite()
   where id = annonce and auteur_id = auth.uid() and statut = 'publiee'
     and expire_le < now() + interval '15 days'
  returning expire_le into fin;
  if fin is null then
    raise exception 'Cette annonce ne peut pas encore être renouvelée : c''est possible dans ses 15 derniers jours, ou une fois expirée.'
      using errcode = 'check_violation';
  end if;
  return fin;
end $$;
revoke execute on function public.renouveler_annonce(uuid) from public, anon;
grant execute on function public.renouveler_annonce(uuid) to authenticated;

-- 20 photos au plus par annonce
create function public.photos_annonce_limite() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.photos_annonce where annonce_id = new.annonce_id) >= 20 then
    raise exception '20 photos au plus par annonce.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger photos_annonce_limite before insert on public.photos_annonce
  for each row execute function public.photos_annonce_limite();

-- Nouvelle photo sur une annonce publiée : nouvelle vérification par l'équipe
create function public.photos_annonce_reverifier() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_admin() then
    update public.annonces set statut = 'en_attente' where id = new.annonce_id and statut = 'publiee';
  end if;
  return null;
end $$;
create trigger photos_annonce_reverifier after insert on public.photos_annonce
  for each row execute function public.photos_annonce_reverifier();

-- Retirer une photo demande aussi de pouvoir « voir » son fichier (règle de Supabase Storage) :
-- chacun voit les fichiers de ses annonces (les visiteurs, eux, passent par l'adresse publique des photos)
create policy "Photos d'annonces : vues par l'auteur de l'annonce (pour les retirer)" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos-annonces' and public.photo_de_mon_annonce(name));
