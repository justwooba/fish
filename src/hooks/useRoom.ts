"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player, RoomSettings } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RoomData {
  room: {
    id: string;
    code: string;
    host_id: string;
    status: "waiting" | "playing" | "finished";
    settings: RoomSettings;
  } | null;
  players: Player[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribes to realtime changes for a room and its players.
 * Handles initial data fetch + live updates.
 */
export function useRoom(roomCode: string): RoomData {
  const [room, setRoom] = useState<RoomData["room"]>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomStatusRef = useRef<string>("waiting");

  // Keep roomStatusRef in sync
  useEffect(() => {
    if (room) roomStatusRef.current = room.status;
  }, [room]);

  // Auto-leave is disabled for now — it fires on hot-reload and page
  // navigation, causing players to be kicked unexpectedly.
  // Players can use the "Leave Room" button instead.

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function init() {
      try {
        // Get current user — try getUser first, then getSession as fallback
        let userId: string | null = null;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        } else {
          // Fallback: check session (works when cookie is httpOnly)
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            userId = session.user.id;
          }
        }

        if (cancelled) return;
        setCurrentUserId(userId);

        // Fetch room
        const { data: roomData, error: roomErr } = await supabase
          .from("rooms")
          .select("*")
          .eq("code", roomCode.toUpperCase())
          .single();

        if (cancelled) return;

        if (roomErr || !roomData) {
          setError("Room not found");
          setLoading(false);
          return;
        }

        setRoom(roomData);

        // Fetch players
        const { data: playerData, error: playerErr } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomData.id);

        if (cancelled) return;

        if (playerErr) {
          setError("Failed to load players");
          setLoading(false);
          return;
        }

        setPlayers(playerData ?? []);
        setLoading(false);

        // Subscribe to realtime changes
        const channel = supabase
          .channel(`room:${roomData.id}`)
          // Room changes (settings, status)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "rooms",
              filter: `id=eq.${roomData.id}`,
            },
            (payload) => {
              if (payload.eventType === "UPDATE") {
                setRoom(payload.new as RoomData["room"]);
              }
            }
          )
          // Player INSERT
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "players",
              filter: `room_id=eq.${roomData.id}`,
            },
            (payload) => {
              setPlayers((prev) => {
                if (prev.some((p) => p.id === (payload.new as Player).id)) return prev;
                return [...prev, payload.new as Player];
              });
            }
          )
          // Player UPDATE
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "players",
              filter: `room_id=eq.${roomData.id}`,
            },
            (payload) => {
              setPlayers((prev) =>
                prev.map((p) =>
                  p.id === (payload.new as Player).id ? (payload.new as Player) : p
                )
              );
            }
          )
          // Player DELETE
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "players",
              filter: `room_id=eq.${roomData.id}`,
            },
            (payload) => {
              setPlayers((prev) =>
                prev.filter((p) => p.id !== (payload.old as { id: string }).id)
              );
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.error("Room init error:", err);
        if (!cancelled) {
          setError("Failed to connect to room");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomCode]);

  return { room, players, currentUserId, loading, error };
}