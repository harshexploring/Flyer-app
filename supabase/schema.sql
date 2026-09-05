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

-- 6) Per-word miss counts, so a player can see the words they trip on
--    most ("your tricky words"). One row per (user, word).
create table if not exists public.word_misses (
  user_id        uuid not null references auth.users(id) on delete cascade,
  word           text not null,
  flies          boolean,
  misses         int not null default 0,
  last_missed_at timestamptz not null default now(),
  primary key (user_id, word)
);
alter table public.word_misses enable row level security;
-- Add last_missed_at to older installs that predate it.
alter table public.word_misses
  add column if not exists last_missed_at timestamptz not null default now();

drop policy if exists "word_misses self read" on public.word_misses;
create policy "word_misses self read" on public.word_misses
  for select using (auth.uid() = user_id);

-- Bump miss counts + recency for the current user. Called once per game
-- with the words that cost a life. The profile shows only the most
-- RECENTLY missed words (ordered by last_missed_at), so the list never
-- grows unbounded on screen.
create or replace function public.record_misses(p_words text[], p_flies boolean[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare i int;
begin
  if auth.uid() is null then return; end if;
  for i in 1 .. coalesce(array_length(p_words, 1), 0) loop
    insert into public.word_misses (user_id, word, flies, misses, last_missed_at)
    values (auth.uid(), p_words[i], p_flies[i], 1, now())
    on conflict (user_id, word)
      do update set misses = public.word_misses.misses + 1,
                    last_missed_at = now();
  end loop;
end;
$$;

grant execute on function public.record_misses(text[], boolean[]) to authenticated;

-- ============================================================
-- 7) Admin allow-list. One person (by Google email) gets admin access,
--    enforced by RLS below — not just a hidden button in the UI.
-- ============================================================
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security; -- no policies: clients can't read it directly

-- ▸▸▸ EDIT THIS EMAIL to your own Google account before running ◂◂◂
insert into public.admins (email) values ('harshjha22022002@gmail.com')
  on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to authenticated;

-- Admin can read every player's profile + games (for the dashboard).
-- RLS is permissive (OR), so this is added ON TOP of the self-read rules.
drop policy if exists "profiles admin read" on public.profiles;
drop policy if exists "games admin read"    on public.games;
create policy "profiles admin read" on public.profiles for select using (public.is_admin());
create policy "games admin read"    on public.games    for select using (public.is_admin());

-- ============================================================
-- 8) Words live in the database so the admin can add/remove them
--    without code changes. Everyone can read; only admin can write.
--    Seed the initial list with supabase/seed_words.sql.
-- ============================================================
create table if not exists public.words (
  id         bigint generated always as identity primary key,
  text       text not null unique,
  flies      boolean not null,
  created_at timestamptz not null default now()
);
alter table public.words enable row level security;

drop policy if exists "words public read"  on public.words;
drop policy if exists "words admin insert" on public.words;
drop policy if exists "words admin update" on public.words;
drop policy if exists "words admin delete" on public.words;
create policy "words public read"  on public.words for select using (true);
create policy "words admin insert" on public.words for insert with check (public.is_admin());
create policy "words admin update" on public.words for update using (public.is_admin());
create policy "words admin delete" on public.words for delete using (public.is_admin());

-- ============================================================
-- 9) Feedback: players leave a ⭐ rating + comment; only admin reads.
-- ============================================================
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  name       text,
  rating     int check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

drop policy if exists "feedback insert" on public.feedback;
drop policy if exists "feedback admin read" on public.feedback;
-- Anyone signed in can leave feedback as themselves (or anonymously).
create policy "feedback insert" on public.feedback
  for insert with check (user_id is null or auth.uid() = user_id);
create policy "feedback admin read" on public.feedback
  for select using (public.is_admin());

-- ============================================================
-- 10) Player ratings — the skill number (0–3000), NOT volume-based.
--     Uses each player's most recent 20 games:
--       accuracy = correct / (correct + mistakes)          weight 0.45
--       speed    = clamp((700 - avg_ms) / 450, 0..1)        weight 0.35
--       depth    = clamp(best_words / 35, 0..1)             weight 0.20
--       rating   = round(3000 * weighted sum)
--     Keep this formula in sync with computeRating() in js/rating.js.
-- ============================================================
create or replace view public.player_ratings
  with (security_invoker = off) as
  with ranked as (
    select g.*, row_number() over (partition by g.user_id order by g.played_at desc) rn
    from public.games g
  ),
  agg as (
    select user_id,
           count(*)                                   as games,
           sum(correct)                               as correct,
           sum(mistakes)                              as mistakes,
           avg(avg_ms) filter (where avg_ms is not null) as avg_ms,
           max(words_survived)                        as best_words
    from ranked where rn <= 20
    group by user_id
  )
  select p.display_name, p.avatar_url, a.games,
         round(3000 * (
             0.45 * coalesce(a.correct::numeric / nullif(a.correct + a.mistakes, 0), 0)
           + 0.35 * greatest(0, least(1, (700 - coalesce(a.avg_ms, 700)) / 450.0))
           + 0.20 * greatest(0, least(1, a.best_words / 35.0))
         ))::int as rating
  from agg a
  join public.profiles p on p.id = a.user_id;

create or replace view public.leaderboard_rating
  with (security_invoker = off) as
  select display_name, avatar_url, rating, games
  from public.player_ratings
  order by rating desc, games desc
  limit 100;

grant select on public.leaderboard_rating to anon, authenticated;
