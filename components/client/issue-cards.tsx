"use client";

import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { type Issue, priorityColors, statusColors } from "./issues.types";

export function IssueCard({
  issue,
  onOpen,
  onOpenChat,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onOpenChat?: (title: string) => void;
}) {
  const chatTitle = `${issue.branchName.slice(0, 7).toUpperCase()} ${issue.title}`;
  return (
    <div
      className="flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:scale-[1.02] hover:shadow-md transition-all duration-150 cursor-pointer"
      onClick={onOpen}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            {issue.branchName.slice(0, 7).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={priorityColors[issue.priorityLabel as keyof typeof priorityColors]}
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
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={statusColors[issue?.state?.name as keyof typeof statusColors]}
          >
            {issue?.state?.name}
          </Badge>
          {onOpenChat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(chatTitle);
              }}
              className="text-muted-foreground hover:text-accent transition-colors"
              title="Open chat about this issue"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function IssueListRow({
  issue,
  onOpen,
  onOpenChat,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onOpenChat?: (title: string) => void;
}) {
  const chatTitle = `${issue.branchName.slice(0, 7).toUpperCase()} ${issue.title}`;
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-all border border-transparent hover:border-border group"
      onClick={onOpen}
    >
      <span className="text-[10px] font-mono text-muted-foreground w-14 flex-shrink-0">
        {issue.branchName.slice(0, 7).toUpperCase()}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] flex-shrink-0 ${priorityColors[issue.priorityLabel as keyof typeof priorityColors]}`}
      >
        {issue.priorityLabel}
      </Badge>
      <p className={`text-xs font-medium flex-1 truncate ${issue.state?.name === "Development" ? "text-yellow-400" : ""}`}>
        {issue.title}
      </p>
      {onOpenChat && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat(chatTitle);
          }}
          className="text-muted-foreground hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          title="Open chat about this issue"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
