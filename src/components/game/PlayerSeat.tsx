"use client";

import type { PlayerInfo } from "@/hooks/useGame";
import type { TeamId } from "@/lib/types";

interface PlayerSeatProps {
  player: PlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  selectable?: boolean;
}

const TEAM_COLORS: Record<TeamId, { bg: string; border: string; text: string; pulse: string; hoverBorder: string }> = {
  A: { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400", pulse: "border-sky-400/40", hoverBorder: "hover:border-sky-400/50" },
  B: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", pulse: "border-rose-400/40", hoverBorder: "hover:border-rose-400/50" },
};

export default function PlayerSeat({
  player,
  isMe,
  isCurrentTurn,
  isSelected,
  onClick,
  selectable,
}: PlayerSeatProps) {
  const team = player.team as TeamId;
  const colors = TEAM_COLORS[team] || { bg: "bg-white/5", border: "border-white/10", text: "text-gray-400", pulse: "border-white/20", hoverBorder: "hover:border-white/30" };

  const isPulsing = selectable && !isSelected;

  return (
    <button
      onClick={onClick}
      disabled={!selectable}
      className={`
        relative flex flex-col items-center gap-1 p-3 rounded-xl border
        transition-all duration-200 min-w-[80px]
        ${isSelected
          ? "border-blue-400 bg-blue-500/15 ring-2 ring-blue-400/40 scale-105"
          : isCurrentTurn
            ? `${colors.border} ${colors.bg} ring-1 ring-amber-400/30`
            : isPulsing
              ? `${colors.border} ${colors.bg}`
              : "border-white/[0.06] bg-white/[0.02]"
        }
        ${selectable
          ? `hover:bg-white/[0.08] ${colors.hoverBorder} hover:scale-105 cursor-pointer`
          : "cursor-default"
        }
      `}
    >
      {/* Pulsing ring in team color */}
      {isPulsing && (
        <div className={`absolute inset-0 rounded-xl border-2 ${colors.pulse} animate-pulse pointer-events-none`} />
      )}

      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
          <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
        </div>
      )}

      {/* Avatar */}
      <div
        className={`
          w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
          ${isMe ? "bg-amber-500/20 text-amber-400" : `${colors.bg} ${colors.text}`}
        `}
      >
        {player.display_name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <span className={`text-xs truncate max-w-[72px] ${isMe ? "text-amber-200" : "text-gray-300"}`}>
        {isMe ? "You" : player.display_name}
      </span>

      {/* Card count */}
      <span className="text-[10px] text-gray-600">
        {player.card_count} card{player.card_count !== 1 ? "s" : ""}
      </span>

      {/* Team badge */}
      <span className={`text-[9px] font-medium uppercase tracking-wider ${colors.text}`}>
        Team {team}
      </span>
    </button>
  );
}