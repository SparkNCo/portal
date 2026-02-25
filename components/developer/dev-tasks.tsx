"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ListTodo, ArrowRight, GitBranch } from "lucide-react"
import { Button } from "@/components/components/ui/button";

const tasks = [
  {
    id: "LIN-301",
    title: "Implement authentication flow",
    status: "in-progress",
    branch: "feat/auth",
    estimate: "3d",
  },
  {
    id: "LIN-298",
    title: "Fix dashboard loading state",
    status: "todo",
    branch: "fix/dashboard",
    estimate: "2h",
  },
  {
    id: "LIN-295",
    title: "Add unit tests for API routes",
    status: "todo",
    branch: "test/api",
    estimate: "1d",
  },
  {
    id: "LIN-290",
    title: "Optimize image loading",
    status: "review",
    branch: "perf/images",
    estimate: "4h",
  },
]

const statusColors = {
  "in-progress": "bg-chart-1/20 text-chart-1",
  todo: "bg-muted text-muted-foreground",
  review: "bg-chart-2/20 text-chart-2",
}

export function DevTasks() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-accent" />
          My Tasks
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                <Badge variant="secondary" className={statusColors[task.status as keyof typeof statusColors]}>
                  {task.status}
                </Badge>
              </div>
              <p className="text-sm font-medium text-card-foreground truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground">{task.branch}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground ml-4">{task.estimate}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
