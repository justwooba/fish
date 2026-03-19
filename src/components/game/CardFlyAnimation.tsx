"use client";

import { useEffect, useState, useRef } from "react";
import type { CardKey } from "@/lib/types";

const SUIT_SYMBOLS: Record<string, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};
const SUIT_COLORS: Record<string, string> = {
  spades: "text-gray-200", clubs: "text-gray-200",
  hearts: "text-red-400", diamonds: "text-red-400",
};

interface CardFlyAnimationProps {
  cardKey: CardKey;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  onComplete: () => void;
}

export default function CardFlyAnimation({
  cardKey,
  fromX,
  fromY,
  toX,
  toY,
  onComplete,
}: CardFlyAnimationProps) {
  const [phase, setPhase] = useState<"start" | "flying" | "done">("start");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t1 = requestAnimationFrame(() => {
      setPhase("flying");
    });

    const t2 = setTimeout(() => {
      setPhase("done");
      onCompleteRef.current();
    }, 600);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  const [rank, suit] = cardKey.split(":");
  const isJoker = suit === "joker";
  const symbol = SUIT_SYMBOLS[suit] ?? "";
  const color = SUIT_COLORS[suit] ?? "text-gray-300";

  const x = phase === "start" ? fromX : toX;
  const y = phase === "start" ? fromY : toY;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: x - 28,
        top: y - 40,
        transition: "left 0.5s cubic-bezier(0.22, 1, 0.36, 1), top 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease-out",
        opacity: phase === "start" ? 0.9 : 1,
      }}
    >
      <div
        className={`
          w-14 h-20 rounded-lg border flex flex-col items-center justify-center
          font-semibold text-sm shadow-xl shadow-black/40
          border-blue-400/50 bg-gray-900/95 backdrop-blur-sm
          ${isJoker ? (rank === "red" ? "text-red-400" : "text-gray-300") : color}
        `}
        style={{
          transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          transform: phase === "start" ? "scale(0.8) rotate(-5deg)" : "scale(1.1) rotate(2deg)",
        }}
      >
        {isJoker ? (
          <span className="text-[9px] font-bold uppercase">Joker</span>
        ) : (
          <>
            <span className="leading-none">{rank}</span>
            <span className="leading-none text-lg mt-0.5">{symbol}</span>
          </>
        )}
      </div>
    </div>
  );
}