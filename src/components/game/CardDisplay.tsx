"use client";

import type { CardKey } from "@/lib/types";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const SUIT_COLORS: Record<string, string> = {
  spades: "text-gray-200",
  clubs: "text-gray-200",
  hearts: "text-red-400",
  diamonds: "text-red-400",
};

interface CardDisplayProps {
  cardKey: CardKey;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export default function CardDisplay({ cardKey, selected, onClick, disabled, size = "md" }: CardDisplayProps) {
  const [rank, suit] = cardKey.split(":");
  const isJoker = suit === "joker";

  const sizeClasses = size === "sm"
    ? "w-10 h-14 text-xs"
    : "w-14 h-20 text-sm";

  const suitSize = size === "sm" ? "text-sm" : "text-lg";

  const baseClasses = `
    ${sizeClasses}
    rounded-lg border flex flex-col items-center justify-center
    font-semibold transition-all duration-150
    ${selected
      ? "border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/40 scale-105"
      : disabled
        ? "border-white/[0.04] bg-white/[0.02] opacity-40 cursor-not-allowed"
        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.15] cursor-pointer"
    }
  `;

  if (isJoker) {
    const jokerColor = rank === "red" ? "text-red-400" : "text-gray-300";
    const jokerLabel = rank === "red" ? "Red Joker" : "Black Joker";

    return (
      <button
        onClick={onClick}
        disabled={disabled && !selected}
        title={jokerLabel}
        className={`${baseClasses} ${jokerColor}`}
      >
        <span className="leading-none text-[9px] font-bold uppercase tracking-tight">
          {size === "sm" ? "JKR" : "Joker"}
        </span>
      </button>
    );
  }

  const symbol = SUIT_SYMBOLS[suit] ?? "";
  const color = SUIT_COLORS[suit] ?? "text-gray-300";

  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      title={`${rank} of ${suit}`}
      className={`${baseClasses} ${color}`}
    >
      <span className="leading-none">{rank}</span>
      <span className={`leading-none ${suitSize} mt-0.5`}>{symbol}</span>
    </button>
  );
}