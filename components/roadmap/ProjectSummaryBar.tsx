import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Milestone, type MilestoneStatus } from "@/components/roadmap/roadmap-timeline";
import type { ChainedMilestone } from "./ProjectRow";
import { formatDate, type TimeBucket } from "./TimelineHeader";

// Only the very first character gets capitalized — the rest of the name is
// left exactly as stored (e.g. acronyms), unlike CSS `capitalize` which
// would title-case every word.
function capitalizeFirst(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function CycleTooltipHeader({ bucket, projectName }: { bucket: TimeBucket; projectName: string }) {
  return (
    <div className="mb-1 pb-1 border-b border-popover-foreground/10">
      <div className="font-medium">
        {bucket.label}
        <span className="ml-1.5 font-normal text-popover-foreground/60">
          {formatDate(bucket.start)} – {formatDate(bucket.end)}
        </span>
      </div>
      <div className="smalltext text-popover-foreground/60">{projectName}</div>
    </div>
  );
}

// Keyed on Linear's own milestone `status`, not a progress/date heuristic —
// "unstarted", "next", "planned", and "in-progress" all used to collapse
// into the same default color since only completion% + due date were
// checked. Each status now gets its own color, reusing the same hues as
// the "Issues by Status" chart (CHART_STATUS_COLORS in issues.types.ts) so
// the same concept reads as the same color across both views: next ~ UAT's
// teal, planned ~ QA's blue, unstarted ~ Planning's yellow — kept as
// real colors rather than a neutral gray, so every status stays readable at
// a glance on the timeline. overdue moved off warning (too close to
// in-progress's orange) onto destructive, matching how Canceled/Blocked
// read in the issues chart.
const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, string> = {
  completed: "bg-success",
  "in-progress": "bg-primary/50",
  overdue: "bg-destructive/50",
  next: "bg-[hsl(180,60%,50%)]/50",
  planned: "bg-[hsl(210,70%,55%)]/50",
  unstarted: "bg-[hsl(43,74%,66%)]/50",
};

function getMilestoneBarColor(m: Milestone): string {
  return MILESTONE_STATUS_COLOR[m.status] ?? "bg-card/50";
}

// Most-urgent-first: if any milestone landing in this cycle bucket is
// overdue, that should win over a merely "next" or "planned" one, etc. Only
// shows completed's green when every milestone in the bucket is done.
const MILESTONE_STATUS_PRIORITY: MilestoneStatus[] = [
  "overdue",
  "in-progress",
  "next",
  "planned",
  "unstarted",
  "completed",
];

function getBucketColor(milestonesInBucket: ChainedMilestone[]): string {
  const statusesPresent = new Set(milestonesInBucket.map((m) => m.status));
  const leadStatus = MILESTONE_STATUS_PRIORITY.find((s) => statusesPresent.has(s));
  return leadStatus ? MILESTONE_STATUS_COLOR[leadStatus] : "bg-card/50";
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
      <div className="hidden shrink-0 sm:block sm:w-[25ch]" />

      <div
        className="grid gap-px sm:flex-1 sm:gap-0.5"
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
                          "absolute inset-y-2 inset-x-0 rounded-md",
                          getBucketColor(milestonesInBucket),
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
                    className="z-50 max-w-xs rounded-md bg-popover text-popover-foreground px-3 py-2 smalltext shadow-md"
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
                            <span className="smalltext text-popover-foreground/60">
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
  isWholeMilestoneSelected?: boolean;
  onCycleClick: (cycleKey: string) => void;
  // Undefined for the placeholder milestone used by projects with none yet
  // (no real name/id to select by), so the name isn't rendered as clickable.
  onMilestoneClick?: () => void;
};

export function MilestoneRow({
  data,
  cycleIds,
  buckets,
  selectedCycleKey,
  isWholeMilestoneSelected,
  onCycleClick,
  onMilestoneClick,
}: MilestoneRowProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md transition-colors sm:flex-row sm:items-center sm:gap-4">
      <div className="w-full shrink-0 sm:w-[25ch]">
        {data.name && (
          <button
            type="button"
            onClick={onMilestoneClick}
            title={data.name}
            aria-label={`View all issues in ${data.name}`}
            className="block w-full max-w-full min-w-0 text-left"
          >
            <Badge
              variant="outline"
              className={cn(
                "max-w-full min-w-0 rounded-sm bg-card/90 px-3 py-1 smalltext font-semibold text-card-foreground transition-colors hover:bg-card",
                isWholeMilestoneSelected ? "border-primary" : "border-transparent",
              )}
            >
              <span className="block min-w-0 truncate">{capitalizeFirst(data.name)}</span>
            </Badge>
          </button>
        )}
      </div>

      <div
        className="grid gap-px sm:flex-1 sm:gap-0.5"
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
                        isInRange ? getMilestoneBarColor(data) : "bg-transparent",
                        isSelected && "ring-2 ring-accent",
                      )}
                    />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="center"
                    className="z-50 max-w-xs rounded-md bg-popover text-popover-foreground px-3 py-2 smalltext shadow-md"
                  >
                    <CycleTooltipHeader bucket={bucket} projectName={data.projectName} />
                    {data.name && (
                      <div className="flex flex-col">
                        <span className="font-medium">{data.name}</span>
                        <span className="smalltext text-popover-foreground/60">{data.status}</span>
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
