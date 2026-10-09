"use client";

import Link from "next/link";
import { useUser } from "context/UserContext";
import { AuthContext } from "./AuthContext";

// Reads the signed-in user from the root UserContext rather than asking
// Supabase again: each section (/admin, /{slug}, /dev) has its own layout and
// AuthGate, and a fresh lookup on every switch between them blanked the whole
// screen, sidebar included, while it waited.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6 text-center">
          <h1 className="text-xl font-semibold">Welcome 👋</h1>
          <p className="text-sm text-muted-foreground">
            Please log in or create an account to continue
          </p>

          <Link
            href="/"
            className="block w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Login / Sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}
