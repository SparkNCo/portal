"use client";

import Link from "next/link";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { homePathFor } from "@/lib/route-access";

// Shown instead of any /{slug} page whose slug matches no client (a
// mistyped or outdated URL). No sidebar, no page panels. Links back to the
// user's own home page, or to login if they aren't signed in.
export function ClientNotFound({ slug }: { readonly slug: string }) {
  const { user, profile } = useUser();
  const { selectedProject } = useSelectedProject();
  const home = user ? homePathFor(profile, selectedProject) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 text-center">
        <p className="smalltext font-medium uppercase tracking-wide text-primary">404</p>
        <h1 className="text-lg font-semibold text-foreground">This client doesn't exist</h1>
        <p className="smalltext text-muted-foreground break-words">
          There's no client called "{slug}". Check the link, or go back to your own pages.
        </p>
        <Link
          href={home ?? "/"}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 smalltext font-medium text-primary-foreground hover:bg-primary/90"
        >
          {home ? "Go to your home page" : "Go to login"}
        </Link>
      </div>
    </div>
  );
}
