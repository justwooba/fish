"use client";

import { useState } from "react";
import type { CardKey, FishSetId, TeamId } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import { setsInHand, getCardKeysInSet, setLabel } from "@/lib/cards";
import { FISH_SET_IDS } from "@/lib/types";
import Button from "@/components/ui/Button";
import CardDisplay from "./CardDisplay";

type DeclareStep = "idle" | "pick_set" | "confirm" | "assign";

interface DeclareControlsProps {
  myHand: CardKey[];
  myPlayerId: string;
  myTeam: TeamId;
  players: PlayerInfo[];
  declaredSetIds: string[];
  roomId: string;
  forced?: boolean; // true when phase === "declaring" (must declare)
  onDeclare: (setId: FishSetId, assignments: Record<string, CardKey[]>) => Promise<void>;
}

export default function DeclareControls({
  myHand,
  myPlayerId,
  myTeam,
  players,
  declaredSetIds,
  roomId,
  forced,
  onDeclare,
}: DeclareControlsProps) {
  const [step, setStep] = useState<DeclareStep>(forced ? "pick_set" : "idle");
  const [selectedSet, setSelectedSet] = useState<FishSetId | null>(null);
  const [assignments, setAssignments] = useState<Record<string, CardKey[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const teammates = players.filter((p) => p.team === myTeam);
  const mySetIds = setsInHand(myHand);
  const availableSets = FISH_SET_IDS.filter((id) => !declaredSetIds.includes(id));

  const selectedSetCards = selectedSet ? getCardKeysInSet(selectedSet) : [];
  const allAssigned = Object.values(assignments).flat();
  const unassigned = selectedSetCards.filter(
    (ck) => !allAssigned.includes(ck) && !myHand.includes(ck)
  );

  function handleAssign(playerId: string, cardKey: CardKey) {
    if (myHand.includes(cardKey) && playerId !== myPlayerId) return;
    if (myHand.includes(cardKey) && playerId === myPlayerId) return;

    setAssignments((prev) => {
      const current = prev[playerId] ?? [];
      if (current.includes(cardKey)) {
        return { ...prev, [playerId]: current.filter((c) => c !== cardKey) };
      }
      const cleaned: Record<string, CardKey[]> = {};
      for (const [pid, cards] of Object.entries(prev)) {
        if (pid === myPlayerId) {
          cleaned[pid] = cards;
        } else {
          cleaned[pid] = cards.filter((c) => c !== cardKey);
        }
      }
      cleaned[playerId] = [...(cleaned[playerId] ?? []), cardKey];
      return cleaned;
    });
    setError("");
  }

  function handleSelectSet(setId: FishSetId) {
    setSelectedSet(setId);
    const myCards = getCardKeysInSet(setId).filter((ck) => myHand.includes(ck));
    const initial: Record<string, CardKey[]> = {};
    if (myCards.length > 0) {
      initial[myPlayerId] = myCards;
    }
    setAssignments(initial);
    setError("");
  }

  async function handleConfirmSet() {
    if (!selectedSet) return;
    setLoading(true);
    try {
      // Broadcast intent to other players
      await fetch(`/api/game/${roomId}/declare-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_id: selectedSet }),
      });
      setStep("assign");
    } catch {
      setError("Failed to start declaration");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeclare() {
    if (!selectedSet) return;
    if (allAssigned.length !== 6) {
      setError("Assign all 6 cards before declaring");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cleanAssignments: Record<string, CardKey[]> = {};
      for (const [pid, cards] of Object.entries(assignments)) {
        if (cards.length > 0) cleanAssignments[pid] = cards;
      }
      await onDeclare(selectedSet, cleanAssignments);
      setStep(forced ? "pick_set" : "idle");
      setSelectedSet(null);
      setAssignments({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Declaration failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Step: idle — just a button ──────────────────────────────────────────

  if (step === "idle") {
    return (
      <Button
        variant="secondary"
        size="md"
        onClick={() => setStep("pick_set")}
        className="w-full"
      >
        Declare a Set
      </Button>
    );
  }

  // ── Step: pick_set ──────────────────────────────────────────────────────

  if (step === "pick_set") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3
            className="text-lg text-gray-200"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {forced ? "You must declare a set" : "Declare a Set"}
          </h3>
          {!forced && (
            <button
              onClick={() => { setStep("idle"); setSelectedSet(null); setError(""); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500">Choose which set to declare</p>
        <div className="flex flex-wrap gap-1.5">
          {availableSets.map((setId) => (
            <button
              key={setId}
              onClick={() => handleSelectSet(setId)}
              className={`
                text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer
                ${selectedSet === setId
                  ? "border-blue-400 bg-blue-500/15 text-blue-300"
                  : mySetIds.includes(setId)
                    ? "border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]"
                    : "border-white/[0.04] bg-white/[0.01] text-gray-600 hover:bg-white/[0.04]"
                }
              `}
            >
              {setLabel(setId)}
            </button>
          ))}
        </div>

        {selectedSet && (
          <Button onClick={() => setStep("confirm")} size="md" className="w-fit">
            Next
          </Button>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Step: confirm — are you sure? ───────────────────────────────────────

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <h3
          className="text-lg text-gray-200"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Declare {setLabel(selectedSet!)}?
        </h3>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-sm text-amber-300">
            Once you begin declaring, you cannot take it back.
          </p>
          <p className="text-xs text-amber-400/60 mt-1">
            All players will see that you are declaring this set.
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleConfirmSet} loading={loading} size="md">
            Yes, declare {setLabel(selectedSet!)}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => { setStep("pick_set"); setError(""); }}
            disabled={loading}
          >
            Go back
          </Button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Step: assign — committed, now assign cards ──────────────────────────

  return (
    <div className="space-y-4">
      <h3
        className="text-lg text-gray-200"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Declaring {setLabel(selectedSet!)}
      </h3>
      <p className="text-xs text-gray-500">Assign each card to the teammate who holds it</p>

      {/* Unassigned cards */}
      {unassigned.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Unassigned cards</p>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((ck) => (
              <CardDisplay key={ck} cardKey={ck} size="sm" disabled />
            ))}
          </div>
        </div>
      )}

      {/* Per-teammate assignment */}
      {teammates.map((tm) => {
        const tmCards = assignments[tm.id] ?? [];
        const isMe = tm.id === myPlayerId;
        const mySetCards = selectedSetCards.filter((ck) => myHand.includes(ck));

        return (
          <div
            key={tm.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium ${isMe ? "text-amber-300" : "text-gray-300"}`}>
                {isMe ? "You" : tm.display_name}
              </span>
              <span className="text-[10px] text-gray-600">({isMe ? mySetCards.length : tmCards.length} cards)</span>
              {isMe && (
                <span className="text-[9px] text-gray-700 italic">auto-assigned from your hand</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
              {isMe ? (
                mySetCards.map((ck) => (
                  <CardDisplay key={ck} cardKey={ck} size="sm" selected disabled />
                ))
              ) : (
                <>
                  {tmCards.map((ck) => (
                    <CardDisplay
                      key={ck}
                      cardKey={ck}
                      size="sm"
                      selected
                      onClick={() => handleAssign(tm.id, ck)}
                    />
                  ))}
                  {unassigned.map((ck) => (
                    <CardDisplay
                      key={`add-${ck}`}
                      cardKey={ck}
                      size="sm"
                      onClick={() => handleAssign(tm.id, ck)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Submit */}
      {allAssigned.length === 6 && (
        <Button onClick={handleDeclare} loading={loading} size="md" className="w-fit">
          Declare
        </Button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}