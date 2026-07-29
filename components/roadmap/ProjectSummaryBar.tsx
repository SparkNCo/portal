import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Milestone } from "@/components/roadmap/roadmap-timeline";
import type { ChainedMilestone } from "./ProjectRow";
import { formatDate, type TimeBucket } from "./TimelineHeader";

function CycleTooltipHeader({ bucket, projectName }: { bucket: TimeBucket; projectName: string }) {
  return (
    <div className="mb-1 pb-1 border-b border-border/50">
      <div className="font-medium">
        {bucket.label}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {formatDate(bucket.start)} – {formatDate(bucket.end)}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">{projectName}</div>
    </div>
  );
}

// Color reflects actual completion + due date rather than Linear's own
// `status` field: all scope done → green; still-open scope past its target
// date → orange (overdue); still-open scope not yet due → blue.
function getMilestoneBarColor(m: Milestone): string {
  if (m.progress >= 1) return "bg-success";
  if (m.targetDate && new Date(m.targetDate).getTime() < Date.now()) {
    return "bg-warning/50";
  }
  return "bg-accent/50";
}

type ProjectSummaryBarProps = {
  projectName: string;
  milestones: ChainedMilestone[];
  buckets: TimeBucket[];
  selectedCycleKey?: string | null;
  onCycleClick: (cycleKey: string) => void;
};

export function ProjectSummaryBar({
  projectName,
  milestones,
  buckets,
  selectedCycleKey,
  onCycleClick,
}: ProjectSummaryBarProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-full text-sm text-muted-foreground sm:w-52">
        {milestones.length} milestones
      </div>

      <div
        className="grid gap-0.5 sm:flex-1 sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${buckets.length || 1}, minmax(0, 1fr))` }}
      >
        {buckets.map((bucket) => {
          const milestonesInBucket = milestones.filter((m) => m.cycleIds.has(bucket.key));
          const isInRange = milestonesInBucket.length > 0;
          const isSelected = selectedCycleKey === bucket.key;

          return (
            <Tooltip.Provider key={bucket.key} delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    onClick={() => onCycleClick(bucket.key)}
                    className="h-8 relative cursor-pointer"
                    aria-label={`View issues in ${bucket.label}`}
                  >
                    {isInRange && (
                      <div
                        className={cn(
                          "absolute inset-y-2 inset-x-0 rounded-md bg-accent/40",
                          isSelected && "ring-2 ring-accent",
                        )}
                      />
                    )}
                  </button>
                </Tooltip.Trigger>

                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="center"
                    className="z-50 max-w-xs rounded-md bg-popover px-3 py-2 text-sm shadow-md"
                  >
                    <CycleTooltipHeader bucket={bucket} projectName={projectName} />
                    {milestonesInBucket.length > 0 && (
                      <div className="space-y-2">
                        {milestonesInBucket.map((m) => (
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
                    )}
                    <Tooltip.Arrow className="fill-popover" />
                  </Tooltip.Content>
                </Tooltip.Portal>
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
  cycleIds: Set<string>;
  buckets: TimeBucket[];
  selectedCycleKey?: string | null;
  onCycleClick: (cycleKey: string) => void;
};

export function MilestoneRow({
  data,
  cycleIds,
  buckets,
  selectedCycleKey,
  onCycleClick,
}: MilestoneRowProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md transition-colors sm:flex-row sm:items-center sm:gap-4">
      <div className="w-full sm:w-52">
        {data.name && (
          <Badge
            variant="outline"
            className="max-w-full truncate rounded-sm border-white/25 bg-transparent px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white"
          >
            {data.name}
          </Badge>
        )}
      </div>

      <div
        className="grid gap-0.5 sm:flex-1 sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${buckets.length || 1}, minmax(0, 1fr))` }}
      >
        {buckets.map((bucket) => {
          const isInRange = cycleIds.has(bucket.key);
          const isSelected = selectedCycleKey === bucket.key;

          return (
            <Tooltip.Provider key={bucket.key} delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    onClick={() => onCycleClick(bucket.key)}
                    className="h-8 relative cursor-pointer"
                    aria-label={`View ${data.name || "milestone"} issues in ${bucket.label}`}
                  >
                    <div
                      className={cn(
                        "absolute inset-y-1 inset-x-0 rounded-md",
                        isInRange ? getMilestoneBarColor(data) : "bg-muted/20",
                        isSelected && "ring-2 ring-accent",
                      )}
                    />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="center"
                    className="z-50 max-w-xs rounded-md bg-popover px-3 py-2 text-sm shadow-md"
                  >
                    <CycleTooltipHeader bucket={bucket} projectName={data.projectName} />
                    {data.name && (
                      <div className="flex flex-col">
                        <span className="font-medium">{data.name}</span>
                        <span className="text-xs text-muted-foreground">{data.status}</span>
                      </div>
                    )}
                    <Tooltip.Arrow className="fill-popover" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          );
        })}
      </div>
    </div>
  );
}
