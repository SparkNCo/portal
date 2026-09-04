"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { fetchPreviewLinks } from "@/lib/demo-video-utils";

// Admin-set links (Settings → Edit Customer → "Preview Links") shown at the
// top of the Demo tab (and the Demos sidebar page) for every role — e.g. a
// direct link to the customer's test environment, so it's always one click
// away from wherever demos live instead of buried in a doc or chat thread.
export function PreviewLinksBanner({ slug }: { readonly slug?: string }) {
  const { data } = useQuery({
    queryKey: ["preview-links", slug],
    queryFn: () => fetchPreviewLinks(slug!),
    enabled: !!slug,
  });

  const links = data ?? [];
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, i) => (
        <a
          key={`${link.url}-${i}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 smalltext font-medium text-primary hover:bg-primary/20 transition-colors max-w-full"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {link.text}: {link.url}
          </span>
        </a>
      ))}
    </div>
  );
}
