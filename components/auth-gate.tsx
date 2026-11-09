"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "context/UserContext";
import { rememberLoginRedirect } from "@/lib/login-redirect";
import { AuthContext } from "./AuthContext";

// Reads the signed-in user from the root UserContext rather than asking
// Supabase again: each section (/admin, /{slug}, /dev) has its own layout and
// AuthGate, and a fresh lookup on every switch between them blanked the whole
// screen, sidebar included, while it waited.
//
// Signed out: straight to the login page (a clean "/"), which brings them
// back here after they log in (lib/login-redirect.ts). Nothing about the page is shown or
// checked first, so a signed-out visitor can't tell which clients or pages
// exist; whether they may see it is decided after login, by the section's
// own access check.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const signedOut = !loading && !user;

  useEffect(() => {
    if (!signedOut) {
      return;
    }
    // Read from window rather than useSearchParams, which would need a
    // Suspense boundary around every layout using this gate. Kept in
    // sessionStorage, so the login page's URL stays a clean "/".
    rememberLoginRedirect(window.location.pathname + window.location.search);
    router.replace("/");
  }, [signedOut, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}
