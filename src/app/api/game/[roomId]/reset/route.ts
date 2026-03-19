import { ensureAuth } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const auth = await ensureAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId, supabase } = auth;
  const { roomId } = await params;

  // Find the room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, host_id, status")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_id !== userId) {
    return NextResponse.json({ error: "Only the host can reset the game" }, { status: 403 });
  }

  if (room.status !== "finished") {
    return NextResponse.json({ error: "Game is not finished" }, { status: 400 });
  }

  // Delete the game state
  await supabase
    .from("game_states")
    .delete()
    .eq("room_id", room.id);

  // Reset players: keep teams, clear seats and card counts
  const { data: players } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id);

  if (players) {
    for (const p of players) {
      await supabase.rpc("reset_player_for_new_game", {
        player_id_input: p.id,
      });
    }
  }

  // Set room back to waiting
  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "waiting" })
    .eq("id", room.id);

  if (roomError) {
    console.error("Failed to reset room:", roomError);
    return NextResponse.json({ error: "Failed to reset room" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, room_code: room.code });
}