import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder for Settings' people sections (Team Members, Stakeholders)
// while they load: the section's real heading over a grid of person cards —
// round avatar, name, role — in the same layout as the loaded ones.
export function PeopleCardsSkeleton({
  title,
  icon,
  count = 3,
}: Readonly<{
  title: string;
  icon: ReactNode;
  count?: number;
}>) {
  const bar = "rounded bg-card-foreground/15";
  return (
    <Card
      role="status"
      aria-live="polite"
      className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground"
    >
      <span className="sr-only">Loading {title.toLowerCase()}…</span>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="body font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
              <div className={`${bar} h-14 w-14 rounded-full`} />
              <div className={`${bar} h-3.5 w-28`} />
              <div className={`${bar} h-3 w-20`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
