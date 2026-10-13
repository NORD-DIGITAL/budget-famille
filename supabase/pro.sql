-- Mode PRO (v3.9.0) : Business Pro devient un espace à projets.
--   * Projet Légumes      : Sam-san + Chloé (tables bp_fournisseurs / bp_clients / bp_transactions)
--   * Projet NORD DIGITAL : Sam-san + andrinirinaonja@gmail.com (tables nd_clients, nd_prospects, nd_idees)
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

-- 3. Projet NORD DIGITAL : Clients, Prospects, Idées (membres « nord-digital »)
create table if not exists public.nd_clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 120),
  email text not null default '' check (char_length(email) <= 160),
  tel text not null default '' check (char_length(tel) <= 40),
  activite text not null default '' check (char_length(activite) <= 200),       -- le projet réalisé pour lui
  type_client text not null default 'GP' check (type_client in ('GP', 'PRO')),
  hebergement text not null default 'nord-digital' check (hebergement in ('nord-digital', 'autre')),
  hebergement_autre text not null default '' check (char_length(hebergement_autre) <= 120),
  domaine text not null default '' check (char_length(domaine) <= 160),
  date_conception date,
  date_deploiement date,
  premier_paiement date,
  premier_paiement_montant numeric not null default 0 check (premier_paiement_montant >= 0),
  type_paiement text not null default 'cash' check (type_paiement in ('abonnement', 'cash')),
  mensualite numeric not null default 0 check (mensualite >= 0),               -- abonnement
  abo_statut text not null default 'impaye' check (abo_statut in ('paye', 'impaye')),
  cash_mode text not null default 'nette' check (cash_mode in ('nette', 'echelonne')),
  montant_total numeric not null default 0 check (montant_total >= 0),          -- cash
  deja_paye numeric not null default 0 check (deja_paye >= 0),
  cash_statut text not null default 'en_attente' check (cash_statut in ('paye', 'en_attente')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'termine', 'vendu')),
  notes text not null default '' check (char_length(notes) <= 8000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nd_prospects (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 120),
  email text not null default '' check (char_length(email) <= 160),
  tel text not null default '' check (char_length(tel) <= 40),
  activite text not null default '' check (char_length(activite) <= 200),
  type_client text not null default 'GP' check (type_client in ('GP', 'PRO')),
  date_conception date,
  idee text not null default '' check (char_length(idee) <= 8000),
  type_paiement text not null default 'cash' check (type_paiement in ('abonnement', 'cash')),
  taches jsonb not null default '[]'::jsonb,                                     -- [{ "t": "…", "ok": false }]
  statut text not null default 'en_cours' check (statut in ('en_cours', 'annule')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nd_idees (
  id uuid primary key default gen_random_uuid(),
  secteur text not null default 'Autre' check (char_length(secteur) <= 60),
  solution text not null default '' check (char_length(solution) <= 60),
  type_client text not null default 'GP' check (type_client in ('GP', 'PRO', 'GP et PRO')),
  type_paiement text not null default 'cash' check (type_paiement in ('abonnement', 'cash')),
  note text not null default '' check (char_length(note) <= 8000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['nd_clients', 'nd_prospects', 'nd_idees'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membres" on public.%I', t);
    execute format('create policy "membres" on public.%I for all to authenticated using (public.bp_member(''nord-digital'')) with check (public.bp_member(''nord-digital''))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Bouton « Déploiement » : le prospect devient client (et quitte la liste des prospects)
create or replace function public.nd_deploy_prospect(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p nd_prospects; v_id uuid; v_taches text;
begin
  if not public.bp_member('nord-digital') then raise exception 'Réservé au Projet NORD DIGITAL'; end if;
  select * into p from nd_prospects where id = p_id;
  if not found then raise exception 'Prospect introuvable'; end if;
  select string_agg(case when (x ->> 'ok')::boolean then '[x] ' else '[ ] ' end || (x ->> 't'), E'\n')
    into v_taches from jsonb_array_elements(p.taches) x;
  insert into nd_clients (nom, email, tel, activite, type_client, date_conception, date_deploiement, type_paiement, statut, notes, created_by)
  values (p.nom, p.email, p.tel, p.activite, p.type_client, p.date_conception, current_date, p.type_paiement, 'en_cours',
          coalesce(concat_ws(E'\n\n', case when p.idee <> '' then 'Idée de conception :' || E'\n' || p.idee end, case when v_taches is not null then 'Tâches :' || E'\n' || v_taches end), ''),
          coalesce(p.created_by, auth.uid()))
  returning id into v_id;
  delete from nd_prospects where id = p_id;
  return v_id;
end $$;
revoke all on function public.nd_deploy_prospect(uuid) from public, anon;
grant execute on function public.nd_deploy_prospect(uuid) to authenticated;

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
