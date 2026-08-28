"use client";

import { Maximize2, Minimize2 } from "lucide-react";

// The orange accent bar + expand/shrink toggle button repeated identically
// across every modal built on the "wide on desktop, expandable" pattern
// (EditIssueModal, EditDeveloperProfileModal, DeveloperDetailsModal) — kept
// in one place so the visual chrome (and its a11y labels) can't drift
// between them. Meant to sit as the first children inside a Dialog's
// DialogContent, right before the DialogHeader.
export function ExpandableDialogChrome({
  isExpanded,
  onToggleExpanded,
}: {
  readonly isExpanded: boolean;
  readonly onToggleExpanded: () => void;
}) {
  return (
    <>
      {/* Orange accent bar ties the modal back to the card it was opened from. */}
      <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      {/* Positioned to match DialogContent's own close button (absolute
          right-4 top-4) exactly — sitting it inline in the header row
          instead left it vertically offset from the X, since that row's
          baseline follows the title's line-height rather than the fixed
          corner the X is pinned to. */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className="hidden lg:inline-flex absolute right-10 top-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isExpanded ? "Shrink modal" : "Expand modal"}
        title={isExpanded ? "Shrink" : "Expand"}
      >
        {isExpanded ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
