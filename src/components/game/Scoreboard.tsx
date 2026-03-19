"use client";

import type { TeamId } from "@/lib/types";

interface ScoreboardProps {
  scoreA: number;
  scoreB: number;
  winner: TeamId | null;
}

export default function Scoreboard({ scoreA, scoreB, winner }: ScoreboardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-3">
      <div className="flex items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-sky-400 font-medium">Team A</p>
          <p className={`text-3xl font-bold ${winner === "A" ? "text-amber-400" : "text-gray-200"}`}>
            {scoreA}
          </p>
        </div>
        <div className="text-gray-700 text-lg">—</div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-rose-400 font-medium">Team B</p>
          <p className={`text-3xl font-bold ${winner === "B" ? "text-amber-400" : "text-gray-200"}`}>
            {scoreB}
          </p>
        </div>
      </div>

      {winner && (
        <div className="text-center mt-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-400 font-semibold text-sm">
            Team {winner} wins!
          </p>
        </div>
      )}
    </div>
  );
}