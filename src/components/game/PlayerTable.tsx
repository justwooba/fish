"use client";

import { useRef, useEffect } from "react";
import type { PlayerInfo } from "@/hooks/useGame";
import type { DeclaredSet, TeamId } from "@/lib/types";
import { setLabel } from "@/lib/cards";
import PlayerSeat from "./PlayerSeat";

export interface SeatPositions {
  [playerId: string]: { x: number; y: number };
}

interface PlayerTableProps {
  players: PlayerInfo[];
  myPlayerId: string;
  myTeam: TeamId;
  currentTurn: string;
  declaredSets: DeclaredSet[];
  selectableOpponents?: boolean;
  selectedOpponent?: string | null;
  onSelectOpponent?: (playerId: string) => void;
  onSeatPositions?: (positions: SeatPositions) => void;
}

export default function PlayerTable({
  players,
  myPlayerId,
  myTeam,
  currentTurn,
  declaredSets,
  selectableOpponents,
  selectedOpponent,
  onSelectOpponent,
  onSeatPositions,
}: PlayerTableProps) {
  const sorted = [...players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  const myIndex = sorted.findIndex((p) => p.id === myPlayerId);
  const rotated: PlayerInfo[] = [];
  for (let i = 0; i < sorted.length; i++) {
    rotated.push(sorted[(myIndex + i) % sorted.length]);
  }

  const teamASets = declaredSets.filter((ds) => ds.awarded_to === "A");
  const teamBSets = declaredSets.filter((ds) => ds.awarded_to === "B");
  const nullSets = declaredSets.filter((ds) => ds.awarded_to === null);

  // Refs for each seat position
  const seatRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null, null]);
  const rotatedRef = useRef(rotated);
  rotatedRef.current = rotated;
  const onSeatPositionsRef = useRef(onSeatPositions);
  onSeatPositionsRef.current = onSeatPositions;

  // Update positions after render and on resize
  useEffect(() => {
    function updatePositions() {
      if (!onSeatPositionsRef.current) return;
      const positions: SeatPositions = {};
      rotatedRef.current.forEach((player, i) => {
        const el = seatRefs.current[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          positions[player.id] = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
      });
      onSeatPositionsRef.current(positions);
    }

    // Small delay to let layout settle
    const t = setTimeout(updatePositions, 100);
    window.addEventListener("resize", updatePositions);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updatePositions);
    };
  }, [players]);

  function renderSeat(player: PlayerInfo, index: number) {
    const isOpponent = player.team !== myTeam;
    const canSelect = selectableOpponents && isOpponent && player.card_count > 0;

    return (
      <div ref={(el) => { seatRefs.current[index] = el; }}>
        <PlayerSeat
          player={player}
          isMe={player.id === myPlayerId}
          isCurrentTurn={currentTurn === player.id}
          isSelected={selectedOpponent === player.id}
          onClick={canSelect ? () => onSelectOpponent?.(player.id) : undefined}
          selectable={canSelect}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {selectableOpponents && !selectedOpponent && (
        <p className="text-center text-xs text-blue-400/70 mb-2 animate-pulse">
          Click an opponent to ask them for a card
        </p>
      )}

      <div
        className="grid items-center justify-items-center gap-x-1 gap-y-2"
        style={{
          gridTemplateColumns: "minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr)",
          gridTemplateRows: "auto 1fr 1fr auto",
        }}
      >
        <div className="col-start-2 row-start-1 z-10">{renderSeat(rotated[2], 2)}</div>
        <div className="col-start-3 row-start-1 z-10">{renderSeat(rotated[3], 3)}</div>
        <div className="col-start-1 row-start-2 row-span-2 z-10">{renderSeat(rotated[1], 1)}</div>
        <div className="col-start-4 row-start-2 row-span-2 z-10">{renderSeat(rotated[4], 4)}</div>

        <div
          className="
            col-start-2 col-span-2 row-start-2 row-span-2
            w-full h-full min-h-[120px]
            rounded-[40%/50%]
            bg-emerald-900/15 border border-emerald-800/25
            flex items-center justify-between
            px-5 py-3
          "
        >
          <div className="flex flex-col gap-1 items-start min-w-0">
            {teamASets.length > 0 && (
              <>
                <span className="text-[8px] text-sky-500/50 uppercase tracking-wider font-medium">A</span>
                {teamASets.map((ds, i) => (
                  <span key={i} className="text-[9px] text-sky-400/70 leading-tight truncate">
                    {setLabel(ds.set_id)}
                  </span>
                ))}
              </>
            )}
          </div>
          <span className="text-[10px] text-emerald-700/40 uppercase tracking-widest font-medium shrink-0 mx-2">
            Fish
          </span>
          <div className="flex flex-col gap-1 items-end min-w-0">
            {teamBSets.length > 0 && (
              <>
                <span className="text-[8px] text-rose-500/50 uppercase tracking-wider font-medium">B</span>
                {teamBSets.map((ds, i) => (
                  <span key={i} className="text-[9px] text-rose-400/70 leading-tight truncate">
                    {setLabel(ds.set_id)}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="col-start-2 row-start-4 z-10">{renderSeat(rotated[0], 0)}</div>
        <div className="col-start-3 row-start-4 z-10">{renderSeat(rotated[5], 5)}</div>
      </div>

      {nullSets.length > 0 && (
        <div className="flex justify-center gap-1 mt-2">
          {nullSets.map((ds, i) => (
            <span key={i} className="text-[9px] text-gray-600 line-through">
              {setLabel(ds.set_id)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}