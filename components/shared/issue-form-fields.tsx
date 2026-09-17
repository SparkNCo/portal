import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectSelect } from "@/components/shared/project-select";
import { MilestoneSelect } from "@/components/shared/milestone-select";
import { PrioritySelect } from "@/components/shared/priority-select";
import { SimilarIssuesHint } from "@/components/shared/similar-issues-hint";

// Title is always visible; the Continue button sits next to it (same row on
// desktop, stacked on mobile) until details are revealed, then disappears.
// When `slug` is provided, a "similar issue" hint is shown below the title as the
// user types, backed by the Upstash issues vector search — shared by both the
// Feature Request and Bug Report panels since they both render this component.
export function TitleContinueRow({
  title,
  onTitleChange,
  detailsRevealed,
  onContinue,
  slug,
  kind,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  detailsRevealed: boolean;
  onContinue: () => void;
  slug?: string;
  // Which panel this is — scopes the similar-issues hint to just bugs or just
  // features. See SimilarIssuesHint's own `kind` prop.
  kind: "bug" | "feature";
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="issue-title" className="smalltext">Title</Label>
          <Input
            id="issue-title"
            placeholder="Brief summary..."
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !detailsRevealed && title.trim()) onContinue();
            }}
            className="bg-card border-0 text-card-foreground placeholder:text-card-foreground/40"
            autoComplete="off"
          />
        </div>
        {!detailsRevealed && (
          <Button
            onClick={onContinue}
            disabled={!title.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            Continue
          </Button>
        )}
      </div>
      {/* Unmounted (not just hidden) once Continue is clicked — otherwise a
          debounced search already in flight would still land and pop the
          hint up after the user has moved on, whether it was showing
          already or hadn't resolved yet. */}
      {slug && !detailsRevealed && (
        <SimilarIssuesHint slug={slug} query={title} kind={kind} />
      )}
    </div>
  );
}

export function ProjectField({
  projects,
  value,
  onValueChange,
}: {
  projects: { id: string; name: string }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="issue-project" className="smalltext">
        Project{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <ProjectSelect
        id="issue-project"
        projects={projects}
        value={value}
        onValueChange={onValueChange}
      />
    </div>
  );
}

// Only rendered once a project is picked — milestones belong to a specific
// project, so there's nothing meaningful to choose (or fetch) before that.
export function MilestoneField({
  milestones,
  value,
  onValueChange,
}: {
  milestones: { id: string; name: string; targetDate: string | null }[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="issue-milestone" className="smalltext">
        Milestone{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <MilestoneSelect
        id="issue-milestone"
        milestones={milestones}
        value={value}
        onValueChange={onValueChange}
      />
    </div>
  );
}

export function PriorityField({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="issue-priority" className="smalltext">Priority</Label>
      <PrioritySelect id="issue-priority" value={value} onValueChange={onValueChange} />
    </div>
  );
}

export function SubmitButton({
  onClick,
  disabled,
  pending,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end">
      <Button
        onClick={onClick}
        disabled={disabled}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
    </div>
  );
}
