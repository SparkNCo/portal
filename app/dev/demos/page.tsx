"use client";

import { DevRouteRedirect } from "@/components/dev-route-redirect";

// Moved to /{slug}/demos — see components/dev-route-redirect.tsx.
export default function DevDemosRedirect() {
  return <DevRouteRedirect panel="demos" />;
}
