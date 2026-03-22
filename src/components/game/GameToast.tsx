"use client";

import { useEffect, useState } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "fail" | "declare_correct" | "declare_wrong" | "declare_null" | "info";
}

interface GameToastProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

const COLORS: Record<Toast["type"], { bg: string; border: string; text: string }> = {
  success:         { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  fail:            { bg: "bg-white/[0.04]",   border: "border-white/[0.06]",   text: "text-gray-400" },
  declare_correct: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  declare_wrong:   { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-300" },
  declare_null:    { bg: "bg-gray-500/10",     border: "border-gray-500/20",    text: "text-gray-400" },
  info:            { bg: "bg-amber-500/10",    border: "border-amber-500/20",   text: "text-amber-300" },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const colors = COLORS[toast.type];

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setVisible(true));
    const t2 = setTimeout(() => setVisible(false), 2800);
    const t3 = setTimeout(onRemove, 3300);
    return () => { cancelAnimationFrame(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`
        px-4 py-2 rounded-lg border text-center
        transition-opacity duration-500 ease-out
        ${colors.bg} ${colors.border}
        ${visible ? "opacity-100" : "opacity-0"}
      `}
    >
      <p className={`text-sm font-medium ${colors.text}`}>{toast.message}</p>
    </div>
  );
}

export default function GameToast({ toasts, onRemove }: GameToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
}