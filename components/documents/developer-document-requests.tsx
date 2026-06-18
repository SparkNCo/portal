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

  return <DocumentRequestsList canManage />;
}
