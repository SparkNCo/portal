"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  RotateCcw,
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  GripVertical,
  Pencil,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "context/UserContext";
import { supabase } from "@/lib/supabase-client";
import { IssueCometChat } from "@/components/chat/CometChat/IssueCometChat";
import { LabelPill } from "./issue-cards";
import { DesignTab } from "./design-tab";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Decision,
  type Test,
  type TestExecution,
  type Issue,
  priorityColors,
  statusColors,
} from "./issues.types";
import { useIssueUpdateBadge } from "./use-issue-update-badge";
import { TestPicker } from "@/components/shared/test-picker";
import { useProxiedImageUrl } from "@/hooks/use-proxied-image-url";

import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { DemoTab } from "./demo-tab";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function ProxiedImage({
  src,
  alt,
  className,
  linkable,
}: {
  readonly src: string | undefined | null;
  readonly alt: string;
  readonly className?: string;
  readonly linkable?: boolean;
}) {
  const resolvedSrc = useProxiedImageUrl(src);
  if (!resolvedSrc) return null;

  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={resolvedSrc} alt={alt} loading="lazy" className={className} />;
  return linkable ? (
    <a href={resolvedSrc} target="_blank" rel="noopener noreferrer">
      {img}
    </a>
  ) : (
    img
  );
}

// Reuses Linear's asset storage (same endpoint FeatureRequestPanel uses for
// attachments) — just uploads a file and returns its public URL, no local DB row.
async function uploadTestAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/upload`,
    {
      method: "POST",
      // No Content-Type here — the browser sets multipart/form-data with the
      // correct boundary on its own.
      headers: API_HEADERS,
      body: formData,
    },
  );
  if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  const { name, url } = await res.json();
  return { name: name as string, url: url as string };
}

// ── Tab button ──────────────────────────────────────────────────────────────

function TabButton({
  label,
  tab,
  activeTab,
  onClick,
  badge,
  className,
}: {
  label: string;
  tab: string;
  activeTab: string;
  onClick: () => void;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-1 smalltext font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${className ?? ""} ${
        activeTab === tab
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-muted text-muted-foreground smalltext px-1.5 py-0.5 font-medium">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Tab components ──────────────────────────────────────────────────────────

function DescriptionTab({
  issue,
  reviewComplete,
  currentStateName,
  advancing,
  onAdvanceState,
}: {
  issue: Issue;
  reviewComplete: boolean;
  currentStateName: string | undefined;
  advancing: boolean;
  onAdvanceState: (targetState: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-h-[320px]">
      {issue.description ? (
        <div
          className="smalltext text-foreground rounded-lg bg-muted/40 px-4 py-3 prose prose-sm prose-invert max-w-none leading-relaxed
          [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2 [&_h1:first-child]:mt-0
          [&_h2]:smalltext [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2:first-child]:mt-0
          [&_h3]:smalltext [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3:first-child]:mt-0
          [&_strong]:font-semibold
          [&_p]:mb-5 [&_p:last-child]:mb-0
          [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-1
          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:block"
        >
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
              img: ({ src, alt }) => (
                <ProxiedImage src={typeof src === "string" ? src : undefined} alt={alt ?? ""} />
              ),
            }}
          >
            {issue.description}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="smalltext text-muted-foreground italic">
          No description yet.
        </p>
      )}

      {currentStateName === "Business Review" && reviewComplete && (
        <Button
          size="sm"
          className="w-full smalltext bg-green-600 hover:bg-green-700 text-white"
          disabled={advancing}
          onClick={() => onAdvanceState("Development")}
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          {advancing ? "Updating…" : "Complete Review"}
        </Button>
      )}

      {currentStateName === "UAT" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 smalltext bg-green-600 hover:bg-green-700 text-white"
            disabled={advancing}
            onClick={() => onAdvanceState("Done")}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {advancing ? "Updating…" : "Approved"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 smalltext"
            disabled={advancing}
            onClick={() => onAdvanceState("QA")}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            {advancing ? "Updating…" : "Fixes Required"}
          </Button>
        </div>
      )}

      {currentStateName === "Done" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full smalltext"
          disabled={advancing}
          onClick={() => onAdvanceState("Development")}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          {advancing ? "Updating…" : "Move back to Development"}
        </Button>
      )}
    </div>
  );
}

function DecisionsTab({
  issue,
  ownerEmail,
  canAnswer,
  canAsk,
  decisions,
  setDecisions,
  loadingDecisions,
}: {
  issue: Issue;
  ownerEmail: string | undefined;
  canAnswer: boolean;
  canAsk: boolean;
  decisions: Decision[];
  setDecisions: React.Dispatch<React.SetStateAction<Decision[]>>;
  loadingDecisions: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showNewQuestionForm, setShowNewQuestionForm] = useState(false);
  const [activeAnswerForm, setActiveAnswerForm] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");

  async function handleCreateQuestion() {
    if (!questionText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            issueId: issue.id,
            question: questionText.trim(),
            ownerEmail,
          }),
        },
      );
      const newDecision = await res.json();
      if (newDecision.id) setDecisions((prev) => [...prev, newDecision]);
      setQuestionText("");
      setShowNewQuestionForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitAnswer(decisionId: string) {
    if (!answerText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/decision`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            decisionId,
            decision: answerText.trim(),
            decisionEmail: ownerEmail,
          }),
        },
      );
      const updated = await res.json();
      if (updated.id) {
        setDecisions((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
      setAnswerText("");
      setActiveAnswerForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3 min-h-[320px]">
      {loadingDecisions && (
        <p className="smalltext text-muted-foreground animate-pulse">Loading…</p>
      )}

      {!loadingDecisions && decisions.length === 0 && (
        <p className="smalltext text-muted-foreground italic">
          {canAnswer
            ? "No questions from your team yet."
            : "No questions asked yet."}
        </p>
      )}

      {decisions.map((d) => (
        <div key={d.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
          <div>
            <p className="smalltext font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              Question
            </p>
            <p className="smalltext text-foreground">{d.question}</p>
          </div>

          {d.decision && (
            <div className="rounded bg-success/10 p-2.5 space-y-0.5">
              <p className="smalltext font-semibold uppercase tracking-wide text-success/70 mb-0.5">
                Decision
              </p>
              <p className="smalltext text-success whitespace-pre-wrap">
                {d.decision}
              </p>
              <p className="smalltext text-success/60">
                {d.decision_by} ·{" "}
                {d.decided_at
                  ? new Date(d.decided_at).toLocaleDateString()
                  : ""}
              </p>
            </div>
          )}

          {canAnswer &&
            !d.decision &&
            (activeAnswerForm === d.id ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  className="w-full rounded border border-border bg-secondary/30 smalltext p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  rows={3}
                  placeholder="Your decision…"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                      handleSubmitAnswer(d.id);
                  }}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActiveAnswerForm(null);
                      setAnswerText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!answerText.trim() || submitting}
                    onClick={() => handleSubmitAnswer(d.id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {submitting ? "Submitting…" : "Submit decision"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setActiveAnswerForm(d.id);
                  setAnswerText("");
                }}
              >
                Submit your decision
              </Button>
            ))}

          {canAsk && !d.decision && (
            <p className="smalltext text-muted-foreground italic">
              Awaiting client decision…
            </p>
          )}
        </div>
      ))}

      {canAsk && (
        <div className="pt-1">
          {showNewQuestionForm ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full rounded-lg border-0 bg-card smalltext text-card-foreground placeholder:text-card-foreground/40 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="Ask the client a question…"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    handleCreateQuestion();
                }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewQuestionForm(false);
                    setQuestionText("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!questionText.trim() || submitting}
                  onClick={handleCreateQuestion}
                >
                  {submitting ? "Saving…" : "Ask question"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowNewQuestionForm(true);
                setQuestionText("");
              }}
            >
              <MessageSquare className="h-3 w-3 mr-1.5" />
              Ask a question
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Steps editor (array of draggable step inputs) ──────────────────────────

type StepDraft = { id: string; text: string };
type UatFormState = { executionId: string; result: string; files: File[] } | null;

// A brand-new test always opens with one blank step already showing, rather
// than an empty list — otherwise there's no input row for "+ Add step" below
// to line up with until the user adds one themselves.
function createEmptyStep(): StepDraft {
  return { id: crypto.randomUUID(), text: "" };
}

function SortableStepRow({
  step,
  index,
  onChange,
  onRemove,
  onEnter,
  inputRef,
}: {
  step: StepDraft;
  index: number;
  onChange: (text: string) => void;
  onRemove: () => void;
  onEnter: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder step"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="w-4 shrink-0 smalltext text-muted-foreground">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <Input
          ref={inputRef}
          className="border-0 bg-secondary smalltext text-card-foreground placeholder:text-card-foreground/40 shadow-none"
          placeholder={`Step ${index + 1}…`}
          value={step.text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove step"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StepsEditor({
  steps,
  onChange,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusStepId, setFocusStepId] = useState<string | null>(null);

  // Runs after the newly-inserted step's row has mounted (same commit as the
  // onChange above), so the ref is already registered by the time this fires.
  useEffect(() => {
    if (!focusStepId) return;
    inputRefs.current.get(focusStepId)?.focus();
    setFocusStepId(null);
  }, [focusStepId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(steps, oldIndex, newIndex));
  }

  // Enter on a step inserts a fresh one right after it and focuses it, so
  // users can keep listing steps without reaching for "+ Add step" each time.
  function insertStepAfter(index: number) {
    const newStep: StepDraft = { id: crypto.randomUUID(), text: "" };
    const next = [...steps];
    next.splice(index + 1, 0, newStep);
    onChange(next);
    setFocusStepId(newStep.id);
  }

  return (
    <div className="space-y-1.5">
      <p className="smalltext font-semibold text-muted-foreground">
        Steps
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={steps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <SortableStepRow
                key={step.id}
                step={step}
                index={i}
                onChange={(text) =>
                  onChange(
                    steps.map((s) => (s.id === step.id ? { ...s, text } : s)),
                  )
                }
                onRemove={() => onChange(steps.filter((s) => s.id !== step.id))}
                onEnter={() => insertStepAfter(i)}
                inputRef={(el) => {
                  if (el) inputRefs.current.set(step.id, el);
                  else inputRefs.current.delete(step.id);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        size="sm"
        variant="outline"
        // Lines the button up with the step inputs above, which are indented
        // past the drag handle (14px) and step number (16px), each followed
        // by a gap-1.5 (6px) — 14 + 6 + 16 + 6 = 42px.
        className="ml-[42px]"
        onClick={() => insertStepAfter(steps.length - 1)}
      >
        + Add step
      </Button>
    </div>
  );
}

function TestUatSection({
  execution,
  isQaStage,
  isUatStage,
  canRecordResult,
  uatForm,
  setUatForm,
  uatFileInputRef,
  submitting,
  onSubmitUat,
}: {
  execution: TestExecution;
  isQaStage: boolean;
  isUatStage: boolean;
  canRecordResult: boolean;
  uatForm: UatFormState;
  setUatForm: React.Dispatch<React.SetStateAction<UatFormState>>;
  uatFileInputRef: React.RefObject<HTMLInputElement>;
  submitting: boolean;
  onSubmitUat: () => void;
}) {
  const hasUatRecord = execution.results?.some((entry) => entry.kind === "uat");
  const alreadyRecordedUat = isUatStage && hasUatRecord;
  const statusAllowsRecording =
    execution.status === "approved" ||
    (isQaStage && (execution.status === "draft" || execution.status === "passed"));

  if (!canRecordResult || !statusAllowsRecording) return null;

  if (alreadyRecordedUat) {
    return (
      <p className="smalltext text-muted-foreground italic">
        UAT result already recorded.
      </p>
    );
  }

  if (uatForm?.executionId !== execution.id) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setUatForm({ executionId: execution.id, result: "", files: [] })}
      >
        {isQaStage ? "Record QA" : "Record UAT"}
      </Button>
    );
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setUatForm((f) => (f ? { ...f, files: [...f.files, ...files] } : f));
    e.target.value = "";
  }

  function handleRemoveFile(index: number) {
    setUatForm((f) =>
      f ? { ...f, files: f.files.filter((_, fi) => fi !== index) } : f,
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        className="w-full rounded-lg border border-border bg-card smalltext p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-black placeholder:text-black/40"
        rows={2}
        placeholder="Describe what actually happened…"
        value={uatForm.result}
        onChange={(e) => setUatForm({ ...uatForm, result: e.target.value })}
        autoFocus
      />
      <input
        ref={uatFileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => uatFileInputRef.current?.click()}
      >
        <Paperclip className="h-3.5 w-3.5 mr-1.5" />
        Attach files
      </Button>
      {uatForm.files.length > 0 && (
        <div className="space-y-1">
          {uatForm.files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded border border-border bg-secondary/30 px-2 py-1"
            >
              <span className="truncate smalltext text-foreground">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveFile(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setUatForm(null)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!uatForm.result.trim() || submitting}
          onClick={onSubmitUat}
        >
          {submitting ? "Saving…" : isQaStage ? "Save QA" : "Save UAT"}
        </Button>
      </div>
    </div>
  );
}

function TestsTab({
  issue,
  projectSlug,
  userEmail,
  canAnswer,
  canRecordQaEvidence,
  canRecordUatResult,
  role,
  currentStateName,
  executions,
  setExecutions,
  loadingExecutions,
}: {
  issue: Issue;
  // Which customer/initiative this ticket belongs to — scopes the "pick an existing
  // test" search so one customer's tests never show up on another's tickets.
  projectSlug: string | undefined;
  userEmail: string | undefined;
  canAnswer: boolean;
  canRecordQaEvidence: boolean;
  canRecordUatResult: boolean;
  role: string | undefined;
  currentStateName: string | undefined;
  executions: TestExecution[];
  setExecutions: React.Dispatch<React.SetStateAction<TestExecution[]>>;
  loadingExecutions: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  // Adding a test is a 3-way branch: closed, filling out a brand-new test's
  // title/steps/expected, or setting the expected behaviour for a picked existing test.
  const [showNewTestForm, setShowNewTestForm] = useState(false);
  const [testForm, setTestForm] = useState<{
    title: string;
    steps: StepDraft[];
    expected: string;
  }>({
    title: "",
    steps: [createEmptyStep()],
    expected: "",
  });
  const [pendingExisting, setPendingExisting] = useState<{
    test: Test;
    expected: string;
    steps: StepDraft[];
  } | null>(null);
  const [uatForm, setUatForm] = useState<UatFormState>(null);
  const uatFileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<{
    executionId: string;
    testId: string;
    title: string;
    steps: StepDraft[];
    expected: string;
  } | null>(null);

  // Developers can author/edit test cases while the issue is being scoped, built, or QA'd,
  // not once it's gone to the client for UAT.
  const canManageTests =
    role === "admin" ||
    (role === "developer" &&
      (currentStateName === "Business Review" ||
        currentStateName === "Development" ||
        currentStateName === "QA"));
  // Deleting is more destructive than the edit/create flows above (it also tries to
  // remove the underlying reusable Test, not just this ticket's attachment of it) —
  // restricted to admins only, regardless of ticket stage.
  const isAdmin = role === "admin";
  const isQaStage = currentStateName === "QA";
  const isUatStage = currentStateName === "UAT";

  // QA Evidence is recorded by developers while in QA; UAT Result is recorded
  // by the client (customer/stakeholder) once it's moved to UAT.
  const canRecordResult =
    (isQaStage && canRecordQaEvidence) || (isUatStage && canRecordUatResult);

  // "Create new" flow: POST /tests to create the reusable test, then POST
  // /test-executions to attach it to this ticket.
  async function handleCreateTest() {
    if (!testForm.title.trim() || !projectSlug || submitting) return;
    setSubmitting(true);
    try {
      const steps = testForm.steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .map((d, i) => ({ order: i + 1, description: d }));
      const testRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            project_slug: projectSlug,
            title: testForm.title.trim(),
            steps,
            created_by: userEmail,
          }),
        },
      );
      const test = await testRes.json();
      if (!test.id) return;

      const created = await attachTest(test, testForm.expected.trim());
      if (created) setExecutions((prev) => [...prev, created]);

      setTestForm({ title: "", steps: [createEmptyStep()], expected: "" });
      setShowNewTestForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Picking an existing test starts the "expected" field blank (it's per-ticket, not
  // stored on the reusable Test) — so pull the most recent value used for this test on
  // any other ticket as a starting point, editable before attaching.
  async function handleSelectExisting(test: Test) {
    setPendingExisting({
      test,
      expected: "",
      steps: test.steps.map((s) => ({ id: crypto.randomUUID(), text: s.description })),
    });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions?test_id=${test.id}`,
      { headers: API_HEADERS },
    );
    if (!res.ok) return;
    const latest = await res.json();
    if (latest?.expected) {
      setPendingExisting((p) => (p && p.test.id === test.id ? { ...p, expected: latest.expected } : p));
    }
  }

  // "Pick existing" flow: just attach it — the test itself already exists.
  async function attachTest(test: Test, expected: string): Promise<TestExecution | null> {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions`,
      {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({
          test_id: test.id,
          issue_id: issue.id,
          expected,
          created_by: userEmail,
        }),
      },
    );
    const created = await res.json();
    if (!created.id) return null;
    return { ...created, test: { title: test.title, steps: test.steps } };
  }

  async function handleAttachExisting() {
    if (!pendingExisting || submitting) return;
    setSubmitting(true);
    try {
      let test = pendingExisting.test;
      // Steps are only editable here while the test has never passed on another
      // ticket (same rule PATCH /tests/update enforces) — only PATCH when they
      // actually changed, to avoid a no-op write on every attach.
      const editedSteps = pendingExisting.steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .map((d, i) => ({ order: i + 1, description: d }));
      const stepsChanged =
        !test.last_passed_execution_id &&
        JSON.stringify(editedSteps) !==
          JSON.stringify(test.steps.map((s) => ({ order: s.order, description: s.description })));

      if (stepsChanged) {
        const testRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/update`,
          {
            method: "PATCH",
            headers: API_JSON_HEADERS,
            body: JSON.stringify({ test_id: test.id, title: test.title, steps: editedSteps }),
          },
        );
        const updatedTest = await testRes.json();
        if (updatedTest.id) test = updatedTest;
      }

      const created = await attachTest(test, pendingExisting.expected.trim());
      if (created) setExecutions((prev) => [...prev, created]);
      setPendingExisting(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartEdit(execution: TestExecution) {
    if (!execution.test) return;
    setEditForm({
      executionId: execution.id,
      testId: execution.test_id,
      title: execution.test.title,
      steps: execution.test.steps.map((s) => ({
        id: crypto.randomUUID(),
        text: s.description,
      })),
      expected: execution.expected,
    });
  }

  // Edits route to two different tables: title/steps belong to the reusable Test,
  // expected behaviour belongs to this ticket's execution.
  async function handleSaveEdit() {
    if (!editForm || !editForm.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const steps = editForm.steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .map((d, i) => ({ order: i + 1, description: d }));

      const [testRes, executionRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/update`, {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            test_id: editForm.testId,
            title: editForm.title.trim(),
            steps,
          }),
        }),
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions/update`, {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            execution_id: editForm.executionId,
            expected: editForm.expected.trim(),
          }),
        }),
      ]);
      const updatedTest = await testRes.json();
      const updatedExecution = await executionRes.json();

      if (updatedExecution.id) {
        setExecutions((prev) =>
          prev.map((e) =>
            e.id === updatedExecution.id
              ? {
                  ...updatedExecution,
                  test: updatedTest.id
                    ? { title: updatedTest.title, steps: updatedTest.steps }
                    : e.test,
                }
              : e,
          ),
        );
      }
      setEditForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveTest(executionId: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions/approve`,
      {
        method: "PATCH",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ execution_id: executionId, approved_by: userEmail }),
      },
    );
    const updated = await res.json();
    if (updated.id)
      setExecutions((prev) =>
        prev.map((e) => (e.id === updated.id ? { ...e, ...updated, test: e.test } : e)),
      );
  }

  async function handleSubmitUat() {
    if (!uatForm || submitting) return;
    setSubmitting(true);
    try {
      const attachments = await Promise.all(
        uatForm.files.map(uploadTestAttachment),
      );
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions/result`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            execution_id: uatForm.executionId,
            result: uatForm.result,
            recorded_by: userEmail,
            kind: isQaStage ? "qa" : "uat",
            attachments,
          }),
        },
      );
      const updated = await res.json();
      if (updated.id)
        setExecutions((prev) =>
          prev.map((e) => (e.id === updated.id ? { ...e, ...updated, test: e.test } : e)),
        );
      setUatForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  // Admin-only. Detaches the test from this ticket, then best-effort deletes the
  // underlying reusable Test too — the backend refuses that second step (silently,
  // here) when the test is still attached to other tickets, which is expected and
  // fine: this ticket's attachment is gone either way.
  async function handleDeleteExecution(execution: TestExecution) {
    if (!isAdmin || submitting) return;
    if (!window.confirm(`Delete "${execution.test?.title ?? "this test"}" from this ticket? This can't be undone.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions?execution_id=${execution.id}`,
        { method: "DELETE", headers: API_HEADERS },
      );
      if (!res.ok) {
        toast.error("Failed to delete test case. Please try again.");
        return;
      }
      setExecutions((prev) => prev.filter((e) => e.id !== execution.id));
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests?test_id=${execution.test_id}`,
        { method: "DELETE", headers: API_HEADERS },
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePassed(execution: TestExecution) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions/result`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            execution_id: execution.id,
            passed: execution.status !== "passed",
          }),
        },
      );
      const updated = await res.json();
      if (updated.id)
        setExecutions((prev) =>
          prev.map((e) => (e.id === updated.id ? { ...e, ...updated, test: e.test } : e)),
        );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3 min-h-[320px]">
      {loadingExecutions && (
        <p className="smalltext text-muted-foreground animate-pulse">Loading…</p>
      )}

      {!loadingExecutions && executions.length === 0 && (
        <p className="smalltext text-muted-foreground italic">
          No test cases yet.
        </p>
      )}

      {executions.map((e) => (
        <div key={e.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="smalltext font-medium text-foreground">{e.test?.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {canManageTests &&
                e.status === "draft" &&
                editForm?.executionId !== e.id && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(e)}
                    className="rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-background"
                    aria-label="Edit test case"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              {isAdmin && editForm?.executionId !== e.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteExecution(e)}
                  disabled={submitting}
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-background disabled:opacity-50"
                  aria-label="Delete test case"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <span
                className={`smalltext px-1.5 py-0.5 rounded font-semibold ${
                  e.status === "passed"
                    ? "bg-success/20 text-success"
                    : e.status === "failed"
                      ? "bg-destructive/20 text-destructive"
                      : e.status === "approved"
                        ? "bg-chart-1/20 text-chart-1"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {e.status}
              </span>
            </div>
          </div>

          {editForm?.executionId === e.id ? (
            <div className="flex flex-col gap-2">
              <div className="space-y-1.5">
                <p className="smalltext font-semibold text-muted-foreground">
                  Title
                </p>
                <Input
                  className="border-0 bg-secondary smalltext text-card-foreground placeholder:text-card-foreground/40 shadow-none"
                  placeholder="Test case title…"
                  value={editForm.title}
                  onChange={(ev) =>
                    setEditForm({ ...editForm, title: ev.target.value })
                  }
                  autoFocus
                />
              </div>
              <StepsEditor
                steps={editForm.steps}
                onChange={(steps) => setEditForm({ ...editForm, steps })}
              />
              <div className="space-y-1.5">
                <p className="smalltext font-semibold text-muted-foreground">
                  Expected Result
                </p>
                <textarea
                  className="w-full rounded-lg border border-border bg-secondary/30 smalltext text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Expected result…"
                  value={editForm.expected}
                  onChange={(ev) =>
                    setEditForm({ ...editForm, expected: ev.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditForm(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!editForm.title.trim() || submitting}
                  onClick={handleSaveEdit}
                >
                  {submitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {e.test && e.test.steps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="smalltext font-semibold text-muted-foreground">
                    Steps
                  </p>
                  <div className="space-y-1.5">
                    {e.test.steps.map((s) => (
                      <div key={s.order} className="flex items-center gap-1.5">
                        <span className="w-4 shrink-0 smalltext text-muted-foreground">
                          {s.order}.
                        </span>
                        <p className="flex-1 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 smalltext text-black">
                          {s.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {e.expected && (
                <div>
                  <p className="smalltext font-semibold text-muted-foreground mb-0.5">
                    Expected
                  </p>
                  <p className="smalltext text-foreground">{e.expected}</p>
                </div>
              )}
            </>
          )}

          {e.results && e.results.length > 0 && (
            <div className="space-y-2">
              {e.results.map((entry, i) => (
                <div
                  key={`${entry.recorded_at}-${i}`}
                  className="border-l-2 border-border pl-2"
                >
                  <p className="smalltext font-semibold text-muted-foreground mb-0.5">
                    {entry.kind === "qa"
                      ? "QA Evidence"
                      : entry.kind === "uat"
                        ? "UAT Result"
                        : "Actual"}
                  </p>
                  <p className="smalltext text-foreground">{entry.text}</p>
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.attachments.map((att, ai) =>
                        IMAGE_EXT_RE.test(att.name) ? (
                          <ProxiedImage
                            key={ai}
                            src={att.url}
                            alt={att.name}
                            className="h-14 w-14 rounded border border-border object-cover"
                            linkable
                          />
                        ) : (
                          <a
                            key={ai}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded border border-border bg-secondary/30 px-2 py-1 smalltext text-foreground hover:bg-secondary"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.name}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                  {(entry.recorded_by || entry.recorded_at) && (
                    <p className="smalltext text-muted-foreground mt-0.5">
                      {entry.recorded_by}
                      {entry.recorded_by && entry.recorded_at ? " · " : ""}
                      {entry.recorded_at
                        ? new Date(entry.recorded_at).toLocaleString()
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {canAnswer && e.status === "draft" && editForm?.executionId !== e.id && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => handleApproveTest(e.id)}
            >
              Approve test case
            </Button>
          )}

          <TestUatSection
            execution={e}
            isQaStage={isQaStage}
            isUatStage={isUatStage}
            canRecordResult={canRecordResult}
            uatForm={uatForm}
            setUatForm={setUatForm}
            uatFileInputRef={uatFileInputRef}
            submitting={submitting}
            onSubmitUat={handleSubmitUat}
          />

          {(role === "stakeholder" || role === "customer") &&
            (e.status === "approved" || e.status === "passed") &&
            currentStateName === "UAT" &&
            (e.status === "passed" ||
              e.results?.some((entry) => entry.kind === "uat")) && (
              <Button
                size="sm"
                variant={e.status === "passed" ? "outline" : "default"}
                disabled={submitting}
                className={
                  e.status === "passed"
                    ? "w-full"
                    : "w-full bg-green-600 hover:bg-green-700 text-white"
                }
                onClick={() => handleTogglePassed(e)}
              >
                {e.status === "passed"
                  ? "Revert to Approved"
                  : "Mark as Passed"}
              </Button>
            )}
        </div>
      ))}

      {canManageTests && projectSlug && (
        <div className="pt-1">
          {showNewTestForm ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 space-y-2">
              <div className="space-y-1.5">
                <p className="smalltext font-semibold text-muted-foreground">
                  Title
                </p>
                <Input
                  className="border-0 bg-secondary smalltext text-card-foreground placeholder:text-card-foreground/40 shadow-none"
                  placeholder="Test case title…"
                  value={testForm.title}
                  onChange={(ev) =>
                    setTestForm((f) => ({ ...f, title: ev.target.value }))
                  }
                  autoFocus
                />
              </div>
              <StepsEditor
                steps={testForm.steps}
                onChange={(steps) => setTestForm((f) => ({ ...f, steps }))}
              />
              <div className="space-y-1.5">
                <p className="smalltext font-semibold text-muted-foreground">
                  Expected Result
                </p>
                <textarea
                  className="w-full rounded-lg border-0 bg-secondary smalltext text-card-foreground placeholder:text-card-foreground/40 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Expected result…"
                  value={testForm.expected}
                  onChange={(ev) =>
                    setTestForm((f) => ({ ...f, expected: ev.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewTestForm(false);
                    setTestForm({ title: "", steps: [createEmptyStep()], expected: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!testForm.title.trim() || submitting}
                  onClick={handleCreateTest}
                >
                  {submitting ? "Saving…" : "Add test case"}
                </Button>
              </div>
            </div>
          ) : pendingExisting ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 space-y-2">
              <p className="smalltext font-medium text-foreground">
                {pendingExisting.test.title}
              </p>
              {pendingExisting.test.last_passed_execution_id ? (
                pendingExisting.test.steps.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingExisting.test.steps.map((s) => (
                      <div key={s.order} className="flex items-center gap-1.5">
                        <span className="w-4 shrink-0 smalltext text-muted-foreground">
                          {s.order}.
                        </span>
                        <p className="flex-1 rounded-lg border-0 bg-card/90 px-2.5 py-1.5 smalltext text-black">
                          {s.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <StepsEditor
                  steps={pendingExisting.steps}
                  onChange={(steps) => setPendingExisting((p) => (p ? { ...p, steps } : p))}
                />
              )}
              <div className="space-y-1.5">
                <p className="smalltext font-semibold text-muted-foreground">
                  Expected Result on This Ticket
                </p>
                <textarea
                  className="w-full rounded-lg border-0 bg-secondary smalltext text-card-foreground placeholder:text-card-foreground/40 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Expected result…"
                  value={pendingExisting.expected}
                  onChange={(ev) =>
                    setPendingExisting((p) => (p ? { ...p, expected: ev.target.value } : p))
                  }
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setPendingExisting(null)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={submitting} onClick={handleAttachExisting}>
                  {submitting ? "Saving…" : "Attach test case"}
                </Button>
              </div>
            </div>
          ) : (
            <TestPicker
              projectSlug={projectSlug}
              onSelectExisting={handleSelectExisting}
              onCreateNew={(title) => {
                setTestForm({ title, steps: [createEmptyStep()], expected: "" });
                setShowNewTestForm(true);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function IssueDetailModal({
  issue,
  slug,
  onClose,
}: {
  issue: Issue;
  // Which customer this issue belongs to — passed through to the Chat tab.
  slug?: string;
  onClose: () => void;
}) {
  const { profile } = useUser();
  const role = profile?.role;
  const canAnswer = role === "customer" || role === "stakeholder";
  const canAsk = role === "developer" || role === "admin";
  // QA Evidence (developer, during QA) and UAT Result (customer/stakeholder, during UAT)
  // are two distinct recording steps — see TestsTab.
  const canRecordQaEvidence = role === "developer";
  const canRecordUatResult = role === "customer" || role === "stakeholder";

  const [visible, setVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "description" | "chat" | "decisions" | "tests" | "design" | "demo"
  >("description");

  // "Business Review" is complete once every question raised has an answer
  // (or none were raised at all) — that's what unlocks "Complete Review".
  const reviewComplete =
    !loadingDecisions && decisions.every((d) => d.decision != null);

  // Bug tickets don't go through design — the Design tab isn't relevant for them.
  const isBugIssue =
    issue.labels?.nodes?.some((l) => l.name?.toLowerCase() === "bug") ?? false;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setLoadingDecisions(true);
    setLoadingExecutions(true);

    supabase
      .schema("portal")
      .from("decisions")
      .select("*")
      .eq("issue_id", issue.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setDecisions(data as Decision[]);
        setLoadingDecisions(false);
      });

    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/test-executions?issue_id=${issue.id}`,
      {
        headers: API_HEADERS,
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setExecutions(data);
      })
      .finally(() => setLoadingExecutions(false));
  }, [issue.id]);

  const queryClient = useQueryClient();
  const { isOwnUnseenUpdate } = useIssueUpdateBadge();
  const seenMarkedForIssueRef = useRef<string | null>(null);

  // Fires once per issue.id (not on every render): isOwnUnseenUpdate is
  // intentionally left out of the deps array — it's a fresh function
  // reference every time portal.issue_views refetches (viewed_at always
  // changes), and marking seen here itself triggers that refetch, so
  // depending on it re-fires this effect forever instead of once.
  useEffect(() => {
    if (!profile?.id || seenMarkedForIssueRef.current === issue.id) return;
    if (isOwnUnseenUpdate(issue, profile?.email)) return;

    seenMarkedForIssueRef.current = issue.id;

    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/seen`, {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issueId: issue.id, userId: profile.id }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["issue-views", profile.id] });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id, profile?.id]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  async function handleAdvanceState(targetState: string) {
    if (!targetState || targetState === currentStateName || advancing) return;
    setAdvancing(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ issueId: issue.id, stateName: targetState }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setCurrentStateName(targetState as NonNullable<Issue["state"]>["name"]);
        // Refetch every issue list this ticket could appear in — otherwise
        // closing and reopening the modal re-mounts it with the stale
        // `issue` prop from the cached list, showing the old state again
        // and letting the same transition be triggered a second time.
        queryClient.invalidateQueries({
          predicate: (query) =>
            ["linear-issues", "linear-issues-developer", "roadmap"].includes(
              query.queryKey[0] as string,
            ),
        });
      }
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        visible
          ? "bg-black/60 backdrop-blur-sm"
          : "bg-transparent backdrop-blur-none"
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
        aria-label="Close modal"
      />
      <div
        className={`relative z-10 bg-background border border-border rounded-2xl shadow-2xl w-[95vw] sm:w-full mx-auto sm:mx-6 flex flex-col max-h-[90vh] transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-3xl md:max-w-5xl lg:max-w-6xl sm:max-h-[92vh]"
            : "sm:max-w-xl md:max-w-2xl lg:max-w-3xl sm:max-h-[85vh]"
        } ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="smalltext font-mono text-muted-foreground">
                {issue.branchName.slice(0, 7).toUpperCase()}
              </span>
              <Badge
                variant="outline"
                className={`smalltext ${
                  priorityColors[
                    issue.priorityLabel as keyof typeof priorityColors
                  ]
                }`}
              >
                {issue.priorityLabel}
              </Badge>
              <Badge
                variant="secondary"
                className={`smalltext ${
                  statusColors[currentStateName as keyof typeof statusColors]
                }`}
              >
                {currentStateName}
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {issue.labels?.nodes?.map((l) => (
                <LabelPill key={l.id} label={l} iconOnly />
              ))}
              <h2 className="text-base font-semibold leading-snug">
                {issue.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <button
              onClick={() => setIsExpanded((e) => !e)}
              className="hidden lg:inline-flex text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isExpanded ? "Shrink modal" : "Expand modal"}
              title={isExpanded ? "Shrink" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab bar — wraps to a second row on narrow screens instead of
            overflowing/scrolling horizontally. */}
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 border-b border-border px-5 flex-shrink-0">
          <TabButton
            label="Description"
            tab="description"
            activeTab={activeTab}
            onClick={() => setActiveTab("description")}
          />
          <TabButton
            label="Chat"
            tab="chat"
            activeTab={activeTab}
            onClick={() => setActiveTab("chat")}
          />
          <TabButton
            label="Tests"
            tab="tests"
            activeTab={activeTab}
            onClick={() => setActiveTab("tests")}
            badge={executions.length}
          />
          <TabButton
            label="Decisions"
            tab="decisions"
            activeTab={activeTab}
            onClick={() => setActiveTab("decisions")}
            badge={decisions.length}
          />
          {!isBugIssue && (
            <TabButton
              label="Design"
              tab="design"
              activeTab={activeTab}
              onClick={() => setActiveTab("design")}
            />
          )}
          {!isBugIssue && (
            <TabButton
              label="Demo"
              tab="demo"
              activeTab={activeTab}
              onClick={() => setActiveTab("demo")}
            />
          )}
        </div>

        {activeTab === "description" && (
          <DescriptionTab
            issue={issue}
            reviewComplete={reviewComplete}
            currentStateName={currentStateName}
            advancing={advancing}
            onAdvanceState={handleAdvanceState}
          />
        )}

        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-[320px]">
            <IssueCometChat issueId={issue.id} issueTitle={issue.title} slug={slug} />
          </div>
        )}

        {activeTab === "decisions" && (
          <DecisionsTab
            issue={issue}
            ownerEmail={profile?.email}
            canAnswer={canAnswer}
            canAsk={canAsk}
            decisions={decisions}
            setDecisions={setDecisions}
            loadingDecisions={loadingDecisions}
          />
        )}

        {activeTab === "tests" && (
          <TestsTab
            issue={issue}
            projectSlug={slug}
            userEmail={profile?.email}
            canAnswer={canAnswer}
            canRecordQaEvidence={canRecordQaEvidence}
            canRecordUatResult={canRecordUatResult}
            role={role}
            currentStateName={currentStateName}
            executions={executions}
            setExecutions={setExecutions}
            loadingExecutions={loadingExecutions}
          />
        )}

        {activeTab === "design" && !isBugIssue && <DesignTab issue={issue} />}

        {activeTab === "demo" && !isBugIssue && <DemoTab issue={issue} />}
      </div>
    </div>
  );
}
