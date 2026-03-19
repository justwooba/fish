import { ensureAuth } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ROOM_SETTINGS } from "@/lib/types";

export async function POST(request: NextRequest) {
  const auth = await ensureAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId, supabase } = auth;

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

  // Generate a unique 6-character room code
  let roomCode: string | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabase.rpc("generate_room_code");
    if (data) {
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", data)
        .maybeSingle();
      if (!existing) {
        roomCode = data;
        break;
      }
    }
  }

  if (!roomCode) {
    return NextResponse.json(
      { error: "Failed to generate room code" },
      { status: 500 }
    );
  }

  // Create the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      code: roomCode,
      host_id: userId,
      status: "waiting",
      settings: DEFAULT_ROOM_SETTINGS,
    })
    .select()
    .single();

  if (roomError || !room) {
    console.error("Failed to create room:", roomError);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }

  // Add the host as a player
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
    console.error("Failed to add host as player:", playerError);
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }

  return NextResponse.json({ room_code: roomCode, room_id: room.id });
}