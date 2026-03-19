"use client";

import type { Player, TeamId } from "@/lib/types";
import Button from "@/components/ui/Button";
import PlayerSlot from "./PlayerSlot";

interface TeamColumnProps {
  team: TeamId;
  players: Player[];
  currentUserId: string;
  hostId: string;
  onJoinTeam: (team: TeamId) => void;
  onLeaveTeam: () => void;
  onKick?: (playerId: string) => void;
  isHostUser: boolean;
  currentUserTeam: TeamId | null;
  gameStarted: boolean;
}

const TEAM_CONFIG = {
  A: { label: "Team A", color: "text-sky-400", accent: "border-sky-500/20", bg: "bg-sky-500/[0.03]" },
  B: { label: "Team B", color: "text-rose-400", accent: "border-rose-500/20", bg: "bg-rose-500/[0.03]" },
};

export default function TeamColumn({
  team,
  players,
  currentUserId,
  hostId,
  onJoinTeam,
  onLeaveTeam,
  onKick,
  isHostUser,
  currentUserTeam,
  gameStarted,
}: TeamColumnProps) {
  const config = TEAM_CONFIG[team];
  const teamPlayers = players.filter((p) => p.team === team);
  const isFull = teamPlayers.length >= 3;
  const currentUserOnThisTeam = currentUserTeam === team;
  const currentUserAssigned = currentUserTeam !== null;

  // Fill empty slots up to 3
  const slots: (Player | undefined)[] = [...teamPlayers];
  while (slots.length < 3) slots.push(undefined);

  return (
    <div className={`flex-1 rounded-2xl border ${config.accent} ${config.bg} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold tracking-wide uppercase ${config.color}`}>
          {config.label}
        </h3>
        <span className="text-xs text-gray-600">
          {teamPlayers.length} / 3
        </span>
      </div>

      {/* Player slots */}
      <div className="flex flex-col gap-2 mb-4">
        {slots.map((player, i) => (
          <PlayerSlot
            key={player?.id ?? `empty-${team}-${i}`}
            player={player}
            isCurrentUser={player?.user_id === currentUserId}
            isHost={player?.user_id === hostId}
            canKick={isHostUser && !gameStarted}
            onKick={onKick}
          />
        ))}
      </div>

      {/* Join / Leave button */}
      {!gameStarted && (
        <>
          {currentUserOnThisTeam ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeaveTeam}
              className="w-full text-gray-500 hover:text-gray-300"
            >
              Leave Team
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onJoinTeam(team)}
              disabled={isFull || (currentUserAssigned && !currentUserOnThisTeam)}
              className="w-full"
            >
              {isFull ? "Full" : "Join"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}