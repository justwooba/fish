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

  // Find the room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status === "playing") {
    return NextResponse.json(
      { error: "Cannot leave during an active game" },
      { status: 400 }
    );
  }

  // If the host is leaving, transfer host BEFORE deleting the player row.
  // RLS requires auth.uid() = host_id to update rooms, so this must happen first.
  if (room.host_id === userId) {
    const { data: otherPlayers } = await supabase
      .from("players")
      .select("user_id")
      .eq("room_id", room.id)
      .neq("user_id", userId)
      .limit(1);

    if (otherPlayers && otherPlayers.length > 0) {
      const { error: transferError } = await supabase
        .from("rooms")
        .update({ host_id: otherPlayers[0].user_id })
        .eq("id", room.id);

      if (transferError) {
        console.error("Failed to transfer host:", transferError);
        return NextResponse.json({ error: "Failed to transfer host" }, { status: 500 });
      }
    }
  }

  // Now delete the player row
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to leave room:", error);
    return NextResponse.json({ error: "Failed to leave room" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}