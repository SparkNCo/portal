import type { IssueViewMode } from "./issues.types";

// Placeholders shown while tickets load, shaped like what's about to appear
// (a card, a list row, or board columns) so the page doesn't jump when they
// arrive — and so an empty list isn't mistaken for "no tickets".

function Bar({ className }: Readonly<{ className: string }>) {
  return <div className={`rounded bg-muted-foreground/20 ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Bar className="h-3 w-16" />
        <Bar className="h-4 w-14 rounded-full" />
      </div>
      <Bar className="h-3.5 w-11/12" />
      <Bar className="h-3.5 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Bar className="h-4 w-16 rounded-full" />
        <Bar className="h-4 w-20 rounded-full" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2">
      <Bar className="h-3 w-14 shrink-0" />
      <Bar className="h-3.5 flex-1" />
      <Bar className="h-4 w-16 shrink-0 rounded-full" />
    </div>
  );
}

export function IssueSkeletons({
  view = "grid",
  count,
}: Readonly<{
  view?: IssueViewMode;
  /** How many placeholders (cards, rows, or cards per board column). */
  count?: number;
}>) {
  const items = (n: number) => Array.from({ length: n }, (_, i) => i);

  let content: React.ReactNode;
  if (view === "list") {
    content = (
      <div className="flex flex-col gap-0.5 pt-3">
        {items(count ?? 6).map((i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    );
  } else if (view === "board") {
    content = (
      <div className="flex gap-3 overflow-hidden pt-3 pb-2">
        {items(4).map((column) => (
          <div key={column} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/30 p-2">
            <Bar className="h-4 w-24 rounded-full" />
            {items(count ?? 2).map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    );
  } else {
    content = (
      <div className="grid gap-2 pt-3 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {items(count ?? 6).map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading tickets…</span>
      {content}
    </div>
  );
}
