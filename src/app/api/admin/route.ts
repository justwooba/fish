import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function checkAuth(request: NextRequest): boolean {
  const auth = request.headers.get("x-admin-password");
  return !!process.env.ADMIN_PASSWORD && auth === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
  const { data: players } = await supabase.from("players").select("*").order("created_at", { ascending: false });
  const { data: gameStates } = await supabase.from("game_states").select("*");
  return NextResponse.json({ rooms, players, gameStates });
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

async function updateCardCounts(supabase: Awaited<ReturnType<typeof createClient>>, roomId: string, hands: Record<string, string[]>) {
  const { data: players } = await supabase.from("players").select("id").eq("room_id", roomId);
  if (players) {
    const counts = players.map((p: { id: string }) => ({ player_id: p.id, card_count: (hands[p.id] ?? []).length }));
    await supabase.rpc("update_card_counts", { room_id_input: roomId, counts });
  }
}

export async function PATCH(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  let body: { action: string; game_state_id: string; [key: string]: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { data: gs } = await supabase.from("game_states").select("*").eq("id", body.game_state_id).maybeSingle();
  if (!gs) return NextResponse.json({ error: "Game state not found" }, { status: 404 });

  const actionLog = [...(gs.action_log ?? [])];
  const timestamp = new Date().toISOString();

  // ── Move card ──────────────────────────────────────────────────────────
  if (body.action === "move_card") {
    const { card, from_player_id, to_player_id } = body as { card: string; from_player_id: string; to_player_id: string; action: string; game_state_id: string };
    const hands = { ...gs.hands };
    if (!hands[from_player_id]?.includes(card)) {
      return NextResponse.json({ error: "Player does not hold that card" }, { status: 400 });
    }
    hands[from_player_id] = hands[from_player_id].filter((c: string) => c !== card);
    hands[to_player_id] = [...(hands[to_player_id] ?? []), card];

    actionLog.push({ type: "admin", description: `Moved ${card} from ${from_player_id} to ${to_player_id}`, card, from_player_id, to_player_id, timestamp });

    const { error } = await supabase.from("game_states").update({ hands, action_log: actionLog }).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await updateCardCounts(supabase, gs.room_id, hands);
    return NextResponse.json({ ok: true });
  }

  // ── Change turn ────────────────────────────────────────────────────────
  if (body.action === "change_turn") {
    const { player_id } = body as { player_id: string; action: string; game_state_id: string };

    actionLog.push({ type: "admin", description: `Changed turn to ${player_id}`, player_id, timestamp });

    const { error } = await supabase.from("game_states").update({
      current_turn: player_id,
      phase: "asking",
      action_log: actionLog,
    }).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Award set ──────────────────────────────────────────────────────────
  if (body.action === "award_set") {
    const { set_id, team } = body as { set_id: string; team: string; action: string; game_state_id: string };
    const hands = { ...gs.hands };
    const { getCardKeysInSet } = await import("@/lib/cards");
    const setCards = getCardKeysInSet(set_id as any);

    for (const pid of Object.keys(hands)) {
      hands[pid] = hands[pid].filter((c: string) => !setCards.includes(c));
    }

    const awardedTo = team === "null" ? null : team;
    const declaredSets = [...(gs.declared_sets ?? []), {
      set_id, awarded_to: awardedTo, declared_by: "admin", was_correct: true,
    }];

    actionLog.push({ type: "admin", description: `Awarded ${set_id} to ${awardedTo ?? "null (nullified)"}`, set_id, awarded_to: awardedTo, timestamp });

    const updates: Record<string, unknown> = { hands, declared_sets: declaredSets, action_log: actionLog };
    if (team === "A") updates.score_a = (gs.score_a ?? 0) + 1;
    if (team === "B") updates.score_b = (gs.score_b ?? 0) + 1;

    const { error } = await supabase.from("game_states").update(updates).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await updateCardCounts(supabase, gs.room_id, hands);
    return NextResponse.json({ ok: true });
  }

  // ── Reassign set ownership ─────────────────────────────────────────────
  if (body.action === "reassign_set") {
    const { set_id, new_team } = body as { set_id: string; new_team: string; action: string; game_state_id: string };
    const declaredSets = [...(gs.declared_sets ?? [])];
    const idx = declaredSets.findIndex((ds: { set_id: string }) => ds.set_id === set_id);
    if (idx === -1) return NextResponse.json({ error: "Set not found in declared sets" }, { status: 400 });

    const oldTeam = declaredSets[idx].awarded_to;
    const newAwardedTo = new_team === "null" ? null : new_team;
    declaredSets[idx] = { ...declaredSets[idx], awarded_to: newAwardedTo };

    // Recalculate scores from scratch
    let scoreA = 0;
    let scoreB = 0;
    for (const ds of declaredSets) {
      if (ds.awarded_to === "A") scoreA++;
      if (ds.awarded_to === "B") scoreB++;
    }

    actionLog.push({ type: "admin", description: `Reassigned ${set_id} from ${oldTeam ?? "null"} to ${newAwardedTo ?? "null"}`, set_id, old_team: oldTeam, new_team: newAwardedTo, timestamp });

    const { error } = await supabase.from("game_states").update({
      declared_sets: declaredSets,
      score_a: scoreA,
      score_b: scoreB,
      action_log: actionLog,
    }).eq("id", gs.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}