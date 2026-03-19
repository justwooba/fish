"use client";

import { useState, useCallback, useEffect } from "react";
import { setLabel, cardKeyLabel } from "@/lib/cards";
import { FISH_SET_IDS } from "@/lib/types";
import type { FishSetId } from "@/lib/types";

interface Room { id: string; code: string; host_id: string; status: string; settings: Record<string, boolean>; created_at: string; }
interface Player { id: string; room_id: string; user_id: string; display_name: string; team: string | null; seat: number | null; card_count: number; is_connected: boolean; }
interface GameState {
  id: string; room_id: string; phase: string; current_turn: string;
  hands: Record<string, string[]>; last_ask: Record<string, unknown> | null;
  declared_sets: Array<{ set_id: string; awarded_to: string | null; declared_by: string; was_correct: boolean }>;
  score_a: number; score_b: number;
  action_log: Array<Record<string, unknown>>;
  winner: string | null; version: number;
  declaring_player_id: string | null; declaring_set: string | null;
  started_at: string; turn_started_at: string; ended_at: string | null;
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
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [moveCard, setMoveCard] = useState<{ gsId: string; card: string; fromId: string } | null>(null);
  const [awardSet, setAwardSet] = useState<{ gsId: string } | null>(null);
  const [changeTurn, setChangeTurn] = useState<{ gsId: string } | null>(null);
  const [reassignSet, setReassignSet] = useState<{ gsId: string; setId: string } | null>(null);

  const hdrs = useCallback(() => ({ "x-admin-password": password }), [password]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin", { headers: { "x-admin-password": password } });
      if (!res.ok) { if (res.status === 401) { setAuthed(false); setError("Wrong password"); } return; }
      const data = await res.json();
      setRooms(data.rooms ?? []); setPlayers(data.players ?? []); setGameStates(data.gameStates ?? []);
      setAuthed(true);
    } catch { setError("Failed to connect"); }
    finally { setLoading(false); }
  }, [password]);

  async function handleDelete(type: string, id: string, label: string) {
    if (!confirm(`Delete ${type} "${label}"?`)) return;
    await fetch("/api/admin", { method: "DELETE", headers: { ...hdrs(), "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
    fetchData();
  }

  async function adminPatch(body: Record<string, unknown>) {
    const res = await fetch("/api/admin", { method: "PATCH", headers: { ...hdrs(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); alert(`Error: ${d.error}`); }
    fetchData();
  }

  // Client-side timer refresh (no API calls, just re-renders the elapsed times)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!authed) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [authed]);

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-xs space-y-4">
          <h1 className="text-2xl text-gray-200 text-center" style={{ fontFamily: "var(--font-display)" }}>Admin</h1>
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] text-gray-100 rounded-xl outline-none focus:border-blue-500/50" />
          <button onClick={fetchData} disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-all cursor-pointer disabled:opacity-50">
            {loading ? "..." : "Login"}
          </button>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      </main>
    );
  }

  const getRoomPlayers = (roomId: string) => players.filter((p) => p.room_id === roomId);
  const getGameState = (roomId: string) => gameStates.find((gs) => gs.room_id === roomId);
  const getPlayerName = (pid: string) => {
    if (pid === "admin") return "Admin";
    return players.find((p) => p.id === pid)?.display_name ?? pid?.slice(0, 8) ?? "?";
  };

  function renderLogEntry(action: Record<string, unknown>, i: number, startedAt?: string) {
    const turnNum = i + 1;
    const numSpan = <span className="text-gray-700 w-5 text-right shrink-0 font-mono">{turnNum}</span>;
    
    let timeStr = "";
    if (startedAt && action.timestamp) {
      const relSec = Math.max(0, Math.floor((new Date(action.timestamp as string).getTime() - new Date(startedAt).getTime()) / 1000));
      timeStr = `${Math.floor(relSec / 60)}:${(relSec % 60).toString().padStart(2, "0")}`;
    }
    const timeSpan = <span className="text-gray-700 w-8 text-right shrink-0 font-mono">{timeStr}</span>;

    if (action.type === "admin") {
      return (
        <div key={i} className="flex gap-2 py-0.5 text-[10px]">
          {numSpan}{timeSpan}
          <span className="text-amber-400/70 italic">Admin: {action.description as string}</span>
        </div>
      );
    }
    if (action.type === "ask") {
      return (
        <div key={i} className="flex gap-2 py-0.5 text-[10px]">
          {numSpan}{timeSpan}
          <div>
            <span className="text-gray-400">{getPlayerName(action.asker_id as string)}</span>
            <span className="text-gray-600"> → </span>
            <span className="text-gray-400">{getPlayerName(action.target_id as string)}</span>
            <span className="text-gray-600"> for </span>
            <span className="text-gray-300">{cardKeyLabel(action.card as string)}</span>
            <span className="text-gray-600"> — </span>
            <span className={action.success ? "text-emerald-400" : "text-gray-600"}>{action.success ? "✓" : "✗"}</span>
          </div>
        </div>
      );
    }
    if (action.type === "declare") {
      return (
        <div key={i} className="flex gap-2 py-0.5 text-[10px]">
          {numSpan}{timeSpan}
          <div className={`rounded px-1 ${action.success ? "bg-emerald-500/[0.05]" : action.awarded_to === null ? "bg-gray-500/[0.05]" : "bg-red-500/[0.05]"}`}>
            <span className="text-gray-400">{getPlayerName(action.declarer_id as string)}</span>
            <span className="text-gray-600"> declared </span>
            <span className="text-gray-300">{setLabel((action.set_id as string) as FishSetId)}</span>
            <span className="text-gray-600"> — </span>
            {action.success
              ? <span className="text-emerald-400">✓ Team {action.awarded_to as string}</span>
              : action.awarded_to === null ? <span className="text-gray-500">nullified</span>
              : <span className="text-red-400">✗ Team {action.awarded_to as string}</span>}
          </div>
        </div>
      );
    }
    if (action.type === "choose_turn") {
      return (
        <div key={i} className="flex gap-2 py-0.5 text-[10px]">
          {numSpan}{timeSpan}
          <span className="text-gray-600 italic">Team {action.team as string} → {getPlayerName(action.chosen_player_id as string)}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gray-200" style={{ fontFamily: "var(--font-display)" }}>Admin Dashboard</h1>
          <div className="flex gap-2">
            <button onClick={fetchData} className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] cursor-pointer transition-all">Refresh</button>
            <button onClick={() => setAuthed(false)} className="text-xs px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 cursor-pointer transition-all">Logout</button>
          </div>
        </div>
        <div className="text-xs text-gray-600">{rooms.length} rooms · {players.length} players · {gameStates.length} active games</div>

        {rooms.map((room) => {
          const roomPlayers = getRoomPlayers(room.id);
          const gs = getGameState(room.id);
          const isExp = expandedRoom === room.id;

          return (
            <div key={room.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-all"
                onClick={() => setExpandedRoom(isExp ? null : room.id)}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm text-gray-200 font-bold">{room.code}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                    room.status === "playing" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    room.status === "finished" ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                    "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                    {room.status}
                  </span>
                  <span className="text-xs text-gray-600">{roomPlayers.length}p</span>
                  {gs && <span className="text-xs text-gray-600">{gs.score_a}-{gs.score_b}</span>}
                  {gs?.declaring_player_id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {getPlayerName(gs.declaring_player_id)} declaring {gs.declaring_set ? setLabel(gs.declaring_set as FishSetId) : "..."}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-700">{new Date(room.created_at).toLocaleString()}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete("room", room.id, room.code); }}
                    className="text-[10px] px-2 py-1 rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">Delete</button>
                </div>
              </div>

              {isExp && (
                <div className="border-t border-white/[0.04] px-4 py-3 space-y-4">
                  {/* Settings */}
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Settings</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(room.settings).map(([k, v]) => (
                        <span key={k} className={`text-[10px] px-2 py-0.5 rounded ${v ? "bg-blue-500/10 text-blue-400" : "bg-white/[0.03] text-gray-600"}`}>{k}: {v ? "on" : "off"}</span>
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
                            {gs?.current_turn === p.id && <span className="text-[9px] text-amber-400">← TURN</span>}
                          </div>
                          <button onClick={() => handleDelete("player", p.id, p.display_name)}
                            className="text-[9px] text-red-400/40 hover:text-red-400 cursor-pointer transition-all">kick</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Game state */}
                  {gs && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-gray-600 uppercase tracking-wider">Game State</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>Phase: <span className="text-gray-300">{gs.phase}</span></span>
                        <span>Turn: <span className="text-gray-300">{getPlayerName(gs.current_turn)}</span></span>
                        <span>Score: <span className="text-sky-400">{gs.score_a}</span>-<span className="text-rose-400">{gs.score_b}</span></span>
                        <span>v{gs.version}</span>
                        {gs.winner && <span>Winner: <span className="text-amber-400">Team {gs.winner}</span></span>}
                        {gs.started_at && (
                          <span>Game: <span className="text-gray-300 font-mono">{(() => {
                            const start = new Date(gs.started_at).getTime();
                            const end = gs.ended_at ? new Date(gs.ended_at).getTime() : Date.now();
                            const sec = Math.floor((end - start) / 1000);
                            return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
                          })()}</span></span>
                        )}
                        {gs.turn_started_at && !gs.ended_at && gs.phase !== "choosing_turn" && (
                          <span>Turn: <span className="text-amber-300 font-mono">{(() => {
                            const sec = Math.floor((Date.now() - new Date(gs.turn_started_at).getTime()) / 1000);
                            return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
                          })()}</span></span>
                        )}
                      </div>

                      {/* Declared sets with reassign */}
                      {gs.declared_sets.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-600">Declared Sets (click to reassign):</p>
                          {gs.declared_sets.map((ds, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                                ds.awarded_to === "A" ? "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20" :
                                ds.awarded_to === "B" ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" :
                                "bg-gray-500/10 text-gray-500 line-through hover:bg-gray-500/20"}`}
                                onClick={() => setReassignSet(reassignSet?.setId === ds.set_id ? null : { gsId: gs.id, setId: ds.set_id })}>
                                {setLabel(ds.set_id as FishSetId)} {ds.was_correct ? "✓" : "✗"} → {ds.awarded_to ?? "null"}
                              </span>

                              {reassignSet?.gsId === gs.id && reassignSet?.setId === ds.set_id && (
                                <div className="flex gap-1">
                                  <span className="text-[9px] text-gray-600">Reassign to:</span>
                                  {["A", "B", "null"].map((t) => (
                                    <button key={t}
                                      onClick={() => { adminPatch({ action: "reassign_set", game_state_id: gs.id, set_id: ds.set_id, new_team: t }); setReassignSet(null); }}
                                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                                        t === "A" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20" :
                                        t === "B" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20" :
                                        "bg-gray-500/10 text-gray-500 border border-gray-500/20 hover:bg-gray-500/20"}`}>
                                      {t === "null" ? "Null" : `Team ${t}`}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Admin actions */}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setChangeTurn(changeTurn?.gsId === gs.id ? null : { gsId: gs.id })}
                          className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] cursor-pointer transition-all">Change Turn</button>
                        <button onClick={() => setAwardSet(awardSet?.gsId === gs.id ? null : { gsId: gs.id })}
                          className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] cursor-pointer transition-all">Award Set</button>
                        {gs.phase !== "finished" && (
                          <button onClick={() => {
                            if (confirm(`End game? Score: ${gs.score_a}-${gs.score_b}. Winner: ${gs.score_a > gs.score_b ? "Team A" : gs.score_b > gs.score_a ? "Team B" : "Tie"}`)) {
                              adminPatch({ action: "end_game", game_state_id: gs.id });
                            }
                          }}
                            className="text-[10px] px-2 py-1 rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">End Game</button>
                        )}
                      </div>

                      {changeTurn?.gsId === gs.id && (
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1">
                          <p className="text-[10px] text-gray-500">Set turn to:</p>
                          <div className="flex flex-wrap gap-1">
                            {roomPlayers.map((p) => (
                              <button key={p.id}
                                onClick={() => { adminPatch({ action: "change_turn", game_state_id: gs.id, player_id: p.id }); setChangeTurn(null); }}
                                className={`text-[10px] px-2 py-1 rounded border cursor-pointer transition-all ${
                                  gs.current_turn === p.id ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"}`}>
                                {p.display_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {awardSet?.gsId === gs.id && (
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-2">
                          <p className="text-[10px] text-gray-500">Award undeclared set:</p>
                          {FISH_SET_IDS.filter((sid) => !gs.declared_sets.some((ds) => ds.set_id === sid)).map((sid) => (
                            <div key={sid} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-24">{setLabel(sid)}</span>
                              {["A", "B", "null"].map((t) => (
                                <button key={t}
                                  onClick={() => { adminPatch({ action: "award_set", game_state_id: gs.id, set_id: sid, team: t }); setAwardSet(null); }}
                                  className={`text-[9px] px-2 py-0.5 rounded cursor-pointer transition-all ${
                                    t === "A" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20" :
                                    t === "B" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20" :
                                    "bg-gray-500/10 text-gray-500 border border-gray-500/20 hover:bg-gray-500/20"}`}>
                                  {t === "null" ? "Null" : t}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Hands */}
                      <button onClick={() => setExpandedHands(expandedHands === gs.id ? null : gs.id)}
                        className="text-[10px] text-blue-400/60 hover:text-blue-400 cursor-pointer transition-all">
                        {expandedHands === gs.id ? "Hide hands" : "Show all hands"}
                      </button>

                      {expandedHands === gs.id && (
                        <div className="space-y-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          {Object.entries(gs.hands).map(([pid, hand]) => (
                            <div key={pid}>
                              <p className="text-[10px] text-gray-500 mb-1">{getPlayerName(pid)} ({(hand as string[]).length} cards)</p>
                              <div className="flex flex-wrap gap-1">
                                {(hand as string[]).map((card, ci) => (
                                  <button key={ci}
                                    onClick={() => setMoveCard(moveCard?.card === card && moveCard?.fromId === pid ? null : { gsId: gs.id, card, fromId: pid })}
                                    className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                                      moveCard?.card === card && moveCard?.fromId === pid
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                                        : "bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"}`}>
                                    {cardKeyLabel(card)}
                                  </button>
                                ))}
                                {(hand as string[]).length === 0 && <span className="text-[9px] text-gray-700 italic">empty</span>}
                              </div>
                              {moveCard?.fromId === pid && moveCard.gsId === gs.id && (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <span className="text-[9px] text-gray-600">Move {cardKeyLabel(moveCard.card)} to:</span>
                                  {roomPlayers.filter((p) => p.id !== pid).map((p) => (
                                    <button key={p.id}
                                      onClick={() => { adminPatch({ action: "move_card", game_state_id: gs.id, card: moveCard.card, from_player_id: pid, to_player_id: p.id }); setMoveCard(null); }}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] cursor-pointer transition-all">
                                      {p.display_name}
                                    </button>
                                  ))}
                                  <button onClick={() => setMoveCard(null)} className="text-[9px] text-gray-600 hover:text-gray-400 cursor-pointer ml-1">✕</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action log */}
                      <button onClick={() => setExpandedLog(expandedLog === gs.id ? null : gs.id)}
                        className="text-[10px] text-blue-400/60 hover:text-blue-400 cursor-pointer transition-all">
                        {expandedLog === gs.id ? "Hide game log" : `Show game log (${gs.action_log.length} actions)`}
                      </button>

                      {expandedLog === gs.id && (
                        <div className="space-y-0.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] max-h-80 overflow-y-auto">
                          {gs.action_log.length === 0 && <p className="text-[9px] text-gray-700 italic">No actions yet</p>}
                          {gs.action_log.map((action, i) => renderLogEntry(action, i, gs.started_at))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {rooms.length === 0 && <p className="text-center text-gray-600 text-sm py-8">No rooms</p>}
      </div>
    </main>
  );
}