"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, X, Paperclip, File as FileIcon } from "lucide-react";
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
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { postCreateIssue, fetchProjects, fetchMilestones } from "@/lib/issues-api";
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

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: !!slug,
  });

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
    mutationFn: async () => {
      const uploaded = await Promise.all(attachments.map(uploadFileToLinear));

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
      if (issueId && uploaded.length) {
        await Promise.all(
          uploaded.map((a) => attachFileToIssue(issueId, a.url, a.name)),
        );
      }

      return result;
    },
    onSuccess: (data) => {
      toast.success(`Bug reported: ${data.issue?.identifier ?? ""}`);
      reset();
    },
    onError: () => toast.error("Failed to report bug. Please try again."),
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
    if (!title.trim()) return;
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

              {attachments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {attachments.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="smalltext truncate">{file.name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => removeFile(file.name)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
    </Card>
  );
}
