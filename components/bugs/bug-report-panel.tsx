"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/components/ui/button";
import {
  TitleContinueRow,
  ProjectField,
  MilestoneField,
  ListItemsField,
  PriorityField,
  SubmitButton,
} from "@/components/shared/issue-form-fields";
import { AttachedFilesList } from "@/components/shared/attached-files-list";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { postCreateIssue, fetchProjects, fetchMilestones, isProjectRequired } from "@/lib/issues-api";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useUser } from "context/UserContext";

// Sends the file to our backend, which uploads it to Linear's storage server-side
// (Linear's presigned GCS URLs aren't CORS-enabled for direct browser upload).
async function uploadFileToLinear(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/upload`,
    {
      method: "POST",
      // No Content-Type here — the browser sets multipart/form-data with
      // the correct boundary on its own; overriding it (e.g. with the JSON
      // headers) would break the upload.
      headers: API_HEADERS,
      body: formData,
    },
  );
  if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  const { name, url } = await res.json();
  return { name: name as string, url: url as string };
}

async function attachFileToIssue(issueId: string, url: string, title: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/attachment`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issueId, url, title }),
    },
  );
  if (!res.ok) throw new Error(`Failed to attach ${title} to issue`);
  return res.json();
}

function buildBugDescription(steps: string[], expected: string, actual: string) {
  const stepsList = steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  return [
    stepsList ? `### Steps to Reproduce\n${stepsList}` : null,
    expected.trim() ? `### Expected Behavior\n${expected.trim()}` : null,
    actual.trim() ? `### Actual Behavior\n${actual.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function BugReportPanel({ slug }: { slug: string }) {
  const { profile } = useUser();
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: !!slug,
  });

  // With no projects to pick from, the backend decides (and says why).
  const projectRequired = isProjectRequired(projects);
  const missingProject = projectRequired && projects.length > 0 && !selectedProjectId;

  // Only one project: nothing to choose, so pick it (again after a reset).
  useEffect(() => {
    const onlyProject = projects.length === 1 ? projects[0] : undefined;
    if (onlyProject && !selectedProjectId) setSelectedProjectId(onlyProject.id);
  }, [projects, selectedProjectId]);

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", selectedProjectId],
    queryFn: () => fetchMilestones(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  // A milestone from a previously-selected project shouldn't linger once the
  // project changes (or is cleared) — it wouldn't belong to the new project.
  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedMilestoneId("");
  }

  const mutation = useMutation({
    // A file that fails to upload or attach doesn't undo the bug: it's
    // reported as created, with the files that didn't make it. Failing the
    // whole thing would make people resubmit and duplicate the bug.
    mutationFn: async () => {
      const failedFiles: string[] = [];
      const uploaded: { name: string; url: string }[] = [];
      const uploads = await Promise.allSettled(attachments.map(uploadFileToLinear));
      uploads.forEach((r, i) => {
        if (r.status === "fulfilled") uploaded.push(r.value);
        else failedFiles.push(attachments[i]?.name ?? "a file");
      });

      const result = await postCreateIssue({
        title: title.trim(),
        description: buildBugDescription(steps, expected, actual),
        priority,
        slug,
        ...(profile?.email && { requestedBy: profile.email }),
        type: "bug",
        ...(selectedProjectId && { projectId: selectedProjectId }),
        ...(selectedMilestoneId && { projectMilestoneId: selectedMilestoneId }),
      });

      const issueId = result.issue?.id;
      if (!issueId) throw new Error("The bug wasn't created");

      const attached = await Promise.allSettled(
        uploaded.map((a) => attachFileToIssue(issueId, a.url, a.name)),
      );
      attached.forEach((r, i) => {
        if (r.status === "rejected") failedFiles.push(uploaded[i]?.name ?? "a file");
      });

      return { identifier: result.issue?.identifier ?? "", failedFiles };
    },
    onSuccess: ({ identifier, failedFiles }) => {
      if (failedFiles.length) {
        toast.warning(`Bug reported: ${identifier}, but couldn't attach ${failedFiles.join(", ")}`);
      } else {
        toast.success(`Bug reported: ${identifier}`);
      }
      reset();
    },
    onError: (err) =>
      toast.error("Failed to report bug. Please try again.", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  function reset() {
    setDetailsRevealed(false);
    setTitle("");
    setSteps([""]);
    setExpected("");
    setActual("");
    setPriority("medium");
    setSelectedProjectId("");
    setSelectedMilestoneId("");
    setAttachments([]);
  }

  function addFiles(files: File[]) {
    setAttachments((prev) => [...prev, ...files]);
  }

  function removeFile(name: string) {
    setAttachments((prev) => prev.filter((f) => f.name !== name));
  }

  function handleSubmit() {
    if (!title.trim() || missingProject) return;
    mutation.mutate();
  }

  return (
    <Card className="bg-background text-foreground border-transparent sm:border-border rounded-none sm:rounded-xl">
      <CardHeader>
        <CardTitle className="body font-semibold flex items-center gap-2">
          <Bug className="h-4 w-4 text-destructive" />
          Report a Bug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TitleContinueRow
          title={title}
          onTitleChange={setTitle}
          detailsRevealed={detailsRevealed}
          onContinue={() => setDetailsRevealed(true)}
          slug={slug}
          kind="bug"
        />

        {detailsRevealed && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <ListItemsField
                  label="Steps to Reproduce"
                  items={steps}
                  onChange={setSteps}
                  itemLabel="Step"
                  placeholderFor={(i) => (i === 0 ? "Go to..." : "Click on...")}
                  addLabel="Add step"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-expected">Expected</Label>
                <RichTextEditor
                  id="bug-expected"
                  ariaLabel="Expected"
                  placeholder="What should happen (you can paste screenshots)"
                  value={expected}
                  onChange={setExpected}
                  className="border-0"
                  minHeight="60px"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-actual">Actual</Label>
                <RichTextEditor
                  id="bug-actual"
                  ariaLabel="Actual"
                  placeholder="What actually happened (you can paste screenshots)"
                  value={actual}
                  onChange={setActual}
                  className="border-0"
                  minHeight="60px"
                />
              </div>

              <ProjectField
                projects={projects}
                value={selectedProjectId}
                onValueChange={handleProjectChange}
                required={projectRequired}
              />

              {selectedProjectId && (
                <MilestoneField
                  milestones={milestones}
                  value={selectedMilestoneId}
                  onValueChange={setSelectedMilestoneId}
                />
              )}

              <PriorityField value={priority} onValueChange={setPriority} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-attachments">
                Attachments{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <input
                id="bug-attachments"
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Add files
              </Button>

              <AttachedFilesList files={attachments} onRemove={removeFile} />
            </div>

            <SubmitButton
              onClick={handleSubmit}
              disabled={!title.trim() || projectsLoading || missingProject || mutation.isPending}
              pending={mutation.isPending}
              label="Submit Bug Report"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
