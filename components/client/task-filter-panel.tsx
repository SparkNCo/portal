"use client";

import { statusColors, type FilterState } from "./issues.types";

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
    <div
      className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border bg-background shadow-xl p-4 space-y-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="menu"
      tabIndex={0}
    >
      {hasCycles && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Cycle
          </p>
          <button
            onClick={onToggleActive}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-medium ${
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableStatuses.map((status) => {
              const active = selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => onToggleStatus(status)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all ${
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Priority
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availablePriorities.map((priority) => {
              const active = selectedPriorities.includes(priority);
              return (
                <button
                  key={priority}
                  onClick={() => onTogglePriority(priority)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary/40 opacity-100"
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Date
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange?.(e.target.value)}
              className="h-7 flex-1 rounded-md border border-border bg-secondary/30 px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[11px] text-muted-foreground">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange?.(e.target.value)}
              className="h-7 flex-1 rounded-md border border-border bg-secondary/30 px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {availableLabels.length > 0 && onToggleLabel && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Labels
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableLabels.map((label) => {
              const active = selectedLabels.includes(label);
              return (
                <button
                  key={label}
                  onClick={() => onToggleLabel(label)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all ${
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

      {activeFilters > 0 && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          onClick={onClearFilters}
        >
          <span className="text-base leading-none">×</span> Clear all filters
        </button>
      )}
    </div>
  );
}
