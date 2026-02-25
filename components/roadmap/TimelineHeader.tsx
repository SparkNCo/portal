import { Calendar, ChevronLeft, ChevronRight, Map } from "lucide-react";
import { CardHeader, CardTitle } from "../ui/card";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";

/* =========================
   Constants
========================= */

const months: readonly string[] = [
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

/* =========================
   Types
========================= */

interface TimelineHeaderProps {
  year: number;
  onPrev: () => void;
  onNext: () => void;
}

interface TimelineMonthsHeaderProps {
  year: number;
}

/* =========================
   Components
========================= */

export function TimelineHeader({
  year,
  onPrev,
  onNext,
}: TimelineHeaderProps) {
  return (
    <CardHeader className="flex flex-row justify-between">
      <CardTitle className="flex items-center gap-2">
        <Map className="h-4 w-4 text-accent" />
        Projects Timeline
      </CardTitle>

      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="sm">
          <Calendar className="h-3 w-3 mr-1" />
          {year}
        </Button>

        <Button size="icon" variant="ghost" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );
}

export function TimelineMonthsHeader({
  year,
}: TimelineMonthsHeaderProps) {
  const now = new Date();

  return (
    <div className="flex border-b pb-2 mb-4">
      <div className="w-56" />
      <div className="flex-1 grid grid-cols-12 gap-1">
        {months.map((month, i) => {
          const isCurrentMonth =
            i === now.getMonth() &&
            year === now.getFullYear();

          return (
            <div
              key={month}
              className={cn(
                "text-xs text-center py-1 rounded",
                isCurrentMonth
                  ? "bg-accent/20 text-accent"
                  : "text-muted-foreground"
              )}
            >
              {month.slice(0, 3)}
            </div>
          );
        })}
      </div>
    </div>
  );
}