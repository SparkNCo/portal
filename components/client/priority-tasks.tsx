"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

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
  urgent: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-accent/20 text-accent border-accent/30",
};

const statusColors = {
  "needs-input": "bg-chart-1/20 text-chart-1",
  waiting: "bg-muted text-muted-foreground",
};

export function PriorityTasks() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Priority Tasks
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="
    grid
    grid-rows-2
    grid-flow-col
    auto-cols-[280px]
    gap-4
    overflow-x-auto
    h-full
    pb-2
    scrollbar-thin
    scrollbar-thumb-border
    scrollbar-track-transparent
  "
        >
          {priorityTasks.map((task) => (
            <div
              key={task.id}
              className="flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {task.id}
                </span>
                <Badge
                  variant="outline"
                  className={
                    priorityColors[task.priority as keyof typeof priorityColors]
                  }
                >
                  {task.priority}
                </Badge>
              </div>
              <p className="text-sm font-medium text-card-foreground mb-3 line-clamp-2">
                {task.title}
              </p>
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className={
                    statusColors[task.status as keyof typeof statusColors]
                  }
                >
                  {task.status.replace("-", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {task.dueDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
