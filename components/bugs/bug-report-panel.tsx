"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Bug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollapsiblePanelHeader } from "@/components/shared/collapsible-panel-header";
import { ProjectSelect } from "@/components/shared/project-select";
import { PrioritySelect } from "@/components/shared/priority-select";
import { postCreateIssue, fetchProjects } from "@/lib/issues-api";

function buildBugDescription(steps: string, expected: string, actual: string) {
  return `
### Steps to Reproduce
${steps}

### Expected Behavior
${expected}

### Actual Behavior
${actual}
`.trim();
}

export function BugReportPanel({ slug }: { slug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: !!slug,
  });

  const mutation = useMutation({
    mutationFn: postCreateIssue,
    onSuccess: (data) => {
      toast.success(`Bug reported: ${data.issue?.identifier ?? ""}`);
      reset();
    },
    onError: () => toast.error("Failed to report bug. Please try again."),
  });

  function reset() {
    setDetailsRevealed(false);
    setTitle("");
    setSteps("");
    setExpected("");
    setActual("");
    setPriority("medium");
    setSelectedProjectId("");
  }

  function handleSubmit() {
    if (!title.trim()) return;
    mutation.mutate({
      title: title.trim(),
      description: buildBugDescription(steps, expected, actual),
      priority,
      slug,
      type: "bug",
      ...(selectedProjectId && { projectId: selectedProjectId }),
    });
  }

  return (
    <Card className="bg-background">
      <CollapsiblePanelHeader
        icon={<Bug className="h-4 w-4 text-destructive" />}
        title="Report a Bug"
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            placeholder="Brief summary..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-secondary border-0"
          />
        </div>

        {!detailsRevealed ? (
          <div className="flex justify-end">
            <Button
              onClick={() => setDetailsRevealed(true)}
              disabled={!title.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Continue
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Steps to Reproduce</Label>
                <Textarea
                  placeholder="1. Go to... 2. Click on..."
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="bg-secondary border-0 min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Expected</Label>
                <Textarea
                  placeholder="What should happen"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  className="bg-secondary border-0 min-h-[60px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Actual</Label>
                <Textarea
                  placeholder="What actually happened"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  className="bg-secondary border-0 min-h-[60px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Project{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <ProjectSelect
                  projects={projects}
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <PrioritySelect value={priority} onValueChange={setPriority} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || mutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit Bug Report"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
      )}
    </Card>
  );
}
