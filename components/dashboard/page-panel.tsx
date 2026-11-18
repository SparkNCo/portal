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
  expandable = true,
  expandFrom = "md",
  toolbar = "above",
  cornerClassName = "top-2.5 right-3",
  className,
  contentClassName,
  children,
}: Readonly<{
  // "above": a strip above the panel holds the buttons. "inside": they sit
  // in the panel's own top-right corner, level with its title, with no strip
  // (the panel leaves room for them; see PriorityTasks' reserveTopRight).
  toolbar?: "above" | "inside";
  // With toolbar="inside": where in the corner, level with the panel's title
  // (cards with the default p-6 header: "top-6 right-6").
  cornerClassName?: string;
  page: string;
  panelId: string;
  // Off for panels that only exist inside another one (e.g. Metrics' charts).
  pinnable?: boolean;
  // Off for panels that are always full width (no two-column grid around
  // them, e.g. Build's rows), where the expand button would do nothing.
  expandable?: boolean;
  expandFrom?: keyof typeof EXPAND_FROM;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}>) {
  const { expanded, toggle } = usePanelExpanded(page, panelId);
  const breakpoint = EXPAND_FROM[expandFrom];
  // Room above the content for the toolbar: none when it's inside the panel;
  // otherwise always with the pin, and with only the expand button just
  // where it shows.
  let contentRoom = "";
  if (toolbar === "above" && pinnable) contentRoom = "pt-12";
  else if (toolbar === "above" && expandable) contentRoom = breakpoint.room;

  return (
    <div className={cn("relative", expandable && expanded && breakpoint.span, className)}>
      <div className={cn("absolute z-10 flex items-center gap-1.5", toolbar === "inside" ? cornerClassName : "top-3 right-3")}>
        {/* Only does anything once the grid has 2 columns, so hidden below
            that, like on the Dashboard. */}
        {expandable && (
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
        )}
        {pinnable && <PinButton panelId={panelId as PinnablePanelId} inline />}
      </div>
      <div className={cn(contentRoom, contentClassName)}>{children}</div>
    </div>
  );
}
