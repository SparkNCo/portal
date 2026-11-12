"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { API_HEADERS } from "@/lib/api-headers";
import { safeDecodeURIComponent, deriveIssueKind, getIssueCode } from "@/lib/utils";
import { issueShareUrl } from "@/hooks/use-issue-deep-link";

// The button next to a ticket chat's title that opens the ticket: on the
// Bugs page for a bug, on Build otherwise, with its detail modal open. Shown
// only once the ticket is found for this initiative (issues/by-id checks it's
// this customer's), so a deleted ticket or another customer's never links.
export function ChatTicketLink({
  issueId,
  fallbackSlug,
}: Readonly<{ issueId: string | null | undefined; fallbackSlug?: string | null }>) {
  const { slug: rawSlug } = useParams<{ slug?: string }>();
  const slug = (rawSlug ? safeDecodeURIComponent(rawSlug) : null) ?? fallbackSlug ?? null;

  const { data: issue } = useQuery({
    queryKey: ["chat-ticket", issueId, slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/by-id?id=${encodeURIComponent(issueId!)}&slug=${encodeURIComponent(slug!)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        id: string;
        identifier?: string;
        branchName?: string;
        labels?: { nodes?: { name?: string }[] };
      };
    },
    enabled: !!issueId && !!slug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!issue || !slug) return null;

  const isBug = deriveIssueKind(issue.labels?.nodes) === "bug";
  const href = issueShareUrl("", slug, issue.id, isBug);
  // Jira tickets carry their key; Linear ones, in their branch name.
  const code = issue.identifier ?? (issue.branchName ? getIssueCode(issue.branchName) : undefined);

  return (
    <Link
      href={href}
      title={code ? `Open ticket ${code}` : "Open ticket"}
      aria-label={code ? `Open ticket ${code}` : "Open ticket"}
      // A plain orange link (not a button): the ticket code and the redirect icon.
      className="inline-flex shrink-0 items-center gap-1 smalltext font-medium text-primary hover:underline underline-offset-2"
    >
      {code && <span>{code}</span>}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
