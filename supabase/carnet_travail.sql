-- Carnet de travail (v3.7.0) : rendez-vous, tâches et notes personnels.
-- Chaque ligne appartient à un seul utilisateur (RLS : user_id = auth.uid()).

create table if not exists public.work_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  note text check (note is null or char_length(note) <= 1000),
  day date not null,                                   -- jour du rendez-vous (heure locale du téléphone)
  at_time text check (at_time is null or at_time ~ '^[0-2][0-9]:[0-5][0-9]$'), -- null = journée entière
  duration_min int not null default 30 check (duration_min between 5 and 1440),
  remind_min int check (remind_min is null or remind_min between 0 and 10080),
  weekly boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  due date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists work_events_user_day on public.work_events (user_id, day);
create index if not exists work_tasks_user on public.work_tasks (user_id);
create index if not exists work_notes_user on public.work_notes (user_id);

alter table public.work_events enable row level security;
alter table public.work_tasks enable row level security;
alter table public.work_notes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['work_events', 'work_tasks', 'work_notes'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.work_events, public.work_tasks, public.work_notes to authenticated;
