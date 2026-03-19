import { NextRequest, NextResponse } from "next/server";
import { loadGameContext, saveGameState } from "@/lib/supabase/game-context";
import { chooseNextTurn, getPlayerTeam } from "@/lib/engine";

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

  let body: { chosen_player_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.chosen_player_id) {
    return NextResponse.json(
      { error: "chosen_player_id is required" },
      { status: 400 }
    );
  }

  // The requesting player's team is the one choosing
  const choosingTeam = getPlayerTeam(ctx.playerId, ctx.players);

  // Run through the engine
  const engineResult = chooseNextTurn(
    ctx.gameState,
    ctx.players,
    ctx.settings,
    choosingTeam,
    body.chosen_player_id,
    new Date().toISOString()
  );

  if (!engineResult.ok) {
    return NextResponse.json({ error: engineResult.error }, { status: 400 });
  }

  // Save the new state
  const saveError = await saveGameState(ctx, engineResult.state);
  if (saveError) {
    return NextResponse.json({ error: saveError }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}