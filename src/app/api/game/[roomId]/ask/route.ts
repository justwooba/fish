import { NextRequest, NextResponse } from "next/server";
import { loadGameContext, saveGameState } from "@/lib/supabase/game-context";
import { performAsk } from "@/lib/engine";

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

  let body: { target_id?: string; card?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.target_id || !body.card) {
    return NextResponse.json(
      { error: "target_id and card are required" },
      { status: 400 }
    );
  }

  // Run through the engine
  const engineResult = performAsk(
    ctx.gameState,
    ctx.players,
    ctx.settings,
    ctx.playerId,
    body.target_id,
    body.card,
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