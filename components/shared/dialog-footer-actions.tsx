"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";

export function DialogFooterActions({
  onCancel,
  onSubmit,
  submitDisabled,
  pending,
  submitLabel,
  cancelLabel = "Cancel",
  // Extra classes for both buttons — e.g. "smalltext" for a modal that's opted
  // into the body/smalltext type scale. Left empty by default so every other
  // caller keeps its current (plain text-sm) look.
  buttonClassName,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  pending: boolean;
  submitLabel: string;
  cancelLabel?: string;
  buttonClassName?: string;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={pending}
        className={cn("flex-1", buttonClassName)}
      >
        {cancelLabel}
      </Button>
      <Button
        onClick={onSubmit}
        disabled={submitDisabled || pending}
        className={cn("flex-1 bg-primary text-primary-foreground hover:bg-primary/90", buttonClassName)}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}
