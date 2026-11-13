"use client";

import type React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelExpanded } from "@/hooks/use-user-layout";
import { PinButton } from "@/components/dashboard/pin-button";
import type { PinnablePanelId } from "@/lib/pinnable-panels";

export const panelActionButtonClass =
  "rounded-md border border-border/40 bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50";

// The grid's two-column breakpoint: where the expand button starts doing
// anything (below it every panel is already full width), and so where it
// shows. Spelled out so Tailwind sees the class names.
const EXPAND_FROM = {
  md: { span: "md:col-span-2", button: "hidden md:inline-block", room: "md:pt-12" },
  lg: { span: "lg:col-span-2", button: "hidden lg:inline-block", room: "lg:pt-12" },
} as const;

// A panel on a page other than the Dashboard (Build, Monitor) that sits in a
// two-column grid: the same top-right toolbar as the Dashboard's panels,
// with the expand button (full page width ↔ half) and, for panels that can
// be pinned, the pin. The width is each user's own and is kept per page
// (hooks/use-user-layout.ts, portal.user_layout.expanded_panels); the
// Dashboard's own pinned panels keep theirs in pinned_panels.full_width.
export function PagePanel({
  page,
  panelId,
  pinnable = true,
  expandFrom = "md",
  className,
  contentClassName,
  children,
}: Readonly<{
  page: string;
  panelId: string;
  // Off for panels that only exist inside another one (e.g. Metrics' charts).
  pinnable?: boolean;
  expandFrom?: keyof typeof EXPAND_FROM;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}>) {
  const { expanded, toggle } = usePanelExpanded(page, panelId);
  const breakpoint = EXPAND_FROM[expandFrom];

  return (
    <div className={cn("relative", expanded && breakpoint.span, className)}>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {/* Only does anything once the grid has 2 columns, so hidden below
            that, like on the Dashboard. */}
        <button
          type="button"
          onClick={toggle}
          title={expanded ? "Shrink to half width" : "Expand to full width"}
          aria-label={expanded ? "Shrink to half width" : "Expand to full width"}
          aria-pressed={expanded}
          className={cn(breakpoint.button, panelActionButtonClass)}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        {pinnable && <PinButton panelId={panelId as PinnablePanelId} inline />}
      </div>
      {/* Room above the content for the toolbar: always with the pin; with
          only the expand button, just where it shows. */}
      <div className={cn(pinnable ? "pt-12" : breakpoint.room, contentClassName)}>{children}</div>
    </div>
  );
}
