"use client";

import { useRouter } from "next/navigation";
import { LogOut, RotateCw } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

// Shown instead of any portal page when the signed-in user has no portal
// profile, no recognised role, or nowhere valid to land (e.g. a customer
// with no linked client). Logging out is the only way forward for them.
// With `loadFailed` (the profile request itself failed) it offers a retry
// instead, since the account may be fine.
export function AccountNotSetUp({ loadFailed = false }: { readonly loadFailed?: boolean }) {
  const router = useRouter();
  const { reloadUser } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {loadFailed ? "We couldn't load your account" : "Your account isn't set up yet"}
        </h1>
        <p className="smalltext text-muted-foreground">
          {loadFailed
            ? "Please try again. If it keeps happening, contact your administrator."
            : "Contact your administrator to finish setting up your access."}
        </p>
        {loadFailed && (
          <button
            type="button"
            onClick={() => reloadUser()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 smalltext font-medium text-foreground hover:bg-secondary/40"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 smalltext font-medium text-primary-foreground hover:bg-primary/90"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
