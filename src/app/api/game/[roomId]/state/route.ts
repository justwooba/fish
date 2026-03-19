import { NextRequest, NextResponse } from "next/server";
import { loadGameContext } from "@/lib/supabase/game-context";
import { toClientGameState } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const result = await loadGameContext(roomId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ctx } = result;

  const includeLog = ctx.gameState.phase === "finished";

  const clientState = toClientGameState(
    ctx.gameState,
    ctx.playerId,
    includeLog
  );

  const playerInfo = ctx.players.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    team: p.team,
    seat: p.seat,
    card_count: p.card_count,
    is_connected: p.is_connected,
  }));

  const { data: gs } = await ctx.supabase
    .from("game_states")
    .select("declaring_player_id, declaring_set")
    .eq("room_id", roomId)
    .maybeSingle();

  return NextResponse.json({
    game: clientState,
    players: playerInfo,
    settings: ctx.settings,
    is_host: ctx.userId === ctx.hostId,
    room_code: ctx.roomCode,
    declaring: gs?.declaring_player_id ? {
      player_id: gs.declaring_player_id,
      set_id: gs.declaring_set,
    } : null,
  });
}