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
        <Label>Title</Label>
        <Input
          placeholder="Brief summary..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-secondary border-0"
        />
      </div>
      {!detailsRevealed && (
        <Button
          onClick={onContinue}
          disabled={!title.trim()}
          className="bg-accent text-accent-foreground hover:bg-accent/90 sm:w-auto"
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
      <Label>
        Project{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <ProjectSelect projects={projects} value={value} onValueChange={onValueChange} />
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
      <Label>Priority</Label>
      <PrioritySelect value={value} onValueChange={onValueChange} />
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
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
    </div>
  );
}
