import { ensureAuth } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";
import type { RoomSettings } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await ensureAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId, supabase } = auth;
  const { code } = await params;

  let body: RoomSettings;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate settings shape
  if (
    typeof body.team_declare !== "boolean" ||
    typeof body.nullify_misdeclare !== "boolean" ||
    typeof body.no_turn_on_misdeclare !== "boolean" ||
    typeof body.play_all_sets !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  // Find the room and verify host
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_id !== userId) {
    return NextResponse.json({ error: "Only the host can change settings" }, { status: 403 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Cannot change settings after game starts" }, { status: 400 });
  }

  const { error } = await supabase
    .from("rooms")
    .update({ settings: body })
    .eq("id", room.id);

  if (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}