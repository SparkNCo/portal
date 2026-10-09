import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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

// A numbered list of one-line inputs — Bug Report's "Steps to Reproduce" and
// Feature Request's "Criteria". Enter moves to the next item (adding one at
// the end); items can be removed while there's more than one.
export function ListItemsField({
  label,
  items,
  onChange,
  itemLabel,
  placeholderFor,
  addLabel,
}: {
  readonly label: React.ReactNode;
  readonly items: string[];
  readonly onChange: (items: string[]) => void;
  /** e.g. "Step" → "Step 1" for each input's accessible name. */
  readonly itemLabel: string;
  readonly placeholderFor: (index: number) => string;
  readonly addLabel: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return;
    inputRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex, items.length]);

  function update(index: number, value: string) {
    onChange(items.map((s, i) => (i === index ? value : s)));
  }

  function remove(index: number) {
    if (items.length > 1) onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index === items.length - 1) onChange([...items, ""]);
    setFocusIndex(index + 1);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 smalltext text-muted-foreground">{i + 1}.</span>
            <Input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              aria-label={`${itemLabel} ${i + 1}`}
              placeholder={placeholderFor(i)}
              value={item}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="bg-card border-0 text-card-foreground placeholder:text-card-foreground/40"
            />
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => remove(i)}
                aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="ml-6" onClick={() => onChange([...items, ""])}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
