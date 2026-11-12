"use client";

import type React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelExpanded } from "@/hooks/use-user-layout";
import { PinButton } from "@/components/dashboard/pin-button";
import type { PinnablePanelId } from "@/lib/pinnable-panels";

export const panelActionButtonClass =
  "rounded-md border border-border/40 bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50";

// A panel on a page other than the Dashboard (Build, Monitor) that sits in a
// two-column grid: the same top-right toolbar as the Dashboard's panels,
// with the expand button (full page width ↔ half) and the pin. The width is
// each user's own and is kept per page (hooks/use-user-layout.ts,
// portal.user_layout.expanded_panels); the Dashboard keeps its own in
// pinned_panels.full_width.
export function PagePanel({
  page,
  panelId,
  className,
  contentClassName,
  children,
}: Readonly<{
  page: string;
  panelId: PinnablePanelId;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}>) {
  const { expanded, toggle } = usePanelExpanded(page, panelId);

  return (
    <div className={cn("relative", expanded && "md:col-span-2", className)}>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {/* Only does anything once the grid has 2 columns (md and up), so
            hidden below that, like on the Dashboard. */}
        <button
          type="button"
          onClick={toggle}
          title={expanded ? "Shrink to half width" : "Expand to full width"}
          aria-label={expanded ? "Shrink to half width" : "Expand to full width"}
          aria-pressed={expanded}
          className={cn("hidden md:inline-block", panelActionButtonClass)}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <PinButton panelId={panelId} inline />
      </div>
      <div className={cn("pt-12", contentClassName)}>{children}</div>
    </div>
  );
}
