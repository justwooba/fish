import { ensureAuth } from "@/lib/supabase/auth";
import type { Player, ServerGameState, RoomSettings } from "@/lib/types";
import { findNextActivePlayer, getSeatOrder, determinePhaseForPlayer } from "@/lib/engine";

export interface GameContext {
  userId: string;
  playerId: string;
  gameState: ServerGameState;
  players: Player[];
  settings: RoomSettings;
  roomId: string;
  supabase: Awaited<ReturnType<typeof ensureAuth>> extends infer T
    ? T extends { supabase: infer S } ? S : never
    : never;
}

/**
 * Loads everything needed to process a game action.
 */
export async function loadGameContext(
  roomId: string
): Promise<{ ctx: GameContext } | { error: string; status: number }> {
  const auth = await ensureAuth();
  if (!auth) {
    return { error: "Not authenticated", status: 401 };
  }

  const { userId, supabase } = auth;

  // Load room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, settings, status")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    return { error: "Room not found", status: 404 };
  }

  if (room.status !== "playing") {
    return { error: "Game is not in progress", status: 400 };
  }

  // Load game state
  const { data: gs } = await supabase
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!gs) {
    return { error: "Game state not found", status: 404 };
  }

  // Load players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId);

  if (!players || players.length === 0) {
    return { error: "No players found", status: 404 };
  }

  // Find this user's player record
  const player = players.find((p: Player) => p.user_id === userId);
  if (!player) {
    return { error: "You are not in this game", status: 403 };
  }

  // Reconstruct ServerGameState from DB row
  const gameState: ServerGameState = {
    id: gs.id,
    room_id: gs.room_id,
    phase: gs.phase,
    current_turn: gs.current_turn,
    hands: gs.hands,
    last_ask: gs.last_ask,
    declared_sets: gs.declared_sets,
    score_a: gs.score_a,
    score_b: gs.score_b,
    action_log: gs.action_log,
    winner: gs.winner,
    version: gs.version ?? 0,
  };

  return {
    ctx: {
      userId,
      playerId: player.id,
      gameState,
      players,
      settings: room.settings as RoomSettings,
      roomId,
      supabase,
    },
  };
}

/**
 * After any action, if the new current_turn player has zero cards,
 * skip forward to the next player who can act. This prevents the
 * game from getting stuck on empty-handed players.
 */
export function skipEmptyPlayers(
  state: ServerGameState,
  players: Player[]
): ServerGameState {
  // Only skip during asking/declaring phases, not choosing_turn or finished
  if (state.phase === "choosing_turn" || state.phase === "finished") {
    return state;
  }

  const hand = state.hands[state.current_turn];
  if (hand && hand.length > 0) {
    return state; // Current player has cards, no skip needed
  }

  // Find next player with cards
  const seatOrder = getSeatOrder(players);
  const nextPlayer = findNextActivePlayer(state, seatOrder, state.current_turn);

  if (!nextPlayer) {
    // Nobody has cards — game should be over
    return state;
  }

  if (nextPlayer === state.current_turn) {
    return state; // No one else to skip to
  }

  const updated = { ...state, current_turn: nextPlayer };
  updated.phase = determinePhaseForPlayer(updated, players, nextPlayer);
  return updated;
}

/**
 * Persists an updated game state using optimistic locking.
 * Returns null on success, or an error string.
 *
 * The version check ensures that if two requests race, only the first
 * one succeeds. The second gets "State has changed" and the client
 * should re-fetch and retry (or just let the realtime update handle it).
 */
export async function saveGameState(
  ctx: GameContext,
  newState: ServerGameState
): Promise<string | null> {
  const { supabase } = ctx;

  // Auto-skip empty-handed players before saving
  const finalState = skipEmptyPlayers(newState, ctx.players);

  // Versioned update — only succeeds if version hasn't changed
  const { data: success, error: rpcError } = await supabase.rpc(
    "update_game_state_versioned",
    {
      game_id_input: finalState.id,
      expected_version: ctx.gameState.version,
      new_phase: finalState.phase,
      new_current_turn: finalState.current_turn,
      new_hands: finalState.hands,
      new_last_ask: finalState.last_ask,
      new_declared_sets: finalState.declared_sets,
      new_score_a: finalState.score_a,
      new_score_b: finalState.score_b,
      new_action_log: finalState.action_log,
      new_winner: finalState.winner,
    }
  );

  if (rpcError) {
    console.error("Failed to save game state:", rpcError);
    return "Failed to save game state";
  }

  if (success === false) {
    return "State has changed — please try again";
  }

  // Update card counts (non-blocking, cosmetic)
  const counts = Object.entries(finalState.hands).map(([playerId, hand]) => ({
    player_id: playerId,
    card_count: hand.length,
  }));

  const { error: countError } = await supabase.rpc("update_card_counts", {
    room_id_input: finalState.room_id,
    counts,
  });
  if (countError) {
    console.error("Failed to update card counts:", countError);
  }

  // If game is finished, update room status
  if (finalState.phase === "finished" && finalState.winner) {
    const { error: roomError } = await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", finalState.room_id);
    if (roomError) {
      console.error("Failed to update room status:", roomError);
    }
  }

  return null;
}