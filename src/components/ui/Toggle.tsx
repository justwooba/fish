"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors duration-200 ease-out
        cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${checked ? "bg-blue-500/80" : "bg-white/[0.08]"}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full
          transition-transform duration-200 ease-out
          ${checked ? "translate-x-6 bg-gray-950" : "translate-x-1 bg-gray-500"}
        `}
      />
    </button>
  );
}