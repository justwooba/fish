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

  const seatRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null, null]);
  const rotatedRef = useRef(rotated);
  rotatedRef.current = rotated;
  const onSeatPositionsRef = useRef(onSeatPositions);
  onSeatPositionsRef.current = onSeatPositions;

  // Update positions after render, on resize, and on scroll
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

    const t = setTimeout(updatePositions, 100);
    window.addEventListener("resize", updatePositions);
    window.addEventListener("scroll", updatePositions, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("scroll", updatePositions, true);
    };
  }, [players]);

  function renderSeat(player: PlayerInfo | undefined, index: number) {
    if (!player) return <div ref={(el) => { seatRefs.current[index] = el; }} />;

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

  const totalDeclared = teamASets.length + teamBSets.length + nullSets.length;

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

        {/* ── Table surface ───────────────────────────────────────── */}
        <div
          className="
            col-start-2 col-span-2 row-start-2 row-span-2
            w-full h-full min-h-[120px]
            rounded-[40%/50%]
            bg-emerald-900/15 border border-emerald-800/25
            flex flex-col items-center justify-center
            px-4 py-3 gap-2
          "
        >
          {/* Score chips on the table */}
          {totalDeclared > 0 ? (
            <div className="flex gap-3 items-start">
              {/* Team A stack */}
              {teamASets.length > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-sky-400">{teamASets.length}</span>
                    </div>
                    <span className="text-[8px] text-sky-400/60 uppercase font-medium">A</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {teamASets.map((ds, i) => (
                      <span key={i} className="text-[8px] text-sky-400/50 leading-none">
                        {setLabel(ds.set_id)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Center divider */}
              {teamASets.length > 0 && teamBSets.length > 0 && (
                <div className="w-px h-8 bg-white/[0.06] self-center" />
              )}

              {/* Team B stack */}
              {teamBSets.length > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-rose-400">{teamBSets.length}</span>
                    </div>
                    <span className="text-[8px] text-rose-400/60 uppercase font-medium">B</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {teamBSets.map((ds, i) => (
                      <span key={i} className="text-[8px] text-rose-400/50 leading-none">
                        {setLabel(ds.set_id)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-emerald-700/40 uppercase tracking-widest font-medium">
              Fish
            </span>
          )}

          {/* Nullified sets */}
          {nullSets.length > 0 && (
            <div className="flex gap-1.5">
              {nullSets.map((ds, i) => (
                <span key={i} className="text-[7px] text-gray-600 line-through">
                  {setLabel(ds.set_id)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="col-start-2 row-start-4 z-10">{renderSeat(rotated[0], 0)}</div>
        <div className="col-start-3 row-start-4 z-10">{renderSeat(rotated[5], 5)}</div>
      </div>
    </div>
  );
}