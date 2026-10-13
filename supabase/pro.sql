-- Mode PRO (v3.9.0) : Business Pro devient un espace à projets.
--   * Projet Légumes      : Sam-san + Chloé (tables bp_fournisseurs / bp_clients / bp_transactions)
--   * Projet NORD DIGITAL : Sam-san + andrinirinaonja@gmail.com (table nd_projets : suivi des projets clients)
--   * Carnet de travail   : chaque utilisateur PRO a le sien (tables work_*)
-- Tout utilisateur peut « Passer en PRO » (table pro_users). Les membres d'un projet sont PRO d'office
-- et gardent l'accès illimité (sans Go Code). À exécuter après business_pro.sql. Rejouable sans risque.

-- 1. Membres des projets
create table if not exists public.bp_members (
  projet text not null check (projet in ('legumes', 'nord-digital')),
  email text not null check (email = lower(email)),
  label text,
  created_at timestamptz not null default now(),
  primary key (projet, email)
);
alter table public.bp_members enable row level security;
revoke all on public.bp_members from anon, authenticated;

insert into public.bp_members (projet, email, label) values
  ('legumes', 'gosamsan1122@gmail.com', 'Sam-san'),
  ('legumes', 'raharisoamaevahchloe@gmail.com', 'Chloé'),
  ('nord-digital', 'gosamsan1122@gmail.com', 'Sam-san'),
  ('nord-digital', 'andrinirinaonja@gmail.com', null)
on conflict (projet, email) do nothing;

create or replace function public.bp_member(p_projet text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bp_members where projet = p_projet and email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.bp_member(text) from public, anon;
grant execute on function public.bp_member(text) to authenticated;

-- Membre d'au moins un projet = accès illimité (utilisé par my_access_v3)
create or replace function public.is_partner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bp_members where email = lower(coalesce(auth.jwt() ->> 'email', '')))
      or exists (select 1 from app_partners where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- 2. Projet Légumes : réservé aux membres « legumes »
do $$
declare t text;
begin
  foreach t in array array['bp_fournisseurs', 'bp_clients', 'bp_transactions'] loop
    execute format('drop policy if exists "partenaires" on public.%I', t);
    execute format('create policy "partenaires" on public.%I for all to authenticated using (public.bp_member(''legumes'')) with check (public.bp_member(''legumes''))', t);
  end loop;
end $$;

-- 3. Projet NORD DIGITAL : suivi des projets clients
create table if not exists public.nd_projets (
  id uuid primary key default gen_random_uuid(),
  client text not null check (char_length(client) between 1 and 120),
  tel text not null default '' check (char_length(tel) <= 40),
  type text not null default 'Site web' check (char_length(type) <= 40),
  titre text not null default '' check (char_length(titre) <= 160),
  statut text not null default 'devis' check (statut in ('devis', 'en_cours', 'livre', 'annule')),
  montant numeric not null default 0 check (montant >= 0),
  acompte numeric not null default 0 check (acompte >= 0),
  echeance date,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nd_projets enable row level security;
drop policy if exists "membres" on public.nd_projets;
create policy "membres" on public.nd_projets for all to authenticated
  using (public.bp_member('nord-digital')) with check (public.bp_member('nord-digital'));
revoke all on public.nd_projets from anon;
grant select, insert, update, delete on public.nd_projets to authenticated;

-- 4. Membres visibles entre eux, projet par projet
create or replace function public.bp_project_members(p_projet text)
returns table(user_id uuid, email text, label text, full_name text, phone text, has_account boolean)
language sql stable security definer set search_path = public as $$
  select u.id, m.email, m.label,
         coalesce(nullif(trim(pr.full_name), ''), u.raw_user_meta_data ->> 'full_name'),
         u.raw_user_meta_data ->> 'phone_local',
         u.id is not null
  from bp_members m
  left join auth.users u on lower(u.email) = m.email
  left join profiles pr on pr.id = u.id
  where m.projet = p_projet and public.bp_member(p_projet)
  order by m.created_at, m.email;
$$;
revoke all on function public.bp_project_members(text) from public, anon;
grant execute on function public.bp_project_members(text) to authenticated;

-- Compatibilité avec la 3.8.x
create or replace function public.bp_partners()
returns table(user_id uuid, email text, label text, full_name text, phone text, has_account boolean)
language sql stable security definer set search_path = public as $$
  select * from public.bp_project_members('legumes');
$$;

-- 5. Passer en PRO
create table if not exists public.pro_users (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  since timestamptz not null default now()
);
alter table public.pro_users enable row level security;
drop policy if exists "own select" on public.pro_users;
drop policy if exists "own insert" on public.pro_users;
create policy "own select" on public.pro_users for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.pro_users for insert to authenticated with check (user_id = auth.uid());
revoke all on public.pro_users from anon;
grant select, insert on public.pro_users to authenticated;

create or replace function public.my_pro()
returns table(pro boolean, projets text[])
language sql stable security definer set search_path = public as $$
  select public.is_partner() or exists (select 1 from pro_users where user_id = auth.uid()),
         coalesce((select array_agg(projet order by projet) from bp_members where email = lower(coalesce(auth.jwt() ->> 'email', ''))), '{}');
$$;
revoke all on function public.my_pro() from public, anon;
grant execute on function public.my_pro() to authenticated;

-- 6. Carnet de travail : chaque utilisateur a le sien (plus de restriction à un seul e-mail)
do $$
declare t text;
begin
  foreach t in array array['work_events', 'work_tasks', 'work_notes'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- 7. Statuts des utilisateurs (page admin « Utilisateurs »)
create or replace function public.admin_user_roles()
returns table(user_id uuid, is_admin boolean, is_pro boolean, projets text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return query
    select u.id,
           exists (select 1 from app_admins a where a.user_id = u.id),
           exists (select 1 from pro_users p where p.user_id = u.id) or exists (select 1 from bp_members m where m.email = lower(u.email)),
           coalesce((select array_agg(m.projet order by m.projet) from bp_members m where m.email = lower(u.email)), '{}')
    from auth.users u;
end $$;
revoke all on function public.admin_user_roles() from public, anon;
grant execute on function public.admin_user_roles() to authenticated;
