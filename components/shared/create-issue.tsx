"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { toast } from "sonner";
import {
  Bug,
  Lightbulb,
  Plus,
  Loader2,
  FlaskConical,
  FolderKanban,
} from "lucide-react";
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

type IssueType = "bug" | "feature" | "uat" | "project" | "milestone";

interface IssueFields {
  // bug
  steps?: string;
  expected?: string;
  actual?: string;
  // feature
  userStory?: string;
  acceptanceCriteria?: string;
  // project
  projectDescription?: string;
  projectDueDate?: string;
  projectMilestones?: string;
  // milestone creation
  milestoneTargetDate?: string;
  milestoneDescription?: string;
  // uat
  testSteps?: string;
  testExpected?: string;
  testActual?: string;
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

    case "uat":
      return [
`### Test Steps\n${data.testSteps || ""}`,
        `### Expected Result\n${data.testExpected || ""}`,
        `### Actual Result\n${data.testActual || ""}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "project":
      return [
        `### Description\n${data.projectDescription || ""}`,
        data.projectDueDate ? `### Due Date\n${data.projectDueDate}` : null,
        data.projectMilestones
          ? `### Milestones\n${data.projectMilestones}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "milestone":
      return [
        data.milestoneDescription
          ? `### Description\n${data.milestoneDescription}`
          : null,
        data.milestoneTargetDate
          ? `### Target Date\n${data.milestoneTargetDate}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

    default:
      return "";
  }
}

const API_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
  apikey: process.env.NEXT_PUBLIC_APIKEY!,
};

async function postCreateIssue(payload: {
  title: string;
  description: string;
  priority: string;
  slug: string;
  projectId?: string;
  projectMilestoneId?: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues/create`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create issue");
  return res.json();
}

async function postCreateMilestone(payload: {
  projectId: string;
  name: string;
  targetDate?: string;
  description?: string;
}) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/milestone`,
    {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error("Failed to create milestone");
  return res.json();
}

async function fetchProjects(initiativeId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/projects?initiativeId=${initiativeId}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json() as Promise<{ id: string; name: string }[]>;
}

async function fetchMilestones(projectId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/milestones?projectId=${projectId}`,
    {
      headers: API_HEADERS,
    },
  );
  if (!res.ok) throw new Error("Failed to fetch milestones");
  return res.json() as Promise<
    { id: string; name: string; targetDate?: string }[]
  >;
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
    type: "uat",
    label: "UAT Test Case",
    description: "Log a test case with steps & results",
    icon: FlaskConical,
    color: "text-chart-2",
  },
  {
    type: "project",
    label: "Project",
    description: "New project with goals & milestones",
    icon: FolderKanban,
    color: "text-muted-foreground",
  },
  {
    type: "milestone",
    label: "Milestone",
    description: "Add a milestone to a project",
    icon: Lightbulb,
    color: "text-chart-1",
  },
];

export function CreateIssue({
  slug,
  projectId,
  profile: profileProp,
  compact,
  defaultType,
}: {
  slug: string;
  projectId?: string;
  profile?: any;
  compact?: boolean;
  defaultType?: IssueType;
}) {
  const { profile: contextProfile } = useUser();
  const profile = profileProp ?? contextProfile;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "form">("type");
  const [issueType, setIssueType] = useState<IssueType | null>(null);

  function handleOpen() {
    if (defaultType) {
      setIssueType(defaultType);
      setStep("form");
    }
    setOpen(true);
  }
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [fields, setFields] = useState<IssueFields>({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");

  const needsProjectSelector =
    issueType === "bug" || issueType === "feature" || issueType === "milestone" || issueType === "uat";

  const linearSlug = profile?.linear_slug ?? "";

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", linearSlug],
    queryFn: () => fetchProjects(linearSlug),
    enabled: open && !!linearSlug && needsProjectSelector,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", selectedProjectId],
    queryFn: () => fetchMilestones(selectedProjectId),
    enabled:
      !!selectedProjectId && (issueType === "bug" || issueType === "feature" || issueType === "uat"),
  });

  const issueMutation = useMutation({
    mutationFn: postCreateIssue,
    onSuccess: (data) => {
      toast.success(`Issue created: ${data.issue?.identifier ?? ""}`);
      handleClose();
    },
    onError: () => toast.error("Failed to create issue. Please try again."),
  });

  const milestoneMutation = useMutation({
    mutationFn: postCreateMilestone,
    onSuccess: () => {
      toast.success("Milestone created successfully");
      handleClose();
    },
    onError: () => toast.error("Failed to create milestone. Please try again."),
  });

  const isPending = issueMutation.isPending || milestoneMutation.isPending;

  function handleClose() {
    setOpen(false);
    setStep("type");
    setIssueType(null);
    setTitle("");
    setPriority("medium");
    setFields({});
    setSelectedProjectId("");
    setSelectedMilestoneId("");
  }

  function setField(key: keyof IssueFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!issueType || !title.trim()) return;

    if (issueType === "milestone") {
      if (!selectedProjectId) return;
      milestoneMutation.mutate({
        projectId: selectedProjectId,
        name: title.trim(),
        targetDate: fields.milestoneTargetDate,
        description: fields.milestoneDescription,
      });
      return;
    }

    issueMutation.mutate({
      title: title.trim(),
      description: buildDescription(issueType, fields),
      priority,
      slug,
      ...(projectId && { projectId }),
      ...(selectedProjectId && { projectId: selectedProjectId }),
      ...(selectedMilestoneId && { projectMilestoneId: selectedMilestoneId }),
    });
  }

  const selectedTypeConfig = TYPE_OPTIONS.find((t) => t.type === issueType);

  return (
    <>
      <div className={compact ? undefined : "flex gap-2"}>
        <Button
          onClick={handleOpen}
          size={compact ? "sm" : "default"}
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
                : (selectedTypeConfig?.label ?? "New Issue")}
            </DialogTitle>
          </DialogHeader>

          {step === "type" && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {TYPE_OPTIONS.map(
                ({ type, label, description, icon: Icon, color }) => (
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
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </button>
                ),
              )}
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
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      placeholder="- Given... When... Then...&#10;- The user should be able to..."
                      value={fields.acceptanceCriteria ?? ""}
                      onChange={(e) =>
                        setField("acceptanceCriteria", e.target.value)
                      }
                      className="bg-secondary border-0 min-h-[80px] resize-none"
                    />
                  </div>
                </>
              )}

              {issueType === "project" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="What is this project about?"
                      value={fields.projectDescription ?? ""}
                      onChange={(e) =>
                        setField("projectDescription", e.target.value)
                      }
                      className="bg-secondary border-0 min-h-[90px] resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={fields.projectDueDate ?? ""}
                      onChange={(e) =>
                        setField("projectDueDate", e.target.value)
                      }
                      className="bg-secondary border-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Milestones{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      placeholder={
                        "- Phase 1: ...\n- Phase 2: ...\n- Phase 3: ..."
                      }
                      value={fields.projectMilestones ?? ""}
                      onChange={(e) =>
                        setField("projectMilestones", e.target.value)
                      }
                      className="bg-secondary border-0 min-h-[70px] resize-none"
                    />
                  </div>
                </>
              )}

              {issueType === "milestone" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Project</Label>

                    <Select
                      value={selectedProjectId}
                      onValueChange={setSelectedProjectId}
                    >
                      <SelectTrigger className="bg-secondary border-0">
                        <SelectValue
                          placeholder={
                            projects.length
                              ? "Select a project…"
                              : "Loading projects…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target Date</Label>
                    <Input
                      type="date"
                      value={fields.milestoneTargetDate ?? ""}
                      onChange={(e) =>
                        setField("milestoneTargetDate", e.target.value)
                      }
                      className="bg-secondary border-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      placeholder="What does this milestone represent?"
                      value={fields.milestoneDescription ?? ""}
                      onChange={(e) =>
                        setField("milestoneDescription", e.target.value)
                      }
                      className="bg-secondary border-0 min-h-[70px] resize-none"
                    />
                  </div>
                </>
              )}

              {issueType === "uat" && (
                <>
                  <div className="space-y-1.5">
                    <Label>
                      Milestone{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={(v) => { setSelectedProjectId(v); setSelectedMilestoneId(""); }}
                    >
                      <SelectTrigger className="bg-secondary border-0">
                        <SelectValue placeholder={projects.length ? "Select a project…" : "Loading projects…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProjectId && (
                      <Select value={selectedMilestoneId} onValueChange={setSelectedMilestoneId}>
                        <SelectTrigger className="bg-secondary border-0 mt-1.5">
                          <SelectValue placeholder={milestones.length ? "Select a milestone…" : "No milestones found"} />
                        </SelectTrigger>
                        <SelectContent>
                          {milestones.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}{m.targetDate ? ` — ${new Date(m.targetDate).toLocaleDateString()}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Test Steps</Label>
                    <Textarea
                      placeholder={
                        "1. Navigate to...\n2. Click on...\n3. Fill in..."
                      }
                      value={fields.testSteps ?? ""}
                      onChange={(e) => setField("testSteps", e.target.value)}
                      className="bg-secondary border-0 min-h-[90px] resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Expected Result</Label>
                      <Textarea
                        placeholder="What should happen..."
                        value={fields.testExpected ?? ""}
                        onChange={(e) =>
                          setField("testExpected", e.target.value)
                        }
                        className="bg-secondary border-0 min-h-[70px] resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Actual Result</Label>
                      <Textarea
                        placeholder="What actually happened..."
                        value={fields.testActual ?? ""}
                        onChange={(e) => setField("testActual", e.target.value)}
                        className="bg-secondary border-0 min-h-[70px] resize-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {(issueType === "bug" || issueType === "feature") && (
                <>
                  <div className="space-y-1.5">
                    <Label>
                      Milestone{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>

                    <Select
                      value={selectedProjectId}
                      onValueChange={(v) => {
                        setSelectedProjectId(v);
                        setSelectedMilestoneId("");
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-0">
                        <SelectValue
                          placeholder={
                            projects.length
                              ? "Select a project…"
                              : "Loading projects…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProjectId && (
                      <Select
                        value={selectedMilestoneId}
                        onValueChange={setSelectedMilestoneId}
                      >
                        <SelectTrigger className="bg-secondary border-0 mt-1.5">
                          <SelectValue
                            placeholder={
                              milestones.length
                                ? "Select a milestone…"
                                : "No milestones found"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {milestones.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                              {m.targetDate
                                ? ` — ${new Date(m.targetDate).toLocaleDateString()}`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </>
              )}

              {issueType !== "milestone" && (
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
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setStep("type")}
                  disabled={isPending}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !title.trim() ||
                    isPending ||
                    (issueType === "milestone" && !selectedProjectId)
                  }
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : issueType === "milestone" ? (
                    "Create Milestone"
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
