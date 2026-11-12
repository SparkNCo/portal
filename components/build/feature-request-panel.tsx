"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useUser } from "context/UserContext";
import {
  TitleContinueRow,
  ProjectField,
  ListItemsField,
  MilestoneField,
  PriorityField,
  SubmitButton,
} from "@/components/shared/issue-form-fields";
import { AttachedFilesList } from "@/components/shared/attached-files-list";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import {
  postCreateIssue,
  fetchProjects,
  fetchMilestones,
  isProjectRequired,
  recallLastProject,
  rememberLastProject,
} from "@/lib/issues-api";

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

function buildFeatureDescription(description: string, criteria: string[]) {
  const criteriaList = criteria
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => `- ${c}`)
    .join("\n");
  return [
    description.trim() ? `### Feature Description\n${description.trim()}` : null,
    criteriaList ? `### Criteria\n${criteriaList}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function FeatureRequestPanel({ slug }: { slug: string }) {
  const { profile } = useUser();
  const [detailsRevealed, setDetailsRevealed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<string[]>([""]);
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

  // Preselect (again after a reset): the only project, or the one the last
  // ticket went to in the past few hours.
  useEffect(() => {
    if (selectedProjectId || projects.length === 0) return;
    const pick = projects.length === 1 ? projects[0]?.id : recallLastProject(slug, profile?.id, projects);
    if (pick) setSelectedProjectId(pick);
  }, [projects, selectedProjectId, slug, profile?.id]);

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
    // A file that fails to upload or attach doesn't undo the request: it's
    // reported as submitted, with the files that didn't make it. Failing the
    // whole thing would make people resubmit and duplicate it.
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
        description: buildFeatureDescription(description, criteria),
        priority,
        slug,
        ...(profile?.email && { requestedBy: profile.email }),
        type: "feature",
        ...(selectedProjectId && { projectId: selectedProjectId }),
        ...(selectedMilestoneId && { projectMilestoneId: selectedMilestoneId }),
      });

      const issueId = result.issue?.id;
      if (!issueId) throw new Error("The feature request wasn't created");
      if (selectedProjectId) rememberLastProject(slug, profile?.id, selectedProjectId);

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
        toast.warning(
          `Feature request submitted: ${identifier}, but couldn't attach ${failedFiles.join(", ")}`,
        );
      } else {
        toast.success(`Feature request submitted: ${identifier}`);
      }
      reset();
    },
    onError: (err) =>
      toast.error("Failed to submit feature request. Please try again.", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  function reset() {
    setDetailsRevealed(false);
    setTitle("");
    setDescription("");
    setCriteria([""]);
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

              <div className="md:col-span-2">
                <ListItemsField
                  label={
                    <>
                      Criteria{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </>
                  }
                  items={criteria}
                  onChange={setCriteria}
                  itemLabel="Criterion"
                  placeholderFor={(i) =>
                    i === 0 ? "e.g. Users can export the report as PDF" : "Another way to know it works..."
                  }
                  addLabel="Add criterion"
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

              <AttachedFilesList files={attachments} onRemove={removeFile} />
            </div>

            <SubmitButton
              onClick={handleSubmit}
              disabled={!title.trim() || projectsLoading || missingProject || mutation.isPending}
              pending={mutation.isPending}
              label="Submit Feature Request"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
