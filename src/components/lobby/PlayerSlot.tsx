"use client";

import type { Player } from "@/lib/types";

interface PlayerSlotProps {
  player?: Player;
  isCurrentUser?: boolean;
  isHost?: boolean;
  canKick?: boolean;
  onKick?: (playerId: string) => void;
}

export default function PlayerSlot({ player, isCurrentUser, isHost, canKick, onKick }: PlayerSlotProps) {
  if (!player) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01]">
        <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.06]" />
        <span className="text-sm text-gray-700 italic">Waiting for player...</span>
      </div>
    );
  }

  return (
    <div
      className={`
        group flex items-center gap-3 px-4 py-3 rounded-xl border
        transition-all duration-200
        ${isCurrentUser
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : "border-white/[0.06] bg-white/[0.02]"
        }
      `}
    >
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
          ${isCurrentUser
            ? "bg-amber-500/20 text-amber-400"
            : "bg-white/[0.06] text-gray-400"
          }
        `}
      >
        {player.display_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate ${isCurrentUser ? "text-amber-200" : "text-gray-200"}`}>
            {player.display_name}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] uppercase tracking-wider text-amber-500/60 font-medium">You</span>
          )}
          {isHost && (
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Host</span>
          )}
        </div>
      </div>
      {canKick && onKick && !isCurrentUser ? (
        <button
          onClick={() => onKick(player.id)}
          className="
            opacity-0 group-hover:opacity-100
            text-[10px] uppercase tracking-wider font-medium
            text-gray-600 hover:text-red-400
            px-2 py-1 rounded-lg
            hover:bg-red-500/[0.08]
            transition-all duration-150
            cursor-pointer
          "
          title={`Kick ${player.display_name}`}
        >
          Kick
        </button>
      ) : (
        <>
          {player.is_connected ? (
            <div className="w-2 h-2 rounded-full bg-emerald-500/80 shrink-0" title="Connected" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-600 shrink-0" title="Disconnected" />
          )}
        </>
      )}
    </div>
  );
}