"use client";

import type { Player } from "@/lib/types";
import Button from "@/components/ui/Button";

interface StartGameButtonProps {
  players: Player[];
  isHost: boolean;
  onStart: () => void;
  loading?: boolean;
}

export default function StartGameButton({ players, isHost, onStart, loading }: StartGameButtonProps) {
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  const unassigned = players.filter((p) => p.team === null);

  let message = "";
  let canStart = false;

  if (players.length < 6) {
    message = `Waiting for ${6 - players.length} more player${6 - players.length === 1 ? "" : "s"}`;
  } else if (unassigned.length > 0) {
    message = `${unassigned.length} player${unassigned.length === 1 ? " needs" : "s need"} to pick a team`;
  } else if (teamA.length !== 3 || teamB.length !== 3) {
    message = "Each team needs exactly 3 players";
  } else {
    canStart = true;
    message = isHost ? "All players ready" : "Waiting for host to start";
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500">{message}</p>

      {isHost && (
        <Button
          variant="primary"
          size="lg"
          onClick={onStart}
          disabled={!canStart}
          loading={loading}
          className="w-full max-w-xs"
        >
          Start Game
        </Button>
      )}
    </div>
  );
}