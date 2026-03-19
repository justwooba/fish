"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface JoinViaLinkProps {
  roomCode: string;
}

export default function JoinViaLink({ roomCode }: JoinViaLinkProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
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
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join room");
      }

      // Reload the page so useRoom picks up the new player
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        <div className="text-center">
          <h1
            className="text-4xl font-normal tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fish
          </h1>
          <p className="text-gray-400 text-sm">
            You&apos;ve been invited to room{" "}
            <span className="font-mono text-gray-200">{roomCode}</span>
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <Input
            label="Your Name"
            placeholder="Enter a display name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            error={error || undefined}
            autoFocus
            maxLength={20}
          />
          <Button
            onClick={handleJoin}
            loading={loading}
            size="lg"
            className="w-full"
          >
            Join Room
          </Button>
        </div>

        <a
          href="/"
          className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
        >
          ← Back to home
        </a>
      </div>
    </main>
  );
}