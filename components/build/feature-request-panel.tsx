"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb, Paperclip, File as FileIcon, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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

function buildFeatureDescription(description: string, requirements: string) {
  return [
    description.trim() ? `### Feature Description\n${description.trim()}` : null,
    requirements.trim() ? `### Requirement\n${requirements.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function FeatureRequestPanel({ slug }: { slug: string }) {
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        description: buildFeatureDescription(description, requirements),
        priority,
        slug,
        type: "feature",
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
      toast.success(
        `Feature request submitted: ${data.issue?.identifier ?? ""}`,
      );
      reset();
    },
    onError: () =>
      toast.error("Failed to submit feature request. Please try again."),
  });

  function reset() {
    setDetailsRevealed(false);
    setTitle("");
    setDescription("");
    setRequirements("");
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

  function handleSubmit() {
    if (!title.trim()) return;
    mutation.mutate();
  }

  return (
    <Card className="bg-background text-foreground">
      <CardHeader>
        <CardTitle level={2} className="body font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Request a Feature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TitleContinueRow
          title={title}
          onTitleChange={setTitle}
          detailsRevealed={detailsRevealed}
          onContinue={() => setDetailsRevealed(true)}
          slug={slug}
          kind="feature"
        />

        {detailsRevealed && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="feature-description" className="smalltext">Description</Label>
                <RichTextEditor
                  id="feature-description"
                  ariaLabel="Description"
                  placeholder="Describe the feature you'd like in plain language..."
                  value={description}
                  onChange={setDescription}
                  className="border-0"
                  minHeight="90px"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="feature-requirements" className="smalltext">
                  Requirements{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <RichTextEditor
                  id="feature-requirements"
                  ariaLabel="Requirements (optional)"
                  placeholder="How will you know this feature is working well?"
                  value={requirements}
                  onChange={setRequirements}
                  className="border-0"
                  minHeight="70px"
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
              <Label htmlFor="feature-attachments" className="smalltext">
                Attachments{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <input
                id="feature-attachments"
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
              label="Submit Feature Request"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
