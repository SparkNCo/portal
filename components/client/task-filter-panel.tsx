"use client";

import { X } from "lucide-react";
import { priorityColors, statusColors, type FilterState } from "./issues.types";
import { Input } from "@/components/ui/input";

export function TaskFilterPanel({
  filterState,
  activeFilters,
}: {
  filterState: FilterState;
  activeFilters: number;
}) {
  const {
    selectedStatuses,
    onlyActive,
    availableStatuses,
    hasCycles,
    onToggleStatus,
    onToggleActive,
    onClearFilters,
    selectedLabels = [],
    availableLabels = [],
    onToggleLabel,
    selectedPriorities = [],
    availablePriorities = [],
    onTogglePriority,
    dateFrom = "",
    dateTo = "",
    onDateFromChange,
    onDateToChange,
  } = filterState;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="smalltext font-semibold text-foreground">Filters</p>
        {activeFilters > 0 && (
          <button
            className="smalltext text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            onClick={onClearFilters}
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      {/* Long status/label lists (e.g. the developer dashboard's merged
          multi-customer view) can otherwise push this panel past the
          viewport — cap it and let it scroll instead. */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
        {hasCycles && (
          <div>
            <p className="smalltext font-semibold text-primary mb-2">
              Cycle
            </p>
            <button
              onClick={onToggleActive}
              className={`smalltext px-3 py-1.5 rounded-md border transition-colors font-medium ${
                onlyActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Active cycle only
            </button>
          </div>
        )}

        {availableStatuses.length > 0 && (
          <div>
            <p className="smalltext font-semibold text-primary mb-2">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableStatuses.map((status) => {
                const active = selectedStatuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => onToggleStatus(status)}
                    className={`smalltext px-2.5 py-1 rounded-md border font-medium transition-all ${
                      active
                        ? `${statusColors[status as keyof typeof statusColors]} border-current opacity-100`
                        : "bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted opacity-70 hover:opacity-100"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {availablePriorities.length > 0 && onTogglePriority && (
          <div>
            <p className="smalltext font-semibold text-primary mb-2">
              Priority
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availablePriorities.map((priority) => {
                const active = selectedPriorities.includes(priority);
                return (
                  <button
                    key={priority}
                    onClick={() => onTogglePriority(priority)}
                    className={`smalltext px-2.5 py-1 rounded-md border font-medium transition-all ${
                      active
                        ? `${priorityColors[priority as keyof typeof priorityColors] ?? "bg-primary/20 text-primary border-primary/30"} opacity-100`
                        : "bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted opacity-70 hover:opacity-100"
                    }`}
                  >
                    {priority}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(onDateFromChange || onDateToChange) && (
          <div>
            <p className="smalltext font-semibold text-primary mb-2">
              Date
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 smalltext text-muted-foreground">
                  From
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange?.(e.target.value)}
                    className="h-7 bg-secondary/30 border-border smalltext"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 smalltext text-muted-foreground">
                  To
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange?.(e.target.value)}
                    className="h-7 bg-secondary/30 border-border smalltext"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {availableLabels.length > 0 && onToggleLabel && (
          <div>
            <p className="smalltext font-semibold text-primary mb-2">
              Labels
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableLabels.map((label) => {
                const active = selectedLabels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => onToggleLabel(label)}
                    className={`smalltext px-2.5 py-1 rounded-md border font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary/40 opacity-100"
                        : "bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted opacity-70 hover:opacity-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only pills for each currently-active filter, shown inline in the
// toolbar (outside the popover) so a filter can be seen/removed without
// opening the panel. Mirrors TaskFilterPanel's toggle semantics — clicking
// a chip's × calls the same toggle function to switch that value off.
export function ActiveFilterChips({ filterState }: { filterState: FilterState }) {
  const {
    selectedStatuses,
    onToggleStatus,
    onlyActive,
    onToggleActive,
    selectedLabels = [],
    onToggleLabel,
    selectedPriorities = [],
    onTogglePriority,
    dateFrom = "",
    dateTo = "",
    onDateFromChange,
    onDateToChange,
  } = filterState;

  // Colored per filter type instead of one flat gray — status/priority chips
  // reuse the exact same colors as their toggle buttons in the panel above
  // (statusColors/priorityColors), so a chip reads as "the same Status/
  // Priority you picked," not a generic tag. Labels and dates have no
  // per-value color of their own, so they get one consistent accent each
  // instead, still distinct from status/priority chips.
  const chips: { key: string; label: string; onRemove: () => void; className: string }[] = [
    ...(onlyActive
      ? [
          {
            key: "cycle",
            label: "Active cycle",
            onRemove: onToggleActive,
            className: "bg-primary/15 text-primary border-primary/30",
          },
        ]
      : []),
    ...selectedStatuses.map((s) => ({
      key: `status:${s}`,
      label: s,
      onRemove: () => onToggleStatus(s),
      className: `${statusColors[s as keyof typeof statusColors] ?? "bg-muted/40 text-muted-foreground"} border-current/30`,
    })),
    ...selectedPriorities.map((p) => ({
      key: `priority:${p}`,
      label: p,
      onRemove: () => onTogglePriority?.(p),
      className: priorityColors[p as keyof typeof priorityColors] ?? "bg-primary/20 text-primary border-primary/30",
    })),
    ...selectedLabels.map((l) => ({
      key: `label:${l}`,
      label: l,
      onRemove: () => onToggleLabel?.(l),
      className: "bg-secondary/60 text-secondary-foreground border-border",
    })),
    ...(dateFrom
      ? [
          {
            key: "dateFrom",
            label: `From ${dateFrom}`,
            onRemove: () => onDateFromChange?.(""),
            className: "bg-accent/10 text-accent border-accent/30",
          },
        ]
      : []),
    ...(dateTo
      ? [
          {
            key: "dateTo",
            label: `To ${dateTo}`,
            onRemove: () => onDateToChange?.(""),
            className: "bg-accent/10 text-accent border-accent/30",
          },
        ]
      : []),
  ];

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={chip.onRemove}
          className={`smalltext flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md border font-medium transition-all hover:brightness-110 hover:shadow-sm ${chip.className}`}
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
