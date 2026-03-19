"use client";

import { useState, useCallback, useEffect } from "react";
import { setLabel } from "@/lib/cards";
import { cardKeyLabel } from "@/lib/cards";
import type { FishSetId } from "@/lib/types";

interface Room {
  id: string;
  code: string;
  host_id: string;
  status: string;
  settings: Record<string, boolean>;
  created_at: string;
}

interface Player {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  team: string | null;
  seat: number | null;
  card_count: number;
  is_connected: boolean;
}

interface GameState {
  id: string;
  room_id: string;
  phase: string;
  current_turn: string;
  hands: Record<string, string[]>;
  last_ask: Record<string, unknown> | null;
  declared_sets: Array<{ set_id: string; awarded_to: string | null; declared_by: string; was_correct: boolean }>;
  score_a: number;
  score_b: number;
  action_log: Array<Record<string, unknown>>;
  winner: string | null;
  version: number;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStates, setGameStates] = useState<GameState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [expandedHands, setExpandedHands] = useState<string | null>(null);

  const headers = { "x-admin-password": password };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin", { headers: { "x-admin-password": password } });
      if (!res.ok) {
        if (res.status === 401) { setAuthed(false); setError("Wrong password"); return; }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setPlayers(data.players ?? []);
      setGameStates(data.gameStates ?? []);
      setAuthed(true);
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, [password]);

  async function handleDelete(type: string, id: string, label: string) {
    if (!confirm(`Delete ${type} ${label}?`)) return;
    const res = await fetch("/api/admin", {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (res.ok) fetchData();
    else {
      const data = await res.json();
      alert(`Delete failed: ${data.error}`);
    }
  }

  // Auto-refresh every 10s
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [authed, fetchData]);

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-xs space-y-4">
          <h1 className="text-2xl text-gray-200 text-center" style={{ fontFamily: "var(--font-display)" }}>Admin</h1>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] text-gray-100 rounded-xl outline-none focus:border-blue-500/50"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "..." : "Login"}
          </button>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      </main>
    );
  }

  function getRoomPlayers(roomId: string) {
    return players.filter((p) => p.room_id === roomId);
  }

  function getGameState(roomId: string) {
    return gameStates.find((gs) => gs.room_id === roomId);
  }

  function getPlayerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.display_name ?? playerId.slice(0, 8);
  }

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gray-200" style={{ fontFamily: "var(--font-display)" }}>Admin Dashboard</h1>
          <div className="flex gap-2">
            <button onClick={fetchData} className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] cursor-pointer transition-all">
              Refresh
            </button>
            <button onClick={() => setAuthed(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 cursor-pointer transition-all">
              Logout
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          {rooms.length} rooms · {players.length} players · {gameStates.length} active games
        </div>

        {/* Rooms */}
        {rooms.map((room) => {
          const roomPlayers = getRoomPlayers(room.id);
          const gs = getGameState(room.id);
          const isExpanded = expandedRoom === room.id;

          return (
            <div key={room.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Room header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-all"
                onClick={() => setExpandedRoom(isExpanded ? null : room.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-200 font-bold">{room.code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                    room.status === "playing" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    room.status === "finished" ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                    "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}>
                    {room.status}
                  </span>
                  <span className="text-xs text-gray-600">{roomPlayers.length} players</span>
                  {gs && <span className="text-xs text-gray-600">· {gs.score_a}-{gs.score_b}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-700">{new Date(room.created_at).toLocaleString()}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete("room", room.id, room.code); }}
                    className="text-[10px] px-2 py-1 rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/[0.04] px-4 py-3 space-y-4">
                  {/* Settings */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Settings</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(room.settings).map(([key, val]) => (
                        <span key={key} className={`text-[10px] px-2 py-0.5 rounded ${val ? "bg-blue-500/10 text-blue-400" : "bg-white/[0.03] text-gray-600"}`}>
                          {key}: {val ? "on" : "off"}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Players */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Players</p>
                    <div className="space-y-1">
                      {roomPlayers.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/[0.02]">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${p.is_connected ? "bg-emerald-500" : "bg-gray-600"}`} />
                            <span className="text-gray-300">{p.display_name}</span>
                            {p.team && <span className={`text-[9px] ${p.team === "A" ? "text-sky-400" : "text-rose-400"}`}>Team {p.team}</span>}
                            {p.seat !== null && <span className="text-[9px] text-gray-600">seat {p.seat}</span>}
                            <span className="text-[9px] text-gray-700">{p.card_count} cards</span>
                            {room.host_id === p.user_id && <span className="text-[9px] text-amber-500/60">HOST</span>}
                          </div>
                          <button
                            onClick={() => handleDelete("player", p.id, p.display_name)}
                            className="text-[9px] text-red-400/40 hover:text-red-400 cursor-pointer transition-all"
                          >
                            kick
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Game State */}
                  {gs && (
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Game State</p>
                      <div className="text-xs space-y-1">
                        <div className="flex gap-4 text-gray-500">
                          <span>Phase: <span className="text-gray-300">{gs.phase}</span></span>
                          <span>Turn: <span className="text-gray-300">{getPlayerName(gs.current_turn)}</span></span>
                          <span>Score: <span className="text-sky-400">{gs.score_a}</span>-<span className="text-rose-400">{gs.score_b}</span></span>
                          <span>Version: <span className="text-gray-300">{gs.version}</span></span>
                          {gs.winner && <span>Winner: <span className="text-amber-400">Team {gs.winner}</span></span>}
                        </div>

                        {/* Declared sets */}
                        {gs.declared_sets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {gs.declared_sets.map((ds, i) => (
                              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${
                                ds.awarded_to === "A" ? "bg-sky-500/10 text-sky-400" :
                                ds.awarded_to === "B" ? "bg-rose-500/10 text-rose-400" :
                                "bg-gray-500/10 text-gray-500 line-through"
                              }`}>
                                {setLabel(ds.set_id as FishSetId)} {ds.was_correct ? "✓" : "✗"}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Hands */}
                        <button
                          onClick={() => setExpandedHands(expandedHands === gs.id ? null : gs.id)}
                          className="text-[10px] text-blue-400/60 hover:text-blue-400 cursor-pointer transition-all mt-1"
                        >
                          {expandedHands === gs.id ? "Hide hands" : "Show all hands"}
                        </button>

                        {expandedHands === gs.id && (
                          <div className="space-y-2 mt-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            {Object.entries(gs.hands).map(([pid, hand]) => (
                              <div key={pid}>
                                <p className="text-[10px] text-gray-500 mb-0.5">{getPlayerName(pid)} ({(hand as string[]).length} cards)</p>
                                <div className="flex flex-wrap gap-1">
                                  {(hand as string[]).map((card, ci) => (
                                    <span key={ci} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-300">
                                      {cardKeyLabel(card)}
                                    </span>
                                  ))}
                                  {(hand as string[]).length === 0 && (
                                    <span className="text-[9px] text-gray-700 italic">empty</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action log count */}
                        <p className="text-[9px] text-gray-700 mt-1">{gs.action_log.length} actions in log</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rooms.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">No rooms</p>
        )}
      </div>
    </main>
  );
}