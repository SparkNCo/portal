"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { useRef, useState } from "react";

const priorityTasks = [
  {
    id: "LIN-234",
    title: "Review API documentation",
    priority: "urgent",
    status: "needs-input",
    dueDate: "Today",
  },
  {
    id: "LIN-189",
    title: "Approve wireframe designs",
    priority: "high",
    status: "waiting",
    dueDate: "Tomorrow",
  },
  {
    id: "LIN-156",
    title: "Provide feedback on staging",
    priority: "high",
    status: "needs-input",
    dueDate: "Jan 12",
  },
  {
    id: "LIN-142",
    title: "Sign off on milestone 2",
    priority: "medium",
    status: "waiting",
    dueDate: "Jan 15",
  },
  {
    id: "LIN-128",
    title: "Review database schema changes",
    priority: "medium",
    status: "needs-input",
    dueDate: "Jan 16",
  },
  {
    id: "LIN-115",
    title: "Approve final designs for homepage",
    priority: "high",
    status: "waiting",
    dueDate: "Jan 18",
  },
];

const priorityColors = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-warning/20 text-warning border-warning/30",
  Medium: "bg-accent/20 text-accent border-accent/30",
  Low: "bg-muted/50 text-muted-foreground border-muted",
};

const statusColors = {
  "needs-input": "bg-chart-1/20 text-chart-1",
  Backlog: "bg-muted/50 text-muted-foreground",
  Todo: "bg-slate-500/20 text-slate-600",
  "In Progress": "bg-warning/20 text-warning",
  "In Review": "bg-blue-500/20 text-blue-600",
  Canceled: "bg-destructive/20 text-destructive",
  waiting: "bg-muted text-muted-foreground",
  Done: "bg-success/20 text-success",
};

export type Issue = {
  id: string;
  branchName: string;
  priorityLabel: "Urgent" | "High" | "Medium" | "Low";
  title: string;
  state?: {
    name:
      | "needs-input"
      | "Backlog"
      | "Todo"
      | "In Progress"
      | "In Review"
      | "Canceled"
      | "waiting"
      | "Done";
  };
};

export type PriorityTasksProps = {
  issuesData: Issue[];
};

export function PriorityTasks({ issuesData }: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card border-border h-full flex flex-col max-w-[50rem] py-4">
      <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Priority Tasks
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "View all"}
          <ArrowRight
            className={`ml-1 h-3 w-3 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className={`
    grid
    gap-4
    pb-2
    scrollbar-thin
    scrollbar-thumb-border
    scrollbar-track-transparent

    ${
      expanded
        ? `
          grid-flow-row
          grid-cols-[repeat(auto-fill,minmax(280px,1fr))]
          auto-rows-auto
          overflow-visible
          h-auto
        `
        : `
          grid-rows-2
          grid-flow-col
          auto-cols-[280px]
          overflow-x-auto
          h-full
        `
    }
  `}
        >
          {issuesData.map((issue) => (
            <div
              key={issue.id}
              className="flex-shrink-0 w-[280px] even:mb-4 rounded-lg border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors cursor-pointer "
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {issue.branchName.slice(0, 7).toUpperCase()}
                </span>
                <Badge
                  variant="outline"
                  className={
                    priorityColors[
                      issue.priorityLabel as keyof typeof priorityColors
                    ]
                  }
                >
                  {issue.priorityLabel}
                </Badge>
              </div>
              <p className="text-sm font-medium text-card-foreground mb-3 line-clamp-2">
                {issue.title}
              </p>
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className={
                    statusColors[
                      issue?.state?.name as keyof typeof statusColors
                    ]
                  }
                >
                  {issue?.state?.name}
                </Badge>
                {/* <Badge
                  variant="secondary"
                  className={
                    statusColors[task.assignee as keyof typeof statusColors]
                  }
                >
                  {task.assignee.replace("-", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {task.dueDate}
                </span> */}
                {/* <span className="text-xs text-muted-foreground">
                  {task.description}
                </span> */}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
