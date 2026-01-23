"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, ChevronLeft, ChevronRight, Calendar, Box } from "lucide-react";
import { cn } from "@/lib/utils";

const monthsGrid = [
  "Month 1",
  "Month 2",
  "Month 3",
  "Month 4",
  "Month 5",
  "Month 6",
  "Month 7",
  "Month 8",
  "Month 9",
  "Month 10",
  "Month 11",
  "Month 12",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const statusColors = {
  completed: "bg-success/20 border-success/40 text-success",
  "in-progress": "bg-chart-1/20 border-chart-1/40 text-chart-1",
  planned: "bg-muted border-border text-muted-foreground",
  overdue: "bg-warning/20 border-border text-warning",
};

const barColors = {
  completed: "bg-success",
  "in-progress": "bg-chart-1",
  planned: "bg-muted-foreground/30",
  overdue: "bg-warning/70 border-border text-warning",
};

function calculateProgress(
  issues?: {
    completedAt?: string | null;
    canceledAt?: string | null;
  }[],
) {
  if (!issues || issues.length === 0) return 0;

  const completed = issues.filter(
    (issue) => issue.completedAt || issue.canceledAt,
  ).length;

  return Math.round((completed / issues.length) * 100);
}

export function RoadmapTimeline({ projectName, projectMilestones = [] }) {
  const [milestonesData, setMilestonesData] = useState(projectMilestones);

  useEffect(() => {
    if (projectMilestones.length !== 0 && milestonesData.length === 0) {
      setMilestonesData(projectMilestones);
    }
  }, [projectMilestones]);

  const INITIAL_YEAR = new Date().getFullYear();

  function useYearNavigator() {
    const [year, setYear] = useState(INITIAL_YEAR);

    const next = () => setYear((y) => y + 1);
    const prev = () => setYear((y) => y - 1);

    return { year, next, prev };
  }

  const now = new Date();

  const [currentMonth] = useState(now.getMonth()); // 0–11
  const [currentYear] = useState(now.getFullYear());
  const { year, next, prev } = useYearNavigator();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Map className="h-4 w-4 text-accent" />
          {`${projectName}`} Timeline{" "}
        </CardTitle>
        <CardTitle
          className="text-base font-semibold flex items-center gap-2"
          onClick={() =>
            console.log({
              milesStonesData: milestonesData,
            })
          }
        >
          Ver ProjectMilestones !!!!
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={prev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 bg-transparent"
          >
            <Calendar className="h-3 w-3" />
            {year}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={next}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Week headers */}
            <div className="flex border-b border-border pb-2 mb-4">
              <div className="w-56 shrink-0" />
              <div className="flex-1 grid grid-cols-12 gap-1">
                {months.map((month, i) => {
                  const isCurrentMonth =
                    i === currentMonth && year === currentYear;

                  return (
                    <div
                      key={month}
                      className={cn(
                        "text-xs text-center py-1 rounded transition-colors",
                        isCurrentMonth
                          ? "bg-accent/20 text-accent font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      {month.slice(0, 3)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current week indicator line */}
            <div className="relative">
              {/* Epics */}
              <div className="space-y-3">
                {milestonesData.map((data) => (
                  <div key={data?.id} className="flex items-center gap-4">
                    <div className="w-52 shrink-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            statusColors[
                              data?.status as keyof typeof statusColors
                            ]
                          }
                        >
                          {data?.status.replace("-", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-card-foreground mt-1 truncate">
                        {data?.name}
                      </p>
                    </div>
                    <div className="flex-1 grid grid-cols-12 gap-1 items-center">
                      {monthsGrid.map((_, i) => {
                        if (!data?.createdAt || !data?.targetDate) return null;

                        const startDate = new Date(data.createdAt);
                        const endDate = new Date(data.targetDate);

                        const startYear = startDate.getFullYear();
                        const endYear = endDate.getFullYear();

                        // If the selected year is completely outside the range → render empty
                        if (year < startYear || year > endYear) return null;

                        // Clamp months based on the selected year
                        const startMonthIndex =
                          year === startYear ? startDate.getMonth() : 0;

                        const endMonthIndex =
                          year === endYear ? endDate.getMonth() : 11;

                        const isInRange =
                          i >= startMonthIndex && i <= endMonthIndex;
                        const isStart = i === startMonthIndex;
                        const isEnd = i === endMonthIndex;

                        return (
                          <div key={i} className="h-8 relative">
                            {isInRange && (
                              <div
                                className={cn(
                                  "absolute inset-y-1 inset-x-0",
                                  barColors[
                                    data.status as keyof typeof barColors
                                  ],
                                  isStart && "rounded-l-md",
                                  isEnd && "rounded-r-md",
                                )}
                              >
                                {/* {data.status === "in-progress" && isStart && (
                                  <div
                                    className="absolute inset-y-0 left-0 bg-chart-1 opacity-50 rounded-l-md"
                                    style={{
                                      width: `${data.progress ?? 100}%`,
                                    }}
                                  />
                                )} */}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* <div className="w-12 text-right">
                      <span className="text-xs text-muted-foreground">
                        {calculateProgress(data?.issues?.nodes)}%
                      </span>
                    </div> */}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success" />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-chart-1" />
            <span className="text-xs text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Planned</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
