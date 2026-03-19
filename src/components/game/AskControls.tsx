"use client";

import { useState, useEffect, useRef } from "react";
import type { CardKey, FishSetId } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import { getCardKeysInSet, setLabel, cardKeyLabel } from "@/lib/cards";
import { setsInHand } from "@/lib/cards";
import Button from "@/components/ui/Button";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};
const SUIT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  spades: { text: "text-gray-200", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  clubs: { text: "text-gray-200", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  hearts: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  diamonds: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

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
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // When defaultSet changes (after successful ask), clear selection
  const prevDefault = useRef(defaultSet);
  useEffect(() => {
    if (defaultSet !== prevDefault.current) {
      prevDefault.current = defaultSet;
      setSelectedCard(null);
    }
  }, [defaultSet]);

  const targetPlayer = players?.find((p) => p.id === selectedTarget);
  const mySets = setsInHand(myHand);

  async function handleAsk() {
    if (!selectedCard) return;
    setLoading(true);
    setError("");
    try {
      await onAsk(selectedTarget, selectedCard);
      setSelectedCard(null);
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
            setSelectedCard(null);
            setError("");
          }}
          className="text-xs px-2.5 py-1 rounded-md border border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          Change
        </button>
      </div>
      <p className="text-[10px] text-gray-600 -mt-2">
        Click a missing card to ask for it
      </p>

      {/* Visual set rows */}
      <div className="space-y-3">
        {mySets.map((setId) => {
          const allCards = getCardKeysInSet(setId);
          const heldCards = allCards.filter((ck) => myHand.includes(ck));
          const missingCards = allCards.filter((ck) => !myHand.includes(ck));

          if (missingCards.length === 0) return null; // Can't ask from complete sets

          // Determine suit for color theming
          const sampleCard = allCards[0];
          const suit = sampleCard?.split(":")[1] ?? "spades";
          const isEightsJokers = setId === "eights_jokers";
          const colors = SUIT_COLORS[suit] ?? SUIT_COLORS.spades;

          return (
            <div key={setId} className="space-y-1.5">
              {/* Set label */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${isEightsJokers ? "text-gray-400" : colors.text}`}>
                  {setLabel(setId)}
                </span>
                <span className="text-[9px] text-gray-700">
                  {heldCards.length}/6
                </span>
              </div>

              {/* Cards row */}
              <div className="flex flex-wrap gap-1">
                {allCards.map((ck) => {
                  const [rank, cardSuit] = ck.split(":");
                  const isJoker = cardSuit === "joker";
                  const iHaveIt = myHand.includes(ck);
                  const isSelected = selectedCard === ck;
                  const cardColors = isJoker
                    ? { text: rank === "red" ? "text-red-400" : "text-gray-300" }
                    : { text: SUIT_COLORS[cardSuit]?.text ?? "text-gray-300" };
                  const symbol = SUIT_SYMBOLS[cardSuit] ?? "";

                  if (iHaveIt) {
                    // Card you hold — solid, not clickable
                    return (
                      <div
                        key={ck}
                        className={`
                          w-10 h-14 rounded-lg border flex flex-col items-center justify-center
                          text-xs font-semibold
                          border-white/[0.08] bg-white/[0.05]
                          ${cardColors.text} opacity-50
                        `}
                        title={`You hold: ${cardKeyLabel(ck)}`}
                      >
                        {isJoker ? (
                          <span className="text-[8px] font-bold uppercase">JKR</span>
                        ) : (
                          <>
                            <span className="leading-none text-[11px]">{rank}</span>
                            <span className="leading-none text-sm">{symbol}</span>
                          </>
                        )}
                      </div>
                    );
                  }

                  // Card you're missing — clickable ghost
                  return (
                    <button
                      key={ck}
                      onClick={() => {
                        setSelectedCard(isSelected ? null : ck);
                        setError("");
                      }}
                      className={`
                        w-10 h-14 rounded-lg border-2 border-dashed flex flex-col items-center justify-center
                        text-xs font-semibold transition-all cursor-pointer
                        ${isSelected
                          ? "border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/40 scale-105 border-solid"
                          : `border-white/[0.12] bg-transparent hover:bg-white/[0.06] hover:border-white/[0.25] hover:scale-105`
                        }
                        ${isSelected ? "text-blue-300" : cardColors.text}
                      `}
                      title={`Ask for: ${cardKeyLabel(ck)}`}
                    >
                      {isJoker ? (
                        <span className="text-[8px] font-bold uppercase">JKR</span>
                      ) : (
                        <>
                          <span className="leading-none text-[11px]">{rank}</span>
                          <span className="leading-none text-sm">{symbol}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm */}
      {selectedCard && (
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleAsk} loading={loading} size="md">
            Ask for {cardKeyLabel(selectedCard)}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}