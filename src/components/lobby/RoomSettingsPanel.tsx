"use client";

import type { RoomSettings as RoomSettingsType } from "@/lib/types";
import Toggle from "@/components/ui/Toggle";

interface RoomSettingsPanelProps {
  settings: RoomSettingsType;
  onChange: (settings: RoomSettingsType) => void;
  isHost: boolean;
}

const SETTING_DEFS: {
  key: keyof RoomSettingsType;
  label: string;
  description: string;
}[] = [
  {
    key: "team_declare",
    label: "Team Declarations",
    description: "Any teammate can declare on their team's turn, not just the active player",
  },
  {
    key: "nullify_misdeclare",
    label: "Nullify Misdeclares",
    description: "Wrong assignment when your team holds all cards → set is nullified instead of going to opponent",
  },
  {
    key: "no_turn_on_misdeclare",
    label: "No Turn on Misdeclare",
    description: "After a misdeclare, play continues from last turn instead of opposing team's turn",
  },
  {
    key: "play_all_sets",
    label: "Play All Sets",
    description: "Play until all 9 sets are declared, not just first to 5",
  },
];

export default function RoomSettingsPanel({ settings, onChange, isHost }: RoomSettingsPanelProps) {
  function handleToggle(key: keyof RoomSettingsType) {
    onChange({ ...settings, [key]: !settings[key] });
  }

  return (
    <div className="w-full rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5">
      <h3
        className="text-lg text-gray-200 mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Game Settings
      </h3>

      <div className="flex flex-col gap-4">
        {SETTING_DEFS.map(({ key, label, description }) => (
          <div key={key} className="flex items-start gap-4">
            <div className="pt-0.5">
              <Toggle
                checked={settings[key]}
                onChange={() => handleToggle(key)}
                disabled={!isHost}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-300">{label}</div>
              <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">{description}</div>
            </div>
          </div>
        ))}
      </div>

      {!isHost && (
        <p className="text-xs text-gray-700 mt-4 italic">Only the host can change settings</p>
      )}
    </div>
  );
}