"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bug,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lightbulb,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "context/UserContext";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { ListItemsField, MilestoneField, PriorityField, ProjectField } from "@/components/shared/issue-form-fields";
import { SimilarIssuesHint, plainSearchText } from "@/components/shared/similar-issues-hint";
import { fetchMilestones, isProjectRequired, postCreateIssue, rememberLastProject } from "@/lib/issues-api";
import {
  MAX_BULK_NOTES_CHARS,
  analyzeBulkNotes,
  buildBulkDescription,
  bulkImportStorageKey,
  parseSavedBulkImport,
  type BulkDraft,
  type SavedBulkImport,
} from "@/lib/bulk-import-api";

type RowStatus = "idle" | "creating" | "created" | "failed";

type DraftRow = Omit<BulkDraft, "projectId" | "milestoneId"> & {
  key: string;
  include: boolean;
  // "" = none picked (the selects' empty value).
  projectId: string;
  milestoneId: string;
  status: RowStatus;
  identifier?: string;
  error?: string;
};

// "3 tickets" / "1 ticket".
const tickets = (n: number) => `${n} ticket${n === 1 ? "" : "s"}`;

// Few at a time: every ticket is a Linear/Jira call (plus a label lookup).
const CREATE_CONCURRENCY = 3;

function toRow(draft: BulkDraft, i: number): DraftRow {
  return {
    ...draft,
    // ListItemsField always shows at least one input.
    items: draft.items.length ? draft.items : [""],
    projectId: draft.projectId ?? "",
    milestoneId: draft.milestoneId ?? "",
    key: `${Date.now()}-${i}`,
    include: true,
    status: "idle",
  };
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const runNext = async (): Promise<void> => {
    const item = items[next++];
    if (item === undefined) return;
    await worker(item);
    return runNext();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
}

// What keeps a selected, not-yet-created ticket from being filed.
function rowProblem(row: DraftRow, projectRequired: boolean): string | null {
  if (!row.include || row.status === "created") return null;
  if (!row.title.trim()) return "Needs a title";
  if (projectRequired && !row.projectId) return "Needs a project";
  return null;
}

// Storage can be blocked (private mode, disabled site data): the dialog
// still works, it just isn't saved.
function readSaved(key: string) {
  try {
    return parseSavedBulkImport<DraftRow>(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeSaved(key: string, saved: SavedBulkImport<DraftRow> | null) {
  try {
    if (saved) localStorage.setItem(key, JSON.stringify(saved));
    else localStorage.removeItem(key);
  } catch {
    // Only a convenience.
  }
}

// Arrow keys move between tickets, unless they're editing a field or a
// dialog opened on top (a similar ticket's detail).
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.getAttribute("role") === "combobox" ||
    !!target.closest('[role="listbox"]')
  );
}

export function BulkImportDialog({
  slug,
  projects,
  open,
  onOpenChange,
}: Readonly<{
  slug: string;
  projects: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { profile } = useUser();
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [index, setIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  // Which inline "are you sure?" is showing.
  const [confirming, setConfirming] = useState<"start-over" | "reanalyze" | null>(null);

  const projectRequired = isProjectRequired(projects);

  // Restore what was left here (this customer, this user) before saving
  // anything, so the first save can't wipe it.
  const storageKey = bulkImportStorageKey(slug, profile?.id);
  const restoredKey = useRef<string | null>(null);
  useEffect(() => {
    if (!profile?.id || restoredKey.current === storageKey) return;
    restoredKey.current = storageKey;
    const saved = readSaved(storageKey);
    if (!saved) return;
    setNotes(saved.notes);
    setRows(saved.rows);
    setStep(saved.step);
    setIndex(saved.index);
  }, [storageKey, profile?.id]);

  useEffect(() => {
    if (restoredKey.current !== storageKey) return;
    const empty = !notes.trim() && rows.length === 0;
    writeSaved(storageKey, empty ? null : { notes, step, rows, index, savedAt: Date.now() });
  }, [storageKey, notes, step, rows, index]);

  const lastIndex = Math.max(0, rows.length - 1);
  const current = rows[Math.min(index, lastIndex)];
  const goTo = (i: number) => setIndex(Math.min(Math.max(0, i), lastIndex));

  useEffect(() => {
    if (!open || step !== "review" || rows.length < 2) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target) || document.querySelectorAll('[role="dialog"]').length > 1) return;
      e.preventDefault();
      setIndex((i) => Math.min(Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)), rows.length - 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, step, rows.length]);

  const analyze = useMutation({
    mutationFn: () => analyzeBulkNotes(slug, notes, profile?.email ?? ""),
    onSuccess: (drafts) => {
      if (!drafts.length) {
        toast.info("No tickets found in those notes", {
          description: "Try adding more detail about what you'd like built or what isn't working.",
        });
        return;
      }
      setRows(drafts.map((draft, i) => toRow(draft, i)));
      setIndex(0);
      setStep("review");
    },
    onError: (err) =>
      toast.error("Couldn't analyze the notes", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  // A blank ticket for something the AI missed, without re-analyzing (which
  // would replace the drafts and their edits). Starts in the same project
  // as the ticket being looked at.
  function addRow() {
    const onlyProject = projects.length === 1 ? projects[0]?.id : undefined;
    const blank: DraftRow = {
      type: "feature",
      title: "",
      description: "",
      items: [""],
      expected: "",
      actual: "",
      projectId: current?.projectId || onlyProject || "",
      milestoneId: "",
      priority: "medium",
      sourceExcerpt: "",
      key: `${Date.now()}-added`,
      include: true,
      status: "idle",
    };
    setRows((prev) => [...prev, blank]);
    setIndex(rows.length);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Selected and not filed yet (a failed one is retried).
  const pendingRows = rows.filter((r) => r.include && r.status !== "created");
  const missingProject = projectRequired && pendingRows.some((r) => !r.projectId);
  const missingTitle = pendingRows.some((r) => !r.title.trim());
  const createdCount = rows.filter((r) => r.status === "created").length;
  const failedCount = rows.filter((r) => r.include && r.status === "failed").length;

  async function handleCreate() {
    if (!pendingRows.length || missingProject || missingTitle) return;
    setCreating(true);
    let created = 0;
    let failed = 0;

    await runWithConcurrency(pendingRows, CREATE_CONCURRENCY, async (row) => {
      updateRow(row.key, { status: "creating", error: undefined });
      try {
        const result = await postCreateIssue({
          title: row.title.trim(),
          description: buildBulkDescription(row),
          priority: row.priority,
          slug,
          type: row.type,
          ...(profile?.email && { requestedBy: profile.email }),
          ...(row.projectId && { projectId: row.projectId }),
          ...(row.milestoneId && { projectMilestoneId: row.milestoneId }),
        });
        if (!result.issue?.id) throw new Error("The ticket wasn't created");
        updateRow(row.key, { status: "created", identifier: result.issue.identifier ?? "" });
        if (row.projectId) rememberLastProject(slug, profile?.id, row.projectId);
        created++;
      } catch (err) {
        updateRow(row.key, { status: "failed", error: err instanceof Error ? err.message : "Failed to create" });
        failed++;
      }
    });

    setCreating(false);
    // Land on the first one that needs attention.
    setRows((latest) => {
      const firstFailed = latest.findIndex((r) => r.include && r.status === "failed");
      if (firstFailed >= 0) setIndex(firstFailed);
      return latest;
    });
    if (failed) {
      toast.warning(`Created ${tickets(created)}, ${failed} failed`, {
        description: "Check the ones marked in red and try again.",
      });
    } else {
      toast.success(`Created ${tickets(created)}`);
    }
  }

  // A new analysis replaces the current drafts (and their edits): asked
  // first, inline (same pattern as Log Hours' delete).
  function handleAnalyze() {
    if (rows.length) setConfirming("reanalyze");
    else analyze.mutate();
  }

  // Clears the notes and drafts (here and in the browser).
  function reset() {
    setConfirming(null);
    setStep("paste");
    setNotes("");
    setRows([]);
    setIndex(0);
  }

  // Closing keeps everything: reopening picks up where they left off.
  function handleOpenChange(next: boolean) {
    if (creating || analyze.isPending) return;
    onOpenChange(next);
  }

  function handleDone() {
    reset();
    onOpenChange(false);
  }

  function handleStartOver() {
    if (rows.some((r) => r.status !== "created")) setConfirming("start-over");
    else reset();
  }

  const firstProblem = rows.findIndex((r) => rowProblem(r, projectRequired));

  const allDone = rows.length > 0 && pendingRows.length === 0 && createdCount > 0;
  // Only failed ones left (a retry), or the first run.
  const onlyRetries = failedCount > 0 && failedCount === pendingRows.length;
  const createLabel = onlyRetries ? `Retry ${failedCount} failed` : `Create ${tickets(pendingRows.length)}`;
  const tooLong = notes.length > MAX_BULK_NOTES_CHARS;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* A column that doesn't scroll itself: header on top, the middle
          scrolls, the footer stays below it (a sticky footer inside the
          scrolling dialog let the card show around the buttons). */}
      <DialogContent
        className={`flex flex-col w-[95vw] sm:w-full max-h-[90vh] overflow-hidden transition-all duration-200 ${
          isExpanded ? "sm:max-w-3xl md:max-w-5xl lg:max-w-6xl" : "sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        }`}
      >
        <ExpandableDialogChrome isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded((e) => !e)} />
        <DialogHeader className="pt-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Bulk Import
          </DialogTitle>
          <DialogDescription className="smalltext">
            {step === "paste"
              ? "Paste your notes as they are. AI will split them into tickets and pick the project and milestone for each one. You'll review them before anything is created."
              : `${tickets(rows.length)} found. Go through them with the arrows or the numbers, edit or untick any of them, then create. Closing this keeps your drafts.`}
          </DialogDescription>
        </DialogHeader>

        {step === "paste" && (
          <div className="-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pt-1 pb-1">
            <Label htmlFor="bulk-notes" className="sr-only">
              Notes
            </Label>
            <Textarea
              id="bulk-notes"
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={"- The export button on reports doesn't do anything\n- Would be great to filter the dashboard by region\n- Login is slow on mobile…"}
              className="bg-muted/40 border-0 min-h-[280px] smalltext text-foreground placeholder:text-muted-foreground"
              disabled={analyze.isPending}
            />
            {confirming === "reanalyze" && (
              <InlineConfirm
                message={`Analyzing again replaces the current ${tickets(rows.length)} and your edits.`}
                confirmLabel="Analyze again"
                onCancel={() => setConfirming(null)}
                onConfirm={() => {
                  setConfirming(null);
                  analyze.mutate();
                }}
              />
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {rows.length > 0 && (
                  <Button variant="outline" onClick={() => setStep("review")} disabled={analyze.isPending}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to tickets
                  </Button>
                )}
                <span className={`smalltext ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
                  {notes.length.toLocaleString()} / {MAX_BULK_NOTES_CHARS.toLocaleString()}
                </span>
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={notes.trim().length < 20 || tooLong || analyze.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {analyze.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze notes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "review" && current && (
          <>
            <div className="-mx-6 min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pt-1 pb-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                  aria-label="Previous ticket"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DraftChips rows={rows} index={index} projectRequired={projectRequired} onSelect={goTo} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => goTo(index + 1)}
                  disabled={index >= lastIndex}
                  aria-label="Next ticket"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={addRow}
                  disabled={creating}
                  aria-label="Add a ticket"
                  title="Add a ticket the AI missed"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="ml-auto shrink-0 smalltext text-muted-foreground tabular-nums" aria-live="polite">
                  {Math.min(index, lastIndex) + 1} of {rows.length}
                </span>
              </div>

              <DraftCard
                key={current.key}
                row={current}
                slug={slug}
                projects={projects}
                projectRequired={projectRequired}
                disabled={creating || current.status === "created"}
                wide={isExpanded}
                onChange={(patch) => updateRow(current.key, patch)}
              />
            </div>

            <div className="-mx-6 -mb-6 shrink-0 space-y-3 border-t border-border bg-background px-6 py-3 sm:rounded-b-lg">
              {confirming === "start-over" && (
                <InlineConfirm
                  message="Discard these notes and drafts and start over? Tickets already created stay in Linear."
                  confirmLabel="Start over"
                  onCancel={() => setConfirming(null)}
                  onConfirm={reset}
                />
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                {allDone ? (
                  <>
                    <span className="smalltext text-muted-foreground">
                      {tickets(createdCount)} created.
                    </span>
                    <Button onClick={handleDone}>Done</Button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep("paste")} disabled={creating || createdCount > 0}>
                        Back to notes
                      </Button>
                      <Button variant="ghost" onClick={handleStartOver} disabled={creating}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Start over
                      </Button>
                    </div>
                    <div className="flex flex-col items-stretch gap-1 sm:items-end">
                      {firstProblem >= 0 && (
                        <button
                          type="button"
                          onClick={() => goTo(firstProblem)}
                          className="smalltext text-destructive underline-offset-2 hover:underline text-left sm:text-right"
                        >
                          {missingTitle ? "Every selected ticket needs a title." : "Pick a project for every selected ticket."}{" "}
                          Go to #{firstProblem + 1}
                        </button>
                      )}
                      <Button
                        onClick={handleCreate}
                        disabled={!pendingRows.length || missingProject || missingTitle || creating}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : createLabel}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The portal's inline "are you sure?" (as in Log Hours' delete), instead of
// the browser's confirm().
function InlineConfirm({
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: Readonly<{
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  return (
    <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3" role="alertdialog" aria-label={confirmLabel}>
      <p className="smalltext text-foreground">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="smalltext" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="destructive" className="smalltext" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

// One numbered chip per ticket: where you are, and which ones are created,
// failed, need something, or are left out. Click to jump.
function chipState(row: DraftRow, projectRequired: boolean) {
  if (row.status === "created") return { label: "created", icon: Check, className: "border-success/50 bg-success/15 text-success" };
  if (row.status === "failed" && row.include) {
    return { label: "failed", icon: X, className: "border-destructive/50 bg-destructive/15 text-destructive" };
  }
  if (!row.include) return { label: "left out", icon: null, className: "border-border text-muted-foreground/60 line-through" };
  if (rowProblem(row, projectRequired)) {
    return { label: "needs attention", icon: null, className: "border-warning/60 bg-warning/10 text-warning" };
  }
  return { label: row.type, icon: null, className: "border-border text-foreground" };
}

function DraftChips({
  rows,
  index,
  projectRequired,
  onSelect,
}: Readonly<{
  rows: DraftRow[];
  index: number;
  projectRequired: boolean;
  onSelect: (i: number) => void;
}>) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [index]);

  return (
    <div className="flex min-w-0 gap-1.5 overflow-x-auto py-1 px-0.5" role="tablist" aria-label="Tickets">
      {rows.map((row, i) => {
        const state = chipState(row, projectRequired);
        const Icon = state.icon;
        const active = i === index;
        return (
          <button
            key={row.key}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            title={`${i + 1}. ${row.title || "Untitled"} (${state.label})`}
            className={`flex h-7 min-w-7 shrink-0 items-center justify-center gap-0.5 rounded-md border px-1.5 smalltext tabular-nums transition-colors hover:bg-muted/60 ${state.className} ${
              active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
            }`}
          >
            {i + 1}
            {Icon && <Icon className="h-3 w-3" />}
            {state.label === "needs attention" && <span aria-hidden="true">!</span>}
          </button>
        );
      })}
    </div>
  );
}

function DraftCard({
  row,
  slug,
  projects,
  projectRequired,
  disabled,
  wide,
  onChange,
}: Readonly<{
  row: DraftRow;
  slug: string;
  projects: { id: string; name: string }[];
  projectRequired: boolean;
  disabled: boolean;
  // The dialog is expanded: room for Expected and Actual side by side.
  wide: boolean;
  onChange: (patch: Partial<DraftRow>) => void;
}>) {
  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", row.projectId],
    queryFn: () => fetchMilestones(row.projectId),
    enabled: !!row.projectId,
  });

  const isBug = row.type === "bug";
  const showMissingProject = row.include && projectRequired && !row.projectId && row.status !== "created";
  const editable = row.include && !disabled;

  return (
    <div
      className={`rounded-lg border p-3 space-y-3 ${
        row.status === "failed" ? "border-destructive/50" : "border-border"
      } ${row.include ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={row.include}
          onCheckedChange={(v) => onChange({ include: v === true })}
          disabled={disabled}
          aria-label={`Include "${row.title}"`}
        />
        <Select
          value={row.type}
          onValueChange={(v) => onChange({ type: v as DraftRow["type"] })}
          disabled={!editable}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs md:smalltext" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feature" className="text-xs md:smalltext">
              <span className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-chart-2" /> Feature
              </span>
            </SelectItem>
            <SelectItem value="bug" className="text-xs md:smalltext">
              <span className="flex items-center gap-1.5">
                <Bug className="h-3.5 w-3.5 text-destructive" /> Bug
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1.5 smalltext">
          {row.status === "creating" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          {row.status === "created" && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {row.identifier || "Created"}
            </span>
          )}
          {row.status === "failed" && (
            <span className="flex items-center gap-1 text-destructive" title={row.error}>
              <XCircle className="h-3.5 w-3.5" /> Failed
            </span>
          )}
        </div>
      </div>

      {row.status === "failed" && row.error && <p className="smalltext text-destructive">{row.error}</p>}

      {row.include && row.status !== "created" && (
        <SimilarIssuesHint slug={slug} query={plainSearchText(row.title, row.description)} kind={row.type} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`bulk-title-${row.key}`} className="smalltext">
          Title
        </Label>
        <Input
          id={`bulk-title-${row.key}`}
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={!editable}
          className="bg-muted/40 border-0 smalltext text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`bulk-description-${row.key}`} className="smalltext">
          Description
        </Label>
        <Textarea
          id={`bulk-description-${row.key}`}
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={!editable}
          className="bg-muted/40 border-0 min-h-[70px] smalltext text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {editable && (
        <ListItemsField
          label={
            <span className="smalltext">
              {isBug ? "Steps to Reproduce" : "Criteria"}{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </span>
          }
          items={row.items}
          onChange={(items) => onChange({ items })}
          itemLabel={isBug ? "Step" : "Criterion"}
          placeholderFor={() => (isBug ? "Go to… then click…" : "A way to know it works…")}
          addLabel={isBug ? "Add step" : "Add criterion"}
        />
      )}

      {isBug && editable && (
        <div className={`grid grid-cols-1 gap-3 ${wide ? "lg:grid-cols-2" : ""}`}>
          <div className="space-y-1.5">
            <Label htmlFor={`bulk-expected-${row.key}`} className="smalltext">
              Expected
            </Label>
            <Textarea
              id={`bulk-expected-${row.key}`}
              value={row.expected}
              onChange={(e) => onChange({ expected: e.target.value })}
              className="bg-muted/40 border-0 min-h-[50px] smalltext text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`bulk-actual-${row.key}`} className="smalltext">
              Actual
            </Label>
            <Textarea
              id={`bulk-actual-${row.key}`}
              value={row.actual}
              onChange={(e) => onChange({ actual: e.target.value })}
              className="bg-muted/40 border-0 min-h-[50px] smalltext text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <fieldset disabled={!editable} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <ProjectField
            projects={projects}
            value={row.projectId}
            onValueChange={(projectId) => onChange({ projectId, milestoneId: "" })}
            required={projectRequired}
          />
          {showMissingProject && <p className="mt-1 smalltext text-destructive">Pick a project</p>}
        </div>
        {row.projectId ? (
          <MilestoneField
            milestones={milestones}
            value={row.milestoneId}
            onValueChange={(milestoneId) => onChange({ milestoneId })}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <PriorityField value={row.priority} onValueChange={(v) => onChange({ priority: v as DraftRow["priority"] })} />
      </fieldset>

      {row.sourceExcerpt && (
        <details className="smalltext text-muted-foreground">
          <summary className="cursor-pointer select-none">From your notes</summary>
          <blockquote className="mt-1 border-l-2 border-border pl-2 whitespace-pre-wrap">{row.sourceExcerpt}</blockquote>
        </details>
      )}
    </div>
  );
}
