"use client";

import { useUser } from "context/UserContext";
import { DocumentRequestsList } from "./document-requests-list";

// Customers and developers share the /documents route. This panel only
// renders for roles that can fulfill requests, so customers see nothing.
export function DeveloperDocumentRequests({
  customerSlug,
}: {
  readonly customerSlug?: string;
}) {
  const { profile } = useUser();

  if (profile?.role !== "developer" && profile?.role !== "admin") {
    return null;
  }

  // Admins are scoped to whichever customer dashboard they're currently
  // viewing. Developers only see requests for the customers they're actually
  // assigned to. document_requests.customer_slug is populated with
  // clientName (the app routes by clientName, e.g. /custest/dashboard/...,
  // not linear_slug), so the filter must compare against
  // profile.assignment_id[].clientName.
  if (profile.role === "admin") {
    return <DocumentRequestsList canManage customerSlug={customerSlug} />;
  }

  // `customerSlug` here is whichever project is selected in the sidebar
  // dropdown (resolved by app/[slug]/(portal)/documents/page.tsx) — scope
  // to just that one project rather than every assignment, falling back to
  // every assigned project only if none resolved yet.
  const assignedSlugs = customerSlug
    ? [customerSlug]
    : Array.from(
        new Set(
          (profile.assignment_id ?? [])
            .map((a) => a.clientName)
            .filter((slug): slug is string => Boolean(slug)),
        ),
      );

  return <DocumentRequestsList canManage assignedSlugs={assignedSlugs} />;
}
