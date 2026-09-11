"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "context/UserContext";
import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { fetchPreviewLinks, type PreviewLink } from "@/lib/demo-video-utils";

// Mirrors the backend's own validation (supabase/functions/users/updateCustomer.ts
// resolvePreviewLinks) so a bad entry never reaches Save in the first place —
// null means "fine to submit" (a fully blank row is silently dropped, not an error).
function getLinkError(link: PreviewLink): string | null {
  const text = link.text.trim();
  const url = link.url.trim();
  if (!text && !url) return null;
  if (!text || !url) return "Needs both a description and a URL";
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) {
      return "URL must start with http:// or https://";
    }
  } catch {
    return "Not a valid URL";
  }
  return null;
}

// Shown at the top of the Demo tab (and the Demos sidebar page) for every
// role — e.g. a direct link to the customer's test environment, so it's
// always one click away from wherever demos live instead of buried in a doc
// or chat thread. Admins/developers additionally get an inline editor here
// (Settings → Edit Customer → "Preview Links" still works too, this is just
// a shortcut from wherever they're already looking at the customer's
// tickets) — customers/stakeholders only ever see the read-only list.
export function PreviewLinksBanner({ slug }: { readonly slug?: string }) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const canManage = profile?.role === "admin" || profile?.role === "developer";

  const { data } = useQuery({
    queryKey: ["preview-links", slug],
    queryFn: () => fetchPreviewLinks(slug!),
    enabled: !!slug,
  });

  const links = data?.links ?? [];
  const customerId = data?.customerId ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [draftLinks, setDraftLinks] = useState<PreviewLink[]>([]);

  function startEditing() {
    setDraftLinks(links.length > 0 ? links : [{ text: "", url: "" }]);
    setIsEditing(true);
  }

  function addLink() {
    setDraftLinks((prev) => [...prev, { text: "", url: "" }]);
  }

  function updateLink(index: number, field: keyof PreviewLink, value: string) {
    setDraftLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  }

  function removeLink(index: number) {
    setDraftLinks((prev) => prev.filter((_, i) => i !== index));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Could not resolve this customer");

      // Same session-token requirement as EditClientModal's save — the
      // backend resolves "is this caller actually admin/developer?" from
      // the token itself, never from a client-supplied role.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders = {
        ...API_JSON_HEADERS,
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      };

      const cleanedLinks = draftLinks.filter((l) => l.text.trim() || l.url.trim());

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ customer_id: customerId, preview_links: cleanedLinks }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save test environments");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preview-links", slug] });
      setIsEditing(false);
      toast.success("Test environments updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canManage && links.length === 0) return null;

  if (isEditing) {
    const linkErrors = draftLinks.map(getLinkError);
    const hasInvalidLinks = linkErrors.some(Boolean);

    return (
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 smalltext"
            disabled={hasInvalidLinks}
            title={hasInvalidLinks ? "Fix the entry below before adding another" : undefined}
            onClick={addLink}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {/* Each environment gets its own card (rather than every field just
            stacking into one long list) so adding another one reads as a
            new, distinct entry instead of two more inputs tacked onto the
            existing ones. auto-fill/minmax rather than a fixed column count
            so this fills whatever width it's given (the Demo dashboard's
            full-width row, or a narrower Demo tab) with as many columns as
            fit, wrapping instead of ever overflowing sideways. */}
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {draftLinks.map((link, i) => {
            const error = linkErrors[i];
            return (
              <div
                key={i}
                className={`space-y-1.5 rounded-lg border p-2.5 ${
                  error ? "border-destructive/50 bg-destructive/5" : "border-border bg-background"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={link.text}
                      onChange={(e) => updateLink(i, "text", e.target.value)}
                      className="smalltext bg-secondary border-0"
                      placeholder="Description, e.g. Cycle 19 Environment"
                    />
                    <Input
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      className="smalltext bg-secondary border-0"
                      placeholder="https://..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLink(i)}
                    aria-label="Remove test environment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {error && <p className="smalltext text-destructive">{error}</p>}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="smalltext"
            disabled={saveMutation.isPending}
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 smalltext"
            disabled={saveMutation.isPending || hasInvalidLinks}
            title={hasInvalidLinks ? "Fix the highlighted entry before saving" : undefined}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {canManage && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 smalltext text-muted-foreground hover:text-foreground"
            onClick={startEditing}
          >
            <Pencil className="h-3.5 w-3.5" />
            {links.length === 0 ? "Add test environment" : "Edit test environments"}
          </Button>
        </div>
      )}

      {links.length === 0 ? (
        <p className="smalltext text-muted-foreground italic">No test environments yet.</p>
      ) : (
        // auto-fill/minmax: as many 220px+ columns as fit the available
        // width (the full-width Demo dashboard row, or a narrower Demo tab),
        // wrapping to more rows instead of ever overflowing sideways.
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {links.map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 smalltext font-medium text-primary rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 hover:text-primary/80 hover:border-primary/40 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {link.text}: {link.url}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
