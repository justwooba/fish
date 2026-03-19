"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useGame } from "@/hooks/useGame";
import type { CardKey, FishSetId, TeamId, LastAsk } from "@/lib/types";
import { getSetForCardKey, getCardKeysInSet, setLabel } from "@/lib/cards";
import { setsInHand } from "@/lib/cards";
import Scoreboard from "@/components/game/Scoreboard";
import EventBanner from "@/components/game/EventBanner";
import MyHand from "@/components/game/MyHand";
import PlayerTable from "@/components/game/PlayerTable";
import type { SeatPositions } from "@/components/game/PlayerTable";
import AskControls from "@/components/game/AskControls";
import DeclareControls from "@/components/game/DeclareControls";
import ChooseTurnControls from "@/components/game/ChooseTurnControls";
import CardFlyAnimation from "@/components/game/CardFlyAnimation";

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
  const { game, players, settings, myPlayerId, declaring, loading, error } = useGame(roomId);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [defaultSet, setDefaultSet] = useState<FishSetId | null>(null);
  const [seatPositions, setSeatPositions] = useState<SeatPositions>({});
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const prevLastAskRef = useRef<LastAsk | null>(null);

  // ── Detect new successful asks and trigger fly animation ───────────────
  useEffect(() => {
    if (!game?.last_ask) return;
    const curr = game.last_ask;
    const prev = prevLastAskRef.current;

    // Check if this is a NEW successful ask (not the same one we already animated)
    const isNew = !prev
      || prev.asker_id !== curr.asker_id
      || prev.target_id !== curr.target_id
      || prev.card !== curr.card;

    if (isNew && curr.success) {
      const fromPos = seatPositions[curr.target_id];
      const toPos = seatPositions[curr.asker_id];

      if (fromPos && toPos) {
        const id = ++flyIdCounter;
        setFlyingCards((prev) => [
          ...prev,
          {
            cardKey: curr.card,
            fromX: fromPos.x,
            fromY: fromPos.y,
            toX: toPos.x,
            toY: toPos.y,
            id,
          },
        ]);
      }
    }

    prevLastAskRef.current = curr;
  }, [game?.last_ask, seatPositions]);

  function removeFlyingCard(id: number) {
    setFlyingCards((prev) => prev.filter((fc) => fc.id !== id));
  }

  // ── API action helpers ─────────────────────────────────────────────────

  const handleAsk = useCallback(async (targetId: string, card: CardKey) => {
    const res = await fetch(`/api/game/${roomId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, card }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Ask failed");
    }
    // After a successful ask, keep the same opponent selected.
    // Set the default set to the same set we just asked from,
    // unless we now have all cards in that set.
    const askedSet = getSetForCardKey(card);
    // We don't have the updated hand yet (realtime will bring it),
    // so just set the default and let AskControls figure it out.
    setDefaultSet(askedSet);
    // Don't clear selectedOpponent — keep asking the same person
  }, [roomId]);

  // When it's no longer our turn, clear selections
  useEffect(() => {
    if (game && game.current_turn !== myPlayerId) {
      setSelectedOpponent(null);
      setDefaultSet(null);
    }
  }, [game?.current_turn, myPlayerId, game]);

  // When the hand updates after a successful ask, check if we still have
  // cards to ask from the default set. If not, clear it but keep opponent.
  useEffect(() => {
    if (defaultSet && game) {
      const askable = getCardKeysInSet(defaultSet).filter((ck) => !game.my_hand.includes(ck));
      if (askable.length === 0) {
        // We have all cards in this set now — clear default set
        setDefaultSet(null);
      }
    }
  }, [game?.my_hand, defaultSet, game]);

  const handleDeclare = useCallback(async (setId: FishSetId, assignments: Record<string, CardKey[]>) => {
    const res = await fetch(`/api/game/${roomId}/declare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set_id: setId, assignments }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Declaration failed");
    }
  }, [roomId]);

  const handleChooseTurn = useCallback(async (playerId: string) => {
    const res = await fetch(`/api/game/${roomId}/choose-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosen_player_id: playerId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Choose turn failed");
    }
  }, [roomId]);

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
          <h1 className="text-2xl text-gray-200 mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Cannot load game
          </h1>
          <p className="text-gray-500 text-sm mb-4">{error || "Something went wrong"}</p>
          <a href="/" className="text-sm text-blue-500 hover:text-blue-400 transition-colors">← Back to home</a>
        </div>
      </main>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const me = players.find((p) => p.id === myPlayerId);
  const myTeam = (me?.team as TeamId) ?? "A";
  const isMyTurn = game.current_turn === myPlayerId;
  const isMyTeamsTurn = players.find((p) => p.id === game.current_turn)?.team === myTeam;
  const isFinished = game.phase === "finished";

  const lastDeclared = game.declared_sets[game.declared_sets.length - 1];
  const choosingTeam = lastDeclared?.awarded_to ?? "A";

  const declaredSetIds = game.declared_sets.map((ds) => ds.set_id);

  // Opponents are clickable when it's my turn to ask
  const canSelectOpponents = isMyTurn && game.phase === "asking";

  // ── Phase text ─────────────────────────────────────────────────────────

  let phaseText = "";
  if (isFinished) {
    phaseText = game.winner ? `Team ${game.winner} wins!` : "Game over";
  } else if (game.phase === "choosing_turn") {
    const myTeamIsChoosing = choosingTeam === myTeam;
    phaseText = myTeamIsChoosing
      ? "Your team picks who goes next"
      : `Team ${choosingTeam} is choosing...`;
  } else if (isMyTurn) {
    phaseText = game.phase === "declaring"
      ? "You must declare a set — you have no legal asks"
      : selectedOpponent
        ? ""
        : "Your turn — click an opponent to ask, or declare a set";
  } else {
    const turnPlayer = players.find((p) => p.id === game.current_turn);
    phaseText = `${turnPlayer?.display_name ?? "?"}'s turn`;
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        {/* Scoreboard */}
        <Scoreboard
          scoreA={game.score_a}
          scoreB={game.score_b}
          winner={game.winner}
        />

        {/* Phase indicator */}
        {phaseText && (
          <div className="text-center">
            <p className={`text-sm font-medium ${isMyTurn ? "text-amber-400" : "text-gray-400"}`}>
              {phaseText}
            </p>
          </div>
        )}

        {/* Players around the table */}
        <PlayerTable
          players={players}
          myPlayerId={myPlayerId}
          myTeam={myTeam}
          currentTurn={game.current_turn}
          declaredSets={game.declared_sets}
          selectableOpponents={canSelectOpponents}
          selectedOpponent={selectedOpponent}
          onSelectOpponent={setSelectedOpponent}
          onSeatPositions={setSeatPositions}
        />

        {/* Event banners */}
        <EventBanner
          lastAsk={game.last_ask}
          declaredSets={game.declared_sets}
          players={players}
        />

        {/* Declaring intent banner — shown to everyone when someone is declaring */}
        {declaring && declaring.player_id !== myPlayerId && (
          <div className="w-full px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-center">
            <p className="text-sm text-amber-300">
              <span className="font-medium text-amber-200">
                {players.find((p) => p.id === declaring.player_id)?.display_name ?? "?"}
              </span>
              {" is declaring "}
              <span className="font-medium text-amber-200">
                {setLabel(declaring.set_id as FishSetId)}
              </span>
              ...
            </p>
          </div>
        )}

        {/* Action area */}
        {!isFinished && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {game.phase === "choosing_turn" ? (
              <ChooseTurnControls
                myTeam={myTeam}
                choosingTeam={choosingTeam}
                players={players}
                myPlayerId={myPlayerId}
                onChoose={handleChooseTurn}
              />
            ) : isMyTurn || (settings?.team_declare && isMyTeamsTurn && game.phase === "declaring") ? (
              <>
                {/* Ask controls — when opponent is selected */}
                {game.phase === "asking" && isMyTurn && selectedOpponent && (
                  <AskControls
                    myHand={game.my_hand}
                    myPlayerId={myPlayerId}
                    players={players}
                    selectedTarget={selectedOpponent}
                    defaultSet={defaultSet}
                    onAsk={handleAsk}
                    onCancelTarget={() => {
                      setSelectedOpponent(null);
                      setDefaultSet(null);
                    }}
                  />
                )}

                {/* Declare controls */}
                {(!selectedOpponent || game.phase === "declaring") && (
                  <DeclareControls
                    myHand={game.my_hand}
                    myPlayerId={myPlayerId}
                    myTeam={myTeam}
                    players={players}
                    declaredSetIds={declaredSetIds}
                    roomId={roomId}
                    forced={game.phase === "declaring"}
                    onDeclare={handleDeclare}
                  />
                )}
              </>
            ) : declaring && declaring.player_id !== myPlayerId ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">
                  <span className="text-gray-300 font-medium">
                    {players.find((p) => p.id === declaring.player_id)?.display_name ?? "?"}
                  </span>
                  {" is declaring "}
                  <span className="text-gray-300 font-medium">
                    {setLabel(declaring.set_id as FishSetId)}
                  </span>
                  ...
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">
                  Waiting for{" "}
                  <span className="text-gray-300">
                    {players.find((p) => p.id === game.current_turn)?.display_name ?? "?"}
                  </span>
                  {" "}to play...
                </p>
              </div>
            )}
          </div>
        )}

        {/* My hand */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <MyHand hand={game.my_hand} />
        </div>

        {/* Postgame log */}
        {isFinished && game.action_log && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-lg text-gray-200 mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Game Log
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto text-xs text-gray-500">
              {game.action_log.map((action, i) => {
                if (action.type === "ask") {
                  const asker = players.find((p) => p.id === action.asker_id)?.display_name ?? "?";
                  const target = players.find((p) => p.id === action.target_id)?.display_name ?? "?";
                  return (
                    <div key={i}>
                      <span className="text-gray-400">{asker}</span>
                      {" asked "}
                      <span className="text-gray-400">{target}</span>
                      {" for "}
                      <span className="text-gray-400">{action.card}</span>
                      {" — "}
                      <span className={action.success ? "text-emerald-400" : "text-gray-600"}>
                        {action.success ? "yes" : "no"}
                      </span>
                    </div>
                  );
                }
                if (action.type === "declare") {
                  const declarer = players.find((p) => p.id === action.declarer_id)?.display_name ?? "?";
                  return (
                    <div key={i}>
                      <span className="text-gray-400">{declarer}</span>
                      {" declared "}
                      <span className="text-gray-400">{action.set_id}</span>
                      {" — "}
                      <span className={action.success ? "text-emerald-400" : "text-red-400"}>
                        {action.success ? "correct" : "misdeclare"}
                      </span>
                      {action.awarded_to ? ` → Team ${action.awarded_to}` : " → nullified"}
                    </div>
                  );
                }
                if (action.type === "choose_turn") {
                  const chosen = players.find((p) => p.id === action.chosen_player_id)?.display_name ?? "?";
                  return (
                    <div key={i}>
                      Team {action.team} chose <span className="text-gray-400">{chosen}</span> to go next
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="text-center mt-2">
          <a href="/" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">← Back to home</a>
        </div>
      </div>

      {/* Flying card animations */}
      {flyingCards.map((fc) => (
        <CardFlyAnimation
          key={fc.id}
          cardKey={fc.cardKey}
          fromX={fc.fromX}
          fromY={fc.fromY}
          toX={fc.toX}
          toY={fc.toY}
          onComplete={() => removeFlyingCard(fc.id)}
        />
      ))}
    </main>
  );
}