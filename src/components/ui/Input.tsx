"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-gray-400 tracking-wider uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-2.5
            bg-white/[0.04] border border-white/[0.08]
            text-gray-100 placeholder:text-gray-600
            rounded-xl
            outline-none
            transition-all duration-150
            focus:border-blue-500/50 focus:bg-white/[0.06]
            focus:ring-1 focus:ring-blue-500/20
            ${error ? "border-red-500/50" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;