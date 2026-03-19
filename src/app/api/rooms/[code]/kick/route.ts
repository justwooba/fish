import { ensureAuth } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await ensureAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId, supabase } = auth;
  const { code } = await params;

  let body: { player_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.player_id) {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  }

  // Find the room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_id !== userId) {
    return NextResponse.json({ error: "Only the host can kick players" }, { status: 403 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Cannot kick during an active game" }, { status: 400 });
  }

  // Find the target player
  const { data: target } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("id", body.player_id)
    .eq("room_id", room.id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Can't kick yourself
  if (target.user_id === userId) {
    return NextResponse.json({ error: "You cannot kick yourself" }, { status: 400 });
  }

  // Delete the player — RLS only allows users to delete themselves,
  // so we need a workaround. We'll use the host's auth to delete by
  // updating the player's user_id to the host first... Actually, the
  // simplest fix is to add an RLS policy for host kicks.
  // For now, we'll use the supabase client which respects RLS.
  // We need a policy that allows the host to delete players in their room.
  //
  // Since we can't change RLS here, let's use a different approach:
  // We'll call a database function that bypasses RLS.

  const { error } = await supabase.rpc("kick_player", {
    target_player_id: body.player_id,
    room_id_input: room.id,
  });

  if (error) {
    console.error("Failed to kick player:", error);
    return NextResponse.json({ error: "Failed to kick player" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}