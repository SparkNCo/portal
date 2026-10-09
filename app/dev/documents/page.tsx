"use client";

import { DevRouteRedirect } from "@/components/dev-route-redirect";

// Moved to /{slug}/documents — see components/dev-route-redirect.tsx.
export default function DevDocumentsRedirect() {
  return <DevRouteRedirect panel="documents" />;
}
