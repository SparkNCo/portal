import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectSelect } from "@/components/shared/project-select";
import { PrioritySelect } from "@/components/shared/priority-select";

// Title is always visible; the Continue button sits next to it (same row on
// desktop, stacked on mobile) until details are revealed, then disappears.
export function TitleContinueRow({
  title,
  onTitleChange,
  detailsRevealed,
  onContinue,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  detailsRevealed: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="issue-title">Title</Label>
        <Input
          id="issue-title"
          placeholder="Brief summary..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !detailsRevealed && title.trim()) onContinue();
          }}
          className="bg-secondary border-0 text-card-foreground placeholder:text-card-foreground/40"
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
      <Label htmlFor="issue-project">
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

export function PriorityField({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="issue-priority">Priority</Label>
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
