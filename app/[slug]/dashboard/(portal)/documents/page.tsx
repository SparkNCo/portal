"use client";

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

export default function DocumentsPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const canUpload = profile?.role === "developer" || profile?.role === "admin";
  const canRequest = profile?.role === "customer" || profile?.role === "stakeholder";

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
            <DocumentsList projectSlug={slug} />
          </div>
          {canUpload && (
            <div>
              <UploadDocument />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
