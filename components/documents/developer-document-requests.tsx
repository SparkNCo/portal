"use client";

import { useUser } from "context/UserContext";
import { DocumentRequestsList } from "./document-requests-list";

// Customers and developers share the /documents route. This panel only
// renders for roles that can fulfill requests, so customers see nothing.
export function DeveloperDocumentRequests() {
  const { profile } = useUser();

  if (profile?.role !== "developer" && profile?.role !== "admin") {
    return null;
  }

  // Admins manage every project, so they see the full queue. Developers only
  // see requests for the customers they're actually assigned to.
  // document_requests.customer_slug is populated with clientName (the app
  // routes by clientName, e.g. /custest/dashboard/..., not linear_slug), so
  // the filter must compare against profile.assignment_id[].clientName.
  if (profile.role === "admin") {
    return <DocumentRequestsList canManage />;
  }

  const assignedSlugs = Array.from(
    new Set(
      (profile.assignment_id ?? [])
        .map((a) => a.clientName)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  );

  return <DocumentRequestsList canManage assignedSlugs={assignedSlugs} />;
}
