"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Video, Link as LinkIcon, Send, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "context/UserContext";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import type { Issue } from "./issues.types";

type DemoUser = {
  id: string;
  email: string;
  userName?: string | null;
  role?: string;
};

type Demo = {
  id: string;
  issue_id: string;
  version: number;
  source_type: "upload" | "embed";
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  embed_url: string | null;
  embed_provider: string | null;
  created_at: string;
  updated_at?: string;
  uploader?: DemoUser | null;
};

type DemoComment = {
  id: string;
  demo_video_id: string;
  body: string;
  created_at: string;
  author?: DemoUser | null;
};

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;

function isImageFile(fileName?: string | null) {
  return !!fileName && IMAGE_EXTENSIONS.test(fileName);
}

function getEmbedIframeSrc(embedUrl: string, provider?: string | null) {
  if (provider === "loom") {
    const match = embedUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return `https://www.loom.com/embed/${match[1]}`;
  }
  return embedUrl;
}

function displayName(user?: DemoUser | null) {
  if (!user) return "Someone";
  return user.userName || user.email;
}

export function DemoTab({ issue }: { issue: Issue }) {
  const { profile } = useUser();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [showAddEmbedForm, setShowAddEmbedForm] = useState(false);
  const [addEmbedUrl, setAddEmbedUrl] = useState("");
  const [showReplaceEmbedForm, setShowReplaceEmbedForm] = useState(false);
  const [replaceEmbedUrl, setReplaceEmbedUrl] = useState("");
  const [commentBody, setCommentBody] = useState("");

  /*
   * Load all demo versions for this issue.
   */
  const demosQuery = useQuery({
    queryKey: ["demo-versions", issue.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos?issue_id=${issue.id}`,
        { headers: API_HEADERS },
      );

      if (!res.ok) throw new Error("Failed to load demo versions");

      return (await res.json()) as Demo[];
    },
  });

  /*
   * Always select the latest version after loading/reloading the demos.
   */
  useEffect(() => {
    setSelectedVersion(demosQuery.data?.[0]?.version ?? null);
  }, [demosQuery.data]);

  const latestVersion = demosQuery.data?.[0]?.version;

  const currentDemo = demosQuery.data?.find(
    (demo) => demo.version === selectedVersion,
  );

  /*
   * Comment thread for the currently selected version. Clients,
   * stakeholders, and admins all read/write from the same list, so
   * everyone sees everyone else's feedback.
   */
  const commentsQuery = useQuery({
    queryKey: ["demo-comments", currentDemo?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos?type=comments&demo_video_id=${currentDemo!.id}`,
        { headers: API_HEADERS },
      );

      if (!res.ok) throw new Error("Failed to load feedback");

      return (await res.json()) as DemoComment[];
    },
    enabled: !!currentDemo?.id,
  });

  /*
   * Upload a completely new version. v1 -> v2 -> v3 -> ...
   */
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.email) {
        throw new Error("Could not identify the current user");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("issue_id", issue.id);
      formData.append("email", profile.email);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
        { method: "POST", headers: API_HEADERS, body: formData },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Demo upload failed");
      }

      return (await res.json()) as Demo;
    },
    onSuccess: (demo) => {
      queryClient.invalidateQueries({ queryKey: ["demo-versions", issue.id] });
      setSelectedVersion(demo.version);
      setCreateOpen(false);
      toast.success(`Demo uploaded (v${demo.version})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /*
   * Add a completely new version as an embed link (e.g. Loom).
   */
  const addEmbedMutation = useMutation({
    mutationFn: async (embedUrl: string) => {
      if (!profile?.email) {
        throw new Error("Could not identify the current user");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            issue_id: issue.id,
            email: profile.email,
            embed_url: embedUrl,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to add embed link");
      }

      return (await res.json()) as Demo;
    },
    onSuccess: (demo) => {
      queryClient.invalidateQueries({ queryKey: ["demo-versions", issue.id] });
      setSelectedVersion(demo.version);
      setShowAddEmbedForm(false);
      setAddEmbedUrl("");
      setCreateOpen(false);
      toast.success(`Demo added (v${demo.version})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /*
   * Replace the currently selected version's file. Version number
   * stays the same — v3 updated is still v3, not v4.
   */
  const replaceWithFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.email) {
        throw new Error("Could not identify the current user");
      }
      if (!currentDemo) {
        throw new Error("Select a demo version before updating it");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("demo_id", currentDemo.id);
      formData.append("email", profile.email);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
        { method: "PUT", headers: API_HEADERS, body: formData },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Demo update failed");
      }

      return (await res.json()) as Demo;
    },
    onSuccess: (demo) => {
      queryClient.invalidateQueries({ queryKey: ["demo-versions", issue.id] });
      setSelectedVersion(demo.version);
      setUpdateOpen(false);
      toast.success(`Version v${demo.version} updated`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /*
   * Replace the currently selected version's content with an embed link.
   */
  const replaceWithEmbedMutation = useMutation({
    mutationFn: async (embedUrl: string) => {
      if (!profile?.email) {
        throw new Error("Could not identify the current user");
      }
      if (!currentDemo) {
        throw new Error("Select a demo version before updating it");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos`,
        {
          method: "PUT",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            demo_id: currentDemo.id,
            email: profile.email,
            embed_url: embedUrl,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Demo update failed");
      }

      return (await res.json()) as Demo;
    },
    onSuccess: (demo) => {
      queryClient.invalidateQueries({ queryKey: ["demo-versions", issue.id] });
      setSelectedVersion(demo.version);
      setShowReplaceEmbedForm(false);
      setReplaceEmbedUrl("");
      setUpdateOpen(false);
      toast.success(`Version v${demo.version} updated`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!profile?.email) {
        throw new Error("Could not identify the current user");
      }
      if (!currentDemo) {
        throw new Error("Select a demo version before leaving feedback");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos?type=comments`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            demo_video_id: currentDemo.id,
            email: profile.email,
            body,
          }),
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? "Failed to post feedback");
      }

      return (await res.json()) as DemoComment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["demo-comments", currentDemo?.id],
      });
      setCommentBody("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSupportedMediaFile = (file: File) =>
    file.type.startsWith("video/") || file.type.startsWith("image/");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isSupportedMediaFile(file)) {
      toast.error("Please select a video or image file");
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleReplaceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isSupportedMediaFile(file)) {
      toast.error("Please select a video or image file");
      return;
    }

    replaceWithFileMutation.mutate(file);
  };

  const handleSubmitComment = () => {
    if (!commentBody.trim()) return;
    addCommentMutation.mutate(commentBody);
  };

  const hasDemos = (demosQuery.data?.length ?? 0) > 0;
  const comments = commentsQuery.data ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-[320px]">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Demo</h3>
        <p className="text-xs text-muted-foreground">
          Upload or embed demo videos and images for this issue and gather feedback
        </p>
      </div>

      {/* Add or update a version */}
      <div className="flex flex-wrap items-end gap-3">
        {hasDemos && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Version
            </span>
            <Select
              value={selectedVersion ? String(selectedVersion) : ""}
              onValueChange={(value) => setSelectedVersion(Number(value))}
            >
              <SelectTrigger className="w-40 bg-secondary border-0 text-card-foreground">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                {demosQuery.data?.map((demo) => (
                  <SelectItem key={demo.id} value={String(demo.version)}>
                    v{demo.version}
                    {demo.version === latestVersion ? " (latest)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            setCreateOpen((v) => !v);
            setUpdateOpen(false);
            setShowReplaceEmbedForm(false);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Version
        </Button>

        {currentDemo && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setUpdateOpen((v) => !v);
              setCreateOpen(false);
              setShowAddEmbedForm(false);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Update Version
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={replaceFileInputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={handleReplaceFileSelect}
        />
      </div>

      {/* Create Version: choose Add Link or Upload Media */}
      {createOpen && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setShowAddEmbedForm((v) => !v)}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Add Link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload Media
          </Button>
        </div>
      )}

      {/* Update Version: choose Add Link or Upload Media */}
      {updateOpen && currentDemo && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setShowReplaceEmbedForm((v) => !v)}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Add Link
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={replaceWithFileMutation.isPending}
            onClick={() => replaceFileInputRef.current?.click()}
          >
            {replaceWithFileMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload Media
          </Button>
        </div>
      )}

      {/* Add embed link form (new version) */}
      {showAddEmbedForm && (
        <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Video URL (e.g. Loom)
            </label>
            <Input
              value={addEmbedUrl}
              onChange={(e) => setAddEmbedUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
              className="bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={addEmbedMutation.isPending || !addEmbedUrl.trim()}
              onClick={() => addEmbedMutation.mutate(addEmbedUrl.trim())}
              className="gap-1.5"
            >
              {addEmbedMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LinkIcon className="h-3.5 w-3.5" />
              )}
              Add version
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={addEmbedMutation.isPending}
              onClick={() => {
                setShowAddEmbedForm(false);
                setAddEmbedUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Replace embed link form (existing version) */}
      {showReplaceEmbedForm && currentDemo && (
        <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Replace v{currentDemo.version} with video URL
            </label>
            <Input
              value={replaceEmbedUrl}
              onChange={(e) => setReplaceEmbedUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
              className="bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                replaceWithEmbedMutation.isPending || !replaceEmbedUrl.trim()
              }
              onClick={() =>
                replaceWithEmbedMutation.mutate(replaceEmbedUrl.trim())
              }
              className="gap-1.5"
            >
              {replaceWithEmbedMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LinkIcon className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={replaceWithEmbedMutation.isPending}
              onClick={() => {
                setShowReplaceEmbedForm(false);
                setReplaceEmbedUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Demo preview */}
      <div className="rounded-lg border border-border overflow-hidden min-h-[360px] bg-secondary/20">
        {demosQuery.isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[360px] text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mb-2" />
            Loading demos…
          </div>
        )}

        {demosQuery.isError && (
          <div className="flex flex-col items-center justify-center min-h-[360px] p-4 text-center">
            <p className="text-sm text-destructive">
              Failed to load demo videos.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please try closing and reopening the ticket.
            </p>
          </div>
        )}

        {!demosQuery.isLoading && !demosQuery.isError && !currentDemo && (
          <div className="flex flex-col items-center justify-center min-h-[360px] p-6 text-center">
            <Video className="h-8 w-8 mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No demo uploaded yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload a video/image or paste an embed link to create the first
              demo version.
            </p>
          </div>
        )}

        {currentDemo &&
          currentDemo.source_type === "upload" &&
          (isImageFile(currentDemo.file_name) ? (
            <div className="flex flex-col">
              <img
                key={currentDemo.id}
                className="w-full max-h-[560px] bg-black object-contain"
                src={currentDemo.file_url ?? undefined}
                alt={currentDemo.file_name ?? `Demo v${currentDemo.version}`}
              />
              <DemoMeta demo={currentDemo} latestVersion={latestVersion} />
            </div>
          ) : (
            <div className="flex flex-col">
              <video
                key={currentDemo.id}
                className="w-full max-h-[560px] bg-black"
                controls
                preload="metadata"
                src={currentDemo.file_url ?? undefined}
              >
                Your browser does not support video playback.
              </video>
              <DemoMeta demo={currentDemo} latestVersion={latestVersion} />
            </div>
          ))}

        {currentDemo && currentDemo.source_type === "embed" && (
          <div className="flex flex-col">
            <div className="relative w-full aspect-video bg-black">
              <iframe
                key={currentDemo.id}
                src={getEmbedIframeSrc(
                  currentDemo.embed_url ?? "",
                  currentDemo.embed_provider,
                )}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
            <DemoMeta demo={currentDemo} latestVersion={latestVersion} />
          </div>
        )}
      </div>

      {/* Feedback thread for the selected version */}
      {currentDemo && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">
            Feedback on v{currentDemo.version}
          </h4>

          {commentsQuery.isLoading && (
            <p className="text-xs text-muted-foreground">Loading feedback…</p>
          )}

          {!commentsQuery.isLoading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No feedback yet on this version.
            </p>
          )}

          {comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-border bg-secondary/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {displayName(comment.author)}
                    </span>
                    {comment.author?.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary capitalize">
                        {comment.author.role}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Leave feedback on this version…"
              className="bg-background min-h-[72px]"
            />
            <Button
              size="sm"
              className="self-end gap-1.5"
              disabled={addCommentMutation.isPending || !commentBody.trim()}
              onClick={handleSubmitComment}
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Post feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoMeta({
  demo,
  latestVersion,
}: {
  demo: Demo;
  latestVersion?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-border bg-background">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {demo.source_type === "upload"
            ? demo.file_name
            : demo.embed_provider
              ? `${demo.embed_provider} link`
              : "Embedded link"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          v{demo.version}
          {demo.uploader ? ` · ${displayName(demo.uploader)}` : ""}
          {demo.created_at
            ? ` · ${new Date(demo.created_at).toLocaleString()}`
            : ""}
        </p>
      </div>
      {demo.version === latestVersion && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-semibold">
          Latest
        </span>
      )}
    </div>
  );
}
