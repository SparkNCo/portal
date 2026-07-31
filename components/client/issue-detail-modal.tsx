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
} from "lucide-react";
import { Button } from "@/components/components/ui/button";
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
  type TestCase,
  type Issue,
  priorityColors,
  statusColors,
} from "./issues.types";
import { useIssueUpdateBadge } from "./use-issue-update-badge";

import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { DemoTab } from "./demo-tab";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

// Linear-hosted attachments (issue description images, UAT/QA evidence)
// require Linear's own API key to view — portal users don't have a Linear
// account, so their browser can't load these URLs directly. Route them
// through our backend proxy, which fetches with our key instead.
const LINEAR_UPLOAD_HOST = "uploads.linear.app";

function toProxiedImageUrl(url: string | undefined | null) {
  if (!url) return url ?? undefined;

  try {
    if (new URL(url).hostname !== LINEAR_UPLOAD_HOST) return url;
  } catch {
    return url;
  }

  // A plain <img> can't send the `apikey`/Authorization headers every other
  // request uses, so pass the anon key as a query param instead — Supabase's
  // gateway accepts it either way, and this key is already public (it's in
  // every fetch call's headers, visible in the network tab regardless).
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/linear-image-proxy?url=${encodeURIComponent(url)}&apikey=${apikey}`;
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
      className={`py-2.5 px-1 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${className ?? ""} ${
        activeTab === tab
          ? "border-accent text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 font-medium">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Tab components ──────────────────────────────────────────────────────────

function DescriptionTab({
  issue,
  canAnswer,
  reviewComplete,
  canReopenFromDone,
  currentStateName,
  advancing,
  onAdvanceState,
}: {
  issue: Issue;
  canAnswer: boolean;
  reviewComplete: boolean;
  canReopenFromDone: boolean;
  currentStateName: string | undefined;
  advancing: boolean;
  onAdvanceState: (targetState: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-h-[320px]">
      {issue.description ? (
        <div
          className="text-sm text-foreground rounded-lg bg-muted/40 px-4 py-3 prose prose-sm prose-invert max-w-none leading-relaxed
          [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2 [&_h1:first-child]:mt-0
          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2:first-child]:mt-0
          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3:first-child]:mt-0
          [&_strong]:font-semibold
          [&_p]:mb-5 [&_p:last-child]:mb-0
          [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-1
          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:block"
        >
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
              img: ({ src, alt, ...props }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  {...props}
                  src={toProxiedImageUrl(typeof src === "string" ? src : undefined)}
                  alt={alt ?? ""}
                  loading="lazy"
                />
              ),
            }}
          >
            {issue.description}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No description yet.
        </p>
      )}

      {canAnswer &&
        currentStateName === "Business Review" &&
        reviewComplete && (
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={advancing}
            onClick={() => onAdvanceState("Development")}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {advancing ? "Updating…" : "Complete Review"}
          </Button>
        )}

      {canAnswer && currentStateName === "UAT" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            disabled={advancing}
            onClick={() => onAdvanceState("Done")}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {advancing ? "Updating…" : "Approved"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={advancing}
            onClick={() => onAdvanceState("QA")}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            {advancing ? "Updating…" : "Fixes Required"}
          </Button>
        </div>
      )}

      {canReopenFromDone && currentStateName === "Done" && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
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
        <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
      )}

      {!loadingDecisions && decisions.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {canAnswer
            ? "No questions from your team yet."
            : "No questions asked yet."}
        </p>
      )}

      {decisions.map((d) => (
        <div key={d.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              Question
            </p>
            <p className="text-sm text-foreground">{d.question}</p>
          </div>

          {d.decision && (
            <div className="rounded bg-success/10 p-2.5 space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-success/70 mb-0.5">
                Decision
              </p>
              <p className="text-xs text-success whitespace-pre-wrap">
                {d.decision}
              </p>
              <p className="text-[10px] text-success/60">
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
                  className="w-full rounded border border-border bg-secondary/30 text-sm p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
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
            <p className="text-[10px] text-muted-foreground italic">
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
                className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
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
type UatFormState = { testId: string; actual: string; files: File[] } | null;

function SortableStepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  onChange: (text: string) => void;
  onRemove: () => void;
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
      <span className="w-4 shrink-0 text-[10px] text-muted-foreground">
        {index + 1}.
      </span>
      <input
        className="flex-1 rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={`Step ${index + 1}…`}
        value={step.text}
        onChange={(e) => onChange(e.target.value)}
      />
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(steps, oldIndex, newIndex));
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([...steps, { id: crypto.randomUUID(), text: "" }])
        }
      >
        + Add step
      </Button>
    </div>
  );
}

function TestUatSection({
  test,
  isQaStage,
  isUatStage,
  canRecordResult,
  uatForm,
  setUatForm,
  uatFileInputRef,
  submitting,
  onSubmitUat,
}: {
  test: TestCase;
  isQaStage: boolean;
  isUatStage: boolean;
  canRecordResult: boolean;
  uatForm: UatFormState;
  setUatForm: React.Dispatch<React.SetStateAction<UatFormState>>;
  uatFileInputRef: React.RefObject<HTMLInputElement>;
  submitting: boolean;
  onSubmitUat: () => void;
}) {
  const hasUatRecord = test.actual?.some((entry) => entry.kind === "uat");
  const alreadyRecordedUat = isUatStage && hasUatRecord;
  const statusAllowsRecording =
    test.status === "approved" ||
    (isQaStage && (test.status === "draft" || test.status === "passed"));

  if (!canRecordResult || !statusAllowsRecording) return null;

  if (alreadyRecordedUat) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        UAT result already recorded.
      </p>
    );
  }

  if (uatForm?.testId !== test.id) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setUatForm({ testId: test.id, actual: "", files: [] })}
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
        className="w-full rounded-lg border border-border bg-secondary/30 text-sm p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
        rows={2}
        placeholder="Describe what actually happened…"
        value={uatForm.actual}
        onChange={(e) => setUatForm({ ...uatForm, actual: e.target.value })}
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
              <span className="truncate text-[11px] text-foreground">
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
          disabled={!uatForm.actual.trim() || submitting}
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
  userEmail,
  canAnswer,
  canRecordQaEvidence,
  canRecordUatResult,
  role,
  currentStateName,
  tests,
  setTests,
  loadingTests,
}: {
  issue: Issue;
  userEmail: string | undefined;
  canAnswer: boolean;
  canRecordQaEvidence: boolean;
  canRecordUatResult: boolean;
  role: string | undefined;
  currentStateName: string | undefined;
  tests: TestCase[];
  setTests: React.Dispatch<React.SetStateAction<TestCase[]>>;
  loadingTests: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showNewTestForm, setShowNewTestForm] = useState(false);
  const [testForm, setTestForm] = useState<{
    title: string;
    steps: StepDraft[];
    expected: string;
  }>({
    title: "",
    steps: [],
    expected: "",
  });
  const [uatForm, setUatForm] = useState<UatFormState>(null);
  const uatFileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<{
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
  const isQaStage = currentStateName === "QA";
  const isUatStage = currentStateName === "UAT";

  // QA Evidence is recorded by developers while in QA; UAT Result is recorded
  // by the client (customer/stakeholder) once it's moved to UAT.
  const canRecordResult =
    (isQaStage && canRecordQaEvidence) || (isUatStage && canRecordUatResult);

  async function handleCreateTest() {
    if (!testForm.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const steps = testForm.steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .map((d, i) => ({ order: i + 1, description: d }));
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            issue_id: issue.id,
            title: testForm.title.trim(),
            steps,
            expected: testForm.expected.trim(),
            created_by: userEmail,
          }),
        },
      );
      const created = await res.json();
      if (created.id) setTests((prev) => [...prev, created]);
      setTestForm({ title: "", steps: [], expected: "" });
      setShowNewTestForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartEdit(test: TestCase) {
    setEditForm({
      testId: test.id,
      title: test.title,
      steps: test.steps.map((s) => ({
        id: crypto.randomUUID(),
        text: s.description,
      })),
      expected: test.expected,
    });
  }

  async function handleSaveEdit() {
    if (!editForm || !editForm.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const steps = editForm.steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .map((d, i) => ({ order: i + 1, description: d }));
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/update`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            test_id: editForm.testId,
            title: editForm.title.trim(),
            steps,
            expected: editForm.expected.trim(),
          }),
        },
      );
      const updated = await res.json();
      if (updated.id)
        setTests((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      setEditForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveTest(testId: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/approve`,
      {
        method: "PATCH",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ test_id: testId, approved_by: userEmail }),
      },
    );
    const updated = await res.json();
    if (updated.id)
      setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function handleSubmitUat() {
    if (!uatForm || submitting) return;
    setSubmitting(true);
    try {
      const attachments = await Promise.all(
        uatForm.files.map(uploadTestAttachment),
      );
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/uat`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            test_id: uatForm.testId,
            actual: uatForm.actual,
            recorded_by: userEmail,
            kind: isQaStage ? "qa" : "uat",
            attachments,
          }),
        },
      );
      const updated = await res.json();
      if (updated.id)
        setTests((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      setUatForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePassed(test: TestCase) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/uat`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            test_id: test.id,
            passed: test.status !== "passed",
          }),
        },
      );
      const updated = await res.json();
      if (updated.id)
        setTests((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3 min-h-[320px]">
      {loadingTests && (
        <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
      )}

      {!loadingTests && tests.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No test cases yet.
        </p>
      )}

      {tests.map((t) => (
        <div key={t.id} className="rounded-lg bg-muted/40 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {canManageTests &&
                t.status === "draft" &&
                editForm?.testId !== t.id && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(t)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    aria-label="Edit test case"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  t.status === "passed"
                    ? "bg-success/20 text-success"
                    : t.status === "failed"
                      ? "bg-destructive/20 text-destructive"
                      : t.status === "approved"
                        ? "bg-chart-1/20 text-chart-1"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {t.status}
              </span>
            </div>
          </div>

          {editForm?.testId === t.id ? (
            <div className="flex flex-col gap-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Title
                </p>
                <input
                  className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Test case title…"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <StepsEditor
                steps={editForm.steps}
                onChange={(steps) => setEditForm({ ...editForm, steps })}
              />
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected result
                </p>
                <textarea
                  className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Expected result…"
                  value={editForm.expected}
                  onChange={(e) =>
                    setEditForm({ ...editForm, expected: e.target.value })
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
              {t.steps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Steps
                  </p>
                  <div className="space-y-1.5">
                    {t.steps.map((s) => (
                      <div key={s.order} className="flex items-center gap-1.5">
                        <span className="w-4 shrink-0 text-[10px] text-muted-foreground">
                          {s.order}.
                        </span>
                        <p className="flex-1 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5 text-xs text-foreground">
                          {s.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {t.expected && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    Expected
                  </p>
                  <p className="text-xs text-foreground">{t.expected}</p>
                </div>
              )}
            </>
          )}

          {t.actual && t.actual.length > 0 && (
            <div className="space-y-2">
              {t.actual.map((entry, i) => (
                <div
                  key={`${entry.recorded_at}-${i}`}
                  className="border-l-2 border-border pl-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                    {entry.kind === "qa"
                      ? "QA Evidence"
                      : entry.kind === "uat"
                        ? "UAT Result"
                        : "Actual"}
                  </p>
                  <p className="text-xs text-foreground">{entry.text}</p>
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.attachments.map((att, ai) =>
                        IMAGE_EXT_RE.test(att.name) ? (
                          <a
                            key={ai}
                            href={toProxiedImageUrl(att.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={toProxiedImageUrl(att.url)}
                              alt={att.name}
                              className="h-14 w-14 rounded border border-border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={ai}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded border border-border bg-secondary/30 px-2 py-1 text-[10px] text-foreground hover:bg-secondary"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.name}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {entry.attachments.map((att, ai) =>
                        IMAGE_EXT_RE.test(att.name) ? (
                          <a
                            key={ai}
                            href={toProxiedImageUrl(att.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={toProxiedImageUrl(att.url)}
                              alt={att.name}
                              className="h-14 w-14 rounded border border-border object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={ai}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded border border-border bg-secondary/30 px-2 py-1 text-[10px] text-foreground hover:bg-secondary"
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.name}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                  {(entry.recorded_by || entry.recorded_at) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
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

          {canAnswer && t.status === "draft" && editForm?.testId !== t.id && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => handleApproveTest(t.id)}
            >
              Approve test case
            </Button>
          )}

          <TestUatSection
            test={t}
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
            (t.status === "approved" || t.status === "passed") &&
            currentStateName === "UAT" &&
            (t.status === "passed" ||
              t.actual?.some((entry) => entry.kind === "uat")) && (
              <Button
                size="sm"
                variant={t.status === "passed" ? "outline" : "default"}
                disabled={submitting}
                className={
                  t.status === "passed"
                    ? "w-full"
                    : "w-full bg-green-600 hover:bg-green-700 text-white"
                }
                onClick={() => handleTogglePassed(t)}
              >
                {t.status === "passed"
                  ? "Revert to Approved"
                  : "Mark as Passed"}
              </Button>
            )}
        </div>
      ))}

      {canManageTests && (
        <div className="pt-1">
          {showNewTestForm ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 space-y-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Title
                </p>
                <input
                  className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Test case title…"
                  value={testForm.title}
                  onChange={(e) =>
                    setTestForm((f) => ({ ...f, title: e.target.value }))
                  }
                  autoFocus
                />
              </div>
              <StepsEditor
                steps={testForm.steps}
                onChange={(steps) => setTestForm((f) => ({ ...f, steps }))}
              />
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected result
                </p>
                <textarea
                  className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                  placeholder="Expected result…"
                  value={testForm.expected}
                  onChange={(e) =>
                    setTestForm((f) => ({ ...f, expected: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewTestForm(false);
                    setTestForm({ title: "", steps: [], expected: "" });
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
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setShowNewTestForm(true)}
            >
              + Add test case
            </Button>
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
  const canReopenFromDone = role === "stakeholder";
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
  const [tests, setTests] = useState<TestCase[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
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
    setLoadingTests(true);

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
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests?issue_id=${issue.id}`,
      {
        headers: API_HEADERS,
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTests(data);
      })
      .finally(() => setLoadingTests(false));
  }, [issue.id]);

  const queryClient = useQueryClient();
  const { isOwnUnseenUpdate } = useIssueUpdateBadge();

  useEffect(() => {
    if (isOwnUnseenUpdate(issue, profile?.email)) return;

    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/seen`, {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issueId: issue.id }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["issue-updates"] });
      })
      .catch(() => {});
  }, [issue.id, queryClient, isOwnUnseenUpdate, issue, profile?.email]);

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
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-all duration-200 ${
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
        className={`relative z-10 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:mx-6 flex flex-col max-h-[90vh] transition-all duration-200 ${
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
              <span className="text-xs font-mono text-muted-foreground">
                {issue.branchName.slice(0, 7).toUpperCase()}
              </span>
              <Badge
                variant="outline"
                className={
                  priorityColors[
                    issue.priorityLabel as keyof typeof priorityColors
                  ]
                }
              >
                {issue.priorityLabel}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  statusColors[currentStateName as keyof typeof statusColors]
                }
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

        {/* Tab bar */}
        <div className="flex border-b border-border px-5 flex-shrink-0">
          <TabButton
            label="Description"
            tab="description"
            activeTab={activeTab}
            onClick={() => setActiveTab("description")}
            className="mr-5"
          />
          <TabButton
            label="Chat"
            tab="chat"
            activeTab={activeTab}
            onClick={() => setActiveTab("chat")}
            className="mr-5"
          />
          <TabButton
            label="Tests"
            tab="tests"
            activeTab={activeTab}
            onClick={() => setActiveTab("tests")}
            badge={tests.length}
            className="mr-5"
          />
          <TabButton
            label="Decisions"
            tab="decisions"
            activeTab={activeTab}
            onClick={() => setActiveTab("decisions")}
            badge={decisions.length}
            className="mr-5"
          />
          {!isBugIssue && (
            <TabButton
              label="Design"
              tab="design"
              activeTab={activeTab}
              onClick={() => setActiveTab("design")}
              className="mr-5"
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
            canAnswer={canAnswer}
            reviewComplete={reviewComplete}
            canReopenFromDone={canReopenFromDone}
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
            userEmail={profile?.email}
            canAnswer={canAnswer}
            canRecordQaEvidence={canRecordQaEvidence}
            canRecordUatResult={canRecordUatResult}
            role={role}
            currentStateName={currentStateName}
            tests={tests}
            setTests={setTests}
            loadingTests={loadingTests}
          />
        )}

        {activeTab === "design" && !isBugIssue && <DesignTab issue={issue} />}

        {activeTab === "demo" && !isBugIssue && <DemoTab issue={issue} />}
      </div>
    </div>
  );
}
