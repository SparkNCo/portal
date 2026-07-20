import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Milestone } from "@/components/roadmap/roadmap-timeline";

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

const barColors: Record<string, string> = {
  completed: "bg-success",
  done: "bg-success",
  "in-progress": "bg-chart-1",
  planned: "bg-muted-foreground/30",
  overdue: "bg-warning/50",
  unstarted: "bg-accent/50",
  next: "bg-accent/50",
};

const FALLBACK_BAR_COLOR = "bg-muted-foreground/40";

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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <div className="w-full text-sm text-muted-foreground sm:w-52">
          {milestones.length} milestones
        </div>
        <div className="grid grid-cols-12 gap-0.5 sm:flex-1 sm:gap-1" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-full text-sm text-muted-foreground sm:w-52">
        {milestones.length} milestones
      </div>

      <div className="grid grid-cols-12 gap-0.5 sm:flex-1 sm:gap-1">
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
  onSelect?: () => void;
  isSelected?: boolean;
};

export function MilestoneRow({ data, year, onSelect, isSelected }: MilestoneRowProps) {
  const hasRange = !!data.createdAt && !!data.targetDate;
  const start = hasRange ? new Date(data.createdAt) : null;
  const end = hasRange ? new Date(data.targetDate) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 cursor-pointer rounded-md transition-colors sm:flex-row sm:items-center sm:gap-4",
        isSelected && "bg-accent/10",
      )}
      onClick={onSelect}
    >
      <div className="w-full sm:w-52">
        <Badge
          variant="outline"
          className={cn(
            "max-w-full truncate rounded-sm border-white/25 bg-transparent px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white",
            isSelected && "ring-1 ring-offset-1 ring-accent",
          )}
        >
          {data.name}
        </Badge>
      </div>

      <div className="grid grid-cols-12 gap-0.5 sm:flex-1 sm:gap-1">
        {monthsGrid.map((_, i) => {
          const isInRange =
            hasRange &&
            year >= start!.getFullYear() &&
            year <= end!.getFullYear() &&
            i >= (year === start!.getFullYear() ? start!.getMonth() : 0) &&
            i <= (year === end!.getFullYear() ? end!.getMonth() : 11);

          return (
            <div key={i} className="h-8 relative">
              <div
                className={cn(
                  "absolute inset-y-1 inset-x-0 rounded-md",
                  isInRange
                    ? (barColors[data?.status] ?? FALLBACK_BAR_COLOR)
                    : "bg-muted/20",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
