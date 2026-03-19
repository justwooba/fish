"use client";

import { useState } from "react";
import type { TeamId } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import Button from "@/components/ui/Button";
import PlayerSeat from "./PlayerSeat";

interface ChooseTurnControlsProps {
  myTeam: TeamId;
  choosingTeam: TeamId;
  players: PlayerInfo[];
  myPlayerId: string;
  onChoose: (playerId: string) => Promise<void>;
}

export default function ChooseTurnControls({
  myTeam,
  choosingTeam,
  players,
  myPlayerId,
  onChoose,
}: ChooseTurnControlsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMyTeamChoosing = myTeam === choosingTeam;

  // Eligible teammates (with cards)
  const teammates = players.filter(
    (p) => p.team === choosingTeam && p.card_count > 0
  );

  if (!isMyTeamChoosing) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">
          Team {choosingTeam} is choosing who goes next...
        </p>
      </div>
    );
  }

  async function handleChoose() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      await onChoose(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to choose");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3
        className="text-lg text-gray-200"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your Team Won a Set!
      </h3>
      <p className="text-sm text-gray-400">Choose a teammate to take the next turn</p>

      <div className="flex flex-wrap gap-2">
        {teammates.map((p) => (
          <PlayerSeat
            key={p.id}
            player={p}
            isMe={p.id === myPlayerId}
            isCurrentTurn={false}
            isSelected={selected === p.id}
            onClick={() => {
              setSelected(p.id);
              setError("");
            }}
            selectable
          />
        ))}
      </div>

      {selected && (
        <Button onClick={handleChoose} loading={loading} size="md" className="w-fit">
          Confirm
        </Button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}