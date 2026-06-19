"use client";

import { Badge } from "@/components/ui/badge";
import { Pencil, Gauge } from "lucide-react";
import { type Issue, priorityColors, statusColors } from "./issues.types";

function EstimateBadge({ estimate }: { readonly estimate: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-chart-1/30 bg-chart-1/10 text-chart-1"
    >
      <Gauge className="h-3 w-3" />
      {estimate}
    </Badge>
  );
}

const LABEL_COLOR_CLASSES: Record<string, string> = {
  bug: "bg-destructive text-white",
  improvement: "bg-[hsl(210,70%,35%)] text-white",
  feature: "bg-success text-white",
};

function LabelPill({
  label,
}: {
  readonly label: { id: string; name: string; color: string };
}) {
  const knownClass = LABEL_COLOR_CLASSES[label.name.toLowerCase()];

  if (knownClass) {
    return (
      <Badge variant="secondary" className={`border-transparent ${knownClass}`}>
        {label.name}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="border-transparent text-white"
      style={{ backgroundColor: label.color }}
    >
      {label.name}
    </Badge>
  );
}

export function IssueCard({
  issue,
  onOpen,
  onEdit,
  hasUpdate,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onEdit?: () => void;
  readonly hasUpdate?: boolean;
}) {
  return (
    <div className="relative flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:scale-[1.02] hover:shadow-md transition-all duration-150">
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
      {hasUpdate && (
        <span
          className="absolute -top-1.5 -right-1.5 z-10 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-background"
          title="Recently updated"
        />
      )}
      {onEdit && (
        <button
          type="button"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit ticket"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            {issue.branchName.slice(0, 7).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={priorityColors[issue.priorityLabel]}
          >
            {issue.priorityLabel}
          </Badge>
          {issue.estimate != null && <EstimateBadge estimate={issue.estimate} />}
        </div>
        <p className="text-sm font-medium text-background-foreground mb-3 line-clamp-2">
          {issue.title}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge
            variant="secondary"
            className={
              statusColors[issue?.state?.name as keyof typeof statusColors]
            }
          >
            {issue?.state?.name}
          </Badge>
          {issue.labels?.nodes?.map((l) => (
            <LabelPill key={l.id} label={l} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IssueListRow({
  issue,
  onOpen,
  onEdit,
  hasUpdate,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onEdit?: () => void;
  readonly hasUpdate?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-all border border-transparent hover:border-border">
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
      {hasUpdate && (
        <span
          className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0"
          title="Recently updated"
        />
      )}
      <span className="text-[10px] font-mono text-muted-foreground w-14 flex-shrink-0">
        {issue.branchName.slice(0, 7).toUpperCase()}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] flex-shrink-0 ${priorityColors[issue.priorityLabel]}`}
      >
        {issue.priorityLabel}
      </Badge>
      {issue.estimate != null && (
        <Badge
          variant="outline"
          className="gap-1 text-[10px] flex-shrink-0 border-chart-1/30 bg-chart-1/10 text-chart-1"
        >
          <Gauge className="h-3 w-3" />
          {issue.estimate}
        </Badge>
      )}
      <p
        className={`text-xs font-medium flex-1 truncate ${issue.state?.name === "Development" ? "text-yellow-400" : ""}`}
      >
        {issue.title}
      </p>
      {issue.labels?.nodes?.map((l) => (
        <LabelPill key={l.id} label={l} />
      ))}
      {onEdit && (
        <button
          type="button"
          className="relative z-10 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit ticket"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
