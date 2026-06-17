"use client";

import { Badge } from "@/components/ui/badge";
import { type Issue, priorityColors, statusColors } from "./issues.types";

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
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
}) {
  return (
    <div className="relative flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:scale-[1.02] hover:shadow-md transition-all duration-150">
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
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
        </div>
        <p className="text-sm font-medium text-background-foreground mb-1 line-clamp-2">
          {issue.title}
        </p>
        {issue.description ? (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {issue.description}
          </p>
        ) : (
          <div className="mb-3" />
        )}
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
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
}) {
  return (
    <div className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-all border border-transparent hover:border-border">
      <button
        type="button"
        className="absolute inset-0 rounded-lg cursor-pointer"
        onClick={onOpen}
        aria-label={issue.title}
      />
      <span className="text-[10px] font-mono text-muted-foreground w-14 flex-shrink-0">
        {issue.branchName.slice(0, 7).toUpperCase()}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] flex-shrink-0 ${priorityColors[issue.priorityLabel]}`}
      >
        {issue.priorityLabel}
      </Badge>
      <p
        className={`text-xs font-medium flex-1 truncate ${issue.state?.name === "Development" ? "text-yellow-400" : ""}`}
      >
        {issue.title}
      </p>
      {issue.labels?.nodes?.map((l) => (
        <LabelPill key={l.id} label={l} />
      ))}
    </div>
  );
}
