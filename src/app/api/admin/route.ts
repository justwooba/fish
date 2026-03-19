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
  const { data: rooms } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
  const { data: players } = await supabase.from("players").select("*").order("created_at", { ascending: false });
  const { data: gameStates } = await supabase.from("game_states").select("*");
  return NextResponse.json({ rooms, players, gameStates });
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();
  let body: { type: string; id: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

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

// PATCH — admin game state modifications
export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = await createClient();

  let body: {
    action: string;
    game_state_id: string;
    [key: string]: unknown;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Load game state
  const { data: gs } = await supabase.from("game_states").select("*").eq("id", body.game_state_id).maybeSingle();
  if (!gs) return NextResponse.json({ error: "Game state not found" }, { status: 404 });

  if (body.action === "move_card") {
    // Move a card from one player to another
    const { card, from_player_id, to_player_id } = body as { card: string; from_player_id: string; to_player_id: string; action: string; game_state_id: string };
    const hands = { ...gs.hands };
    if (!hands[from_player_id]?.includes(card)) {
      return NextResponse.json({ error: "Player does not hold that card" }, { status: 400 });
    }
    hands[from_player_id] = hands[from_player_id].filter((c: string) => c !== card);
    hands[to_player_id] = [...(hands[to_player_id] ?? []), card];

    const { error } = await supabase.from("game_states").update({ hands }).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update card counts
    const { data: players } = await supabase.from("players").select("id").eq("room_id", gs.room_id);
    if (players) {
      const counts = players.map((p: { id: string }) => ({
        player_id: p.id,
        card_count: (hands[p.id] ?? []).length,
      }));
      await supabase.rpc("update_card_counts", { room_id_input: gs.room_id, counts });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "change_turn") {
    const { player_id } = body as { player_id: string; action: string; game_state_id: string };
    const { error } = await supabase.from("game_states").update({
      current_turn: player_id,
      phase: "asking",
    }).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "award_set") {
    const { set_id, team } = body as { set_id: string; team: string; action: string; game_state_id: string };
    const hands = { ...gs.hands };
    const { getCardKeysInSet } = await import("@/lib/cards");
    const setCards = getCardKeysInSet(set_id as any);

    // Remove set cards from all hands
    for (const pid of Object.keys(hands)) {
      hands[pid] = hands[pid].filter((c: string) => !setCards.includes(c));
    }

    const declaredSets = [...(gs.declared_sets ?? []), {
      set_id,
      awarded_to: team === "null" ? null : team,
      declared_by: "admin",
      was_correct: true,
    }];

    const updates: Record<string, unknown> = { hands, declared_sets: declaredSets };
    if (team === "A") updates.score_a = (gs.score_a ?? 0) + 1;
    if (team === "B") updates.score_b = (gs.score_b ?? 0) + 1;

    const { error } = await supabase.from("game_states").update(updates).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update card counts
    const { data: players } = await supabase.from("players").select("id").eq("room_id", gs.room_id);
    if (players) {
      const counts = players.map((p: { id: string }) => ({
        player_id: p.id,
        card_count: (hands[p.id] ?? []).length,
      }));
      await supabase.rpc("update_card_counts", { room_id_input: gs.room_id, counts });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}