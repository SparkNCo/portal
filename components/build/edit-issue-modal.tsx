"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { getIssueCode, deriveIssueKind } from "@/lib/utils";
import {
  type Issue,
  priorityColors,
  statusColors,
  PRIORITY_MENU_OPTIONS,
  ALL_STATUS_OPTIONS,
} from "@/components/client/issues.types";

async function patchIssue(payload: {
  issueId: string;
  title: string;
  description: string;
  actorEmail?: string;
  slug?: string;
  /** Only sent when changed; null takes the ticket out of its cycle. */
  cycleId?: string | null;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/edit`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update issue");
  return res.json();
}

// Same immediate-PATCH-on-select pattern as issue-detail-modal.tsx's header
// badges — kept here as separate PATCH calls (not batched with the
// title/description save below) so a priority/status change sticks even if
// the user then cancels out of the rest of the edit.
// The extra fields let the backend notify the initiative about the change.
async function patchStatus(payload: {
  issueId: string;
  stateName: string;
  actorEmail?: string;
  slug?: string;
  issueCode?: string;
  issueType?: string | null;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function patchPriority(payload: { issueId: string; priority: string; slug: string; actorEmail?: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/edit`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return res.json();
}

type CycleOption = { id: string; number: number; name: string | null; startsAt: string; endsAt: string; isActive: boolean };

// The ticket's team's current and upcoming cycles (see handleGetIssueCycles).
async function fetchIssueCycles(issueId: string): Promise<{ currentCycleId: string | null; cycles: CycleOption[] }> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/cycles?issueId=${encodeURIComponent(issueId)}`,
    { headers: API_JSON_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to load cycles");
  return res.json();
}

const NO_CYCLE = "none";

function formatCycleDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function cycleLabel(cycle: { number: number; name?: string | null }) {
  return cycle.name ? `Cycle ${cycle.number} · ${cycle.name}` : `Cycle ${cycle.number}`;
}

export function EditIssueModal({
  issue,
  slug,
  onClose,
  onSaved,
}: {
  issue: Issue;
  slug: string;
  onClose: () => void;
  /** Called after a successful save, in addition to the built-in cache invalidation — use this to
   * invalidate any additional query keys the caller's issue list depends on (e.g. an aggregated
   * multi-project list that doesn't use the ["linear-issues", slug] key). */
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const { profile } = useUser();
  const role = profile?.role;
  // Same gate as issue-detail-modal.tsx's own header badges — quick priority/
  // status changes are a developer/admin action, not a customer-facing one.
  const canEditTicketMeta = role === "developer" || role === "admin";
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");

  const [currentPriorityLabel, setCurrentPriorityLabel] = useState(issue.priorityLabel);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [changingPriority, setChangingPriority] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Putting a ticket in a cycle is planning work — developers and admins only.
  const cyclesQuery = useQuery({
    queryKey: ["issue-cycles", issue.id],
    queryFn: () => fetchIssueCycles(issue.id),
    enabled: canEditTicketMeta,
  });
  const initialCycleId = cyclesQuery.data?.currentCycleId ?? issue.cycle?.id ?? null;
  // undefined = untouched, so saving doesn't send a cycle change at all.
  const [selectedCycleId, setSelectedCycleId] = useState<string | null | undefined>(undefined);
  const cycleValue = selectedCycleId === undefined ? initialCycleId : selectedCycleId;
  const cycleChanged = selectedCycleId !== undefined && selectedCycleId !== initialCycleId;

  // Refetch every issue list this ticket could appear in, same as
  // issue-detail-modal.tsx's invalidateIssueLists — otherwise a list cached
  // from before this change still shows the old priority/status.
  function invalidateIssueLists() {
    queryClient.invalidateQueries({
      predicate: (query) =>
        ["linear-issues", "linear-issues-developer", "roadmap"].includes(
          query.queryKey[0] as string,
        ),
    });
  }

  async function handleChangePriority(value: string, label: Issue["priorityLabel"]) {
    if (label === currentPriorityLabel || changingPriority) return;
    setChangingPriority(true);
    try {
      const data = await patchPriority({
        issueId: issue.id,
        priority: value,
        slug,
        ...(profile?.email ? { actorEmail: profile.email } : {}),
      });
      if (data.success) {
        setCurrentPriorityLabel(label);
        invalidateIssueLists();
      } else {
        toast.error("Failed to update priority.");
      }
    } catch {
      toast.error("Failed to update priority.");
    } finally {
      setChangingPriority(false);
    }
  }

  async function handleAdvanceState(targetState: string) {
    if (!targetState || targetState === currentStateName || advancing) return;
    setAdvancing(true);
    try {
      const data = await patchStatus({
        issueId: issue.id,
        stateName: targetState,
        actorEmail: profile?.email,
        slug,
        issueCode: getIssueCode(issue.branchName),
        issueType: deriveIssueKind(issue.labels?.nodes),
      });
      if (data.success) {
        setCurrentStateName(targetState as NonNullable<Issue["state"]>["name"]);
        invalidateIssueLists();
      } else {
        toast.error(`Failed to move ticket to "${targetState}".`);
      }
    } catch {
      toast.error(`Failed to move ticket to "${targetState}".`);
    } finally {
      setAdvancing(false);
    }
  }

  const mutation = useMutation({
    mutationFn: patchIssue,
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: ["linear-issues", slug] });
      if (cycleChanged) {
        invalidateIssueLists();
        queryClient.invalidateQueries({ queryKey: ["issue-cycles", issue.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["issue-updates"] });
      onSaved?.();
      onClose();
    },
    onError: () => toast.error("Failed to update ticket. Please try again."),
  });

  function handleSave() {
    if (!title.trim()) return;
    mutation.mutate({
      issueId: issue.id,
      title: title.trim(),
      description,
      slug,
      ...(profile?.email ? { actorEmail: profile.email } : {}),
      ...(cycleChanged ? { cycleId: selectedCycleId ?? null } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-3xl md:max-w-5xl lg:max-w-6xl"
            : "sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        }`}
        aria-describedby={undefined}
      >
        <ExpandableDialogChrome
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((e) => !e)}
        />

        {/* Mirrors the ticket detail modal's header (code + priority +
            status, then the title) so this quick-edit form still reads as
            the same ticket rather than a generic form. For admins/developers
            both badges are directly editable here too — same click-a-badge,
            pick-a-value, save-immediately pattern as issue-detail-modal.tsx
            (a separate PATCH per change, not batched with title/description). */}
        <DialogHeader className="pt-4 pr-12">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="smalltext font-mono text-muted-foreground">
              {getIssueCode(issue.branchName)}
            </span>
            {canEditTicketMeta ? (
              <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={changingPriority}
                    className="focus:outline-none disabled:cursor-wait"
                  >
                    <Badge
                      variant="outline"
                      className={`smalltext gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
                        changingPriority ? "opacity-70" : ""
                      } ${priorityColors[currentPriorityLabel as keyof typeof priorityColors]}`}
                    >
                      {changingPriority && <Loader2 className="h-3 w-3 animate-spin" />}
                      {currentPriorityLabel}
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-44 p-1.5 bg-background border-border">
                  <div className="flex flex-col gap-0.5">
                    {PRIORITY_MENU_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={changingPriority}
                        onClick={() => {
                          setPriorityMenuOpen(false);
                          handleChangePriority(opt.value, opt.label);
                        }}
                        className={`smalltext px-2.5 py-1.5 rounded-md text-left font-medium transition-colors disabled:opacity-50 ${
                          opt.label === currentPriorityLabel
                            ? priorityColors[opt.label]
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Badge
                variant="outline"
                className={`smalltext ${priorityColors[currentPriorityLabel as keyof typeof priorityColors]}`}
              >
                {currentPriorityLabel}
              </Badge>
            )}
            {canEditTicketMeta ? (
              <Popover open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={advancing}
                    className="focus:outline-none disabled:cursor-wait"
                  >
                    <Badge
                      variant="secondary"
                      className={`smalltext gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
                        advancing ? "opacity-70" : ""
                      } ${statusColors[currentStateName as keyof typeof statusColors]}`}
                    >
                      {advancing && <Loader2 className="h-3 w-3 animate-spin" />}
                      {currentStateName}
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-56 p-1.5 bg-background border-border max-h-72 overflow-y-auto"
                >
                  <div className="flex flex-col gap-0.5">
                    {ALL_STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={advancing}
                        onClick={() => {
                          setStatusMenuOpen(false);
                          handleAdvanceState(status);
                        }}
                        className={`smalltext px-2.5 py-1.5 rounded-md text-left font-medium transition-colors disabled:opacity-50 ${
                          status === currentStateName
                            ? statusColors[status as keyof typeof statusColors]
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              currentStateName && (
                <Badge
                  variant="secondary"
                  className={`smalltext ${statusColors[currentStateName as keyof typeof statusColors]}`}
                >
                  {currentStateName}
                </Badge>
              )
            )}
          </div>
          <DialogTitle className="text-primary">Edit Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4 mt-1 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="edit-issue-title" className="smalltext">Title</Label>
            <Input
              id="edit-issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/40 border-0 smalltext text-foreground placeholder:text-muted-foreground"
              placeholder="Brief summary..."
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              className="border-0 bg-muted/40 [&_.ProseMirror]:text-foreground"
              minHeight="140px"
              ariaLabel="Description"
            />
          </div>

          {canEditTicketMeta && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-issue-cycle" className="smalltext">Cycle</Label>
              <Select
                value={cycleValue ?? NO_CYCLE}
                onValueChange={(v) => setSelectedCycleId(v === NO_CYCLE ? null : v)}
                disabled={cyclesQuery.isLoading || cyclesQuery.isError}
              >
                <SelectTrigger
                  id="edit-issue-cycle"
                  className="bg-muted/40 border-0 smalltext text-foreground"
                >
                  <SelectValue
                    placeholder={
                      cyclesQuery.isLoading
                        ? "Loading cycles…"
                        : cyclesQuery.isError
                          ? "Couldn't load cycles"
                          : "No cycle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CYCLE} className="smalltext">No cycle</SelectItem>
                  {/* A ticket already in a past cycle keeps it listed, so the
                      field still shows where it is. */}
                  {issue.cycle?.id &&
                    !cyclesQuery.data?.cycles.some((c) => c.id === issue.cycle?.id) && (
                      <SelectItem value={issue.cycle.id} className="smalltext">
                        {cycleLabel(issue.cycle)} (past)
                      </SelectItem>
                    )}
                  {(cyclesQuery.data?.cycles ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="smalltext">
                      {cycleLabel(c)} · {formatCycleDate(c.startsAt)} – {formatCycleDate(c.endsAt)}
                      {c.isActive ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cyclesQuery.isError && (
                <p className="smalltext text-destructive">
                  Couldn't load this team's cycles. Close and reopen to try again.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 smalltext"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || mutation.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
