"use client";

import { Badge } from "@/components/ui/badge";
import { Pencil, Gauge, Bug, Lightbulb, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Issue, priorityColors, statusColors } from "./issues.types";

function EstimateBadge({ estimate }: { readonly estimate: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 smalltext border-chart-1/30 bg-chart-1/10 text-chart-1"
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

export const LABEL_ICONS: Record<string, { Icon: LucideIcon; className: string }> = {
  bug: { Icon: Bug, className: "text-destructive" },
  feature: { Icon: Lightbulb, className: "text-success" },
};

export function LabelPill({
  label,
  iconOnly = false,
}: {
  readonly label: { id: string; name: string; color: string };
  readonly iconOnly?: boolean;
}) {
  const key = label.name.toLowerCase();

  if (iconOnly && LABEL_ICONS[key]) {
    const { Icon, className } = LABEL_ICONS[key];
    return (
      <span title={label.name} aria-label={label.name} className="shrink-0">
        <Icon className={`h-3.5 w-3.5 ${className}`} aria-hidden="true" />
      </span>
    );
  }

  const knownClass = LABEL_COLOR_CLASSES[key];

  if (knownClass) {
    return (
      <Badge variant="secondary" className={`smalltext border-transparent ${knownClass}`}>
        {label.name}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="smalltext border-transparent text-white"
      style={{ backgroundColor: "#8D1111" }}
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
  lightCard = false,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onEdit?: () => void;
  readonly hasUpdate?: boolean;
  readonly lightCard?: boolean;
}) {
  const typeLabel = issue.labels?.nodes?.find((l) => LABEL_ICONS[l.name.toLowerCase()]);
  const typeIcon = typeLabel ? LABEL_ICONS[typeLabel.name.toLowerCase()] : undefined;
  const otherLabels = issue.labels?.nodes?.filter((l) => l.id !== typeLabel?.id);

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border hover:shadow-md transition-all duration-150",
        lightCard ? "light-card" : "bg-background hover:bg-muted text-foreground",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
      {hasUpdate && (
        <span
          className="absolute -top-2 -right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background"
          title="Recently updated"
        >
          <Mail className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      {onEdit && (
        <button
          type="button"
          className={cn(
            "absolute top-2 right-2 z-10 p-1.5 rounded-md flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
            lightCard
              ? "light-card-chip"
              : "text-muted-foreground hover:text-primary hover:bg-background",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit ticket"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="p-4 ">
        <div className="flex items-center gap-2 mb-2">
          {typeIcon && (
            <typeIcon.Icon
              className={`h-3.5 w-3.5 shrink-0 ${typeIcon.className}`}
              aria-label={typeLabel!.name}
            />
          )}
          <span
            className={cn(
              "smalltext font-mono",
              lightCard ? "light-card-muted" : "text-muted-foreground",
            )}
          >
            {issue.branchName.slice(0, 7).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={`smalltext ${priorityColors[issue.priorityLabel]}`}
          >
            {issue.priorityLabel}
          </Badge>
        </div>
        <p
          className={cn(
            "smalltext font-medium mb-3 line-clamp-2",
            lightCard ? "light-card-text" : "text-foreground",
          )}
        >
          {issue.title}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge
            variant="secondary"
            className={`smalltext ${
              statusColors[issue?.state?.name as keyof typeof statusColors]
            }`}
          >
            {issue?.state?.name}
          </Badge>
          {issue.estimate != null && <EstimateBadge estimate={issue.estimate} />}
          {otherLabels?.map((l) => (
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
  lightCard = false,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onEdit?: () => void;
  readonly hasUpdate?: boolean;
  readonly lightCard?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all border border-transparent hover:border-border",
        lightCard ? "light-card" : "bg-background hover:bg-muted text-foreground",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer "
        onClick={onOpen}
        aria-label={issue.title}
      />
      {hasUpdate && (
        <span
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-orange-500"
          title="Recently updated"
        >
          <Mail className="h-2 w-2 text-white" />
        </span>
      )}
      <span
        className={cn(
          "smalltext font-mono w-20 flex-shrink-0",
          lightCard ? "light-card-muted" : "text-muted-foreground",
        )}
      >
        {issue.branchName.slice(0, 7).toUpperCase()}
      </span>
      <Badge
        variant="outline"
        className={`smalltext flex-shrink-0 ${priorityColors[issue.priorityLabel]}`}
      >
        {issue.priorityLabel}
      </Badge>
      {issue.estimate != null && (
        <Badge
          variant="outline"
          className="gap-1 smalltext flex-shrink-0 border-chart-1/30 bg-chart-1/10 text-chart-1"
        >
          <Gauge className="h-3 w-3" />
          {issue.estimate}
        </Badge>
      )}
      <p
        className={cn(
          "smalltext font-medium flex-1 truncate",
          issue.state?.name === "Development"
            ? "text-yellow-400"
            : lightCard
              ? "light-card-text"
              : "text-foreground",
        )}
      >
        {issue.title}
      </p>
      {issue.labels?.nodes?.map((l) => (
        <LabelPill key={l.id} label={l} iconOnly />
      ))}
      {onEdit && (
        <button
          type="button"
          className={cn(
            "relative z-10 p-1 rounded-md flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
            lightCard
              ? "light-card-chip"
              : "text-muted-foreground hover:text-primary hover:bg-background",
          )}
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
