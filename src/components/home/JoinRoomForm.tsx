"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"code" | "name">("code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleCodeChange(value: string) {
    // Auto-uppercase, strip non-alphanumeric, max 4 chars
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(cleaned);
    setError("");
  }

  async function handleJoin() {
    if (step === "code") {
      if (code.length !== 6) {
        setError("Room code is 6 characters");
        return;
      }
      setStep("name");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a display name");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {step === "code" ? (
        <Input
          placeholder="ABCDEF"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          label="Room Code"
          error={error || undefined}
          autoFocus
          className="text-center text-lg tracking-[0.3em] font-mono"
          maxLength={6}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStep("code"); setError(""); }}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm cursor-pointer"
            >
              ← {code}
            </button>
          </div>
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            error={error || undefined}
            autoFocus
            maxLength={25}
          />
        </>
      )}
      <Button
        variant="secondary"
        size="lg"
        onClick={handleJoin}
        loading={loading}
        className="w-full"
      >
        {step === "code" ? "Next" : "Join Room"}
      </Button>
    </div>
  );
}