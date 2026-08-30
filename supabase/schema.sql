-- ============================================================
-- Flyer — leaderboard schema
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- 1) Profiles: one row per signed-in user (name + avatar from Google).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- 2) Games: one row per finished game. Every stat/leaderboard derives
--    from this table, so we keep the raw history forever.
create table if not exists public.games (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  mode           text not null check (mode in ('solo', 'multiplayer')),
  words_survived int  not null check (words_survived >= 0 and words_survived <= 1000),
  best_ms        int  check (best_ms is null or (best_ms between 120 and 60000)),
  avg_ms         int  check (avg_ms  is null or (avg_ms  between 120 and 60000)),
  correct        int  not null default 0 check (correct  >= 0),
  mistakes       int  not null default 0 check (mistakes >= 0),
  played_at      timestamptz not null default now()
);
create index if not exists games_user_idx   on public.games(user_id);
create index if not exists games_played_idx on public.games(played_at desc);

-- The CHECK constraints above are our basic anti-cheat: the database
-- itself rejects impossible reaction times (< 120 ms) and absurd runs,
-- no matter what a tampered client tries to insert.

-- 3) Auto-create a profile when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name', 'Player'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Row-Level Security: a user can read/write ONLY their own rows.
alter table public.profiles enable row level security;
alter table public.games    enable row level security;

drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "games self read"      on public.games;
drop policy if exists "games self insert"    on public.games;

create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "games self read"      on public.games    for select using (auth.uid() = user_id);
create policy "games self insert"    on public.games    for insert with check (auth.uid() = user_id);

-- 5) Public leaderboards — VIEWS that expose ONLY display name, avatar
--    and score. Never phone/email/anything private. security_invoker=off
--    lets anyone (even logged-out guests) read the aggregate board.
create or replace view public.leaderboard_alltime
  with (security_invoker = off) as
  select p.display_name,
         p.avatar_url,
         max(g.words_survived) as best_words,
         min(g.best_ms)        as best_ms
  from public.games g
  join public.profiles p on p.id = g.user_id
  group by p.id, p.display_name, p.avatar_url
  order by best_words desc, best_ms asc nulls last
  limit 100;

create or replace view public.leaderboard_weekly
  with (security_invoker = off) as
  select p.display_name,
         p.avatar_url,
         max(g.words_survived) as best_words,
         min(g.best_ms)        as best_ms
  from public.games g
  join public.profiles p on p.id = g.user_id
  where g.played_at >= date_trunc('week', now())
  group by p.id, p.display_name, p.avatar_url
  order by best_words desc, best_ms asc nulls last
  limit 100;

create or replace view public.leaderboard_fastest
  with (security_invoker = off) as
  select p.display_name,
         p.avatar_url,
         min(g.best_ms) as best_ms
  from public.games g
  join public.profiles p on p.id = g.user_id
  where g.best_ms is not null
  group by p.id, p.display_name, p.avatar_url
  order by best_ms asc
  limit 100;

grant select on public.leaderboard_alltime to anon, authenticated;
grant select on public.leaderboard_weekly  to anon, authenticated;
grant select on public.leaderboard_fastest to anon, authenticated;
