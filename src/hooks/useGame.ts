"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientGameState, RoomSettings, TeamId } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PlayerInfo {
  id: string;
  display_name: string;
  team: TeamId | null;
  seat: number | null;
  card_count: number;
  is_connected: boolean;
}

export interface DeclaringIntent {
  player_id: string;
  set_id: string;
}

interface GameData {
  game: ClientGameState | null;
  players: PlayerInfo[];
  settings: RoomSettings | null;
  myPlayerId: string | null;
  isHost: boolean;
  roomCode: string | null;
  declaring: DeclaringIntent | null;
  lookingAt: Record<string, string | null>; // player_id -> opponent_id they're looking at
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  broadcastLookingAt: (opponentId: string | null) => void;
}

export function useGame(roomId: string): GameData {
  const [game, setGame] = useState<ClientGameState | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [settings, setSettings] = useState<RoomSettings | null>(null);
  const [declaring, setDeclaring] = useState<DeclaringIntent | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [lookingAt, setLookingAt] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${roomId}/state`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load game");
        setGame(null);
        return;
      }
      const data = await res.json();
      setGame(data.game);
      setPlayers(data.players);
      setSettings(data.settings);
      setDeclaring(data.declaring ?? null);
      setIsHost(data.is_host ?? false);
      setRoomCode(data.room_code ?? null);
      setError(null);
    } catch {
      setError("Failed to connect to game");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const broadcastLookingAt = useCallback((opponentId: string | null) => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    channel.track({
      player_id: myPlayerId,
      looking_at: opponentId,
      online_at: new Date().toISOString(),
    });
  }, [myPlayerId]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      let foundPlayerId: string | null = null;

      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;

      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: myPlayer } = await supabase.from("players").select("id").eq("room_id", roomId).eq("user_id", session.user.id).maybeSingle();
          if (myPlayer) foundPlayerId = myPlayer.id;
        }
      } else {
        const { data: myPlayer } = await supabase.from("players").select("id").eq("room_id", roomId).eq("user_id", uid).maybeSingle();
        if (myPlayer) foundPlayerId = myPlayer.id;
      }

      if (cancelled) return;
      setMyPlayerId(foundPlayerId);

      await fetchState();

      const channel = supabase
        .channel(`game:${roomId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_states", filter: `room_id=eq.${roomId}` }, () => { fetchState(); })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => { fetchState(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => { fetchState(); })
        .subscribe();
      channelRef.current = channel;

      if (foundPlayerId) {
        const presenceChannel = supabase
          .channel(`presence:${roomId}`)
          .on("presence", { event: "sync" }, () => {
            const presenceState = presenceChannel.presenceState();
            const connectedIds = new Set<string>();
            const newLookingAt: Record<string, string | null> = {};
            for (const key of Object.keys(presenceState)) {
              const presences = presenceState[key] as { player_id?: string; looking_at?: string | null }[];
              for (const p of presences) {
                if (p.player_id) {
                  connectedIds.add(p.player_id);
                  newLookingAt[p.player_id] = p.looking_at ?? null;
                }
              }
            }
            setPlayers(prev => prev.map(p => ({ ...p, is_connected: connectedIds.has(p.id) })));
            setLookingAt(newLookingAt);
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await presenceChannel.track({
                player_id: foundPlayerId,
                looking_at: null,
                online_at: new Date().toISOString(),
              });
            }
          });
        presenceChannelRef.current = presenceChannel;
      }
    }

    init();

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    };
  }, [roomId, fetchState]);

  return { game, players, settings, myPlayerId, isHost, roomCode, declaring, lookingAt, loading, error, refetch: fetchState, broadcastLookingAt };
}