"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollapsiblePanelHeader } from "@/components/shared/collapsible-panel-header";
import {
  TitleField,
  ContinueButton,
  ProjectField,
  PriorityField,
  SubmitButton,
} from "@/components/shared/issue-form-fields";
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
        <TitleField value={title} onChange={setTitle} />

        {!detailsRevealed ? (
          <ContinueButton onClick={() => setDetailsRevealed(true)} disabled={!title.trim()} />
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

              <ProjectField
                projects={projects}
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              />

              <PriorityField value={priority} onValueChange={setPriority} />
            </div>

            <SubmitButton
              onClick={handleSubmit}
              disabled={!title.trim() || mutation.isPending}
              pending={mutation.isPending}
              label="Submit Bug Report"
            />
          </>
        )}
      </CardContent>
      )}
    </Card>
  );
}
