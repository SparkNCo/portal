"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lightbulb, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_JSON_HEADERS as API_HEADERS } from "@/lib/api-headers";

async function postCreateIssue(payload: {
  title: string;
  description: string;
  priority: string;
  slug: string;
  type?: string;
  projectId?: string;
  estimate?: number;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues/create`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create issue");
  return res.json();
}

async function fetchProjects(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/projects?slug=${slug}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json() as Promise<{ id: string; name: string }[]>;
}

function buildFeatureDescription(description: string, requirements: string) {
  return [
    `### Feature Description\n${description}`,
    requirements ? `### Requirement\n${requirements}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function FeatureRequestPanel({ slug }: { slug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [priority, setPriority] = useState("medium");
  const [estimate, setEstimate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: !!slug,
  });

  const mutation = useMutation({
    mutationFn: postCreateIssue,
    onSuccess: (data) => {
      toast.success(`Feature request submitted: ${data.issue?.identifier ?? ""}`);
      reset();
    },
    onError: () => toast.error("Failed to submit feature request. Please try again."),
  });

  function reset() {
    setTitle("");
    setDescription("");
    setRequirements("");
    setPriority("medium");
    setEstimate("");
    setSelectedProjectId("");
  }

  function handleSubmit() {
    if (!title.trim()) return;
    mutation.mutate({
      title: title.trim(),
      description: buildFeatureDescription(description, requirements),
      priority,
      slug,
      type: "feature",
      ...(selectedProjectId && { projectId: selectedProjectId }),
      ...(estimate && { estimate: Number(estimate) }),
    });
  }

  return (
    <Card className="bg-background">
      <CardHeader
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-chart-2" />
          Request a Feature
        </CardTitle>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </CardHeader>
      {expanded && (
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Title</Label>
            <Input
              placeholder="Brief summary..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-0"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Description</Label>
            <RichTextEditor
              placeholder="Describe the feature you'd like in plain language..."
              value={description}
              onChange={setDescription}
              className="border-0"
              minHeight="90px"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>
              Requirements{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <RichTextEditor
              placeholder="How will you know this feature is working well?"
              value={requirements}
              onChange={setRequirements}
              className="border-0"
              minHeight="70px"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Project{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-secondary border-0">
                <SelectValue
                  placeholder={projects.length ? "Select a project…" : "Loading projects…"}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Estimate (points){" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 3"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              className="bg-secondary border-0"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || mutation.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit Feature Request"
            )}
          </Button>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
