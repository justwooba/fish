import { createClient } from "@/lib/supabase/server";

/**
 * Ensures the current request has an authenticated user.
 * If no session exists, signs in anonymously.
 * Returns the user ID and supabase client, or null on failure.
 */
export async function ensureAuth(): Promise<{
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
} | null> {
  const supabase = await createClient();

  // Check for existing session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { userId: user.id, supabase };
  }

  // No session — sign in anonymously
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    console.error("Anonymous sign-in failed:", error);
    return null;
  }

  return { userId: data.user.id, supabase };
}