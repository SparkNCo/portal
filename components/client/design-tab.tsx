"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import mermaid from "mermaid";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { API_HEADERS } from "@/lib/api-headers";
import type { Issue } from "./issues.types";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "strict",
});

type Service = {
  id: string;
  project_slug: string;
  name: string;
};

type Diagram = {
  id: string;
  service_id: string;
  issue_id: string;
  version: number;
  mermaid_source: string | null;
  created_at: string;
};

const NEW_SERVICE = "__new__";

function MermaidDiagram({ source }: { source: string }) {
  const renderId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    mermaid
      .render(`mermaid-${renderId}`, source)
      .then((result) => {
        if (!cancelled) setSvg(result.svg);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, renderId]);

  if (error) {
    return (
      <p className="text-sm text-destructive p-4">
        Failed to render diagram: {error}
      </p>
    );
  }
  if (!svg) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        Rendering diagram…
      </p>
    );
  }
  return (
    <div
      className="p-4 overflow-auto [&_svg]:mx-auto"
      // biome-ignore lint: mermaid.render output is trusted, rendered with securityLevel "strict"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function DesignTab({ issue }: { issue: Issue }) {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const projectSlug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const isCreatingNew = selectedServiceId === NEW_SERVICE;
  const activeServiceId = isCreatingNew ? "" : selectedServiceId;

  const servicesQuery = useQuery({
    queryKey: ["diagram-services", projectSlug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diagrams?type=services&project_slug=${encodeURIComponent(projectSlug)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load services");
      return (await res.json()) as Service[];
    },
    enabled: !!projectSlug,
  });

  // Diagrams already uploaded from this issue (any service) — used only to
  // default the "Service" dropdown to the last one this issue uploaded to.
  const issueDiagramsQuery = useQuery({
    queryKey: ["diagram-issue", issue.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diagrams?issue_id=${issue.id}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load issue diagrams");
      return (await res.json()) as Diagram[];
    },
  });

  useEffect(() => {
    const lastServiceId = issueDiagramsQuery.data?.[0]?.service_id;
    if (!selectedServiceId && lastServiceId) {
      setSelectedServiceId(lastServiceId);
    }
  }, [selectedServiceId, issueDiagramsQuery.data]);

  const versionsQuery = useQuery({
    queryKey: ["diagram-versions", activeServiceId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diagrams?service_id=${activeServiceId}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load versions");
      return (await res.json()) as Diagram[];
    },
    enabled: !!activeServiceId,
  });

  useEffect(() => {
    setSelectedVersion(versionsQuery.data?.[0]?.version ?? null);
  }, [versionsQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!projectSlug)
        throw new Error("Could not identify the current project");
      if (!profile?.email)
        throw new Error("Could not identify the current user");
      if (isCreatingNew && !newServiceName.trim()) {
        throw new Error("Enter a name for the new service");
      }
      if (!isCreatingNew && !selectedServiceId) {
        throw new Error("Select a service before uploading the diagram");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("project_slug", projectSlug);
      formData.append("issue_id", issue.id);
      formData.append("email", profile.email);
      if (isCreatingNew) {
        formData.append("service_name", newServiceName.trim());
      } else {
        formData.append("service_id", selectedServiceId);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/diagrams`, {
        method: "POST",
        headers: API_HEADERS,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Diagram upload failed");
      }

      return (await res.json()) as { service: Service; diagram: Diagram };
    },
    onSuccess: ({ service, diagram }) => {
      queryClient.invalidateQueries({
        queryKey: ["diagram-services", projectSlug],
      });
      queryClient.invalidateQueries({
        queryKey: ["diagram-versions", service.id],
      });
      setSelectedServiceId(service.id);
      setNewServiceName("");
      setSelectedVersion(diagram.version);
      toast.success(`Diagram uploaded (v${diagram.version})`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadMutation.mutate(file);
  };

  const canUpload = isCreatingNew
    ? !!newServiceName.trim()
    : !!selectedServiceId;
  const latestVersion = versionsQuery.data?.[0]?.version;
  const currentDiagram = versionsQuery.data?.find(
    (d) => d.version === selectedVersion,
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[320px]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Service
          </span>
          <Select
            value={selectedServiceId}
            onValueChange={(value) => {
              setSelectedServiceId(value);
              setNewServiceName("");
            }}
          >
            <SelectTrigger className="w-56 bg-secondary border-0">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_SERVICE}>
                + Create new service
              </SelectItem>
              {servicesQuery.data?.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCreatingNew && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Service name
            </span>
            <Input
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="e.g. Auth Service"
              className="w-56 bg-secondary border-0"
            />
          </div>
        )}

        {!isCreatingNew && selectedServiceId && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Version
            </span>
            <Select
              value={selectedVersion ? String(selectedVersion) : ""}
              onValueChange={(value) => setSelectedVersion(Number(value))}
            >
              <SelectTrigger className="w-40 bg-secondary border-0">
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                {versionsQuery.data?.map((diagram) => (
                  <SelectItem key={diagram.id} value={String(diagram.version)}>
                    v{diagram.version}
                    {diagram.version === latestVersion ? " (latest)" : ""}
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
          disabled={!canUpload || uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload new version
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mmd,.mermaid,text/plain"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden min-h-[360px] bg-secondary/20">
        {!selectedServiceId && (
          <p className="text-sm text-muted-foreground italic p-4">
            Choose or create a service to see its diagrams.
          </p>
        )}
        {isCreatingNew && (
          <p className="text-sm text-muted-foreground italic p-4">
            Enter a name and upload a .mmd file to create the service.
          </p>
        )}
        {!isCreatingNew && selectedServiceId && versionsQuery.isLoading && (
          <p className="text-sm text-muted-foreground italic p-4">
            Loading diagrams…
          </p>
        )}
        {!isCreatingNew &&
          selectedServiceId &&
          !versionsQuery.isLoading &&
          !currentDiagram && (
            <p className="text-sm text-muted-foreground italic p-4">
              This service doesn't have any diagrams uploaded yet.
            </p>
          )}
        {currentDiagram?.mermaid_source && (
          <MermaidDiagram source={currentDiagram.mermaid_source} />
        )}
      </div>
    </div>
  );
}
