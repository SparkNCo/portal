"use client";

import { DevRouteRedirect } from "@/components/dev-route-redirect";

// Moved to /{slug}/build — see components/dev-route-redirect.tsx.
export default function DevBuildRedirect() {
  return <DevRouteRedirect panel="build" />;
}
