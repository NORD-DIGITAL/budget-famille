-- Business Pro (v3.8.0) : carnet fournisseurs / clients en légumes, partagé entre les partenaires.
-- Réservé aux comptes de la table app_partners (Sam-san et Chloé).
-- Les partenaires ont aussi un accès illimité (pas de Go Code) sans être administrateurs.
-- Script rejouable sans risque.

-- 1. Partenaires
create table if not exists public.app_partners (
  email text primary key check (email = lower(email)),
  label text,
  created_at timestamptz not null default now()
);
alter table public.app_partners enable row level security;
revoke all on public.app_partners from anon, authenticated;

insert into public.app_partners (email, label) values
  ('gosamsan1122@gmail.com', 'Sam-san'),
  ('raharisoamaevahchloe@gmail.com', 'Chloé')
on conflict (email) do nothing;

create or replace function public.is_partner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_partners where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_partner() from public, anon;
grant execute on function public.is_partner() to authenticated;

-- 2. Accès illimité des partenaires (même signature : marche aussi avec l'appli déjà installée)
create or replace function public.my_access_v3()
returns table(is_admin boolean, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select public.is_app_admin(),
         case when public.is_partner() then '2999-12-31 00:00:00+00'::timestamptz
              else (select s.expires_at from subscriptions s where s.user_id = auth.uid()) end;
$$;

-- 3. Tables du carnet Business Pro (données communes aux partenaires)
create table if not exists public.bp_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '' check (char_length(nom) <= 120),
  quartier text not null default '' check (char_length(quartier) <= 120),
  tel text not null default '' check (char_length(tel) <= 40),
  produits text[] not null default '{}',
  autres text not null default '' check (char_length(autres) <= 300),
  mois int[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 4000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bp_clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '' check (char_length(nom) <= 120),
  region text not null default '' check (char_length(region) <= 120),
  tel text not null default '' check (char_length(tel) <= 40),
  produits text[] not null default '{}',
  autres text not null default '' check (char_length(autres) <= 300),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- achat = auprès d'un fournisseur, vente = à un client. contact_nom garde le nom si la fiche est supprimée.
create table if not exists public.bp_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('achat', 'vente')),
  contact_id uuid,
  contact_nom text not null default '',
  produit text not null check (char_length(produit) between 1 and 80),
  qte numeric not null default 0 check (qte >= 0),
  unite text not null default 'kg' check (char_length(unite) <= 20),
  prix_u numeric not null default 0 check (prix_u >= 0),
  montant numeric not null check (montant >= 0),
  jour date not null default current_date,
  paiement text not null default 'Espèces' check (char_length(paiement) <= 40),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bp_transactions_jour on public.bp_transactions (jour desc);
create index if not exists bp_transactions_contact on public.bp_transactions (contact_id);

-- 4. Sécurité : seuls les partenaires lisent et écrivent
do $$
declare t text;
begin
  foreach t in array array['bp_fournisseurs', 'bp_clients', 'bp_transactions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "partenaires" on public.%I', t);
    execute format('create policy "partenaires" on public.%I for all to authenticated using (public.is_partner()) with check (public.is_partner())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
