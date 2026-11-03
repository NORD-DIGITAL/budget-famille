-- v3.11.0 : chaque mouvement d'argent passe par un compte du portefeuille.
--   * Épargne (versement / retrait) et dettes (prêt, emprunt, remboursements) : compte choisi → le solde bouge.
--   * Transferts entre comptes (Banque → Espèces, MVola → Espèces…).
--   * Business Pro : projets d'investissement (capital investi depuis un compte, dépenses et revenus du projet,
--     versement des gains vers un compte).
-- À exécuter après paiements.sql. Rejouable sans risque (uniquement des ajouts).

-- 0. Le compte doit appartenir au même carnet que la ligne
create or replace function public.check_account_carnet()
returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); k text; a uuid;
begin
  foreach k in array array['account_id', 'from_account', 'to_account'] loop
    a := nullif(j ->> k, '')::uuid;
    if a is not null and not exists (select 1 from accounts where id = a and carnet_id = (j ->> 'carnet_id')::uuid) then
      raise exception 'Compte inconnu dans ce carnet.';
    end if;
  end loop;
  return new;
end $$;

-- 1. Épargne et remboursements : compte utilisé
alter table public.savings_moves add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.debt_payments add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- 2. Dettes : compte et date du prêt / de l'emprunt (null pour les anciennes dettes = la création ne bouge pas le solde)
alter table public.debts add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.debts add column if not exists lent_on date;

-- 3. Anciens mouvements : rattachés au compte du même nom que le moyen choisi (sinon « Sans compte »)
with m(method, name) as (values ('especes', 'Espèces'), ('mvola', 'MVola'), ('orange', 'Orange Money'), ('banque', 'Banque'), ('airtel', 'Airtel Money'))
update public.savings_moves s set account_id = a.id
from m, public.accounts a
where s.account_id is null and s.method = m.method and a.carnet_id = s.carnet_id and a.name = m.name and not a.archived;

with m(method, name) as (values ('especes', 'Espèces'), ('mvola', 'MVola'), ('orange', 'Orange Money'), ('banque', 'Banque'), ('airtel', 'Airtel Money'))
update public.debt_payments p set account_id = a.id
from m, public.accounts a
where p.account_id is null and p.method = m.method and a.carnet_id = p.carnet_id and a.name = m.name and not a.archived;

-- 4. Transferts entre comptes
create table if not exists public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  from_account uuid not null references public.accounts(id) on delete cascade,
  to_account uuid not null references public.accounts(id) on delete cascade,
  amount bigint not null check (amount > 0),
  moved_on date not null default current_date,
  ref text check (char_length(ref) <= 60),
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_account <> to_account)
);
create index if not exists account_transfers_carnet on public.account_transfers (carnet_id, moved_on);
alter table public.account_transfers enable row level security;
drop policy if exists account_transfers_all on public.account_transfers;
create policy account_transfers_all on public.account_transfers for all to authenticated
  using (public.is_carnet_member(carnet_id)) with check (public.is_carnet_member(carnet_id));

-- 5. Projets d'investissement (Business Pro)
create table if not exists public.inv_projects (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  activite text not null default '' check (char_length(activite) <= 200),
  type text not null default 'vente' check (type in ('vente', 'partenariat', 'autre')),
  type_autre text not null default '' check (char_length(type_autre) <= 80),
  archived boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (type <> 'autre' or char_length(trim(type_autre)) > 0)
);
alter table public.inv_projects enable row level security;
drop policy if exists inv_projects_all on public.inv_projects;
create policy inv_projects_all on public.inv_projects for all to authenticated
  using (public.is_carnet_member(carnet_id)) with check (public.is_carnet_member(carnet_id));

-- capital   : argent investi, sorti d'un compte (le solde baisse)
-- depense   : dépense du projet, payée avec l'argent du projet (pas de compte)
-- revenu    : revenu du projet, reste dans le projet (pas de compte)
-- versement : argent du projet versé sur un compte (le solde monte)
create table if not exists public.inv_moves (
  id uuid primary key default gen_random_uuid(),
  carnet_id uuid not null references public.carnets(id) on delete cascade,
  project_id uuid not null references public.inv_projects(id) on delete cascade,
  kind text not null check (kind in ('capital', 'depense', 'revenu', 'versement')),
  amount bigint not null check (amount > 0),
  account_id uuid references public.accounts(id) on delete set null,
  moved_on date not null default current_date,
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists inv_moves_project on public.inv_moves (project_id, moved_on);
create index if not exists inv_moves_carnet on public.inv_moves (carnet_id, moved_on);
alter table public.inv_moves enable row level security;
drop policy if exists inv_moves_all on public.inv_moves;
create policy inv_moves_all on public.inv_moves for all to authenticated
  using (public.is_carnet_member(carnet_id)) with check (
    public.is_carnet_member(carnet_id)
    and exists (select 1 from public.inv_projects p where p.id = project_id and p.carnet_id = inv_moves.carnet_id)
  );

-- Règle : investir / verser demandent un compte ; dépenses et revenus du projet n'en ont pas
create or replace function public.inv_moves_rules()
returns trigger language plpgsql as $$
begin
  if new.kind in ('capital', 'versement') and new.account_id is null and (tg_op = 'INSERT' or new.kind is distinct from old.kind) then
    raise exception 'Choisis le compte.';
  end if;
  if new.kind in ('depense', 'revenu') then new.account_id := null; end if;
  return new;
end $$;
drop trigger if exists inv_moves_rules on public.inv_moves;
create trigger inv_moves_rules before insert or update on public.inv_moves for each row execute function public.inv_moves_rules();

-- 6. Contrôle « compte du même carnet » sur toutes ces tables
do $$
declare t text;
begin
  foreach t in array array['savings_moves', 'debt_payments', 'debts', 'account_transfers', 'inv_moves'] loop
    execute format('drop trigger if exists check_account_carnet on public.%I', t);
    execute format('create trigger check_account_carnet before insert or update on public.%I for each row execute function public.check_account_carnet()', t);
  end loop;
end $$;
