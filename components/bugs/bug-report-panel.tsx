"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, Plus, X, Paperclip, File as FileIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/components/ui/button";
import {
  TitleContinueRow,
  ProjectField,
  PriorityField,
  SubmitButton,
} from "@/components/shared/issue-form-fields";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { postCreateIssue, fetchProjects } from "@/lib/issues-api";

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

  return `
### Steps to Reproduce
${stepsList}

### Expected Behavior
${expected}

### Actual Behavior
${actual}
`.trim();
}

export function BugReportPanel({ slug }: { slug: string }) {
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusStepIndex, setFocusStepIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusStepIndex === null) return;
    stepRefs.current[focusStepIndex]?.focus();
    setFocusStepIndex(null);
  }, [focusStepIndex, steps.length]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: !!slug,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const uploaded = await Promise.all(attachments.map(uploadFileToLinear));

      const result = await postCreateIssue({
        title: title.trim(),
        description: buildBugDescription(steps, expected, actual),
        priority,
        slug,
        type: "bug",
        ...(selectedProjectId && { projectId: selectedProjectId }),
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
    setAttachments([]);
  }

  function addFiles(files: File[]) {
    setAttachments((prev) => [...prev, ...files]);
  }

  function removeFile(name: string) {
    setAttachments((prev) => prev.filter((f) => f.name !== name));
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, ""]);
  }

  function removeStep(index: number) {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleStepKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index === steps.length - 1) {
      setSteps((prev) => [...prev, ""]);
    }
    setFocusStepIndex(index + 1);
  }

  function handleSubmit() {
    if (!title.trim()) return;
    mutation.mutate();
  }

  return (
    <Card className="bg-background text-foreground">
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
              <div className="space-y-1.5 md:col-span-2">
                <Label>Steps to Reproduce</Label>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 smalltext text-muted-foreground">
                        {i + 1}.
                      </span>
                      <Input
                        ref={(el) => { stepRefs.current[i] = el; }}
                        aria-label={`Step ${i + 1}`}
                        placeholder={i === 0 ? "Go to..." : "Click on..."}
                        value={step}
                        onChange={(e) => updateStep(i, e.target.value)}
                        onKeyDown={(e) => handleStepKeyDown(e, i)}
                        className="bg-card border-0 text-card-foreground placeholder:text-card-foreground/40"
                      />
                      {steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => removeStep(i)}
                          aria-label={`Remove step ${i + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addStep}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add step
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-expected">Expected</Label>
                <Textarea
                  id="bug-expected"
                  placeholder="What should happen"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  className="bg-card border-0 min-h-[60px] resize-none text-card-foreground placeholder:text-card-foreground/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bug-actual">Actual</Label>
                <Textarea
                  id="bug-actual"
                  placeholder="What actually happened"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  className="bg-card border-0 min-h-[60px] resize-none text-card-foreground placeholder:text-card-foreground/40"
                />
              </div>

              <ProjectField
                projects={projects}
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              />

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
