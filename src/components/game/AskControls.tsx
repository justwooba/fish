"use client";

import { useState, useEffect, useRef } from "react";
import type { CardKey, FishSetId } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import { getCardKeysInSet, setLabel, cardKeyLabel } from "@/lib/cards";
import { setsInHand } from "@/lib/cards";
import Button from "@/components/ui/Button";
import CardDisplay from "./CardDisplay";

interface AskControlsProps {
  myHand: CardKey[];
  myPlayerId: string;
  players: PlayerInfo[];
  selectedTarget: string;
  defaultSet?: FishSetId | null;
  onAsk: (targetId: string, card: CardKey) => Promise<void>;
  onCancelTarget: () => void;
}

export default function AskControls({
  myHand,
  myPlayerId,
  players,
  selectedTarget,
  defaultSet,
  onAsk,
  onCancelTarget,
}: AskControlsProps) {
  const [selectedSet, setSelectedSet] = useState<FishSetId | null>(defaultSet ?? null);
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Track if defaultSet changes (after a successful ask)
  const prevDefault = useRef(defaultSet);
  useEffect(() => {
    if (defaultSet !== prevDefault.current) {
      prevDefault.current = defaultSet;
      if (defaultSet) {
        setSelectedSet(defaultSet);
        setSelectedCard(null);
      }
    }
  }, [defaultSet]);

  const targetPlayer = players?.find((p) => p.id === selectedTarget);
  const mySets = setsInHand(myHand);

  const askableCards = selectedSet
    ? getCardKeysInSet(selectedSet).filter((ck) => !myHand.includes(ck))
    : [];

  async function handleAsk() {
    if (!selectedCard) return;
    setLoading(true);
    setError("");
    try {
      await onAsk(selectedTarget, selectedCard);
      setSelectedCard(null);
      // Don't clear selectedSet — parent will update defaultSet
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ask failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Target header */}
      <div className="flex items-center gap-3">
        <h3
          className="text-lg text-gray-200"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Asking {targetPlayer?.display_name ?? "?"}
        </h3>
        <button
          onClick={() => {
            onCancelTarget();
            setSelectedSet(null);
            setSelectedCard(null);
            setError("");
          }}
          className="text-xs px-2.5 py-1 rounded-md border border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          Change
        </button>
      </div>
      <p className="text-[10px] text-gray-600 -mt-2">Or click another opponent on the table</p>

      {/* Pick set */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Choose a set</p>
        <div className="flex flex-wrap gap-1.5">
          {mySets.map((setId) => (
            <button
              key={setId}
              onClick={() => {
                setSelectedSet(setId);
                setSelectedCard(null);
                setError("");
              }}
              className={`
                text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer
                ${selectedSet === setId
                  ? "border-blue-400 bg-blue-500/15 text-blue-300"
                  : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06]"
                }
              `}
            >
              {setLabel(setId)}
            </button>
          ))}
        </div>
      </div>

      {/* Pick card */}
      {selectedSet && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Choose a card to ask for</p>
          <div className="flex flex-wrap gap-1.5">
            {askableCards.map((ck) => (
              <CardDisplay
                key={ck}
                cardKey={ck}
                selected={selectedCard === ck}
                onClick={() => {
                  setSelectedCard(ck);
                  setError("");
                }}
              />
            ))}
            {askableCards.length === 0 && (
              <p className="text-sm text-gray-600 italic">You already have all cards in this set!</p>
            )}
          </div>
        </div>
      )}

      {/* Confirm */}
      {selectedCard && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-gray-400">
            Ask{" "}
            <span className="text-gray-200 font-medium">{targetPlayer?.display_name}</span>
            {" for the "}
            <span className="text-gray-200 font-medium">{cardKeyLabel(selectedCard)}</span>
          </div>
          <Button onClick={handleAsk} loading={loading} size="md" className="w-fit">
            Ask
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}