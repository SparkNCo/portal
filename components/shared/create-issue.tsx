"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { toast } from "sonner";
import { Bug, Lightbulb, Database, Settings, Plus, Loader2, FlaskConical } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IssueType = "bug" | "feature" | "data" | "admin";

const ASSIGNEES = [
  { id: "03ce0417-60de-4b58-bb81-7ec268d31f21", name: "John Doe" },
  { id: "03ce0417-60de-4b58-bb81-7ec268d31f21", name: "Jane Smith" },
];

const LABELS = [
  { id: "a745bd21-fc0e-40ab-a59d-1172557abd3c", name: "Frontend" },
  { id: "b856ce32-gd1f-51bc-b60e-2283668bce4d", name: "Backend" },
  { id: "c967df43-hh2g-62cd-c71f-3394779cd55e", name: "Design" },
  { id: "a5b33f33-19a5-43fd-a5a6-8c1b732c3c91", name: "Bug" },
];

interface IssueFields {
  // bug
  steps?: string;
  expected?: string;
  actual?: string;
  environment?: string;
  // feature
  userStory?: string;
  acceptanceCriteria?: string;
  // data
  timeRange?: string;
  runSchedule?: string;
  fieldsAndConditions?: string;
  // admin
  description?: string;
}

function buildDescription(type: IssueType, data: IssueFields): string {
  switch (type) {
    case "bug":
      return `
### Steps to Reproduce
${data.steps || ""}

### Expected Behavior
${data.expected || ""}

### Actual Behavior
${data.actual || ""}

### Environment
${data.environment || ""}
`.trim();

    case "feature":
      return [
        `### User Story\n${data.userStory || ""}`,
        data.acceptanceCriteria
          ? `### Acceptance Criteria\n${data.acceptanceCriteria}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "data":
      return [
        data.timeRange ? `### Time Range\n${data.timeRange}` : null,
        data.runSchedule ? `### Run Schedule\n${data.runSchedule}` : null,
        data.fieldsAndConditions
          ? `### Fields and Conditions\n${data.fieldsAndConditions}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "admin":
    default:
      return data.description ?? "";
  }
}

async function postCreateIssue(payload: {
  title: string;
  description: string;
  priority: string;
  slug: string;
  projectId?: string;
  assigneeId?: string;
  labelIds?: string[];
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
      apikey: process.env.NEXT_PUBLIC_APIKEY!,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create issue");
  return res.json();
}

const TYPE_OPTIONS: {
  type: IssueType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    type: "bug",
    label: "Bug Report",
    description: "Something isn't working",
    icon: Bug,
    color: "text-destructive",
  },
  {
    type: "feature",
    label: "Feature Request",
    description: "Suggest an improvement",
    icon: Lightbulb,
    color: "text-chart-2",
  },
  {
    type: "data",
    label: "Data Request",
    description: "Need a dataset or report",
    icon: Database,
    color: "text-chart-1",
  },
  {
    type: "admin",
    label: "Admin / Other",
    description: "General requests",
    icon: Settings,
    color: "text-muted-foreground",
  },
];

const TEST_ISSUE = {
  id: "test-issue-001",
  branchName: "fix/login-mobile-001",
  priorityLabel: "High",
  title: "Login button not responding on mobile Safari",
  state: { name: "Business Review" },
  cycle: { number: 3, isActive: true, name: "Sprint 3" },
  comments: {
    nodes: [
      {
        id: "cmt-001",
        bodyData: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Can you share the device model and OS version?" }] }],
        }),
        createdAt: new Date().toISOString(),
        user: { displayName: "Dev Team" },
      },
    ],
  },
};

export function CreateIssue({ slug, projectId, profile: profileProp, compact }: { slug: string; projectId?: string; profile?: any; compact?: boolean }) {
  const { profile: contextProfile } = useUser();
  const profile = profileProp ?? contextProfile;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "form">("type");
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [fields, setFields] = useState<IssueFields>({});

  const mutation = useMutation({
    mutationFn: postCreateIssue,
    onSuccess: (data) => {
      toast.success(`Issue created: ${data.issue?.identifier ?? ""}`);
      handleClose();
    },
    onError: () => {
      toast.error("Failed to create issue. Please try again.");
    },
  });

  function handleClose() {
    setOpen(false);
    setStep("type");
    setIssueType(null);
    setTitle("");
    setPriority("medium");
    setAssigneeId("");
    setLabelIds([]);
    setFields({});
  }

  function setField(key: keyof IssueFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!issueType || !title.trim()) return;
    mutation.mutate({
      title: title.trim(),
      description: buildDescription(issueType, fields),
      priority,
      slug,
      ...(projectId && { projectId }),
      ...(assigneeId && { assigneeId }),
      ...(labelIds.length && { labelIds }),
    });
  }

  const selectedTypeConfig = TYPE_OPTIONS.find((t) => t.type === issueType);

  return (
    <>
      <div className={compact ? undefined : "flex gap-2"}>
        <Button
          onClick={() => setOpen(true)}
          className={`${compact ? "" : "flex-1 "}bg-accent text-accent-foreground hover:bg-accent/90`}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Issue
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === "type"
                ? "What type of issue?"
                : selectedTypeConfig?.label ?? "New Issue"}
            </DialogTitle>
          </DialogHeader>

          {step === "type" && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {TYPE_OPTIONS.map(({ type, label, description, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => {
                    setIssueType(type);
                    setStep("form");
                  }}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-secondary p-4 hover:bg-secondary/80 transition-colors text-left"
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "form" && issueType && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="Brief summary..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary border-0"
                  autoFocus
                />
              </div>

              {issueType === "bug" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Steps to Reproduce</Label>
                    <Textarea
                      placeholder="1. Go to... 2. Click on..."
                      value={fields.steps ?? ""}
                      onChange={(e) => setField("steps", e.target.value)}
                      className="bg-secondary border-0 min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Expected</Label>
                      <Textarea
                        placeholder="What should happen"
                        value={fields.expected ?? ""}
                        onChange={(e) => setField("expected", e.target.value)}
                        className="bg-secondary border-0 min-h-[60px] resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Actual</Label>
                      <Textarea
                        placeholder="What actually happened"
                        value={fields.actual ?? ""}
                        onChange={(e) => setField("actual", e.target.value)}
                        className="bg-secondary border-0 min-h-[60px] resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Environment</Label>
                    <Input
                      placeholder="Browser, OS, version..."
                      value={fields.environment ?? ""}
                      onChange={(e) => setField("environment", e.target.value)}
                      className="bg-secondary border-0"
                    />
                  </div>
                </>
              )}

              {issueType === "feature" && (
                <>
                  <div className="space-y-1.5">
                    <Label>User Story</Label>
                    <p className="text-xs text-muted-foreground -mt-0.5">
                      As a [user type], I want to [goal], so that [value]
                    </p>
                    <Textarea
                      placeholder="As a client, I want to see my invoice history, so that I can track my payments."
                      value={fields.userStory ?? ""}
                      onChange={(e) => setField("userStory", e.target.value)}
                      className="bg-secondary border-0 min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Acceptance Criteria{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      placeholder="- Given... When... Then...&#10;- The user should be able to..."
                      value={fields.acceptanceCriteria ?? ""}
                      onChange={(e) => setField("acceptanceCriteria", e.target.value)}
                      className="bg-secondary border-0 min-h-[80px] resize-none"
                    />
                  </div>
                </>
              )}

              {issueType === "data" && (
                <>
                  <div className="space-y-1.5">
                    <Label>
                      Time Range{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      placeholder="e.g. Jan 2024 – Mar 2024, last 90 days..."
                      value={fields.timeRange ?? ""}
                      onChange={(e) => setField("timeRange", e.target.value)}
                      className="bg-secondary border-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Run Schedule{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={fields.runSchedule ?? ""}
                      onValueChange={(v) => setField("runSchedule", v)}
                    >
                      <SelectTrigger className="bg-secondary border-0">
                        <SelectValue placeholder="Select frequency..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="ad-hoc">Ad-hoc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Fields and Conditions{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      placeholder="e.g. Filter by active users, group by region, include columns: name, email, revenue..."
                      value={fields.fieldsAndConditions ?? ""}
                      onChange={(e) => setField("fieldsAndConditions", e.target.value)}
                      className="bg-secondary border-0 min-h-[70px] resize-none"
                    />
                  </div>
                </>
              )}

              {issueType === "admin" && (
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe your request..."
                    value={fields.description ?? ""}
                    onChange={(e) => setField("description", e.target.value)}
                    className="bg-secondary border-0 min-h-[100px] resize-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Assignee{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                {/* TODO: replace ASSIGNEES with data from global state */}
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="bg-secondary border-0">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNEES.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Labels{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                {/* TODO: replace LABELS with data from global state / Linear API */}
                <div className="flex flex-wrap gap-2">
                  {LABELS.map((label) => {
                    const active = labelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() =>
                          setLabelIds((prev) =>
                            active
                              ? prev.filter((id) => id !== label.id)
                              : [...prev, label.id],
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-secondary text-muted-foreground border-border hover:border-accent/50"
                        }`}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-secondary border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep("type")}
                  disabled={mutation.isPending}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || mutation.isPending}
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit Issue"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
