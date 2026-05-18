"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimelineHeader, TimelineMonthsHeader } from "./TimelineHeader";
import { ProjectRow } from "./ProjectRow";
import { IssueDetailModal, Issue } from "@/components/client/priority-tasks";
import { X } from "lucide-react";

export type MilestoneStatus =
  | "completed"
  | "in-progress"
  | "planned"
  | "overdue"
  | "unstarted"
  | "next";

export type Milestone = {
  createdAt: string;
  currentProgress: {
    scopeCount: number;
    scopeEstimate: number;
    unstartedEstimate: number;
    unstartedIssueCount: number;
  };
  description: string | null;
  issues: {
    nodes: any[];
  };
  name: string;
  progress: number;
  progressHistory: any[];
  projectName: string;
  status: MilestoneStatus;
  targetDate: string;
};

type RoadmapTimelineProps = {
  projectMilestones?: Milestone[];
};

const priorityColors: Record<string, string> = {
  Urgent: "bg-destructive/20 border-destructive/40 text-destructive",
  High: "bg-warning/20 border-warning/40 text-warning",
  Medium: "bg-chart-1/20 border-chart-1/40 text-chart-1",
  Low: "bg-muted border-border text-muted-foreground",
  "No priority": "bg-muted border-border text-muted-foreground",
};

const stateColors: Record<string, string> = {
  Done: "bg-success/20 border-success/40 text-success",
  Completed: "bg-success/20 border-success/40 text-success",
  "In Progress": "bg-chart-1/20 border-chart-1/40 text-chart-1",
  Todo: "bg-muted border-border text-muted-foreground",
  Backlog: "bg-muted border-border text-muted-foreground",
  Cancelled: "bg-destructive/20 border-destructive/40 text-destructive",
};

export function RoadmapTimeline({
  projectMilestones = [],
}: RoadmapTimelineProps) {
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const INITIAL_YEAR = new Date().getFullYear();
  const [year, setYear] = useState(INITIAL_YEAR);

  const groupedMilestones = useMemo(() => {
    return projectMilestones.reduce((acc: Record<string, Milestone[]>, m) => {
      const key = m.projectName ?? "Unknown Project";
      acc[key] ??= [];
      acc[key].push(m);
      return acc;
    }, {});
  }, [projectMilestones]);

  function handleMilestoneSelect(m: Milestone) {
    setSelectedMilestone((prev) =>
      prev?.name === m.name && prev?.projectName === m.projectName ? null : m,
    );
  }

  const selectedKey = selectedMilestone
    ? selectedMilestone.name + selectedMilestone.projectName
    : undefined;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-background">
        <TimelineHeader
          year={year}
          onPrev={() => setYear((y) => y - 1)}
          onNext={() => setYear((y) => y + 1)}
        />

        <CardContent className="overflow-x-auto">
          <div className="min-w-[560px]">
            <TimelineMonthsHeader year={year} />
            {Object.entries(groupedMilestones).map(
              ([projectName, milestones]) => (
                <ProjectRow
                  key={projectName}
                  projectName={projectName}
                  milestones={milestones}
                  year={year}
                  expanded={!!expandedProjects[projectName]}
                  onToggle={() =>
                    setExpandedProjects((p) => ({
                      ...p,
                      [projectName]: !p[projectName],
                    }))
                  }
                  onMilestoneSelect={handleMilestoneSelect}
                  selectedMilestoneId={selectedKey}
                />
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMilestone && (
        <Card className="bg-background ">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {selectedMilestone.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedMilestone.projectName}
                </p>
              </div>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedMilestone.issues.nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No issues in this milestone.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedMilestone.issues.nodes.map((issue: any, i: number) => (
                  <div
                    key={issue.id ?? i}
                    className="rounded-md border bg-background p-3 space-y-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => setSelectedIssue({
                      id: issue.id,
                      branchName: issue.identifier ?? issue.id,
                      title: issue.title ?? "Untitled",
                      priorityLabel: issue.priorityLabel ?? "Low",
                      state: issue.state,
                      description: issue.description ?? null,
                    })}
                  >
                    {(issue.identifier || issue.title) && (
                      <div className="space-y-0.5">
                        {issue.identifier && (
                          <p className="text-[10px] text-muted-foreground font-mono">{issue.identifier}</p>
                        )}
                        {issue.title && (
                          <p className="text-xs font-medium leading-snug">{issue.title}</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {issue.state?.name && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${stateColors[issue.state.name] ?? "bg-muted border-border text-muted-foreground"}`}
                        >
                          {issue.state.name}
                        </Badge>
                      )}
                      {issue.priorityLabel &&
                        issue.priorityLabel !== "No priority" && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${priorityColors[issue.priorityLabel] ?? ""}`}
                          >
                            {issue.priorityLabel}
                          </Badge>
                        )}
                    </div>

                    {issue.labels?.nodes?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {issue.labels.nodes.map((l: any) => (
                          <span
                            key={l.name}
                            className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground"
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {issue.assignee?.displayName && (
                        <p className="text-xs text-muted-foreground">
                          Assignee:{" "}
                          <span className="text-foreground">
                            {issue.assignee.displayName}
                          </span>
                        </p>
                      )}
                      {issue.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due:{" "}
                          <span className="text-foreground">
                            {new Date(issue.dueDate).toLocaleDateString()}
                          </span>
                        </p>
                      )}
                      {issue.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          Completed:{" "}
                          <span className="text-success">
                            {new Date(issue.completedAt).toLocaleDateString()}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}
