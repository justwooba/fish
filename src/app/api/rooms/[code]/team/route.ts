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

  let body: { team?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.team !== "A" && body.team !== "B") {
    return NextResponse.json({ error: "Team must be A or B" }, { status: 400 });
  }

  // Find the room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game has already started" }, { status: 400 });
  }

  // Check team isn't full
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("team", body.team);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "Team is full" }, { status: 400 });
  }

  // Update the player's team
  const { error } = await supabase
    .from("players")
    .update({ team: body.team })
    .eq("room_id", room.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to join team:", error);
    return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await ensureAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { userId, supabase } = auth;
  const { code } = await params;

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game has already started" }, { status: 400 });
  }

  const { error } = await supabase
    .from("players")
    .update({ team: null })
    .eq("room_id", room.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to leave team:", error);
    return NextResponse.json({ error: "Failed to leave team" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}