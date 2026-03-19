import { NextRequest, NextResponse } from "next/server";
import { loadGameContext, saveGameState } from "@/lib/supabase/game-context";
import { performDeclaration } from "@/lib/engine";
import type { CardKey } from "@/lib/types";

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

  let body: { set_id?: string; assignments?: Record<string, CardKey[]> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.set_id || !body.assignments) {
    return NextResponse.json(
      { error: "set_id and assignments are required" },
      { status: 400 }
    );
  }

  // Run through the engine
  const engineResult = performDeclaration(
    ctx.gameState,
    ctx.players,
    ctx.settings,
    ctx.playerId,
    body.set_id as any,
    body.assignments,
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

  // Clear declaring intent
  await ctx.supabase
    .from("game_states")
    .update({ declaring_player_id: null, declaring_set: null })
    .eq("id", ctx.gameState.id);

  return NextResponse.json({ ok: true });
}