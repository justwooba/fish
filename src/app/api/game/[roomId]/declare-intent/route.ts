import { NextRequest, NextResponse } from "next/server";
import { loadGameContext } from "@/lib/supabase/game-context";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const result = await loadGameContext(roomId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ctx } = result;

  let body: { set_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.set_id) {
    return NextResponse.json({ error: "set_id is required" }, { status: 400 });
  }

  // Verify it's this player's turn (or team's turn with team_declare)
  const isMyTurn = ctx.gameState.current_turn === ctx.playerId;
  const myTeam = ctx.players.find((p) => p.id === ctx.playerId)?.team;
  const turnPlayerTeam = ctx.players.find((p) => p.id === ctx.gameState.current_turn)?.team;
  const isMyTeamsTurn = myTeam === turnPlayerTeam;

  if (!isMyTurn && !(ctx.settings.team_declare && isMyTeamsTurn)) {
    return NextResponse.json({ error: "Not your turn to declare" }, { status: 400 });
  }

  // Set the declaring intent on the game state
  const { error } = await ctx.supabase
    .from("game_states")
    .update({
      declaring_player_id: ctx.playerId,
      declaring_set: body.set_id,
    })
    .eq("id", ctx.gameState.id);

  if (error) {
    console.error("Failed to set declare intent:", error);
    return NextResponse.json({ error: "Failed to set declare intent" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Clear the intent (cancel — though in real Fish you can't, we clear it after declare resolves)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const result = await loadGameContext(roomId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { ctx } = result;

  await ctx.supabase
    .from("game_states")
    .update({
      declaring_player_id: null,
      declaring_set: null,
    })
    .eq("id", ctx.gameState.id);

  return NextResponse.json({ ok: true });
}