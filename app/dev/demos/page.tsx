"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Film, Loader2, Upload, Link as LinkIcon, Plus, Search, Video, X } from "lucide-react";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PreviewLinksBanner } from "@/components/client/preview-links-banner";
import { IssueDetailModal } from "@/components/client/issue-detail-modal";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { getIssueCode } from "@/lib/utils";
import {
  type Demo,
  type DemoGroup,
  attachDemoToIssue,
  demoLabel,
  displayName,
  fetchProjectDemos,
  groupDemosByContent,
} from "@/lib/demo-video-utils";
import type { Issue } from "@/components/client/issues.types";

async function createDemoFromUpload(issueId: string, email: string, file: File, title: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("issue_id", issueId);
  formData.append("email", email);
  formData.append("title", title);

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

async function createDemoFromEmbed(issueId: string, email: string, embedUrl: string, title: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ issue_id: issueId, email, embed_url: embedUrl, title }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to add video link");
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
  const [title, setTitle] = useState("");
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
      const trimmedTitle = title.trim();
      const first =
        mode === "upload"
          ? await createDemoFromUpload(ids[0]!, email, file!, trimmedTitle)
          : await createDemoFromEmbed(ids[0]!, email, embedUrl.trim(), trimmedTitle);

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

  const selectedIssues = issues.filter((i) => selectedIssueIds.has(i.id));

  const canSubmit =
    !submitMutation.isPending &&
    !!mode &&
    !!title.trim() &&
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
        <div className="space-y-1.5">
          <label className="smalltext font-medium text-muted-foreground">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Login flow walkthrough"
            className="bg-secondary/30 border-border smalltext"
          />
        </div>

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
            {selectedIssues.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIssues.map((i) => (
                  <Badge
                    key={i.id}
                    variant="outline"
                    className="gap-1 smalltext font-mono border-border/60 text-foreground"
                  >
                    {getIssueCode(i.branchName)}
                    <button
                      type="button"
                      onClick={() => toggleIssue(i.id)}
                      aria-label={`Remove ${getIssueCode(i.branchName)}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
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

// One card per uploaded demo video (not per ticket) — several demo_videos
// rows sharing the same content (see groupDemosByContent) collapse into one
// card here, listing every ticket that content is attached to instead of
// showing up once per ticket.
function DemoCard({
  group,
  onOpen,
}: {
  readonly group: DemoGroup;
  readonly onOpen: () => void;
}) {
  const demo = group.representative;
  return (
    // Same dark card + left accent stripe language as IssueCard
    // (components/client/issue-cards.tsx) — bg-background/text-foreground
    // rather than the light bg-card surface, so this grid reads as the same
    // "issues" visual family instead of a one-off style.
    <div className="group relative rounded-lg border border-border bg-background text-foreground transition-all duration-150 hover:-translate-y-px hover:bg-muted hover:shadow-md">
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col gap-4 rounded-lg p-5 pl-6 text-left"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {demo.source_type === "upload" ? (
              <Film className="h-6 w-6" />
            ) : (
              <LinkIcon className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <p
              className="body font-semibold text-foreground truncate"
              title={demo.title}
            >
              {demo.title}
            </p>
            <p className="smalltext text-muted-foreground font-mono">{demoLabel(demo)}</p>
          </div>
        </div>

        {group.issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {group.issues.map((i) => (
              <Badge
                key={i.id}
                variant="outline"
                className="smalltext font-mono border-border/60 bg-transparent text-muted-foreground"
              >
                {i.code || i.title}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <p className="smalltext text-muted-foreground truncate">
            Uploaded by: <span className="text-foreground">{displayName(demo.uploader)}</span>
          </p>
          {demo.created_at && (
            <p className="smalltext text-muted-foreground/70 shrink-0">
              {new Date(demo.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

function canEditIssue(issue: Issue) {
  return issue.state?.name !== "Done";
}

export default function DevDemosPage() {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const { selectedProject } = useSelectedProject();
  const slug = selectedProject ?? profile?.assignment_id?.[0]?.clientName ?? null;
  const [showUpload, setShowUpload] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null);
  const [demoFilter, setDemoFilter] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-demos", slug],
    queryFn: () => fetchProjectDemos(slug!),
    enabled: !!slug,
  });

  const issueById = useMemo(
    () => new Map((data?.issues ?? []).map((i) => [i.id, i])),
    [data],
  );

  // Collapses every demo_videos row down to one entry per distinct piece of
  // content (see groupDemosByContent) — this is what turns "one row per
  // ticket it's attached to" into "one card per actual demo".
  const demoGroups: DemoGroup[] = useMemo(() => {
    if (!data) return [];
    const issueInfoById = new Map(
      data.issues.map((i) => [i.id, { title: i.title, code: getIssueCode(i.branchName) }]),
    );
    return groupDemosByContent(data.demos, issueInfoById);
  }, [data]);

  const visibleGroups = useMemo(() => {
    const query = demoFilter.trim().toLowerCase();
    if (!query) return demoGroups;
    return demoGroups.filter((g) => {
      const demo = g.representative;
      // Defensive fallback: `title` is only guaranteed once both the
      // add_demo_title_and_number migration has run *and* `demo-videos` has
      // been redeployed — before that, older rows genuinely come back with
      // no title at all rather than an empty string.
      return (
        (demo.title ?? "").toLowerCase().includes(query) ||
        demoLabel(demo).toLowerCase().includes(query) ||
        g.issues.some((i) => i.code.toLowerCase().includes(query))
      );
    });
  }, [demoGroups, demoFilter]);

  function openDemo(group: DemoGroup) {
    const firstIssue = issueById.get(group.issues[0]?.id ?? "");
    if (firstIssue) setViewingIssue(firstIssue);
  }

  // Reachable both from the panel's own header toolbar and from the empty
  // state (there's no panel at all to hold it in until the first demo
  // exists), same as before.
  const uploadButton = !showUpload && (
    <Button size="sm" className="h-7 gap-1.5 smalltext shrink-0" onClick={() => setShowUpload(true)}>
      <Plus className="h-3.5 w-3.5" />
      Upload Demo
    </Button>
  );

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
            <PreviewLinksBanner slug={slug} />

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
            ) : demoGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 p-10 text-center">
                <Video className="h-8 w-8 text-muted-foreground/40" />
                <p className="smalltext text-muted-foreground">
                  No demos uploaded yet for this project.
                </p>
                {uploadButton && <div className="pt-1">{uploadButton}</div>}
              </div>
            ) : (
              <Card className="bg-background border-border text-foreground">
                <CardHeader className="flex flex-col gap-2">
                  <CardTitle className="body font-semibold flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Demos
                    <span className="smalltext font-normal text-muted-foreground tabular-nums">
                      {demoGroups.length}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {uploadButton}
                    <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-64">
                      <Search className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        aria-label="Search demos by title, demo id, or ticket code"
                        placeholder="Search by title, demo id, or ticket code..."
                        value={demoFilter}
                        onChange={(e) => setDemoFilter(e.target.value)}
                        className="h-7 pl-8 bg-secondary/30 border-border smalltext"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {visibleGroups.length === 0 ? (
                    <p className="smalltext text-muted-foreground italic px-1">
                      No demos match "{demoFilter}".
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {visibleGroups.map((group) => (
                        <DemoCard key={group.key} group={group} onOpen={() => openDemo(group)} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {viewingIssue && (
        <IssueDetailModal
          issue={viewingIssue}
          slug={slug ?? (viewingIssue as any)._project}
          onClose={() => setViewingIssue(null)}
          onEdit={
            canEditIssue(viewingIssue)
              ? () => {
                  setEditingIssue(viewingIssue);
                  setViewingIssue(null);
                }
              : undefined
          }
          initialTab="demo"
        />
      )}

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
