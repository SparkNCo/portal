"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type InlineSelectOption = {
  readonly value: string;
  readonly label: ReactNode;
  /** Classes for this option while it's the current value (e.g. its priority/status color). */
  readonly activeClassName?: string;
};

/**
 * A dropdown that saves as soon as an option is picked (no Submit button) —
 * a badge (or a custom trigger) that opens a popover list. While `saving`,
 * the badge shows a spinner and the picker is locked, so it's clear the new
 * value is on its way and can't be changed again mid-save.
 */
export function InlineSelect({
  label,
  options,
  value,
  onSelect,
  saving = false,
  loading = false,
  disabled = false,
  emptyText,
  clearLabel,
  onClear,
  onOpenChange,
  trigger,
  badgeVariant = "outline",
  badgeClassName,
  triggerClassName,
  contentClassName,
  optionClassName = "text-muted-foreground hover:bg-muted",
  align = "start",
}: {
  /** Badge content. Ignored when `trigger` is given. */
  readonly label?: ReactNode;
  readonly options: readonly InlineSelectOption[];
  /** The current value, highlighted with its option's `activeClassName`. */
  readonly value?: string | null;
  readonly onSelect: (value: string) => void;
  /** A picked value is being saved — shows the spinner and locks the picker. */
  readonly saving?: boolean;
  /** The options themselves are still loading. */
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Shown when there are no options (once loaded). */
  readonly emptyText?: string;
  /** Adds a first entry that clears the value (e.g. "No milestone"). */
  readonly clearLabel?: string;
  readonly onClear?: () => void;
  /** Notified when the popover opens/closes, e.g. to lazy-load the options. */
  readonly onOpenChange?: (open: boolean) => void;
  /** Replaces the badge, e.g. an icon button. The caller shows its own spinner via `saving`. */
  readonly trigger?: ReactNode;
  readonly badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  readonly badgeClassName?: string;
  readonly triggerClassName?: string;
  readonly contentClassName?: string;
  /** Classes for options that aren't the current value. */
  readonly optionClassName?: string;
  readonly align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const locked = disabled || saving;

  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function pick(action: () => void) {
    changeOpen(false);
    action();
  }

  const optionBase =
    "smalltext px-2.5 py-1.5 rounded-md text-left font-medium transition-colors disabled:opacity-50";

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            disabled={locked}
            aria-busy={saving}
            className={cn(
              "min-w-0 focus:outline-none disabled:cursor-not-allowed",
              saving && "disabled:cursor-wait",
              triggerClassName,
            )}
          >
            <Badge
              variant={badgeVariant}
              className={cn(
                "smalltext gap-1.5 cursor-pointer transition-opacity hover:opacity-80",
                saving && "opacity-70",
                badgeClassName,
              )}
            >
              {saving && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
              {/* Badge is inline-flex — truncation needs a block child to
                  ellipsize against, or long names get hard-cut. */}
              <span className="block truncate">{label}</span>
            </Badge>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-56 p-1.5 bg-background border-border", contentClassName)}
      >
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="custom-scrollbar flex flex-col gap-0.5 max-h-72 overflow-y-auto">
            {onClear && (
              <button
                type="button"
                disabled={locked}
                className={cn(optionBase, optionClassName)}
                onClick={() => pick(onClear)}
              >
                {clearLabel}
              </button>
            )}
            {options.length === 0 && emptyText && (
              <p className="smalltext text-muted-foreground px-2.5 py-1.5">{emptyText}</p>
            )}
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={locked}
                  className={cn(
                    optionBase,
                    // bg-secondary is the light cream surface in this palette —
                    // don't use it here, it makes the label unreadable.
                    active ? (opt.activeClassName ?? "text-primary") : optionClassName,
                  )}
                  onClick={() => pick(() => onSelect(opt.value))}
                >
                  <span className="block truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
