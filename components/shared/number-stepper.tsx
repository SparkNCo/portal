"use client";

import type { ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Replaces the browser's native (and inconsistently styled) number input
// spinner with a bordered up/down chevron pair matching the rest of this
// app's inputs — [appearance:textfield] below hides the native one so it's
// never shown doubled up.
export function NumberStepper({
  id,
  value,
  onChange,
  onBump,
  step,
  min,
  max,
  autoFocus,
  placeholder,
  className,
  leadingSlot,
  invalid = false,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBump: (delta: number) => void;
  step: number;
  min: number;
  max?: number;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  leadingSlot?: ReactNode;
  // The value breaks the caller's rule: red ring, and announced as invalid.
  invalid?: boolean;
  // Id of the element explaining what's wrong.
  describedBy?: string;
}) {
  return (
    // cn (tailwind-merge): a caller's className replaces the base classes it
    // conflicts with (e.g. "border-0 bg-muted/40" over the bordered default).
    <div
      className={cn(
        "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring",
        className,
        invalid && "ring-1 ring-destructive focus-within:ring-destructive",
      )}
    >
      {leadingSlot}
      <input
        id={id}
        autoFocus={autoFocus}
        type="number"
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent pl-2 smalltext focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-input">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onBump(step)}
          className="flex flex-1 items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onBump(-step)}
          className="flex flex-1 items-center justify-center border-t border-input px-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
