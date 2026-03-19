"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TeamId, RoomSettings } from "@/lib/types";
import { useRoom } from "@/hooks/useRoom";
import RoomHeader from "@/components/lobby/RoomHeader";
import TeamColumn from "@/components/lobby/TeamColumn";
import UnassignedPlayers from "@/components/lobby/UnassignedPlayers";
import RoomSettingsPanel from "@/components/lobby/RoomSettingsPanel";
import StartGameButton from "@/components/lobby/StartGameButton";
import JoinViaLink from "@/components/lobby/JoinViaLink";

interface LobbyPageClientProps {
  roomCode: string;
}

export default function LobbyPageClient({ roomCode }: LobbyPageClientProps) {
  const router = useRouter();
  const { room, players, currentUserId, loading, error } = useRoom(roomCode);
  const [startLoading, setStartLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const isHost = room?.host_id === currentUserId;
  const currentUser = players.find((p) => p.user_id === currentUserId);
  const currentUserTeam = currentUser?.team ?? null;

  // ── Redirect when game starts ──────────────────────────────────────────
  useEffect(() => {
    if (room?.status === "playing") {
      router.push(`/game/${room.id}`);
    }
  }, [room?.status, room?.id, router]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleJoinTeam = useCallback(async (team: TeamId) => {
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to join team");
      }
    } catch {
      setActionError("Network error");
    }
  }, [roomCode]);

  const handleLeaveTeam = useCallback(async () => {
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/team`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to leave team");
      }
    } catch {
      setActionError("Network error");
    }
  }, [roomCode]);

  const handleSettingsChange = useCallback(async (newSettings: RoomSettings) => {
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to update settings");
      }
    } catch {
      setActionError("Network error");
    }
  }, [roomCode]);

  const handleStartGame = useCallback(async () => {
    setStartLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to start game");
        setStartLoading(false);
      }
    } catch {
      setActionError("Network error");
      setStartLoading(false);
    }
  }, [roomCode]);

  const handleLeave = useCallback(async () => {
    setLeaveLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to leave room");
        setLeaveLoading(false);
      } else {
        router.push("/");
      }
    } catch {
      setActionError("Network error");
      setLeaveLoading(false);
    }
  }, [roomCode, router]);

  const handleKick = useCallback(async (playerId: string) => {
    setActionError("");
    try {
      const res = await fetch(`/api/rooms/${roomCode}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || "Failed to kick player");
      }
    } catch {
      setActionError("Network error");
    }
  }, [roomCode]);

  // ── Show loading while redirecting to game ─────────────────────────────

  if (room?.status === "playing") {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Starting game...</div>
      </main>
    );
  }

  // ── Loading / Error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading room...</div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="text-center">
          <h1
            className="text-2xl text-gray-200 mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Room not found
          </h1>
          <p className="text-gray-500 text-sm mb-6">{error || "This room doesn't exist."}</p>
          <a
            href="/"
            className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return <JoinViaLink roomCode={roomCode} />;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">

        {/* Room header */}
        <div className="animate-fade-up">
          <RoomHeader code={roomCode} />
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="w-full px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {actionError}
          </div>
        )}

        {/* Teams */}
        <div className="w-full flex flex-col sm:flex-row gap-4 animate-fade-up delay-1">
          <TeamColumn
            team="A"
            players={players}
            currentUserId={currentUserId ?? ""}
            hostId={room.host_id}
            onJoinTeam={handleJoinTeam}
            onLeaveTeam={handleLeaveTeam}
            onKick={handleKick}
            isHostUser={isHost}
            currentUserTeam={currentUserTeam}
            gameStarted={false}
          />
          <TeamColumn
            team="B"
            players={players}
            currentUserId={currentUserId ?? ""}
            hostId={room.host_id}
            onJoinTeam={handleJoinTeam}
            onLeaveTeam={handleLeaveTeam}
            onKick={handleKick}
            isHostUser={isHost}
            currentUserTeam={currentUserTeam}
            gameStarted={false}
          />
        </div>

        {/* Unassigned */}
        <div className="w-full animate-fade-up delay-2">
          <UnassignedPlayers
            players={players}
            currentUserId={currentUserId ?? ""}
            hostId={room.host_id}
            isHostUser={isHost}
            onKick={handleKick}
          />
        </div>

        {/* Settings */}
        <div className="w-full animate-fade-up delay-3">
          <RoomSettingsPanel
            settings={room.settings}
            onChange={handleSettingsChange}
            isHost={isHost}
          />
        </div>

        {/* Start button */}
        <div className="w-full animate-fade-up delay-4">
          <StartGameButton
            players={players}
            isHost={isHost}
            onStart={handleStartGame}
            loading={startLoading}
          />
        </div>

        {/* Leave */}
        <button
          onClick={handleLeave}
          disabled={leaveLoading}
          className="text-sm px-5 py-2 rounded-xl border border-white/[0.06] text-gray-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.04] transition-all mt-4 cursor-pointer disabled:opacity-40"
        >
          {leaveLoading ? "Leaving..." : "Leave Room"}
        </button>
      </div>
    </main>
  );
}