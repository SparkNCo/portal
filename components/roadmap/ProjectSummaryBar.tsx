import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Milestone, MilestoneStatus } from "@/components/roadmap/roadmap-timeline";

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

const statusColors: Record<MilestoneStatus, string> = {
  completed: "bg-success/20 border-success/40 text-success",
  "in-progress": "bg-chart-1/20 border-chart-1/40 text-chart-1",
  planned: "bg-muted border-border text-muted-foreground",
  overdue: "bg-warning/20 border-border text-warning",
  unstarted: "bg-accent/20 border-accent/40 text-accent",
  next: "bg-accent/20 border-accent/40 text-accent",
};

const barColors = {
  completed: "bg-success",
  "in-progress": "bg-chart-1",
  planned: "bg-muted-foreground/30",
  overdue: "bg-warning/50",
  unstarted: "bg-accent/50",
  next: "bg-accent/50",
};

type ProjectRange = {
  start: Date;
  end: Date;
} | null;

type ProjectSummaryBarProps = {
  milestones: Milestone[];
  range: ProjectRange;
  year: number;
};

export function ProjectSummaryBar({
  milestones,
  range,
  year,
}: ProjectSummaryBarProps) {
  if (!range) {
    return (
      <div className="flex items-center gap-4">
        <div className="w-52 text-sm text-muted-foreground">
          {milestones.length} milestones
        </div>
        <div className="flex-1 grid grid-cols-12 gap-1" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <div className="w-52 text-sm text-muted-foreground">
        {milestones.length} milestones
      </div>

      <div className="flex-1 grid grid-cols-12 gap-1">
        {monthsGrid.map((_, i) => {
          const startYear = range?.start.getFullYear();
          const endYear = range?.end.getFullYear();

          if (year < startYear || year > endYear) return <div key={i} />;

          const startMonth = year === startYear ? range.start.getMonth() : 0;
          const endMonth = year === endYear ? range.end.getMonth() : 11;

          const isInRange = i >= startMonth && i <= endMonth;

          // Month boundaries
          const monthStart = new Date(year, i, 1);
          const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);

          const milestonesInMonth = milestones.filter((m) => {
            if (!m.targetDate) return false;

            const target = new Date(m.targetDate);

            return (
              target >= monthStart &&
              target <= monthEnd &&
              target >= range.start &&
              target <= range.end
            );
          });

          return (
            <Tooltip.Provider key={i} delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div className="h-8 relative cursor-pointer">
                    {isInRange && (
                      <div className="absolute inset-y-2 inset-x-0 bg-accent/40 rounded-md" />
                    )}
                  </div>
                </Tooltip.Trigger>

                {milestonesInMonth.length > 0 && (
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      align="center"
                      className="z-50 max-w-xs rounded-md bg-popover px-3 py-2 text-sm shadow-md"
                    >
                      <div className="space-y-2">
                        {milestonesInMonth.map((m) => (
                          <div
                            key={m?.projectName + m?.status}
                            className="flex flex-col"
                          >
                            <span className="font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {m.status}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Tooltip.Arrow className="fill-popover" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                )}
              </Tooltip.Root>
            </Tooltip.Provider>
          );
        })}
      </div>
    </div>
  );
}

type MilestoneRowProps = {
  data: Milestone;
  year: number;
};

export function MilestoneRow({ data, year }: MilestoneRowProps) {
  if (!data.createdAt || !data.targetDate) return null;

  const start = new Date(data.createdAt);
  const end = new Date(data.targetDate);

  return (
    <div className="flex items-center gap-4">
      <div className="w-52">
        <Badge variant="outline" className={statusColors[data?.status]}>
          {data.name}
        </Badge>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-1 ">
        {monthsGrid.map((_, i) => {
          if (year < start.getFullYear() || year > end.getFullYear())
            return null;

          const startMonth =
            year === start.getFullYear() ? start.getMonth() : 0;
          const endMonth = year === end.getFullYear() ? end.getMonth() : 11;

          const isInRange = i >= startMonth && i <= endMonth;

          return (
            <div
              key={i}
              className="h-8 relative "
              onClick={() => {}}
            >
              {isInRange && (
                <div
                  className={cn(
                    "absolute inset-y-1 inset-x-0 rounded-md",
                    barColors[data?.status],
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
