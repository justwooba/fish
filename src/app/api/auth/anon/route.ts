import { ensureAuth } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await ensureAuth();

  if (!auth) {
    return NextResponse.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }

  return NextResponse.json({ user_id: auth.userId });
}