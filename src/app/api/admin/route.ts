import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get("x-admin-password");
  return !!process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: gameStates } = await supabase
    .from("game_states")
    .select("*");

  return NextResponse.json({ rooms, players, gameStates });
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  let body: { type: string; id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "room") {
    const { error } = await supabase.rpc("admin_delete_room", { room_id_input: body.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === "player") {
    const { error } = await supabase.rpc("admin_delete_player", { player_id_input: body.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === "game_state") {
    const { error } = await supabase.rpc("admin_delete_game_state", { game_state_id_input: body.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}