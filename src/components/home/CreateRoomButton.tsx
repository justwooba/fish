"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function CreateRoomButton() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!showNameInput) {
      setShowNameInput(true);
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
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create room");
      }

      const { room_code } = await res.json();
      router.push(`/room/${room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {showNameInput && (
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          error={error && !name.trim() ? error : undefined}
          autoFocus
          maxLength={20}
        />
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={handleCreate}
        loading={loading}
        className="w-full"
      >
        {showNameInput ? "Start Room" : "Create Room"}
      </Button>
      {error && name.trim() && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}