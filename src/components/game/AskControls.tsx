"use client";

import { useState, useEffect, useRef } from "react";
import type { CardKey, FishSetId } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import { getCardKeysInSet, cardKeyLabel } from "@/lib/cards";
import { setsInHand } from "@/lib/cards";
import Button from "@/components/ui/Button";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};
const SUIT_COLORS: Record<string, string> = {
  spades: "text-gray-200",
  clubs: "text-gray-200",
  hearts: "text-red-400",
  diamonds: "text-red-400",
};

function getSetDisplay(setId: FishSetId): { symbol: string; label: string; color: string } {
  if (setId === "eights_jokers") {
    return { symbol: "", label: "8's &\nJKRs", color: "text-gray-300" };
  }
  const [half, suit] = setId.split("_") as [string, string];
  return {
    symbol: SUIT_SYMBOLS[suit] ?? "♠",
    label: half === "low" ? "Low" : "High",
    color: SUIT_COLORS[suit] ?? "text-gray-200",
  };
}

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
  const [expandedSet, setExpandedSet] = useState<FishSetId | null>(defaultSet ?? null);
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prevDefault = useRef(defaultSet);
  useEffect(() => {
    if (defaultSet !== prevDefault.current) {
      prevDefault.current = defaultSet;
      if (defaultSet) {
        setExpandedSet(defaultSet);
        setSelectedCard(null);
      }
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
            setExpandedSet(null);
            setSelectedCard(null);
            setError("");
          }}
          className="text-xs px-2.5 py-1 rounded-md border border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          Change
        </button>
      </div>
      <p className="text-[10px] text-gray-600 -mt-2">
        Pick a set, then click the card you want
      </p>

      {/* Card-sized set selectors */}
      <div className="flex flex-wrap gap-1.5">
        {mySets.map((setId) => {
          const allCards = getCardKeysInSet(setId);
          const heldCount = allCards.filter((ck) => myHand.includes(ck)).length;
          const missingCount = allCards.length - heldCount;
          if (missingCount === 0) return null;

          const { symbol, label, color } = getSetDisplay(setId);
          const isExpanded = expandedSet === setId;
          const isEights = setId === "eights_jokers";

          return (
            <button
              key={setId}
              onClick={() => {
                setExpandedSet(isExpanded ? null : setId);
                setSelectedCard(null);
                setError("");
              }}
              className={`
                w-12 h-[68px] rounded-lg border flex flex-col items-center justify-center
                transition-all cursor-pointer
                ${isExpanded
                  ? "border-blue-400 bg-blue-500/15 ring-1 ring-blue-400/30 scale-105"
                  : "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.10] hover:border-white/[0.2] hover:scale-105"
                }
              `}
              title={`${label} — ${heldCount}/6 cards`}
            >
              {isEights ? (
                <span className={`text-[8px] font-bold text-center leading-tight uppercase ${isExpanded ? "text-blue-300" : "text-gray-200"}`}>
                  8&apos;s &amp;<br />JKRs
                </span>
              ) : (
                <>
                  <span className={`text-xl leading-none ${isExpanded ? "text-blue-300" : color}`}>
                    {symbol}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wide mt-1 ${isExpanded ? "text-blue-300" : "text-gray-200"}`}>
                    {label}
                  </span>
                </>
              )}
              <span className={`text-[8px] font-medium mt-0.5 ${isExpanded ? "text-blue-400" : "text-gray-500"}`}>
                {heldCount}/6
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded card row */}
      {expandedSet && (() => {
        const allCards = getCardKeysInSet(expandedSet);
        return (
          <div className="flex flex-wrap gap-1.5">
            {allCards.map((ck) => {
              const [rank, cardSuit] = ck.split(":");
              const isJoker = cardSuit === "joker";
              const iHaveIt = myHand.includes(ck);
              const isSelected = selectedCard === ck;
              const cardColor = isJoker
                ? (rank === "red" ? "text-red-400" : "text-gray-300")
                : (SUIT_COLORS[cardSuit] ?? "text-gray-300");
              const symbol = SUIT_SYMBOLS[cardSuit] ?? "";

              if (iHaveIt) {
                return (
                  <div
                    key={ck}
                    className={`
                      w-12 h-[68px] rounded-lg border flex flex-col items-center justify-center
                      text-xs font-semibold
                      border-white/[0.08] bg-white/[0.05] ${cardColor} opacity-40
                    `}
                    title={`You hold: ${cardKeyLabel(ck)}`}
                  >
                    {isJoker ? (
                      <span className="text-[8px] font-bold uppercase">JKR</span>
                    ) : (
                      <>
                        <span className="leading-none text-sm">{rank}</span>
                        <span className="leading-none text-lg mt-0.5">{symbol}</span>
                      </>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={ck}
                  onClick={() => {
                    setSelectedCard(isSelected ? null : ck);
                    setError("");
                  }}
                  className={`
                    w-12 h-[68px] rounded-lg flex flex-col items-center justify-center
                    text-xs font-semibold transition-all cursor-pointer
                    ${isSelected
                      ? "border-2 border-solid border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/30 scale-105 text-blue-300"
                      : `border-2 border-dashed border-white/[0.15] bg-transparent hover:bg-white/[0.06] hover:border-white/[0.3] hover:scale-105 ${cardColor}`
                    }
                  `}
                  title={`Ask for: ${cardKeyLabel(ck)}`}
                >
                  {isJoker ? (
                    <span className="text-[8px] font-bold uppercase">JKR</span>
                  ) : (
                    <>
                      <span className="leading-none text-sm">{rank}</span>
                      <span className="leading-none text-lg mt-0.5">{symbol}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Confirm */}
      {selectedCard && (
        <div className="flex items-center gap-3">
          <Button onClick={handleAsk} loading={loading} size="md">
            Ask for {cardKeyLabel(selectedCard)}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}