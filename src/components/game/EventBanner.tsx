"use client";

import type { LastAsk, DeclaredSet } from "@/lib/types";
import type { PlayerInfo } from "@/hooks/useGame";
import { cardKeyLabel, setLabel } from "@/lib/cards";

interface EventBannerProps {
  lastAsk: LastAsk | null;
  declaredSets: DeclaredSet[];
  players: PlayerInfo[];
}

export default function EventBanner({ lastAsk, declaredSets, players }: EventBannerProps) {
  const lastDeclared = declaredSets.length > 0 ? declaredSets[declaredSets.length - 1] : null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Declaration result */}
      {lastDeclared && (
        <div
          className={`
            w-full px-4 py-2.5 rounded-xl text-sm text-center
            ${lastDeclared.was_correct
              ? "bg-emerald-500/[0.08] border border-emerald-500/20"
              : lastDeclared.awarded_to === null
                ? "bg-gray-500/[0.08] border border-gray-500/20"
                : "bg-red-500/[0.08] border border-red-500/20"
            }
          `}
        >
          {(() => {
            const isAdmin = lastDeclared.declared_by === "admin";
            const declarer = players.find((p) => p.id === lastDeclared.declared_by);
            const name = isAdmin ? "Admin" : (declarer?.display_name ?? "?");
            const set = setLabel(lastDeclared.set_id);

            if (isAdmin) {
              return (
                <span className="text-amber-300">
                  <span className="font-medium text-amber-200">Admin</span>
                  {" awarded "}
                  <span className="font-medium text-amber-200">{set}</span>
                  {lastDeclared.awarded_to
                    ? <>{" to Team "}{lastDeclared.awarded_to}</>
                    : " — nullified"
                  }
                </span>
              );
            }

            if (lastDeclared.was_correct) {
              return (
                <span className="text-emerald-300">
                  <span className="font-medium text-emerald-200">{name}</span>
                  {" correctly declared "}
                  <span className="font-medium text-emerald-200">{set}</span>
                  {" — Team "}{lastDeclared.awarded_to}{" scores!"}
                </span>
              );
            }
            if (lastDeclared.awarded_to === null) {
              return (
                <span className="text-gray-400">
                  <span className="font-medium text-gray-300">{name}</span>
                  {" misdeclared "}
                  <span className="font-medium text-gray-300">{set}</span>
                  {" — set nullified, no points awarded"}
                </span>
              );
            }
            return (
              <span className="text-red-300">
                <span className="font-medium text-red-200">{name}</span>
                {" misdeclared "}
                <span className="font-medium text-red-200">{set}</span>
                {" — Team "}{lastDeclared.awarded_to}{" scores instead!"}
              </span>
            );
          })()}
        </div>
      )}

      {/* Last ask */}
      {lastAsk && (
        <div
          className={`
            w-full px-4 py-2.5 rounded-xl text-sm text-center
            ${lastAsk.success
              ? "bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300"
              : "bg-white/[0.03] border border-white/[0.06] text-gray-400"
            }
          `}
        >
          <span className="font-medium text-gray-200">
            {players.find((p) => p.id === lastAsk.asker_id)?.display_name ?? "?"}
          </span>
          {" asked "}
          <span className="font-medium text-gray-200">
            {players.find((p) => p.id === lastAsk.target_id)?.display_name ?? "?"}
          </span>
          {" for the "}
          <span className="font-medium text-gray-200">{cardKeyLabel(lastAsk.card)}</span>
          {" — "}
          <span className={lastAsk.success ? "text-emerald-400 font-medium" : "text-gray-500"}>
            {lastAsk.success ? "got it!" : "nope"}
          </span>
        </div>
      )}
    </div>
  );
}