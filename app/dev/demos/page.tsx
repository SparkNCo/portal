"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Link as LinkIcon, Plus, Video } from "lucide-react";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { getIssueCode } from "@/lib/utils";
import { type Demo, fetchProjectDemos } from "@/lib/demo-video-utils";
import type { Issue } from "@/components/client/issues.types";

async function createDemoFromUpload(issueId: string, email: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("issue_id", issueId);
  formData.append("email", email);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
    { method: "POST", headers: API_HEADERS, body: formData },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Demo upload failed");
  }
  return (await res.json()) as Demo;
}

async function createDemoFromEmbed(issueId: string, email: string, embedUrl: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issue_id: issueId, email, embed_url: embedUrl }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to add video link");
  }
  return (await res.json()) as Demo;
}

async function attachDemoToIssue(issueId: string, email: string, sourceDemoId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issue_id: issueId, email, source_demo_id: sourceDemoId }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to attach demo video");
  }
  return (await res.json()) as Demo;
}

function UploadDemoForm({
  slug,
  issues,
  onDone,
}: {
  readonly slug: string;
  readonly issues: Issue[];
  readonly onDone: () => void;
}) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "embed" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [issueFilter, setIssueFilter] = useState("");

  const toggleIssue = (id: string) =>
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const email = profile?.email;
      if (!email) throw new Error("Could not identify the current user");
      const ids = Array.from(selectedIssueIds);
      if (ids.length === 0) throw new Error("Select at least one feature or bug");

      // Upload/link once, on the first selected ticket, then attach that
      // same demo to every other selected ticket as a new version each —
      // no re-uploading the file per ticket.
      const first =
        mode === "upload"
          ? await createDemoFromUpload(ids[0]!, email, file!)
          : await createDemoFromEmbed(ids[0]!, email, embedUrl.trim());

      for (const issueId of ids.slice(1)) {
        await attachDemoToIssue(issueId, email, first.id);
      }

      return { first, count: ids.length };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ["project-demos", slug] });
      toast.success(
        count > 1 ? `Demo uploaded and linked to ${count} tickets` : "Demo uploaded",
      );
      onDone();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredIssues = issues.filter((i) =>
    `${i.title} ${getIssueCode(i.branchName)}`
      .toLowerCase()
      .includes(issueFilter.toLowerCase()),
  );

  const canSubmit =
    !submitMutation.isPending &&
    !!mode &&
    selectedIssueIds.size > 0 &&
    (mode === "upload" ? !!file : !!embedUrl.trim());

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader>
        <CardTitle className="body font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          Upload Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "upload" ? "default" : "outline"}
            className="gap-1.5 smalltext"
            onClick={() => setMode("upload")}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </Button>
          <Button
            size="sm"
            variant={mode === "embed" ? "default" : "outline"}
            className="gap-1.5 smalltext"
            onClick={() => setMode("embed")}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Video link
          </Button>
        </div>

        {mode === "upload" && (
          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 smalltext"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {file ? file.name : "Choose video or image…"}
            </Button>
          </div>
        )}

        {mode === "embed" && (
          <Input
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://www.loom.com/share/..."
            className="bg-secondary/30 border-border smalltext"
          />
        )}

        {mode && (
          <div className="space-y-1.5">
            <label className="smalltext font-medium text-muted-foreground">
              Related features & bugs
            </label>
            <Input
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              placeholder="Search tickets…"
              className="h-8 bg-secondary/30 border-border smalltext"
            />
            <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-lg border border-border divide-y divide-border">
              {filteredIssues.length === 0 && (
                <p className="smalltext text-muted-foreground italic p-3">
                  No tickets match.
                </p>
              )}
              {filteredIssues.map((i) => (
                <label
                  key={i.id}
                  className="flex items-center gap-2 px-3 py-2 smalltext cursor-pointer hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedIssueIds.has(i.id)}
                    onCheckedChange={() => toggleIssue(i.id)}
                  />
                  <span className="font-mono text-muted-foreground shrink-0">
                    {getIssueCode(i.branchName)}
                  </span>
                  <span className="truncate">{i.title}</span>
                </label>
              ))}
            </div>
            <p className="smalltext text-muted-foreground">
              {selectedIssueIds.size} selected
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="smalltext"
            onClick={onDone}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 smalltext"
            disabled={!canSubmit}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevDemosPage() {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const { selectedProject } = useSelectedProject();
  const slug = selectedProject ?? profile?.assignment_id?.[0]?.clientName ?? null;
  const [showUpload, setShowUpload] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-demos", slug],
    queryFn: () => fetchProjectDemos(slug!),
    enabled: !!slug,
  });

  // Same IssueCard/PriorityTasks the rest of the developer dashboard uses,
  // just narrowed to tickets that actually have a demo attached — clicking
  // one opens straight into its Demo tab, so versions stay grouped by
  // ticket instead of duplicated in a separate video-centric list here.
  const issuesWithDemos = useMemo(() => {
    if (!data) return [];
    const issueIdsWithDemos = new Set(data.demos.map((d) => d.issue_id));
    return data.issues.filter((i) => issueIdsWithDemos.has(i.id));
  }, [data]);

  const availableStatuses = [
    ...new Set(issuesWithDemos.map((i) => i.state?.name).filter(Boolean)),
  ] as string[];
  const availableLabels = [
    ...new Set(
      issuesWithDemos.flatMap((i) => (i.labels?.nodes ?? []).map((l) => l.name)),
    ),
  ];
  const availablePriorities = [
    ...new Set(issuesWithDemos.map((i) => i.priorityLabel).filter(Boolean)),
  ];

  const statusFiltered =
    selectedStatuses.length > 0
      ? issuesWithDemos.filter((i) => selectedStatuses.includes(i.state?.name ?? ""))
      : issuesWithDemos;
  const labelFiltered =
    selectedLabels.length > 0
      ? statusFiltered.filter((i) =>
          (i.labels?.nodes ?? []).some((l) => selectedLabels.includes(l.name)),
        )
      : statusFiltered;
  const visibleIssues =
    selectedPriorities.length > 0
      ? labelFiltered.filter((i) => selectedPriorities.includes(i.priorityLabel))
      : labelFiltered;

  const filterState = {
    selectedStatuses,
    onlyActive: false,
    availableStatuses,
    hasCycles: false,
    onToggleStatus: (s: string) =>
      setSelectedStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
      ),
    onToggleActive: () => {},
    selectedLabels,
    availableLabels,
    onToggleLabel: (l: string) =>
      setSelectedLabels((prev) =>
        prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
      ),
    selectedPriorities,
    availablePriorities,
    onTogglePriority: (p: string) =>
      setSelectedPriorities((prev) =>
        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
      ),
    onClearFilters: () => {
      setSelectedStatuses([]);
      setSelectedLabels([]);
      setSelectedPriorities([]);
    },
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Demos"
        subtitle="Demo videos for your assigned features and bugs"
        subtitleClassName="smalltext"
      />

      <div className="p-4 md:p-6 space-y-6">
        {!slug ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/40 p-10 text-center">
            <p className="smalltext font-medium text-foreground">
              No assigned projects yet
            </p>
            <p className="smalltext text-muted-foreground">
              Once you're assigned to a customer, their demos will show up
              here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end">
              {!showUpload && (
                <Button size="sm" className="gap-1.5 smalltext" onClick={() => setShowUpload(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Upload Demo
                </Button>
              )}
            </div>

            {showUpload && (
              <UploadDemoForm
                slug={slug}
                issues={data?.issues ?? []}
                onDone={() => setShowUpload(false)}
              />
            )}

            {isLoading ? (
              <LoadingDataPanel />
            ) : isError ? (
              <p className="smalltext text-destructive">Failed to load demos.</p>
            ) : issuesWithDemos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 p-10 text-center">
                <Video className="h-8 w-8 text-muted-foreground/40" />
                <p className="smalltext text-muted-foreground">
                  No demos uploaded yet for this project.
                </p>
              </div>
            ) : (
              <PriorityTasks
                issuesData={visibleIssues}
                filterState={filterState}
                onEditIssue={(issue) => setEditingIssue(issue)}
                title="Demos"
                slug={slug}
                initialModalTab="demo"
              />
            )}
          </>
        )}
      </div>

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug ?? ""}
          onClose={() => setEditingIssue(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["project-demos", slug] })}
        />
      )}
    </div>
  );
}
