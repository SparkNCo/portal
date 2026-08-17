"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/headerDashboard";
import { DocumentsList } from "@/components/documents/documents-list";
import {
  UploadDocument,
  type UploadInitiative,
} from "@/components/documents/upload-document";
import { DeveloperDocumentRequests } from "@/components/documents/developer-document-requests";
import { RequestDocumentDialog } from "@/components/documents/request-document-dialog";
import { DocumentRequestsList } from "@/components/documents/document-requests-list";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { safeDecodeURIComponent } from "@/lib/utils";

export default function DocumentsPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  // Developers have no `linear_slug` of their own (that's a customer-account
  // field) and, under `/dev/documents`, no `[slug]` route segment either —
  // fall back to their first assignment, same customer this page would have
  // resolved to via the old `/{assignedClientName}/documents` URL.
  const slug =
    customerSlug ??
    urlSlug ??
    profile?.linear_slug ??
    profile?.assignment_id?.[0]?.clientName ??
    profile?.assignment_id?.[0]?.linear_slug ??
    "";

  const canUpload = profile?.role === "developer" || profile?.role === "admin";
  const canRequest = profile?.role === "customer" || profile?.role === "stakeholder";

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

  // A developer assigned to more than one initiative shouldn't be locked to
  // whichever one this page happens to be scoped to (`slug`/`projectSlug`
  // above) — let them pick the target initiative in the upload panel.
  // Deduped by `linear_slug` since the same initiative can appear more than
  // once in `assignment_id` (e.g. multiple roles on the same project).
  const developerInitiatives: UploadInitiative[] =
    profile?.role === "developer"
      ? Array.from(
          new Map(
            (profile?.assignment_id ?? [])
              .filter((a): a is typeof a & { linear_slug: string } => !!a.linear_slug)
              .map((a) => [
                a.linear_slug,
                { clientName: a.clientName ?? a.linear_slug, linear_slug: a.linear_slug },
              ]),
          ).values(),
        )
      : [];

  // A developer's uploads can now land under any of their assigned
  // initiatives (the picker above, or a fulfilled request's actual
  // requesting customer) — not just whichever one `projectSlug` happens to
  // resolve to for this page. Locking Project Documents to that single
  // value made anything uploaded under a different initiative invisible.
  // For a multi-initiative developer, fetch unscoped (every document they
  // have permission for, across every initiative) — DocumentsList already
  // groups results into a folder per project_slug when more than one is
  // present.
  const isMultiInitiativeDeveloper =
    profile?.role === "developer" && developerInitiatives.length > 1;
  const listProjectSlug = isMultiInitiativeDeveloper ? undefined : projectSlug;

  return (
    <div className="min-h-screen">
      <Header title="Documents" subtitle="Artifacts, reports, and uploads" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6 space-y-6">
        {canRequest && (
          <>
            <div className="flex items-center justify-end">
              <RequestDocumentDialog customerSlug={slug} requestedBy={profile?.email} />
            </div>

            <DocumentRequestsList customerSlug={slug} />
          </>
        )}

        <DeveloperDocumentRequests customerSlug={slug} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className={canUpload ? "lg:col-span-2" : "lg:col-span-3"}>
            {projectSlugPending ? (
              <p className="smalltext text-muted-foreground">Loading documents…</p>
            ) : (
              <DocumentsList projectSlug={listProjectSlug} customers={customers} />
            )}
          </div>
          {canUpload && (
            <div>
              <UploadDocument
                projectSlug={projectSlug}
                initiatives={developerInitiatives}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
