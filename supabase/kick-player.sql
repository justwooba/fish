create or replace function public.kick_player(
  target_player_id uuid,
  room_id_input uuid
)
returns void as $$
declare
  room_host_id uuid;
begin
  select host_id into room_host_id
  from public.rooms
  where id = room_id_input;

  if room_host_id is null or room_host_id != auth.uid() then
    raise exception 'Only the host can kick players';
  end if;

  if not exists (
    select 1 from public.players
    where id = target_player_id
      and room_id = room_id_input
      and user_id != auth.uid()
  ) then
    raise exception 'Player not found or cannot kick yourself';
  end if;

  delete from public.players
  where id = target_player_id
    and room_id = room_id_input;
end;
$$ language plpgsql security definer;