"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { emailsIn, isEmail } from "@/lib/email-list";

type ShareResult = {
  shared_with: string[];
  emailed: string[];
  already_had_access: string[];
  failed: string[];
};

export function useShareDocument() {
  return useMutation({
    mutationFn: async ({
      document_id,
      emails,
      user_id,
    }: {
      document_id: number;
      emails: string[];
      user_id: string | undefined;
    }): Promise<ShareResult> => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/share`, {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ document_id, emails, user_id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to share document");
      return body;
    },
  });
}

type CustomerSummary = {
  id: string;
  email: string | null;
  clientName: string | null;
  linear_slug: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type Person = { email: string; name: string; role: string };

function displayName(u: { firstName?: string | null; lastName?: string | null; userName?: string | null; email?: string | null }) {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.userName || u.email || "";
}

// Everyone on the document's initiative (the customer plus the developers and
// stakeholders assigned to it), offered as suggestions while typing.
// Resolved from the document's own project_slug (its customer's linear_slug).
function useInitiativePeople(projectSlug: string | null | undefined, enabled: boolean) {
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<CustomerSummary[]>;
    },
    enabled,
  });
  const customer = projectSlug
    ? customers?.find((c) => c.linear_slug?.toLowerCase() === projectSlug.toLowerCase())
    : undefined;

  const { data: assignments } = useQuery({
    queryKey: ["assignments", customer?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customer!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch initiative users");
      return res.json() as Promise<
        { email: string | null; role: string; userName?: string | null; firstName?: string | null; lastName?: string | null }[]
      >;
    },
    enabled: enabled && !!customer?.id,
  });

  const byEmail = new Map<string, Person>();
  if (customer?.email) {
    byEmail.set(customer.email.toLowerCase(), { email: customer.email.toLowerCase(), name: customer.clientName ?? displayName(customer), role: "customer" });
  }
  (assignments ?? []).forEach((a) => {
    const email = a.email?.toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, { email, name: displayName(a), role: a.role });
  });
  return Array.from(byEmail.values());
}

// Who has access to the document, by lowercased email.
function usePeopleWithAccess(documentId: number | undefined, callerId: string | undefined, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["document-permissions", documentId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/permissions?document_id=${documentId}&user_id=${callerId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load who has access");
      return res.json() as Promise<{ email: string }[]>;
    },
    enabled: enabled && !!documentId && !!callerId,
  });
  return (data ?? []).map((p) => p.email.toLowerCase());
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// One toast that says what happened to every email.
function shareSummary(res: ShareResult): { ok: boolean; text: string } {
  const parts = [
    res.shared_with.length && `access for ${plural(res.shared_with.length, "person", "people")} in the portal`,
    res.emailed.length && `emailed to ${plural(res.emailed.length, "address", "addresses")}`,
    res.already_had_access.length && `${plural(res.already_had_access.length, "person", "people")} already had access`,
  ].filter(Boolean);
  if (res.failed.length) {
    return { ok: false, text: `Couldn't email ${res.failed.join(", ")}.${parts.length ? ` Done: ${parts.join(", ")}.` : ""}` };
  }
  return { ok: true, text: parts.length ? `Shared: ${parts.join(", ")}.` : "Shared." };
}

// Share by email: type or paste emails (comma, space, Enter or Tab ends one)
// and each becomes a pill. Portal users get access; anyone else gets the file
// by email (storage/shareDocument.ts). People on the initiative are suggested
// as you type.
export function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  id,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  document: any;
  id: string | undefined;
}>) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const shareMutation = useShareDocument();
  const people = useInitiativePeople(document?.project_slug, isOpen);
  const withAccess = usePeopleWithAccess(document?.id, id, isOpen);
  const ownEmail = profile?.email?.toLowerCase();

  const invalid = emails.filter((e) => !isEmail(e));
  const term = draft.trim().toLowerCase();
  const suggestions = term
    ? people
        .filter((p) => p.email !== ownEmail && !emails.includes(p.email) && !withAccess.includes(p.email))
        .filter((p) => p.email.includes(term) || p.name.toLowerCase().includes(term))
        .slice(0, 5)
    : [];

  const addEmails = (text: string) => {
    const found = emailsIn(text);
    if (found.length === 0) return;
    setEmails((prev) => [...new Set([...prev, ...found])]);
    setDraft("");
  };
  const removeEmail = (email: string) => setEmails((prev) => prev.filter((e) => e !== email));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      addEmails(draft);
    } else if (e.key === "Backspace" && !draft && emails.length) {
      removeEmail(emails[emails.length - 1]!);
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (/[,;\s]/.test(text)) {
      e.preventDefault();
      addEmails(text);
    }
  };

  const close = () => {
    setEmails([]);
    setDraft("");
    setIsExpanded(false);
    onClose();
  };

  // A half-typed email counts too, so "Share" doesn't silently drop it.
  const toSend = [...new Set([...emails, ...emailsIn(draft)])];
  const canShare = toSend.length > 0 && toSend.every(isEmail) && !shareMutation.isPending;
  let shareLabel = "Share";
  if (shareMutation.isPending) shareLabel = "Sharing...";
  else if (toSend.length > 0) shareLabel = `Share with ${toSend.length}`;

  const handleShare = () => {
    if (!canShare) return;
    shareMutation.mutate(
      { document_id: document.id, emails: toSend, user_id: id },
      {
        onSuccess: (res) => {
          const { ok, text } = shareSummary(res);
          if (ok) {
            toast.success(text);
          } else {
            toast.error(text);
          }
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
          void queryClient.invalidateQueries({ queryKey: ["document-permissions", document.id] });
          close();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to share document."),
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={cn("flex flex-col", isExpanded ? "max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]" : "sm:max-w-md")}
        aria-describedby={undefined}
      >
        {/* Same expand control as the document preview (document-preview-modal.tsx). */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={isExpanded ? "Exit full screen" : "Expand"}
        >
          {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <p className="smalltext text-muted-foreground">
            Share <span className="font-medium text-foreground">{document?.name}</span> by email. People in the portal
            get access to it; anyone else gets it by email.
          </p>

          {/* The emails as pills, then the input. */}
          <div className="relative">
            <div
              className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-primary"
              onClick={() => window.document.getElementById("share-emails-input")?.focus()}
            >
              {emails.map((email) => (
                <span
                  key={email}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 smalltext",
                    isEmail(email) ? "border-border bg-muted text-foreground" : "border-destructive/60 bg-destructive/10 text-destructive",
                  )}
                  title={isEmail(email) ? email : `${email} isn't a valid email`}
                >
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                    className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="share-emails-input"
                type="text"
                inputMode="email"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => draft.trim() && addEmails(draft)}
                placeholder={emails.length ? "" : "name@example.com, another@example.com"}
                aria-label="Emails to share with, separated by commas"
                className="min-w-[10rem] flex-1 bg-transparent py-0.5 smalltext text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                {suggestions.map((p) => (
                  <li key={p.email}>
                    <button
                      type="button"
                      // Before the input's blur adds the half-typed text.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEmails((prev) => [...new Set([...prev, p.email])]);
                        setDraft("");
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left smalltext hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-popover-foreground">{p.name}</span>
                        <span className="block truncate text-muted-foreground">{p.email}</span>
                      </span>
                      <span className="shrink-0 capitalize text-muted-foreground">{p.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {invalid.length > 0 && (
            <p className="smalltext text-destructive">
              {invalid.length === 1 ? `"${invalid[0]}" isn't a valid email.` : `${invalid.length} emails aren't valid.`}
            </p>
          )}

          {withAccess.length > 0 && (
            <div className="space-y-1">
              <p className="smalltext font-medium text-muted-foreground">Has access</p>
              <div className="flex flex-wrap gap-1.5">
                {withAccess.map((email) => (
                  <span key={email} className="rounded-full border border-border px-2.5 py-0.5 smalltext text-muted-foreground">
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={!canShare}>
              {shareLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
