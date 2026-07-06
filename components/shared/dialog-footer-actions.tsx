"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";

export function DialogFooterActions({
  onCancel,
  onSubmit,
  submitDisabled,
  pending,
  submitLabel,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  pending: boolean;
  submitLabel: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={pending}
        className="flex-1"
      >
        {cancelLabel}
      </Button>
      <Button
        onClick={onSubmit}
        disabled={submitDisabled || pending}
        className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}
