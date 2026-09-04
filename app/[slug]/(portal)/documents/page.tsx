"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/headerDashboard";
import { DocumentsList } from "@/components/documents/documents-list";
import { UploadDocument } from "@/components/documents/upload-document";
import { DeveloperDocumentRequests } from "@/components/documents/developer-document-requests";
import { RequestDocumentDialog } from "@/components/documents/request-document-dialog";
import { DocumentRequestsList } from "@/components/documents/document-requests-list";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { safeDecodeURIComponent } from "@/lib/utils";

export default function DocumentsPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { selectedProject } = useSelectedProject();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  // Which assigned project to scope this page to — picked from the sidebar
  // dropdown (see components/sidebar.tsx). Mirrors that dropdown's own
  // default (first assignment) for the moment before the developer has ever
  // touched it, since nothing's stored yet at that point.
  const selectedDeveloperProject =
    profile?.role === "developer"
      ? (selectedProject ?? profile?.assignment_id?.[0]?.clientName ?? null)
      : null;
  const selectedAssignment = selectedDeveloperProject
    ? profile?.assignment_id?.find(
        (a) => a.clientName === selectedDeveloperProject,
      )
    : undefined;
  // Developers have no `linear_slug` of their own (that's a customer-account
  // field) and, under `/dev/documents`, no `[slug]` route segment either —
  // fall back to the sidebar-selected assignment, then the first one, same
  // customer this page would have resolved to via the old
  // `/{assignedClientName}/documents` URL.
  const slug =
    customerSlug ??
    urlSlug ??
    profile?.linear_slug ??
    selectedAssignment?.clientName ??
    profile?.assignment_id?.[0]?.clientName ??
    profile?.assignment_id?.[0]?.linear_slug ??
    "";

  const canUpload = profile?.role === "developer" || profile?.role === "admin";
  const canRequest = profile?.role === "customer" || profile?.role === "stakeholder" || profile?.role === "admin";

  const isAdmin = profile?.role === "admin";

  // documents.project_slug is populated with the customer's Linear project
  // slug, while `slug` here is the clientName-based route/customer slug
  // (see DeveloperDocumentRequests). Resolve the authoritative project slug
  // from the assignment/customer record instead of reusing the route slug.
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<
        { clientName: string; linear_slug: string | null }[]
      >;
    },
    enabled: isAdmin && !!slug,
  });

  const assignedProjectSlug = profile?.assignment_id?.find(
    (a) => a.clientName?.toLowerCase() === slug.toLowerCase(),
  )?.linear_slug;

  // Admins resolve the route customer's project slug from the customers
  // list — never fall back to the admin's own profile.linear_slug, which
  // belongs to a different account and could scope the fetch to the wrong
  // customer's documents.
  const projectSlug =
    (isAdmin
      ? (assignedProjectSlug ?? customers?.find((c) => c.clientName?.toLowerCase() === slug.toLowerCase())?.linear_slug)
      : (assignedProjectSlug ?? profile?.linear_slug)) ?? undefined;

  // Withhold DocumentsList until an admin's projectSlug actually resolves —
  // whether it's still loading, or the customers lookup finished without a
  // match. Either way, rendering with projectSlug=undefined would make it
  // fetch every document the admin can see.
  const projectSlugPending = isAdmin && !projectSlug;

  // A developer assigned to more than one initiative now scopes Project
  // Documents to whichever one is selected in the sidebar dropdown (via
  // `projectSlug`, resolved above from `selectedDeveloperProject`) — same
  // control the developer dashboard's issue panel uses.
  const listProjectSlug = projectSlug;

  return (
    <div className="min-h-screen">
      <Header title="Documents" subtitle="Artifacts, reports, and uploads" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6 space-y-6">
        {canRequest && (
          <>
            <div className="flex items-center justify-end">
              <RequestDocumentDialog customerSlug={slug} requestedBy={profile?.email} />
            </div>

            {/* Admins get the same "Document Requests"/"Requests Fulfilled"
                panels below from DeveloperDocumentRequests already — with
                canManage on top, so it's a strict superset. Rendering this
                plain (non-manage) copy too would just duplicate them. */}
            {!isAdmin && <DocumentRequestsList customerSlug={slug} />}
          </>
        )}

        <DeveloperDocumentRequests customerSlug={slug} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className={canUpload ? "lg:col-span-2" : "lg:col-span-3"}>
            {projectSlugPending ? (
              <p className="smalltext text-muted-foreground">Loading documents…</p>
            ) : (
              <DocumentsList projectSlug={listProjectSlug} />
            )}
          </div>
          {canUpload && (
            <div>
              <UploadDocument projectSlug={projectSlug} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
