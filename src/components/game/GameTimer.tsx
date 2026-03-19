"use client";

import { useState, useEffect } from "react";

interface GameTimerProps {
  startedAt: string;
  turnStartedAt: string;
  endedAt: string | null;
  isFinished: boolean;
  isChoosingTurn: boolean;
  currentTurnName: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GameTimer({ startedAt, turnStartedAt, endedAt, isFinished, isChoosingTurn, currentTurnName }: GameTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isFinished]);

  const endTime = endedAt ? new Date(endedAt).getTime() : now;
  const gameElapsed = Math.max(0, Math.floor((endTime - new Date(startedAt).getTime()) / 1000));
  const turnElapsed = Math.max(0, Math.floor(((isFinished ? endTime : now) - new Date(turnStartedAt).getTime()) / 1000));
  const showTurnTimer = !isFinished && !isChoosingTurn;

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="text-[10px] text-gray-700 hover:text-gray-500 cursor-pointer transition-colors"
      >
        Show timer
      </button>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-600">Game:</span>
        <span className="font-mono text-gray-300">{formatTime(gameElapsed)}</span>
      </div>
      {showTurnTimer && (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">{currentTurnName}:</span>
          <span className={`font-mono ${turnElapsed > 30 ? "text-amber-400" : "text-gray-400"}`}>
            {formatTime(turnElapsed)}
          </span>
        </div>
      )}
      {isChoosingTurn && !isFinished && (
        <span className="text-gray-600 text-[10px] italic">Choosing next player...</span>
      )}
      {isFinished && (
        <span className="text-gray-600">Final time: {formatTime(gameElapsed)}</span>
      )}
      <button
        onClick={() => setVisible(false)}
        className="text-[10px] text-gray-700 hover:text-gray-500 cursor-pointer transition-colors"
      >
        hide
      </button>
    </div>
  );
}