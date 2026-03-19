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

  let body: { display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const displayName = body.display_name?.trim();
  if (!displayName || displayName.length > 20) {
    return NextResponse.json(
      { error: "Display name is required (max 20 chars)" },
      { status: 400 }
    );
  }

  // Find the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json(
      { error: "Game has already started" },
      { status: 400 }
    );
  }

  // Check if user is already in the room
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingPlayer) {
    await supabase
      .from("players")
      .update({ is_connected: true, display_name: displayName })
      .eq("id", existingPlayer.id);

    return NextResponse.json({ room_code: room.code, room_id: room.id });
  }

  // Check player count
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= 6) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }

  // Add the player
  const { error: playerError } = await supabase.from("players").insert({
    room_id: room.id,
    user_id: userId,
    display_name: displayName,
    team: null,
    seat: null,
    card_count: 0,
    is_connected: true,
  });

  if (playerError) {
    console.error("Failed to join room:", playerError);
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }

  return NextResponse.json({ room_code: room.code, room_id: room.id });
}