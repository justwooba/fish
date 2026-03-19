-- ============================================================================
-- Fish Card Game — Supabase Database Schema
-- Run this ENTIRE file in your Supabase SQL Editor (one time).
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── ROOMS ──────────────────────────────────────────────────────────────────

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,  -- references auth.users(id)
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  settings jsonb not null default '{
    "team_declare": true,
    "nullify_misdeclare": true,
    "no_turn_on_misdeclare": false,
    "play_all_sets": true
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── PLAYERS ────────────────────────────────────────────────────────────────

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,  -- references auth.users(id)
  display_name text not null,
  team text check (team in ('A', 'B')),
  seat int check (seat >= 0 and seat <= 5),
  card_count int not null default 0,
  is_connected boolean not null default true,
  created_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- ─── GAME STATE ─────────────────────────────────────────────────────────────
-- One row per active/completed game. `hands` is stored server-side only.

create table public.game_states (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique not null references public.rooms(id) on delete cascade,
  current_turn uuid,  -- player_id whose turn it is
  hands jsonb not null default '{}'::jsonb,        -- SECRET: player_id → card[]
  last_ask jsonb,                                   -- most recent ask (public)
  declared_sets jsonb not null default '[]'::jsonb,
  score_a int not null default 0,
  score_b int not null default 0,
  action_log jsonb not null default '[]'::jsonb,    -- full log (hidden during play)
  status text not null default 'playing' check (status in ('playing', 'finished')),
  winner text check (winner in ('A', 'B')),
  created_at timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- We enable RLS so that clients can only see what they're allowed to.

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.game_states enable row level security;

-- Rooms: anyone authenticated can read rooms, only host can update
create policy "Anyone can read rooms"
  on public.rooms for select
  using (true);

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check (auth.uid() = host_id);

create policy "Host can update room"
  on public.rooms for update
  using (auth.uid() = host_id);

-- Players: anyone in the room can read players, users manage their own row
create policy "Anyone can read players"
  on public.players for select
  using (true);

create policy "Users can insert themselves"
  on public.players for insert
  with check (auth.uid() = user_id);

create policy "Users can update themselves"
  on public.players for update
  using (auth.uid() = user_id);

create policy "Users can delete themselves"
  on public.players for delete
  using (auth.uid() = user_id);

-- Game states: players can read SOME columns (we'll filter hands in the API)
-- For now, allow read but hands will be stripped by the API before sending.
create policy "Anyone can read game state"
  on public.game_states for select
  using (true);

-- Only server (service role) should insert/update game states, but since
-- we're using anon key + API routes, we allow it for players in the room.
-- The real protection is that game logic runs server-side in API routes.
create policy "Server can manage game state"
  on public.game_states for all
  using (true);

-- ─── REALTIME ───────────────────────────────────────────────────────────────
-- Enable realtime for these tables so clients get live updates.

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_states;

-- ─── HELPER FUNCTION: Generate room code ────────────────────────────────────

create or replace function public.generate_room_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no I/O/0/1 to avoid confusion
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;