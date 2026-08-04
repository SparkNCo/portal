"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/headerDashboard";
import { DocumentsList } from "@/components/documents/documents-list";
import { UploadDocument } from "@/components/documents/upload-document";
import { DeveloperDocumentRequests } from "@/components/documents/developer-document-requests";
import { RequestDocumentDialog } from "@/components/documents/request-document-dialog";
import { DocumentRequestsList } from "@/components/documents/document-requests-list";
import { BookOpen } from "lucide-react";
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

  return (
    <div className="min-h-screen">
      <Header title="Documents" subtitle="Artifacts, reports, and uploads" />

      <div className="p-4 md:p-6 space-y-6">
        {canRequest && (
          <>
            <div className="rounded-lg border border-border bg-secondary/30 p-5 flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Wiki — coming soon
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This section will automatically summarize recent Linear and GitHub
                  activity into living documentation, and surface relevant articles
                  when creating Build/Bug tickets. For now, request a report or
                  technical document below, or browse what's already been uploaded.
                </p>
              </div>
            </div>

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
              <p className="text-sm text-muted-foreground">Loading documents…</p>
            ) : (
              <DocumentsList projectSlug={projectSlug} customers={customers} />
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
