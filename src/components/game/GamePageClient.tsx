"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/hooks/useGame";
import type { CardKey, FishSetId, TeamId, LastAsk } from "@/lib/types";
import { getSetForCardKey, getCardKeysInSet, setLabel, cardKeyLabel } from "@/lib/cards";
import Scoreboard from "@/components/game/Scoreboard";
import EventBanner from "@/components/game/EventBanner";
import MyHand from "@/components/game/MyHand";
import PlayerTable from "@/components/game/PlayerTable";
import type { SeatPositions } from "@/components/game/PlayerTable";
import AskControls from "@/components/game/AskControls";
import DeclareControls from "@/components/game/DeclareControls";
import ChooseTurnControls from "@/components/game/ChooseTurnControls";
import CardFlyAnimation from "@/components/game/CardFlyAnimation";
import Button from "@/components/ui/Button";

interface GamePageClientProps {
  roomId: string;
}

interface FlyingCard {
  cardKey: CardKey;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  id: number;
}

let flyIdCounter = 0;

export default function GamePageClient({ roomId }: GamePageClientProps) {
  const router = useRouter();
  const { game, players, settings, myPlayerId, isHost, roomCode, declaring, loading, error } = useGame(roomId);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [defaultSet, setDefaultSet] = useState<FishSetId | null>(null);
  const [seatPositions, setSeatPositions] = useState<SeatPositions>({});
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [resetLoading, setResetLoading] = useState(false);
  const prevLastAskRef = useRef<LastAsk | null>(null);

  // ── Fly animation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!game?.last_ask) return;
    const curr = game.last_ask;
    const prev = prevLastAskRef.current;
    const isNew = !prev || prev.asker_id !== curr.asker_id || prev.target_id !== curr.target_id || prev.card !== curr.card;
    if (isNew && curr.success) {
      const fromPos = seatPositions[curr.target_id];
      const toPos = seatPositions[curr.asker_id];
      if (fromPos && toPos) {
        const id = ++flyIdCounter;
        setFlyingCards((prev) => [...prev, { cardKey: curr.card, fromX: fromPos.x, fromY: fromPos.y, toX: toPos.x, toY: toPos.y, id }]);
      }
    }
    prevLastAskRef.current = curr;
  }, [game?.last_ask, seatPositions]);

  function removeFlyingCard(id: number) {
    setFlyingCards((prev) => prev.filter((fc) => fc.id !== id));
  }

  // ── API helpers ────────────────────────────────────────────────────────

  const handleAsk = useCallback(async (targetId: string, card: CardKey) => {
    const res = await fetch(`/api/game/${roomId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, card }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Ask failed"); }
    setDefaultSet(getSetForCardKey(card));
  }, [roomId]);

  const handleDeclare = useCallback(async (setId: FishSetId, assignments: Record<string, CardKey[]>) => {
    const res = await fetch(`/api/game/${roomId}/declare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set_id: setId, assignments }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Declaration failed"); }
  }, [roomId]);

  const handleChooseTurn = useCallback(async (playerId: string) => {
    const res = await fetch(`/api/game/${roomId}/choose-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosen_player_id: playerId }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Choose turn failed"); }
  }, [roomId]);

  const handleReset = useCallback(async () => {
    setResetLoading(true);
    try {
      const res = await fetch(`/api/game/${roomId}/reset`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset");
      }
      const data = await res.json();
      router.push(`/room/${data.room_code}`);
    } catch (e) {
      console.error("Reset failed:", e);
      setResetLoading(false);
    }
  }, [roomId, router]);

  // ── Redirect to lobby when room resets (for non-host players) ──────────
  useEffect(() => {
    if (game === null && !loading && !error && roomCode) {
      // Game state was deleted (reset) — go back to lobby
      router.push(`/room/${roomCode}`);
    }
  }, [game, loading, error, roomCode, router]);

  // ── Clear selections when turn changes ─────────────────────────────────
  useEffect(() => {
    if (game && game.current_turn !== myPlayerId) {
      setSelectedOpponent(null);
      setDefaultSet(null);
    }
  }, [game?.current_turn, myPlayerId, game]);

  useEffect(() => {
    if (defaultSet && game) {
      const myHand = game.my_hand ?? [];
      const askable = getCardKeysInSet(defaultSet).filter((ck) => !myHand.includes(ck));
      if (askable.length === 0) setDefaultSet(null);
    }
  }, [game?.my_hand, defaultSet, game]);

  // ── Loading / Error ────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading game...</div>
      </main>
    );
  }

  if (error || !game || !myPlayerId) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl text-gray-200 mb-2" style={{ fontFamily: "var(--font-display)" }}>Cannot load game</h1>
          <p className="text-gray-500 text-sm mb-4">{error || "Something went wrong"}</p>
          <a href="/" className="text-sm text-blue-500 hover:text-blue-400 transition-colors">← Back to home</a>
        </div>
      </main>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const me = players?.find((p) => p.id === myPlayerId);
  const myTeam = (me?.team as TeamId) ?? "A";
  const myHand = game.my_hand ?? [];
  const phase = game.phase ?? "asking";
  const isFinished = phase === "finished";
  const isMyTurn = game.current_turn === myPlayerId;
  const currentTurnPlayer = players?.find((p) => p.id === game.current_turn);
  const isMyTeamsTurn = currentTurnPlayer?.team === myTeam;

  const declaredSets = game.declared_sets ?? [];
  const lastDeclared = declaredSets.length > 0 ? declaredSets[declaredSets.length - 1] : null;
  const choosingTeam: TeamId = lastDeclared?.awarded_to ?? (currentTurnPlayer?.team as TeamId) ?? "A";
  const declaredSetIds = declaredSets.map((ds) => ds.set_id);

  const canSelectOpponents = !isFinished && isMyTurn && phase === "asking";
  const canAct = !isFinished && (isMyTurn || (settings?.team_declare && isMyTeamsTurn && phase === "declaring"));

  // ── Phase text ─────────────────────────────────────────────────────────

  let phaseText = "";
  if (isFinished) {
    phaseText = game.winner ? `Team ${game.winner} wins!` : "Game over";
  } else if (phase === "choosing_turn") {
    phaseText = choosingTeam === myTeam ? "Your team picks who goes next" : `Team ${choosingTeam} is choosing...`;
  } else if (isMyTurn) {
    phaseText = phase === "declaring"
      ? "You must declare a set — you have no legal asks"
      : selectedOpponent ? "" : "Your turn — click an opponent to ask, or declare a set";
  } else {
    phaseText = `${currentTurnPlayer?.display_name ?? "?"}'s turn`;
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        <Scoreboard scoreA={game.score_a ?? 0} scoreB={game.score_b ?? 0} winner={game.winner} />

        {phaseText && (
          <div className="text-center">
            <p className={`text-sm font-medium ${isMyTurn && !isFinished ? "text-amber-400" : "text-gray-400"}`}>{phaseText}</p>
          </div>
        )}

        {players && players.length > 0 && (
          <PlayerTable
            players={players} myPlayerId={myPlayerId} myTeam={myTeam}
            currentTurn={game.current_turn ?? ""} declaredSets={declaredSets}
            selectableOpponents={canSelectOpponents} selectedOpponent={selectedOpponent}
            onSelectOpponent={setSelectedOpponent} onSeatPositions={setSeatPositions}
          />
        )}

        <EventBanner lastAsk={game.last_ask} declaredSets={declaredSets} players={players ?? []} />

        {declaring && declaring.player_id !== myPlayerId && !isFinished && (
          <div className="w-full px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-center">
            <p className="text-sm text-amber-300">
              <span className="font-medium text-amber-200">{players?.find((p) => p.id === declaring.player_id)?.display_name ?? "?"}</span>
              {" is declaring "}
              <span className="font-medium text-amber-200">{setLabel(declaring.set_id as FishSetId)}</span>...
            </p>
          </div>
        )}

        {/* Action area */}
        {!isFinished && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {phase === "choosing_turn" ? (
              <ChooseTurnControls myTeam={myTeam} choosingTeam={choosingTeam} players={players ?? []} myPlayerId={myPlayerId} onChoose={handleChooseTurn} />
            ) : canAct ? (
              <div className="space-y-4">
                {phase === "asking" && isMyTurn && selectedOpponent && (
                  <AskControls
                    myHand={myHand} myPlayerId={myPlayerId} players={players ?? []}
                    selectedTarget={selectedOpponent} defaultSet={defaultSet}
                    onAsk={handleAsk} onCancelTarget={() => { setSelectedOpponent(null); setDefaultSet(null); }}
                  />
                )}
                {phase === "asking" && isMyTurn && selectedOpponent && (
                  <div className="border-t border-white/[0.06]" />
                )}
                <DeclareControls
                  myHand={myHand} myPlayerId={myPlayerId} myTeam={myTeam}
                  players={players ?? []} declaredSetIds={declaredSetIds}
                  roomId={roomId} forced={phase === "declaring"} onDeclare={handleDeclare}
                />
              </div>
            ) : declaring && declaring.player_id !== myPlayerId ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">
                  <span className="text-gray-300 font-medium">{players?.find((p) => p.id === declaring.player_id)?.display_name ?? "?"}</span>
                  {" is declaring "}<span className="text-gray-300 font-medium">{setLabel(declaring.set_id as FishSetId)}</span>...
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Waiting for <span className="text-gray-300">{currentTurnPlayer?.display_name ?? "?"}</span> to play...</p>
              </div>
            )}
          </div>
        )}

        {/* Play Again — host only, game finished */}
        {isFinished && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center space-y-3">
            {isHost ? (
              <>
                <p className="text-sm text-gray-400">Ready for another round?</p>
                <Button onClick={handleReset} loading={resetLoading} size="lg" className="w-full max-w-xs mx-auto">
                  Play Again
                </Button>
                <p className="text-[10px] text-gray-600">Returns everyone to the lobby with the same teams</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Waiting for the host to start a new game...</p>
            )}
          </div>
        )}

        {/* My hand */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <MyHand hand={myHand} />
        </div>

        {/* Postgame log */}
        {isFinished && Array.isArray(game.action_log) && game.action_log.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-lg text-gray-200 mb-3" style={{ fontFamily: "var(--font-display)" }}>Game Log</h3>
            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              {game.action_log.map((action, i) => {
                if (!action || !action.type) return null;
                const turnNum = i + 1;
                if (action.type === "ask") {
                  const asker = players?.find((p) => p.id === action.asker_id)?.display_name ?? "?";
                  const target = players?.find((p) => p.id === action.target_id)?.display_name ?? "?";
                  const cardName = action.card ? cardKeyLabel(action.card) : "?";
                  return (
                    <div key={i} className="flex gap-2 py-1 text-xs">
                      <span className="text-gray-700 w-6 text-right shrink-0 font-mono">{turnNum}</span>
                      <div>
                        <span className="text-gray-300">{asker}</span>
                        <span className="text-gray-600">{" → "}</span>
                        <span className="text-gray-300">{target}</span>
                        <span className="text-gray-600">{" for "}</span>
                        <span className="text-gray-200 font-medium">{cardName}</span>
                        <span className="text-gray-600">{" — "}</span>
                        <span className={action.success ? "text-emerald-400 font-medium" : "text-gray-600"}>{action.success ? "✓ got it" : "✗ miss"}</span>
                      </div>
                    </div>
                  );
                }
                if (action.type === "declare") {
                  const declarer = players?.find((p) => p.id === action.declarer_id)?.display_name ?? "?";
                  const setName = action.set_id ? setLabel(action.set_id as FishSetId) : "?";
                  return (
                    <div key={i} className="flex gap-2 py-1.5 text-xs">
                      <span className="text-gray-700 w-6 text-right shrink-0 font-mono">{turnNum}</span>
                      <div className={`rounded-md px-2 py-1 -mx-1 ${action.success ? "bg-emerald-500/[0.06] border border-emerald-500/10" : action.awarded_to === null ? "bg-gray-500/[0.06] border border-gray-500/10" : "bg-red-500/[0.06] border border-red-500/10"}`}>
                        <span className="text-gray-300">{declarer}</span>
                        <span className="text-gray-600">{" declared "}</span>
                        <span className="text-gray-200 font-medium">{setName}</span>
                        <span className="text-gray-600">{" — "}</span>
                        {action.success ? (
                          <span className="text-emerald-400 font-medium">✓ correct → Team {action.awarded_to}</span>
                        ) : action.awarded_to === null ? (
                          <span className="text-gray-500">nullified</span>
                        ) : (
                          <span className="text-red-400 font-medium">✗ misdeclare → Team {action.awarded_to}</span>
                        )}
                      </div>
                    </div>
                  );
                }
                if (action.type === "choose_turn") {
                  const chosen = players?.find((p) => p.id === action.chosen_player_id)?.display_name ?? "?";
                  return (
                    <div key={i} className="flex gap-2 py-1 text-xs">
                      <span className="text-gray-700 w-6 text-right shrink-0 font-mono">{turnNum}</span>
                      <div className="text-gray-600 italic">Team {action.team} chose <span className="text-gray-400 not-italic">{chosen}</span> to go next</div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        <div className="text-center mt-2">
          <a href="/" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">← Back to home</a>
        </div>
      </div>

      {flyingCards.map((fc) => (
        <CardFlyAnimation key={fc.id} cardKey={fc.cardKey} fromX={fc.fromX} fromY={fc.fromY} toX={fc.toX} toY={fc.toY} onComplete={() => removeFlyingCard(fc.id)} />
      ))}
    </main>
  );
}