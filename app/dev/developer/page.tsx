"use client";

import { DevRouteRedirect } from "@/components/dev-route-redirect";

// Moved to /{slug}/developer — see components/dev-route-redirect.tsx.
export default function DevDeveloperRedirect() {
  return <DevRouteRedirect panel="developer" />;
}
