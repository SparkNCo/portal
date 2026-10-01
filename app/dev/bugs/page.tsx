"use client";

import { DevRouteRedirect } from "@/components/dev-route-redirect";

// Moved to /{slug}/bugs — see components/dev-route-redirect.tsx.
export default function DevBugsRedirect() {
  return <DevRouteRedirect panel="bugs" />;
}
