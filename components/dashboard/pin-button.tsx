"use client";

import { Pin } from "lucide-react";
import { useUser } from "context/UserContext";
import {
  usePinnedPanels,
  usePinPanel,
  useUnpinPanel,
} from "@/hooks/use-pinned-panels";
import type { PinnablePanelId } from "@/lib/pinnable-panels";
import { PINNABLE_PANELS } from "@/lib/pinnable-panels";

export function PinButton({ panelId }: Readonly<{ panelId: PinnablePanelId }>) {
  const { profile } = useUser();
  const userId = profile?.id;

  const { data: pinnedPanels } = usePinnedPanels(userId);
  const pinPanel = usePinPanel(userId);
  const unpinPanel = useUnpinPanel(userId);

  const isPinned = !!pinnedPanels?.some((p) => p.panel_id === panelId);
  const { sourceDashboard } = PINNABLE_PANELS[panelId];

  const handleClick = () => {
    if (!userId) return;
    if (isPinned) {
      unpinPanel.mutate(panelId);
    } else {
      pinPanel.mutate({ panelId, sourceDashboard });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!userId || pinPanel.isPending || unpinPanel.isPending}
      title={isPinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
      className="absolute top-3 right-3 z-10 rounded-md border border-border/40 bg-background/80 p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
    >
      <Pin className={isPinned ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
    </button>
  );
}
