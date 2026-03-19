import { ensureAuth } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  createInitialGameState,
  validatePlayersForGameStart,
  getSeatOrder,
} from "@/lib/engine";
import type { Player } from "@/lib/types";

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
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_id !== userId) {
    return NextResponse.json({ error: "Only the host can start the game" }, { status: 403 });
  }

  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Game has already started" }, { status: 400 });
  }

  // Fetch players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", room.id);

  if (!players || players.length !== 6) {
    return NextResponse.json(
      { error: `Need exactly 6 players, have ${players?.length ?? 0}` },
      { status: 400 }
    );
  }
  //
  // Assign seats: alternate teams around the table
  // Sort by team then by join order, then interleave A-B-A-B-A-B
  const teamA = players.filter((p: Player) => p.team === "A");
  const teamB = players.filter((p: Player) => p.team === "B");

  if (teamA.length !== 3 || teamB.length !== 3) {
    return NextResponse.json(
      { error: "Each team needs exactly 3 players" },
      { status: 400 }
    );
  }

  // Interleave: seat 0=A, 1=B, 2=A, 3=B, 4=A, 5=B
  const seated: Player[] = [];
  for (let i = 0; i < 3; i++) {
    seated.push({ ...teamA[i], seat: i * 2 });
    seated.push({ ...teamB[i], seat: i * 2 + 1 });
  }

  // Validate the seating arrangement
  const validationError = validatePlayersForGameStart(seated);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Pick the first player randomly
  const firstPlayer = seated[Math.floor(Math.random() * 6)];

  // Create the game state using the engine
  const gameState = createInitialGameState(
    crypto.randomUUID(),
    room.id,
    seated,
    firstPlayer.id
  );

  // Update seats in the players table (via RPC to bypass RLS)
  const seatAssignments = seated.map((p) => ({
    player_id: p.id,
    seat: p.seat,
  }));

  const { error: seatError } = await supabase.rpc("assign_seats", {
    room_id_input: room.id,
    seat_assignments: seatAssignments,
  });

  if (seatError) {
    console.error("Failed to assign seats:", seatError);
    return NextResponse.json({ error: "Failed to assign seats" }, { status: 500 });
  }

  // Insert the game state
  const now = new Date().toISOString();
  const { error: gsError } = await supabase.from("game_states").insert({
    id: gameState.id,
    room_id: room.id,
    phase: gameState.phase,
    current_turn: gameState.current_turn,
    hands: gameState.hands,
    last_ask: gameState.last_ask,
    declared_sets: gameState.declared_sets,
    score_a: gameState.score_a,
    score_b: gameState.score_b,
    action_log: gameState.action_log,
    winner: gameState.winner,
    version: 0,
    started_at: now,
    turn_started_at: now,
  });

  if (gsError) {
    console.error("Failed to create game state:", gsError);
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }

  // Update room status to playing
  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", room.id);

  if (roomError) {
    console.error("Failed to update room status:", roomError);
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, game_id: gameState.id });
}