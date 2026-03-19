"use client";

import type { Player } from "@/lib/types";
import PlayerSlot from "./PlayerSlot";

interface UnassignedPlayersProps {
  players: Player[];
  currentUserId: string;
  hostId: string;
  isHostUser: boolean;
  onKick?: (playerId: string) => void;
}

export default function UnassignedPlayers({ players, currentUserId, hostId, isHostUser, onKick }: UnassignedPlayersProps) {
  const unassigned = players.filter((p) => p.team === null);

  if (unassigned.length === 0) return null;

  return (
    <div className="w-full">
      <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-3">
        Unassigned ({unassigned.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {unassigned.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player}
            isCurrentUser={player.user_id === currentUserId}
            isHost={player.user_id === hostId}
            canKick={isHostUser}
            onKick={onKick}
          />
        ))}
      </div>
    </div>
  );
}