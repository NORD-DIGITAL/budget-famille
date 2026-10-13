-- Paiements (v3.10.0) : historique des paiements des clients NORD DIGITAL, pièces jointes,
-- et règle NORD DIGITAL des moyens de paiement (aussi appliquée aux achats/ventes du Projet Légumes).
-- À exécuter après pro.sql. Rejouable sans risque.

-- 1. Règle NORD DIGITAL des moyens de paiement
--    Mobile Money (MVola, Orange Money, Airtel Money) : numéro à 10 chiffres commençant par 032/033/034/036/037/038 + référence
--    Chèque : nom + numéro du chèque · Virement : nom + numéro du virement · Espèces / TPE : rien de plus
create or replace function public.paiement_valide(p_moyen text, p_numero text, p_reference text, p_nom text, p_num_doc text)
returns boolean language sql immutable as $$
  select case
    when p_moyen in ('MVola', 'Orange Money', 'Airtel Money')
      then coalesce(p_numero, '') ~ '^03[234678][0-9]{7}$' and length(trim(coalesce(p_reference, ''))) > 0
    when p_moyen in ('Chèque', 'Virement')
      then length(trim(coalesce(p_nom, ''))) > 0 and length(trim(coalesce(p_num_doc, ''))) > 0
    else true
  end;
$$;

-- 2. Historique des paiements des clients (Projet NORD DIGITAL)
create table if not exists public.nd_paiements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.nd_clients(id) on delete cascade,
  jour date not null default current_date,
  montant numeric not null check (montant > 0),
  moyen text not null check (moyen in ('Espèces', 'MVola', 'Orange Money', 'Airtel Money', 'Chèque', 'Virement', 'TPE')),
  mm_numero text not null default '' check (char_length(mm_numero) <= 10),
  reference text not null default '' check (char_length(reference) <= 80),
  payeur_nom text not null default '' check (char_length(payeur_nom) <= 120),
  num_doc text not null default '' check (char_length(num_doc) <= 60),
  mois text check (mois is null or mois ~ '^[0-9]{4}-[0-9]{2}$'),           -- mois couvert (abonnement)
  note text not null default '' check (char_length(note) <= 500),
  piece_path text,                                                           -- pièce jointe (bucket pro-pieces)
  piece_nom text,
  piece_type text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint regle_paiement check (public.paiement_valide(moyen, mm_numero, reference, payeur_nom, num_doc))
);
create index if not exists nd_paiements_client on public.nd_paiements (client_id, jour desc);
alter table public.nd_paiements enable row level security;
drop policy if exists "membres" on public.nd_paiements;
create policy "membres" on public.nd_paiements for all to authenticated
  using (public.bp_member('nord-digital')) with check (public.bp_member('nord-digital'));
revoke all on public.nd_paiements from anon;
grant select, insert, update, delete on public.nd_paiements to authenticated;

-- Paiement cash : « déjà payé » et statut suivent l'historique
create or replace function public.nd_paiements_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_client uuid := coalesce(new.client_id, old.client_id); v_sum numeric;
begin
  select coalesce(sum(montant), 0) into v_sum from nd_paiements where client_id = v_client;
  update nd_clients set
    deja_paye = v_sum,
    cash_statut = case when montant_total > 0 and v_sum >= montant_total then 'paye' else 'en_attente' end,
    updated_at = now()
  where id = v_client and type_paiement = 'cash';
  return null;
end $$;
drop trigger if exists nd_paiements_sync on public.nd_paiements;
create trigger nd_paiements_sync after insert or update or delete on public.nd_paiements
  for each row execute function public.nd_paiements_sync();

-- 3. Projet Légumes : mêmes détails de paiement sur les achats / ventes
alter table public.bp_transactions add column if not exists mm_numero text not null default '';
alter table public.bp_transactions add column if not exists reference text not null default '';
alter table public.bp_transactions add column if not exists payeur_nom text not null default '';
alter table public.bp_transactions add column if not exists num_doc text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bp_regle_paiement') then
    -- not valid : les anciennes lignes ne sont pas bloquées, toutes les nouvelles respectent la règle
    alter table public.bp_transactions add constraint bp_regle_paiement
      check (public.paiement_valide(paiement, mm_numero, reference, payeur_nom, num_doc)) not valid;
  end if;
end $$;

-- 4. Pièces jointes des projets PRO (privées, 10 Mo, images et PDF)
--    Chemin : <projet>/<dossier>/<fichier>, ex. nord-digital/<client>/<id>.pdf — lisibles par les membres du projet uniquement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-pieces', 'pro-pieces', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pro_pieces_select" on storage.objects;
drop policy if exists "pro_pieces_insert" on storage.objects;
drop policy if exists "pro_pieces_delete" on storage.objects;
create policy "pro_pieces_select" on storage.objects for select to authenticated
  using (bucket_id = 'pro-pieces' and public.bp_member((storage.foldername(name))[1]));
create policy "pro_pieces_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pro-pieces' and public.bp_member((storage.foldername(name))[1]));
create policy "pro_pieces_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pro-pieces' and public.bp_member((storage.foldername(name))[1]));
