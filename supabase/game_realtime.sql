-- Ensure realtime works for game_states updates
-- (players table should already have this from earlier)
alter table public.game_states replica identity full;