import { ChevronLeft, ChevronRight, Map } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CardHeader, CardTitle } from "../ui/card";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";

/* =========================
   Types
========================= */

// A single cycle column on the timeline's x-axis.
export type TimeBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  isActive: boolean;
};

interface TimelineBucketsHeaderProps {
  buckets: TimeBucket[];
}

/* =========================
   Helpers
========================= */

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* =========================
   Components
========================= */

interface TimelineHeaderProps {
  onPrev: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function TimelineHeader({ onPrev, onNext, canGoBack, canGoForward }: TimelineHeaderProps) {
  return (
    <CardHeader className="flex flex-row flex-wrap justify-between gap-2">
      <CardTitle className="body font-semibold flex items-center gap-2 text-foreground">
        <Map className="h-4 w-4 text-primary" />
        Projects Timeline
      </CardTitle>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onPrev}
          disabled={!canGoBack}
          aria-label="Show earlier cycles"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onNext}
          disabled={!canGoForward}
          aria-label="Show later cycles"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
}

export function TimelineBucketsHeader({ buckets }: TimelineBucketsHeaderProps) {
  return (
    <div className="flex border-b pb-2 mb-4">
      <div className="hidden w-[25ch] shrink-0 sm:block" />
      <div
        className="grid flex-1 gap-px sm:gap-0.5"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map((bucket) => {
          const isCurrent = bucket.isActive;

          return (
            <Tooltip.Provider key={bucket.key} delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    className={cn(
                      "rounded py-1 text-center smalltext cursor-default",
                      isCurrent
                        ? "bg-[#fb923c]/20 text-[#fb923c]"
                        : "text-muted-foreground",
                    )}
                  >
                    {bucket.label}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="center"
                    className="z-50 rounded-md bg-popover text-popover-foreground px-3 py-2 smalltext shadow-md"
                  >
                    {formatDate(bucket.start)} – {formatDate(bucket.end)}
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
