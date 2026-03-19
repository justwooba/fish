import { ensureAuth } from "@/lib/supabase/auth";
import type { Player, ServerGameState, RoomSettings } from "@/lib/types";
import {
  findNextActivePlayer,
  getSeatOrder,
  determinePhaseForPlayer,
} from "@/lib/engine";

export interface GameContext {
  userId: string;
  playerId: string;
  gameState: ServerGameState & { version: number };
  players: Player[];
  settings: RoomSettings;
  roomId: string;
  supabase: Awaited<ReturnType<typeof ensureAuth>> extends infer T
    ? T extends { supabase: infer S }
      ? S
      : never
    : never;
}

/**
 * Loads everything needed to process a game action.
 * Hands are loaded from the separate game_hands table (not exposed via realtime).
 */
export async function loadGameContext(
  roomId: string
): Promise<{ ctx: GameContext } | { error: string; status: number }> {
  const auth = await ensureAuth();
  if (!auth) {
    return { error: "Not authenticated", status: 401 };
  }

  const { userId, supabase } = auth;

  const { data: room } = await supabase
    .from("rooms")
    .select("id, settings, status")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "playing" && room.status !== "finished") {
    return { error: "Game is not in progress", status: 400 };
  }

  const { data: gs } = await supabase
    .from("game_states")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!gs) return { error: "Game state not found", status: 404 };

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId);

  if (!players || players.length === 0) return { error: "No players found", status: 404 };

  const player = players.find((p: Player) => p.user_id === userId);
  if (!player) return { error: "You are not in this game", status: 403 };

  // Load hands from separate secure table
  const { data: handsData } = await supabase.rpc("get_game_hands", {
    game_id_input: gs.id,
  });

  // Fall back to game_states.hands for backward compatibility
  const hands = handsData || gs.hands || {};

  const gameState: ServerGameState & { version: number } = {
    id: gs.id,
    room_id: gs.room_id,
    phase: gs.phase,
    current_turn: gs.current_turn,
    hands,
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
 * If the current turn player has no cards, advance to the next
 * teammate who does. The turn stays with the same team.
 */
function skipEmptyPlayers(
  state: ServerGameState,
  players: Player[]
): ServerGameState {
  if (state.phase === "choosing_turn" || state.phase === "finished") {
    return state;
  }

  const hand = state.hands[state.current_turn];
  if (hand && hand.length > 0) return state;

  // Find the current player's team
  const currentPlayer = players.find((p) => p.id === state.current_turn);
  if (!currentPlayer || !currentPlayer.team) return state;

  // Find teammates with cards
  const teammatesWithCards = players
    .filter((p) => p.team === currentPlayer.team && p.id !== state.current_turn)
    .filter((p) => (state.hands[p.id]?.length ?? 0) > 0);

  if (teammatesWithCards.length === 0) {
    // No teammates have cards — fall back to any player with cards
    const seatOrder = getSeatOrder(players);
    const nextPlayer = findNextActivePlayer(state, seatOrder, state.current_turn);
    if (!nextPlayer || nextPlayer === state.current_turn) return state;
    const updated = { ...state, current_turn: nextPlayer };
    updated.phase = determinePhaseForPlayer(updated, players, nextPlayer);
    return updated;
  }

  // Pick the first teammate in seat order
  const seatOrder = getSeatOrder(players);
  const startIdx = seatOrder.indexOf(state.current_turn);
  let nextPlayer: string | null = null;

  for (let offset = 1; offset < 6; offset++) {
    const idx = (startIdx + offset) % 6;
    const pid = seatOrder[idx];
    const p = players.find((pl) => pl.id === pid);
    if (p && p.team === currentPlayer.team && (state.hands[pid]?.length ?? 0) > 0) {
      nextPlayer = pid;
      break;
    }
  }

  if (!nextPlayer) return state;

  const updated = { ...state, current_turn: nextPlayer };
  updated.phase = determinePhaseForPlayer(updated, players, nextPlayer);
  return updated;
}

/**
 * Persists an updated game state using optimistic locking.
 * Hands are stored in the separate game_hands table (never in realtime).
 */
export async function saveGameState(
  ctx: GameContext,
  newState: ServerGameState
): Promise<string | null> {
  const { supabase } = ctx;

  const finalState = skipEmptyPlayers(newState, ctx.players);

  // Optimistic lock: update only if version hasn't changed
  const { data, error: updateError } = await supabase
    .from("game_states")
    .update({
      phase: finalState.phase,
      current_turn: finalState.current_turn,
      hands: finalState.hands,
      last_ask: finalState.last_ask,
      declared_sets: finalState.declared_sets,
      score_a: finalState.score_a,
      score_b: finalState.score_b,
      action_log: finalState.action_log,
      winner: finalState.winner,
      version: ctx.gameState.version + 1,
    })
    .eq("id", finalState.id)
    .eq("version", ctx.gameState.version)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to save game state:", updateError);
    return "Failed to save game state";
  }

  if (!data) {
    return "Action conflict — please try again";
  }

  // Update card counts (cosmetic, non-blocking)
  const counts = Object.entries(finalState.hands).map(([playerId, hand]) => ({
    player_id: playerId,
    card_count: hand.length,
  }));

  supabase
    .rpc("update_card_counts", {
      room_id_input: finalState.room_id,
      counts,
    })
    .then(({ error }) => {
      if (error) console.error("Failed to update card counts:", error);
    });

  // If game is finished, update room status
  if (finalState.phase === "finished" && finalState.winner) {
    supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", finalState.room_id)
      .then(({ error }) => {
        if (error) console.error("Failed to update room status:", error);
      });
  }

  return null;
}