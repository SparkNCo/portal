"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "context/UserContext";
import { clearLoginRedirect, rememberLoginRedirect } from "@/lib/login-redirect";
import { AuthContext } from "./AuthContext";

// Reads the signed-in user from the root UserContext rather than asking
// Supabase again: each section (/admin, /{slug}, /dev) has its own layout and
// AuthGate, and a fresh lookup on every switch between them blanked the whole
// screen, sidebar included, while it waited.
//
// Signed out: straight to the login page (a clean "/"). Nothing about the
// page is shown or checked first, so a signed-out visitor can't tell which
// clients or pages exist; whether they may see it is decided after login,
// by the section's own access check.
//
// Someone who *arrives* signed out (a link they were sent) is brought back
// to this page after they log in (lib/login-redirect.ts). Someone whose
// session ends while they're here (Logout, or the account-not-set-up
// screen's Log out) isn't: the next login, possibly another account in the
// same tab, goes to its own home page instead of the page they left.
export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useUser();
  const router = useRouter();
  const signedOut = !loading && !user;
  // Whether this page had a signed-in user at some point.
  const hadUser = useRef(false);
  if (user) {
    hadUser.current = true;
  }

  useEffect(() => {
    if (!signedOut) {
      return;
    }
    if (hadUser.current) {
      clearLoginRedirect();
    } else {
      // Read from window rather than useSearchParams, which would need a
      // Suspense boundary around every layout using this gate.
      rememberLoginRedirect(window.location.pathname + window.location.search);
    }
    router.replace("/");
  }, [signedOut, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}
