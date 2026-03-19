"use client";

import { useState } from "react";

interface RoomHeaderProps {
  code: string;
}

export default function RoomHeader({ code }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  async function copyLink() {
    try {
      const url = `${window.location.origin}/room/${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className="text-center">
      <p className="text-xs text-white-600 uppercase tracking-widest mb-2">Room Code</p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={copyCode}
          className="
            text-3xl font-mono font-bold tracking-[0.25em] text-gray-100
            px-5 py-2 rounded-xl
            bg-white/[0.03] border border-white/[0.06]
            hover:bg-white/[0.06] hover:border-white/[0.1]
            transition-all duration-150
            cursor-pointer
          "
          title="Click to copy code"
        >
          {code}
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          onClick={copyLink}
          className="text-xs text-sky-500/70 hover:text-sky-400 transition-colors cursor-pointer"
        >
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}