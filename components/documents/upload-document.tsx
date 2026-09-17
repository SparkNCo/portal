"use client";

import type React from "react";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, File, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../AuthContext";
import { useUser } from "context/UserContext";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";

interface UploadedFile {
  name: string;
  size: string;
  status: "uploading" | "complete" | "error";
}

function useUploadFile() {
  const { user, profile, loading } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      userId,
      email,
      projectSlug,
      sharedWithEmails,
    }: {
      file: File;
      userId: string;
      email: string;
      projectSlug: string;
      // Everyone else assigned to this initiative — granted "write" access
      // alongside the uploader's "owner", so a document filed under a
      // project isn't only ever visible to whoever happened to upload it.
      sharedWithEmails?: string[];
    }) => {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("bucket", "documents_bucket");
      formData.append("path", `uploads/${Date.now()}-${file.name}`);
      formData.append("user_id", user?.id);
      formData.append("email", email);
      formData.append("project_slug", projectSlug);
      if (sharedWithEmails?.length) {
        formData.append("shared_with_emails", sharedWithEmails.join(","));
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage`, {
        method: "POST",
        headers: API_HEADERS,
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/* -----------------------------
   Component
--------------------------------*/

export function UploadDocument({
  projectSlug,
}: {
  // Which project the upload is filed under — resolved by the page from
  // whichever project is currently selected (e.g. the sidebar dropdown for
  // a developer with multiple assignments, see components/sidebar.tsx).
  readonly projectSlug?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const uploadMutation = useUploadFile();

  const targetProjectSlug = projectSlug ?? "";
  const canUploadNow = !!targetProjectSlug;

  // Resolve the initiative's customer + stakeholders so an upload shares
  // with the client side automatically, not just whoever happened to
  // upload it — developers already have their own access via being
  // assigned, so they're deliberately left out of this list.
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<{ id: string; email: string; linear_slug: string | null }[]>;
    },
    enabled: canUploadNow,
  });
  const matchedCustomer = customers?.find(
    (c) => c.linear_slug?.toLowerCase() === targetProjectSlug.toLowerCase(),
  );
  const matchedCustomerId = matchedCustomer?.id;

  const { data: assignments } = useQuery({
    queryKey: ["assignments", matchedCustomerId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${matchedCustomerId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json() as Promise<{ email: string; role: string }[]>;
    },
    enabled: !!matchedCustomerId,
  });
  const initiativeEmails = Array.from(
    new Set(
      [
        ...(assignments ?? []).filter((a) => a.role === "stakeholder").map((a) => a.email),
        matchedCustomer?.email,
      ].filter((e): e is string => !!e),
    ),
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canUploadNow) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canUploadNow) return;
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          status: "uploading",
        },
      ]);

      uploadMutation.mutate(
        {
          file,
          userId: user!.id,
          email: user!.email!,
          projectSlug: targetProjectSlug,
          sharedWithEmails: initiativeEmails,
        },
        {
          onSuccess: () => {
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.name === file.name ? { ...f, status: "complete" } : f,
              ),
            );
          },
          onError: () => {
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.name === file.name ? { ...f, status: "error" } : f,
              ),
            );
          },
        },
      );
    });
  };

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  return (
    <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground">
      <CardHeader>
        <CardTitle className="body font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          Upload Document
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => canUploadNow && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
            !canUploadNow
              ? "cursor-not-allowed opacity-50 border-border"
              : "cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : canUploadNow &&
                  "border-border hover:border-primary/50 hover:bg-secondary/30",
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="smalltext font-medium text-foreground text-center">
            {canUploadNow
              ? "Drag and drop files here, or click to browse"
              : "No project selected to upload to"}
          </p>
          <p className="smalltext text-muted-foreground mt-1">
            PDF, DOCX, XLSX, PNG, JPG up to 50MB
          </p>
        </div>

        <Input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={!canUploadNow}
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
          aria-label="Upload document files"
        />

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="smalltext font-medium text-muted-foreground">
              Uploaded Files
            </p>

            {uploadedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2"
              >
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="smalltext text-foreground truncate max-w-[150px]">
                      {file.name}
                    </p>
                    <p className="smalltext text-muted-foreground">{file.size}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {file.status === "complete" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : file.status === "error" ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.name);
                    }}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
